import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { MASCOT_EXPLANATION_ENDPOINT, MASCOT_RESPONSE_VERSION, readExplanationContext } from '../src/ai/mascot/contracts.ts'
import { mascotClaims, mockMascotAnalysis, readExplanationReply, readMascotAnalysis } from '../src/ai/mascot/analysis.ts'
import type { ExplanationContext, ExplanationReply } from '../src/ai/mascot/contracts.ts'
import { createMascotExplanationHandler, mockMascotProvider } from '../src/ai/mascot/server.ts'
import { createMascotGeminiProvider } from '../src/ai/mascot/gemini.ts'
import { createExplanationRequest, explainMascot, explanationContext, requestMascotExplanation } from '../mobile_app/src/game/mascot-explanation.ts'
import { evaluateMascotSignals } from '../mobile_app/src/game/mascot-coach.ts'
import { advance, transact } from '../src/game/engine.ts'
import { boardFor } from '../src/data/board.ts'
import { createMultiCourseGame } from '../src/game/new-game.ts'

const simulatedOrigin = 'http://127.0.0.1:5198'
const context: ExplanationContext = { version: 1, topic: 'deposit', facts: {
  amount: 3_000_000, cashBefore: 50_000_000, cash: 47_000_000, knownPayments: 0, term: 2, maturityLap: 2, rate: .05,
} }
const identity = { session: '123e4567-e89b-42d3-a456-426614174000', profile: 'core-mvp-b18-multi-course-v1' } as const
const reply: ExplanationReply = { version: MASCOT_RESPONSE_VERSION, topic: 'deposit', analysis: mockMascotAnalysis(context), source: 'mock' }
const json = (value: unknown) => Response.json(value)

test('deposit uses the new engine lot and leaves the game and log untouched', () => {
  const initial = advance(createMultiCourseGame('mascot-deep'))
  const bank = { ...initial, phase: 'event' as const, eventId: 'bank', position: boardFor(initial).findIndex(tile => tile.type === 'bank') }
  const after = transact(bank, { kind: 'deposit', term: 2, amount: 3_000_000 })
  const snapshot = JSON.stringify([bank, after])
  const signal = evaluateMascotSignals(bank, after).find(value => value.signalId === 'trade-off')!
  const projected = explanationContext(signal)
  assert.deepEqual(projected, context)
  const content = explainMascot(projected!, reply)
  assert.match(content.narrative, /rút toàn bộ.*mất phần lãi/)
  assert.doesNotMatch(content.narrative, /\d|₫/)
  assert.deepEqual(content.facts.find(fact => fact.label === 'Tiền mặt còn lại'), { label: 'Tiền mặt còn lại', value: '47.000.000 ₫' })
  assert.equal(JSON.stringify([bank, after]), snapshot)
  assert.equal(explanationContext({ ...signal, explanation: undefined }), null)
})

test('offline text adds a concrete consequence and keeps the numeric evidence separate', () => {
  const examples = [
    { topic: 'payment-gap', facts: { cash: 14_000_000, knownPayments: 15_500_000, pending: 0 }, match: /mốc thanh toán/ },
    { topic: 'concentration', facts: { group: 'gold', value: 44_000_000, gross: 50_000_000, share: 88, cash: 6_000_000, knownPayments: 3_500_000 },
      match: /ô cho phép bán hoặc rút/ },
    { topic: 'deposit', facts: context.facts, match: /rút toàn bộ.*mất phần lãi/ },
    { topic: 'debt-reduced', facts: { debtReduced: 2_000_000, debt: 6_000_000, cash: 10_000_000 }, match: /khoản thu hoặc chi khác/ },
    { topic: 'buy', facts: { amount: 6_000_000, cash: 14_000_000, cashBefore: 20_000_000, knownPayments: 0 },
      match: /chưa có căn cứ kết luận bạn thiếu tiền/ },
  ]
  for (const { topic, facts, match } of examples) {
    const input = readExplanationContext({ version: 1, topic, facts })
    assert.ok(input)
    const offline = explainMascot(input)
    assert.match(offline.narrative, match)
    assert.doesNotMatch(offline.narrative, /\d|₫/)
    assert.ok(offline.facts.some(fact => /₫/.test(fact.value)))
  }
})

