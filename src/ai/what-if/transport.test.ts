import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { createWhatIfHandler } from './server.ts'
import { createWhatIfGeminiProvider } from './gemini.ts'
import { createModelWhatIfProvider } from './model-provider.ts'
import { mockServerProvider } from './mock-server-provider.ts'
import { createHttpWhatIfProvider } from '../../../mobile_app/src/game/what-if-ai/http-provider.ts'
import type { WhatIfProvider } from '../../../mobile_app/src/game/what-if-ai/orchestrator.ts'
import { parameterAlternativeId, parameterQuestion } from '../../../mobile_app/src/game/what-if-ai/orchestrator.ts'
import type { WhatIfDecision } from '../../../mobile_app/src/game/what-if-ai/orchestrator.ts'

const catalog = [{ kind: 'gold', decisionId: 'gold:4', alternativeId: 'skip', lap: 1, turn: 1 }] as const
const input = { operation: 'propose', question: 'Nếu tôi bỏ mua vàng thì sao?', catalog }
async function host(provider: WhatIfProvider, options: Parameters<typeof createWhatIfHandler>[1] = {}) {
  const server = createServer(createWhatIfHandler(provider, options))
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  const origin = `http://127.0.0.1:${address.port}`
  return { origin, close: () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()) }),
    post: (body: unknown, headers: Record<string, string> = {}) => fetch(origin + '/api/what-if-provider', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'X-What-If-Request': '1', ...headers }, body: JSON.stringify(body),
    }) }
}

test('actual HTTP mock transport selects a catalog ID and grounds explanation without transmitting game history', async () => {
  const server = await host(mockServerProvider)
  const sent: unknown[] = []
  const transport: typeof fetch = async (_url, request) => {
    sent.push(JSON.parse(String(request?.body)))
    return fetch(server.origin + '/api/what-if-provider', { ...request, headers: { ...request?.headers, Origin: server.origin } })
  }
  try {
    const provider = createHttpWhatIfProvider(transport), signal = new AbortController().signal
    assert.deepEqual(await provider.propose({ question: input.question, catalog: [...catalog] }, signal), { decisionId: 'gold:4', alternativeId: 'skip' })
    assert.deepEqual(await provider.explain({ kind: 'gold', direction: 'up', confirmedFollowUp: true }, signal), { claimId: 'gold-up' })
    assert.deepEqual(sent[0], input)
    assert(!JSON.stringify(sent).includes('snapshot'))
    assert(!JSON.stringify(sent).includes('104006'))
  } finally { await server.close() }
})

test('exact schemas, privacy exclusions, same-origin gate, payload cap, and local call budgets fail closed', async () => {
  let calls = 0
  const server = await host({ ...mockServerProvider, propose: async (...args) => { calls++; return mockServerProvider.propose(...args) } }, { maxRequests: 20, maxCalls: 1 })
  try {
    for (const invalid of [{ ...input, save: {} }, { ...input, question: 'mail a@b.com' }, { ...input, question: '0987654321' },
      { ...input, catalog: [{ ...catalog[0], amount: 42 }] }, { ...input, catalog: [catalog[0], catalog[0]] }, { ...input, question: 'a'.repeat(9000) }]) {
      assert.equal((await server.post(invalid)).status, 400)
    }
    assert.equal((await server.post(input, { Origin: 'http://other.example' })).status, 403)
    assert.equal(calls, 0)
    assert.equal((await server.post(input)).status, 200)
    assert.equal((await server.post(input)).status, 429)
    assert.equal(calls, 1)
  } finally { await server.close() }
})

test('DEV HTTP client preserves the default throttle as a distinct error after twelve requests', async () => {
  const server = await host(mockServerProvider)
  try {
    for (let i = 0; i < 12; i++) assert.equal((await server.post(input)).status, 200)
    const transport: typeof fetch = (_url, request) => fetch(server.origin + '/api/what-if-provider', {
      ...request, headers: { ...request?.headers, Origin: server.origin },
    })
    const provider = createHttpWhatIfProvider(transport)
    await assert.rejects(provider.propose({ question: input.question, catalog: [...catalog] }, new AbortController().signal), { code: 'RATE_LIMITED' })
  } finally { await server.close() }
})

test('unknown provider IDs, extra monetary data and internal errors never cross the response boundary', async () => {
  for (const raw of [{ decisionId: 'gold:999', alternativeId: 'skip' }, { decisionId: 'gold:4', alternativeId: 'skip', cash: 104006 },
    new Error('PRIVATE_CREDENTIAL_VALUE')]) {
    const server = await host({ ...mockServerProvider, propose: async () => { if (raw instanceof Error) throw raw; return raw } })
    try {
      const response = await server.post(input), body = await response.text()
      assert(response.status >= 400)
      assert(!/PRIVATE_CREDENTIAL_VALUE|104006|gold:999/.test(body))
    } finally { await server.close() }
  }
})