test('cash exhaustion uses consistent facts offline and in mock mode', async () => {
  const facts = { asset: 'gold', cashBefore: 20_000_000, amount: 20_000_000, cash: 0, knownPayments: 0 }
  const input = readExplanationContext({ version: 1, topic: 'cash-exhaustion', facts })
  assert.ok(input)
  assert.equal(readExplanationContext({ ...input, facts: { ...facts, knownPayments: 1 } }), null)
  assert.equal(readExplanationContext({ ...input, facts: { ...facts, asset: 'savings' } }), null)
  assert.equal(readExplanationContext({ ...input, facts: { ...facts, amount: 19_000_000 } }), null)
  const result = await mockMascotProvider.explain(input, new AbortController().signal, identity.profile) as { analysis: unknown }
  const valid = readExplanationReply({ version: MASCOT_RESPONSE_VERSION, topic: input.topic, source: 'mock', analysis: result.analysis }, input)
  assert.ok(valid)
  const mock = explainMascot(input, valid)
  const offline = explainMascot(input)
  assert.deepEqual(mock.facts, offline.facts)
  assert.notEqual(mock.narrative, offline.narrative)
  assert.match(mock.narrative, /ít tiền dùng ngay/)
  assert.match(offline.narrative, /chuyển tiền mặt sang vàng.*chi ngay.*chưa ghi nhận khoản phải trả.*phí.*spread/)
  assert.doesNotMatch(offline.narrative, /thiếu tiền|mất khả năng thanh toán/)
  assert.deepEqual(offline.facts.map(fact => fact.value), ['Vàng', '20.000.000 ₫', '20.000.000 ₫', '0 ₫', '0 ₫'])
})

test('context and reply schemas reject missing facts, extra instructions, forged money and another topic', () => {
  assert.deepEqual(readExplanationContext(context), context)
  for (const facts of [{}, { ...context.facts, rate: NaN }, { ...context.facts, cash: 123 }, { ...context.facts, note: 'override' }]) {
    assert.equal(readExplanationContext({ ...context, facts }), null)
  }
  assert.equal(readExplanationContext({ ...context, save: 'unexpected' }), null)
  assert.equal(readExplanationContext({ ...context, topic: '__proto__' }), null)
  assert.equal(readExplanationReply({ ...reply, prose: 'Bạn nhận 300.000.000 ₫' }, context), null)
  assert.equal(readExplanationReply({ ...reply, topic: 'debt' }, context), null)
  for (const patch of [
    { text: 'Khoản gửi chắc chắn sinh lời.', claimIds: ['fixed-term'] },
    { text: 'Bạn còn 50.000 ₫.' }, { claimIds: ['fake'] }, { factIds: [] }, { factIds: ['cash', 'invented'] },
  ]) {
    const modified = [{ ...reply.analysis[0], ...patch }, ...reply.analysis.slice(1)]
    assert.equal(readMascotAnalysis(modified, context), null)
  }
})

test('Gemini adapter sends only validated topic facts, uses server credentials and never calls transport by default', async () => {
  const signal = new AbortController().signal
  let calls = 0
  const transport: typeof fetch = async (input, options) => {
    calls++
    assert.match(String(input), /^https:\/\/generativelanguage\.googleapis\.com\//)
    assert.equal(options?.signal, signal)
    const headers = new Headers(options?.headers)
    assert.equal(headers.get('x-goog-api-key'), 'test-only-placeholder')
    const body = JSON.parse(String(options?.body))
    assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), { profile: identity.profile, ...context, claims: mascotClaims(context), causeLinks: [] })
    assert.deepEqual(body.generationConfig.responseFormat.text.schema.required, ['topic', 'analysis'])
    assert.equal(body.generationConfig.maxOutputTokens, 768)
    return json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true }, {
      text: JSON.stringify({ topic: context.topic, analysis: reply.analysis }),
    }] } }] })
  }
  const options = { model: 'gemini-test', credential: 'test-only-placeholder', transport }
  assert.equal(createMascotGeminiProvider({ ...options, approved: false }), undefined)
  assert.equal(createMascotGeminiProvider({ ...options, credential: undefined, approved: true }), undefined)
  assert.equal(calls, 0)
  const provider = createMascotGeminiProvider({ ...options, approved: true })!
  assert.deepEqual(await provider.explain(context, signal, identity.profile), { topic: context.topic, analysis: reply.analysis })
  assert.equal(calls, 1)
})

test('client falls back for missing provider, transport failure, wrong topic and invalid reply', async () => {
  const signal = new AbortController().signal
  const call = (transport: typeof fetch) => requestMascotExplanation(context, signal, identity, transport)
  assert.deepEqual(await call(async () => json(reply)), reply)
  assert.equal(await call(async () => new Response(null, { status: 503 })), null)
  assert.equal(await call(async () => { throw Error('network') }), null)
  assert.equal(await call(async () => json({ ...reply, topic: 'sell' })), null)
  assert.equal(await call(async () => json({ ...reply, income: 10_000_000 })), null)
})

test('single-flight explanation, close, switching and timeout ignore late replies', async () => {
  const requests: { signal: AbortSignal; resolve: (value: ExplanationReply) => void }[] = []
  const answers: (ExplanationReply | null)[] = []
  const loader = createExplanationRequest((_context, signal) => new Promise(resolve => requests.push({ signal, resolve })), 1000)
  const deliver = (value: ExplanationReply | null) => answers.push(value)
  loader.start(context, deliver)
  loader.start(context, deliver)
  await Promise.resolve()
  assert.equal(requests.length, 1)
  loader.cancel()
  assert.equal(requests[0].signal.aborted, true)
  loader.start(context, deliver)
  await Promise.resolve()
  requests[0].resolve(reply)
  requests[1].resolve({ ...reply, source: 'live' })
  await delay(0)
  assert.deepEqual(answers, [{ ...reply, source: 'live' }])
  const timed = createExplanationRequest(() => new Promise(() => {}), 5)
  timed.start(context, deliver)
  await delay(20)
  assert.equal(answers.at(-1), null)
  assert.equal(timed.isLoading(), false)
})

async function withHandler(options: Parameters<typeof createMascotExplanationHandler>[0], run: (send: (value: unknown, origin?: string, profile?: string, session?: string) => Promise<Response>) => Promise<void>) {
  const server = createServer(createMascotExplanationHandler(options))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address() as { port: number }
  try {
    await run((value, origin = simulatedOrigin, profile = identity.profile, session = identity.session) => fetch(`http://127.0.0.1:${port}${MASCOT_EXPLANATION_ENDPOINT}`, {
      method: 'POST', headers: { origin, 'content-type': 'application/json', 'x-mascot-request': '1', 'x-mascot-profile': profile, 'x-mascot-session': session }, body: JSON.stringify(value),
    }))
  } finally {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
}

test('HTTP endpoint validates ingress, serves labeled mock and fails closed without provider', async () => {
  await withHandler({ provider: mockMascotProvider, origin: simulatedOrigin }, async send => {
    const response = await send(context)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), reply)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal((await send({ ...context, log: [] })).status, 400)
    assert.equal((await send(context, simulatedOrigin, 'unknown')).status, 400)
    assert.equal((await send(context, simulatedOrigin, identity.profile, 'fake')).status, 400)
    assert.equal((await send(context, 'https://other.invalid')).status, 403)
  })
  await withHandler({}, async send => {
    const response = await send(context)
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'PROVIDER_UNAVAILABLE' })
  })
})

test('HTTP timeout, provider error and schema rejection yield no explanation', async () => {
  const cases = [
    { status: 504, error: 'PROVIDER_TIMEOUT', explain: () => new Promise(() => {}) },
    { status: 503, error: 'PROVIDER_UNAVAILABLE', explain: () => { throw new Error('upstream details') } },
    { status: 503, error: 'OUTPUT_REJECTED', explain: () => ({ style: 'practical', amount: 200_000 }) },
  ]
  for (const example of cases) await withHandler({
    origin: simulatedOrigin, deadlineMs: 100, provider: { source: 'live', explain: example.explain },
  }, async send => {
    const response = await send(context)
    assert.equal(response.status, example.status)
    assert.deepEqual(await response.json(), { error: example.error })
  })
})
test('quota isolates game sessions and the process cap also applies across sessions', async () => {
  const other = '123e4567-e89b-42d3-a456-426614174001'
  await withHandler({ provider: mockMascotProvider, origin: simulatedOrigin, maxSessionCalls: 1, maxCalls: 2 }, async send => {
    assert.equal((await send(context)).status, 200)
    assert.equal((await send(context)).status, 429)
    assert.equal((await send(context, simulatedOrigin, identity.profile, other)).status, 200)
    assert.equal((await send(context, simulatedOrigin, identity.profile, '123e4567-e89b-42d3-a456-426614174002')).status, 429)
  })
})