test('ambiguous proposals remain explicit and a provider ignoring AbortSignal is bounded by the server deadline', async () => {
  const server = await host(createModelWhatIfProvider(() => new Promise(() => {})), { deadlineMs: 20 })
  try {
    const response = await server.post(input)
    assert.equal(response.status, 504)
    assert.deepEqual(await response.json(), { error: 'PROVIDER_TIMEOUT' })
  } finally { await server.close() }
  const ambiguous = await host({ ...mockServerProvider, propose: async () => ({ status: 'ambiguous' }) })
  try { assert.deepEqual(await (await ambiguous.post(input)).json(), { status: 'ambiguous' }) }
  finally { await ambiguous.close() }
})

test('Gemini adapter is disabled without explicit access and traffic approval, and validates a mocked Gemini HTTP response', async () => {
  let calls = 0
  const transport: typeof fetch = async (_url, request) => {
    calls++
    const body = JSON.parse(String(request?.body))
    assert.equal(body.generationConfig.maxOutputTokens, 256)
    assert(body.generationConfig.responseFormat.text.schema.anyOf)
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ decisionId: 'gold:4', alternativeId: 'skip' }) }] } }] })
  }
  const options = { model: 'gemini-configured-model', apiKey: 'test-only', fetch: transport }
  const signal = new AbortController().signal
  await assert.rejects(createWhatIfGeminiProvider(options).propose({ question: input.question, catalog: [...catalog] }, signal))
  assert.equal(calls, 0)
  const provider = createWhatIfGeminiProvider({ ...options, accessApproved: true, allowLiveTraffic: true })
  assert.deepEqual(await provider.propose({ question: input.question, catalog: [...catalog] }, signal), { decisionId: 'gold:4', alternativeId: 'skip' })
  assert.equal(calls, 1)
})

test('parallel HTTP requests reserve the two available provider slots before reading their bodies', async () => {
  const releases: (() => void)[] = []
  const server = await host({ ...mockServerProvider, propose: async () => {
    await new Promise<void>(resolve => releases.push(resolve))
    return { decisionId: 'gold:4', alternativeId: 'skip' }
  } })
  try {
    const one = server.post(input), two = server.post(input)
    for (let i = 0; i < 100 && releases.length < 2; i++) await new Promise(resolve => setTimeout(resolve, 5))
    assert.equal(releases.length, 2)
    assert.equal((await server.post(input)).status, 429)
    releases.forEach(resolve => resolve())
    assert.equal((await one).status, 200)
    assert.equal((await two).status, 200)
  } finally { releases.forEach(resolve => resolve()); await server.close() }
})

test('mock HTTP validates all new asset and Advanced catalog tuples and grounded claim IDs', async () => {
  const server = await host(mockServerProvider, { maxRequests: 20 })
  try {
    for (const [kind, alternativeId, question] of [
      ['stocks', 'buy-stocks', 'Mua cổ phiếu'], ['bonds', 'buy-bonds:but-pha', 'Mua trái phiếu Bứt Phá'],
      ['business', 'upgrade-business:budget', 'Nâng cấp giá cả hợp lý'], ['advanced', 'course-advanced', 'Học khóa nâng cao'],
    ]) {
      const catalog = [{ kind, decisionId: `${kind}:7`, alternativeId, lap: 1, turn: 2 }]
      assert.deepEqual(await (await server.post({ operation: 'propose', question, catalog })).json(), {
        status: 'proposal', decisionId: `${kind}:7`, alternativeId,
      })
      assert.deepEqual(await (await server.post({ operation: 'explain', facts: { kind, direction: 'down', confirmedFollowUp: true } })).json(), {
        claimId: `${kind}-down`,
      })
      assert.equal((await server.post({ operation: 'propose', question, catalog: [{ ...catalog[0], alternativeId: 'INVALID' }] })).status, 400)
    }
  } finally { await server.close() }
})

test('mock HTTP carries only user-selected scalar parameters and refuses missing or mismatched numbers', async () => {
  const server = await host(mockServerProvider, { maxRequests: 20 })
  try {
    for (const [kind, parameters] of [
      ['stocks', { operation: 'buy', symbolId: 'CMG', amount: 7_250_000 }],
      ['stocks', { operation: 'sell', symbolId: 'FPT', amount: 1_234_567 }],
      ['bonds', { operation: 'buy', issuerId: 'but-pha', amount: 7_250_000 }],
      ['bonds', { operation: 'sell', lotId: 'bond-2', amount: 750_000 }],
      ['bank', { operation: 'deposit', amount: 1_234_567, term: 3 }],
    ] as const) {
      const choice: WhatIfDecision = { kind, decisionId: `${kind}:7`, alternativeId: parameterAlternativeId(kind, parameters)!, lap: 1, turn: 2, parameters }
      const body = { operation: 'propose', question: parameterQuestion(choice), catalog: [choice] }
      assert.deepEqual(await (await server.post(body)).json(), { status: 'proposal', decisionId: choice.decisionId, alternativeId: choice.alternativeId })
      assert.deepEqual(await (await server.post({ ...body, question: 'Tôi nên chọn gì?' })).json(), { status: 'ambiguous' })
      assert.equal((await server.post({ ...body, catalog: [{ ...choice, parameters: { ...parameters, amount: 99 } }] })).status, 400)
    }
  } finally { await server.close() }
})