test('five scenarios accept prose composed through injected Gemini transport and keep numeric facts local', async () => {
  const cases = [
    { topic: 'cash-exhaustion', facts: { asset: 'gold', amount: 20_000_000, cashBefore: 20_000_000, cash: 0, knownPayments: 0 }, pattern: /ít tiền dùng ngay/ },
    { topic: 'buy', facts: { amount: 6_000_000, cashBefore: 20_000_000, cash: 14_000_000, knownPayments: 0 }, pattern: /chưa đủ để kết luận/ },
    { topic: 'payment-gap', facts: { cash: 1_000_000, knownPayments: 3_500_000, pending: 2_500_000 }, pattern: /nguồn thanh toán hợp lệ/ },
    { topic: 'concentration', facts: { group: 'gold', value: 44_000_000, gross: 50_000_000, share: 88, cash: 6_000_000, knownPayments: 3_500_000 }, pattern: /hơn nửa số dư tiền mặt/ },
    { topic: 'debt-reduced', facts: { debtReduced: 2_000_000, debt: 6_000_000, cash: 10_000_000 }, pattern: /hai tác động khác nhau/ },
  ]
  const adapter = createMascotGeminiProvider({ approved: true, credential: 'test-only-placeholder', transport: async (_url, options) => {
    const body = JSON.parse(String(options?.body))
    const input = JSON.parse(body.contents[0].parts[0].text)
    assert.equal(body.generationConfig.responseFormat.text.schema.properties.topic.enum[0], input.topic)
    const analysis = mockMascotAnalysis(input)
    // Simulate an authored composition, distinct from the deterministic mock.
    if (analysis.length > 3) {
      const causal = input.causeLinks[0] as [string, string] | undefined
      const [a, b] = causal ? causal.map(id => analysis.find(line => line.claimIds[0] === id)!) : analysis
      const joined = { claimIds: [...a.claimIds, ...b.claimIds], factIds: [...new Set([...a.factIds, ...b.factIds])],
        text: a.text.slice(0, -1) + (causal ? ', vì vậy ' : ' và ') + b.text[0].toLocaleLowerCase('vi-VN') + b.text.slice(1) }
      analysis.splice(0, analysis.length, joined, ...analysis.filter(line => line !== a && line !== b))
    }
    return json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ topic: input.topic, analysis }) }] } }] })
  } })!
  await withHandler({ provider: adapter, origin: simulatedOrigin }, async send => {
    for (const { topic, facts, pattern } of cases) {
      const input = readExplanationContext({ version: 1, topic, facts })!
      assert.ok(input)
      const response = await send(input)
      assert.equal(response.status, 200)
      const validated = readExplanationReply(await response.json(), input)
      assert.equal(validated?.source, 'live')
      const offline = explainMascot(input)
      const generated = explainMascot(input, validated)
      assert.notEqual(generated.narrative, offline.narrative)
      assert.deepEqual(generated.facts, offline.facts)
      assert.match(generated.narrative, pattern)
      if (topic === 'cash-exhaustion') assert.match(generated.narrative, /vì vậy/)
      assert.doesNotMatch(generated.narrative, /\d|₫/)
    }
  })
})