test('large explicit catalog amounts keep the question privacy gate for unrelated phone numbers', async () => {
  const server = await host(mockServerProvider)
  try {
    const parameters = { operation: 'deposit', amount: 123_456_789, term: 2 } as const
    const choice: WhatIfDecision = { kind: 'bank', decisionId: 'bank:36', alternativeId: parameterAlternativeId('bank', parameters)!, lap: 2, turn: 9, parameters }
    const body = { operation: 'propose', question: parameterQuestion(choice), catalog: [choice] }
    assert.equal((await server.post(body)).status, 200)
    assert.equal((await server.post({ ...body, question: body.question + ' liên hệ 0987654321' })).status, 400)
    assert.equal((await server.post({ ...body, question: 'Số tiền 987654321 tại quyết định 36' })).status, 400)
  } finally { await server.close() }
})

test('natural-language HTTP intake returns untrusted intent only and fails closed on hallucinated response fields', async () => {
  const server = await host(mockServerProvider)
  try {
    const response = await server.post({ operation: 'interpret', question: 'Nếu tôi mua CMG 7,25 triệu lần đầu thì sao?' })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { status: 'intent', intent: { kind: 'stocks', action: 'buy', occurrence: 'first', amount: 7_250_000, symbolId: 'CMG' } })
    assert.equal((await server.post({ operation: 'interpret', question: 'mua CMG', save: {} })).status, 400)
    assert.equal((await server.post({ operation: 'interpret', question: 'mua CMG liên hệ 0987654321' })).status, 400)
  } finally { await server.close() }
  const invalid = await host({ ...mockServerProvider, interpret: async () => ({ status: 'intent', intent: { kind: 'stocks', action: 'buy', decisionId: 'stocks:999' } }) })
  try {
    const response = await invalid.post({ operation: 'interpret', question: 'Mua CMG 1 triệu' })
    assert.equal(response.status, 503)
    assert(!/999|stocks/.test(await response.text()))
  } finally { await invalid.close() }
})

test('HTTP rejects coerced enums, invented financial parameters and foreign explanation claims', async () => {
  let raw: unknown = { status: ['ambiguous'] }
  const server = await host({ ...mockServerProvider, interpret: async () => raw, propose: async () => raw })
  try {
    const intake = (question: string) => server.post({ operation: 'interpret', question })
    assert.equal((await intake('Mua CMG')).status, 503)
    raw = { status: 'intent', intent: { kind: 'stocks', action: 'buy', symbolId: 'CMG', amount: 2_750_000 } }
    assert.equal((await intake('Mua CMG tại quyết định 14')).status, 503)
    assert.equal((await intake('Mua CMG với 2,75 triệu')).status, 200)
    assert.equal((await intake('Mua CMG với 3 triệu')).status, 503)
    raw = { status: 'intent', intent: { kind: 'bank', action: 'deposit', amount: 2_750_000, term: 2 } }
    assert.equal((await intake('Gửi tiết kiệm 2,75 triệu')).status, 503)
    assert.equal((await intake('Gửi tiết kiệm 2,75 triệu kỳ hạn 2')).status, 200)
    raw = { status: 'intent', intent: { kind: 'bank', action: 'deposit', term: 2 } }
    assert.equal((await intake('Gửi tiết kiệm kỳ hạn 2,5 START')).status, 503)
    assert.equal((await intake('Gửi tiết kiệm 1.2 START')).status, 503)
    assert.equal((await server.post(input)).status, 503)
    assert.equal((await server.post({ operation: 'explain', facts: { kind: 'gold', direction: ['up'], confirmedFollowUp: true } })).status, 400)
  } finally { await server.close() }

  const facts = { kind: 'gold', direction: 'up', confirmedFollowUp: true } as const
  const provider = createHttpWhatIfProvider(async () => Response.json({ claimId: 'bank-up' }))
  await assert.rejects(provider.explain(facts, new AbortController().signal), { code: 'OUTPUT_REJECTED' })
})