test('Gemini HTTP failure is opaque and exposes no upstream response content', async () => {
  const provider = createMascotGeminiProvider({ approved: true, credential: 'test-only-placeholder',
    transport: async () => new Response('private upstream details', { status: 429 }) })!
  await withHandler({ provider, origin: simulatedOrigin }, async send => {
    const response = await send(context)
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: 'PROVIDER_UNAVAILABLE' })
  })
})
test('the server permits only one in-flight request per game and two overall', async () => {
  let enter!: () => void, release!: () => void
  const entered = new Promise<void>(resolve => { enter = resolve })
  const held = new Promise<void>(resolve => { release = resolve })
  let calls = 0
  await withHandler({ origin: simulatedOrigin, provider: {
    source: 'mock',
    async explain(input) {
      if (++calls === 2) enter()
      await held
      return { topic: input.topic, analysis: mockMascotAnalysis(input) }
    },
  } }, async send => {
    const first = send(context)
    const second = send(context, simulatedOrigin, identity.profile, '123e4567-e89b-42d3-a456-426614174001')
    try {
      await entered
      assert.equal((await send(context)).status, 429)
      assert.equal((await send(context, simulatedOrigin, identity.profile, '123e4567-e89b-42d3-a456-426614174002')).status, 429)
    } finally {
      release()
      assert.equal((await first).status, 200)
      assert.equal((await second).status, 200)
    }
    assert.equal(calls, 2)
  })
})

test('Gemini diagnostic metadata separates upstream, parse, schema, claim and timeout failures', async () => {
  const valid = { topic: context.topic, analysis: reply.analysis }
  const candidate = (text: string) => json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] })
  const cases = [
    { upstreamStatus: 503, outcome: 'upstream-unavailable', status: 503, transport: async () => new Response('private', { status: 503 }) },
    { upstreamStatus: 429, outcome: 'upstream-rate-limit', status: 503, transport: async () => new Response('private', { status: 429 }) },
    { upstreamStatus: null, outcome: 'network', status: 503, transport: async () => { throw Error('private') } },
    { upstreamStatus: null, outcome: 'timeout', status: 504, transport: async () => new Promise<Response>(() => {}) },
    { upstreamStatus: 200, outcome: 'parse', status: 503, transport: async () => candidate('private invalid JSON') },
    { upstreamStatus: 200, outcome: 'schema', status: 503, transport: async () => candidate(JSON.stringify({ topic: context.topic, analysis: [] })) },
    { upstreamStatus: 200, outcome: 'claims', status: 503, transport: async () => candidate(JSON.stringify({
      ...valid, analysis: valid.analysis.map((line, i) => i === 0 ? { ...line, text: 'private unsupported claim' } : line),
    })) },
    { upstreamStatus: 200, outcome: 'validated', status: 200, transport: async () => candidate(JSON.stringify(valid)) },
  ]
  for (const example of cases) {
    let diagnostic: unknown
    let calls = 0
    const provider = createMascotGeminiProvider({ approved: true, credential: 'test-only-placeholder', transport: async () => {
      calls++
      return example.transport()
    } })!
    await withHandler({ provider, origin: simulatedOrigin, deadlineMs: 100, onDiagnostic: event => { diagnostic = event } }, async send => {
      const response = await send(context)
      assert.equal(response.status, example.status)
      if (response.ok) assert.equal((await response.json()).source, 'live')
    })
    assert.equal(calls, 1)
    const { elapsedMs, adapter, validation, ...fields } = diagnostic as {
      elapsedMs: number; adapter?: { jsonParse: string; rejectionReason: string | null }; validation?: { stage: string }
    }
    assert.equal(validation?.stage, ['claims', 'schema'].includes(example.outcome) ? example.outcome : undefined)
    assert.ok(elapsedMs >= 0)
    assert.deepEqual(fields, { outcome: example.outcome, upstreamStatus: example.upstreamStatus })
    if (example.upstreamStatus === 200) {
      assert.equal(adapter?.jsonParse, example.outcome === 'parse' ? 'invalid' : 'parsed')
      assert.equal(adapter?.rejectionReason, example.outcome === 'parse' ? 'candidate-json-invalid' : null)
    } else assert.equal(adapter, undefined)
  }
})

test('Gemini adapter emits only bounded structural diagnostics for accepted and rejected responses', async () => {
  const text = JSON.stringify({ topic: context.topic, analysis: reply.analysis })
  const envelope = (parts: unknown[], finishReason: unknown = 'STOP') =>
    json({ candidates: [{ finishReason, content: { parts } }] })
  const cases = [
    { response: envelope([{ thought: true, text: 'private thought' }, { text }]),
      expected: { finishReason: 'STOP', candidatesCount: 1, partsCount: 2, textPartsCount: 1,
        outputTextLength: text.length, jsonParse: 'parsed', rejectionReason: null } },
    { response: envelope([], 'MAX_TOKENS'),
      expected: { finishReason: 'MAX_TOKENS', partsCount: 0, rejectionReason: 'finish-reason' } },
    { response: envelope([{ text }], 'private upstream data'),
      expected: { finishReason: 'other', rejectionReason: 'finish-reason' } },
    { response: json({ candidates: [] }),
      expected: { candidatesCount: 0, rejectionReason: 'candidate-count' } },
    { response: json({ candidates: [{ finishReason: 'STOP' }] }),
      expected: { finishReason: 'STOP', partsCount: null, rejectionReason: 'parts-missing' } },
    { response: envelope([{ text: '{' }, { text: '}' }]),
      expected: { partsCount: 2, textPartsCount: 2, outputTextLength: 2, rejectionReason: 'visible-part-count' } },
    { response: envelope([{ functionCall: {} }]),
      expected: { partsCount: 1, textPartsCount: 0, outputTextLength: 0, rejectionReason: 'non-text-part' } },
    { response: envelope([{ text: 'a'.repeat(4097) }]),
      expected: { outputTextLength: 4097, rejectionReason: 'text-too-long' } },
    { response: envelope([{ text: 'private invalid JSON' }]),
      expected: { jsonParse: 'invalid', rejectionReason: 'candidate-json-invalid' } },
    { response: new Response('private invalid JSON', { headers: { 'content-type': 'application/json' } }),
      expected: { jsonParse: 'not-attempted', rejectionReason: 'response-json-invalid' } },
  ]
  for (const { response, expected } of cases) {
    const provider = createMascotGeminiProvider({ approved: true, credential: 'test-only-placeholder',
      transport: async () => response })!
    let diagnostic: unknown
    const result = await provider.explain(context, new AbortController().signal, identity.profile, (status, metadata) => {
      assert.equal(status, 200)
      diagnostic = metadata
    })
    assert.equal(result !== null, expected.rejectionReason === null)
    assert.ok(diagnostic && typeof diagnostic === 'object')
    assert.deepEqual(Object.keys(diagnostic).sort(), [
      'candidatesCount', 'finishReason', 'jsonParse', 'outputTextLength', 'partsCount', 'rejectionReason', 'textPartsCount',
    ])
    for (const [key, value] of Object.entries(expected)) assert.equal(Reflect.get(diagnostic, key), value)
    assert.doesNotMatch(JSON.stringify(diagnostic), /private|test-only-placeholder/)
  }
})