test('simulated model handles Vietnamese paraphrases, omissions and ambiguity over the three HTTP operations', async () => {
  const first = 'Thử chuyển lần gửi đầu thành 2,75 triệu trong 2 START thì kết quả ra sao?'
  const last = 'Nếu bỏ lần rót tiền mua vàng cuối cùng thì kết quả thay đổi thế nào?'
  const simulate = createModelWhatIfProvider(async request => {
    if (request.operation === 'explain') return '{"claimId":"gold-up"}'
    if (request.operation === 'propose') return '{"decisionId":"gold:4","alternativeId":"skip"}'
    if (request.question === first) return '{"status":"intent","intent":{"kind":"bank","action":"deposit","occurrence":"first","amount":2750000,"term":2}}'
    if (request.question === last) return '{"status":"intent","intent":{"kind":"gold","action":"skip","occurrence":"last","originalAction":"buy"}}'
    if (request.question === 'Thử mua thêm cổ phiếu CMG') return '{"status":"intent","intent":{"kind":"stocks","action":"buy","symbolId":"CMG"}}'
    return '{"status":"ambiguous"}'
  })
  const server = await host(simulate)
  try {
    const interpret = async (question: string) => (await server.post({ operation: 'interpret', question })).json()
    assert.deepEqual(await interpret(first), { status: 'intent', intent: { kind: 'bank', action: 'deposit', occurrence: 'first', amount: 2_750_000, term: 2 } })
    assert.deepEqual(await interpret(last), { status: 'intent', intent: { kind: 'gold', action: 'skip', occurrence: 'last', originalAction: 'buy' } })
    assert.deepEqual(await interpret('Thử mua thêm cổ phiếu CMG'), { status: 'intent', intent: { kind: 'stocks', action: 'buy', symbolId: 'CMG' } })
    assert.deepEqual(await interpret('Thử đổi lựa chọn hôm đó'), { status: 'ambiguous' })
    assert.deepEqual(await (await server.post(input)).json(), { status: 'proposal', decisionId: 'gold:4', alternativeId: 'skip' })
    assert.deepEqual(await (await server.post({ operation: 'explain', facts: { kind: 'gold', direction: 'up', confirmedFollowUp: true } })).json(), { claimId: 'gold-up' })
  } finally { await server.close() }
})

test('simulated model rejects malformed or oversized JSON, hallucinated IDs and financial explanations', async () => {
  const signal = new AbortController().signal
  const facts = { kind: 'gold', direction: 'up', confirmedFollowUp: true } as const
  const propose = { question: input.question, catalog: [...catalog] }
  for (const raw of ['{', '```json\n{}\n```', 'ệ'.repeat(2048), '{"decisionId":"gold:999","alternativeId":"skip"}',
    '{"decisionId":"gold:4","alternativeId":"buy-gold"}', '{"decisionId":"gold:4","alternativeId":"skip","cash":42}']) {
    await assert.rejects(createModelWhatIfProvider(async () => raw).propose(propose, signal), { code: 'OUTPUT_REJECTED' })
  }
  for (const raw of ['{"claimId":"gold-up","event":"Tăng lương 42 VND"}', '{"claimId":"gold-down"}', '{"claimId":["gold-up"]}']) {
    await assert.rejects(createModelWhatIfProvider(async () => raw).explain(facts, signal), { code: 'OUTPUT_REJECTED' })
  }
  const invalid = createModelWhatIfProvider(async () => '{"status":"intent","intent":{"kind":"bank","action":"deposit","term":4}}')
  await assert.rejects(invalid.interpret({ question: 'Gửi ngân hàng 4 START' }, signal), { code: 'OUTPUT_REJECTED' })
  const mutated = createModelWhatIfProvider(async request => {
    if (request.operation === 'propose') request.catalog[0].decisionId = 'gold:999'
    return '{"decisionId":"gold:999","alternativeId":"skip"}'
  })
  await assert.rejects(mutated.propose(propose, signal), { code: 'OUTPUT_REJECTED' })
  assert.equal(propose.catalog[0].decisionId, 'gold:4')
})

test('simulated model keeps concurrent replies separate and suppresses a late cancelled completion', async () => {
  const pending = new Map<string, { signal: AbortSignal; resolve: (text: string) => void }>()
  const provider = createModelWhatIfProvider((request, signal) => new Promise(resolve => {
    if (request.operation === 'interpret') pending.set(request.question, { signal, resolve })
  }))
  const old = new AbortController(), current = new AbortController()
  const one = provider.interpret({ question: 'Bỏ mua vàng' }, old.signal)
  const two = provider.interpret({ question: 'Mua cổ phiếu' }, current.signal)
  old.abort()
  assert(pending.get('Bỏ mua vàng')?.signal.aborted)
  pending.get('Mua cổ phiếu')?.resolve('{"status":"ambiguous"}')
  assert.deepEqual(await two, { status: 'ambiguous' })
  pending.get('Bỏ mua vàng')?.resolve('{"status":"intent","intent":{"kind":"gold","action":"skip"}}')
  await assert.rejects(one, { name: 'AbortError' })
})