test('Gemini contract and validator agree on claim roles, fact links and supported relationships', async () => {
  const exhaustion = readExplanationContext({ version: 1, topic: 'cash-exhaustion', facts: {
    asset: 'gold', amount: 20_000_000, cashBefore: 20_000_000, cash: 0, knownPayments: 0,
  } })!
  const purchase = readExplanationContext({ version: 1, topic: 'buy', facts: {
    amount: 6_000_000, cashBefore: 20_000_000, cash: 14_000_000, knownPayments: 0,
  } })!
  const valid = mockMascotAnalysis(exhaustion)
  const [fact, , impact, otherImpact, consideration] = valid
  const replace = (index: number, values: Partial<typeof fact>) =>
    valid.map((line, i) => i === index ? { ...line, ...values } : line)
  const join = (a: typeof fact, b: typeof fact, connector: string) => ({
    claimIds: [...a.claimIds, ...b.claimIds], factIds: [...new Set([...a.factIds, ...b.factIds])],
    text: a.text.slice(0, -1) + connector + b.text[0].toLocaleLowerCase('vi-VN') + b.text.slice(1),
  })
  const mixedFinal = [fact, impact, join(otherImpact, consideration, ' và ')]
  const cases = [
    { name: 'valid fact and supported causal pair', lines: [join(fact, impact, ', vì vậy '), otherImpact, consideration] },
    { name: 'cash exhaustion', lines: valid },
    { name: 'ordinary purchase', input: purchase, lines: mockMascotAnalysis(purchase) },
    { name: 'unknown claim', lines: replace(0, { claimIds: ['private-claim-123'] }),
      category: 'UNKNOWN_CLAIM_ID', sentenceIndex: 0 },
    { name: 'unknown fact', lines: replace(0, { factIds: ['private-fact-123'] }),
      category: 'UNKNOWN_FACT_ID', sentenceIndex: 0, claimId: 'cash-moved' },
    { name: 'cross-topic claim', lines: replace(0, { claimIds: ['cash-invested'] }),
      category: 'TOPIC_CLAIM_MISMATCH', sentenceIndex: 0, claimId: 'cash-invested' },
    { name: 'known fact outside topic', lines: replace(0, { factIds: ['debt'] }),
      category: 'UNKNOWN_FACT_ID', sentenceIndex: 0, claimId: 'cash-moved', factId: 'debt' },
    { name: 'unsupported causal pair', lines: [fact, join(impact, otherImpact, ', vì vậy '), consideration],
      category: 'UNSUPPORTED_CAUSAL_RELATION', sentenceIndex: 1, claimId: 'less-immediate-cash' },
    { name: 'wrong fact attached to claim', lines: replace(2, { factIds: ['asset'] }),
      category: 'CLAIM_FACT_MISMATCH', sentenceIndex: 2, claimId: 'less-immediate-cash', factId: 'asset' },
    { name: 'missing fact link', lines: replace(2, { factIds: ['cash'] }),
      category: 'CLAIM_FACT_MISMATCH', sentenceIndex: 2, claimId: 'less-immediate-cash', factId: 'cashBefore' },
    { name: 'mixed final sentence', lines: mixedFinal,
      category: 'INVALID_SENTENCE_STRUCTURE', sentenceIndex: 2, claimId: 'held-versus-available' },
    { name: 'one invalid amount in otherwise valid sentences', lines: replace(2, { text: 'Bạn còn 50.000 ₫.' }),
      category: 'INVALID_SENTENCE_STRUCTURE', sentenceIndex: 2, claimId: 'less-immediate-cash' },
  ]
  for (const example of cases) {
    const input = example.input ?? exhaustion
    let diagnostic: unknown
    const provider = createMascotGeminiProvider({ approved: true, credential: 'test-only-placeholder',
      transport: async (_url, options) => {
        const body = JSON.parse(String(options?.body))
        const claims = mascotClaims(input)
        const schema = body.generationConfig.responseFormat.text.schema.properties.analysis.items.properties
        assert.deepEqual(schema.claimIds.anyOf.map((branch: { items: { enum: string[] }; maxItems: number }) =>
          [branch.items.enum, branch.maxItems]), [
          [claims.filter(claim => claim.kind !== 'consideration').map(claim => claim.id), 2],
          [claims.filter(claim => claim.kind === 'consideration').map(claim => claim.id), 1],
        ])
        assert.deepEqual(schema.factIds.items.enum, [...new Set(claims.flatMap(claim => claim.factIds))].sort())
        assert.match(body.systemInstruction.parts[0].text, /final sentence.*only.*consideration/)
        const text = JSON.stringify({ topic: input.topic, analysis: example.lines })
        return json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] })
      } })!
    await withHandler({ provider, origin: simulatedOrigin, onDiagnostic: event => { diagnostic = event } }, async send => {
      const response = await send(input)
      const payload = await response.json()
      if (example.category) {
        assert.equal(response.status, 503, example.name)
        assert.deepEqual(payload, { error: 'OUTPUT_REJECTED' })
      } else {
        assert.equal(response.status, 200, example.name)
        assert.equal(readExplanationReply(payload, input)?.source, 'live')
      }
    })
    const event = diagnostic as { validation?: { reason: string }; outcome: string; adapter?: { finishReason: string } }
    assert.equal(event.adapter?.finishReason, 'STOP')
    assert.equal(event.outcome, example.category ? 'claims' : 'validated')
    assert.deepEqual(event.validation && { ...event.validation, reason: undefined }, example.category ? {
      stage: 'claims', topic: input.topic, sentenceIndex: example.sentenceIndex, category: example.category,
      ...(example.claimId ? { claimId: example.claimId } : {}), ...(example.factId ? { factId: example.factId } : {}), reason: undefined,
    } : undefined, example.name)
    assert.doesNotMatch(JSON.stringify(event), /private-claim|private-fact|50\.000|test-only-placeholder/)
  }
})
