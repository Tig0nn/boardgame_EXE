import assert from 'node:assert/strict'
import { test } from 'node:test'
import { explainFoxWhatIf } from '../src/services/fox-what-if.ts'
import { buildApp } from '../src/app.ts'
import type { DatabaseConnection } from '../src/db/client.ts'
import { startJwtIssuer } from './jwks.ts'

test('Fox routes require the same bearer token as Cloud Save', async t => {
  const issuer = await startJwtIssuer()
  const app = buildApp({ close: async () => {} } as DatabaseConnection, issuer.config)
  t.after(async () => { await app.close(); await issuer.close() })
  const url = '/v1/game-sessions/6e5bc9dd-4d29-47e9-9f22-47c343432ae9/coach'
  assert.equal((await app.inject({ method: 'GET', url })).statusCode, 401)
  assert.equal((await app.inject({ method: 'POST', url: url + '/learn', payload: { question: 'Thanh khoản là gì?' } })).statusCode, 401)
})

test('Fox limited What-if retains decision evidence without a final comparison', () => {
  const decision = { actual: [{ decision: 'Thanh toán ngay', consequence: 'Đã trả' }],
    alternative: [{ decision: 'Hoãn', consequence: 'Đến hạn tại START' }], cashDeltaVnd: 1 }
  for (const reason of ['EARLY_INSOLVENCY', 'ENVIRONMENT_DIVERGED']) {
    const result = explainFoxWhatIf({
      status: 'limited', reason, decision, completedLaps: [1, 2],
      continuation: { retained: 6, notRetained: 2, fallback: [] },
    }, 10)
    assert.equal(result.status, 'limited')
    assert.equal(result.source, 'verified-what-if-replay')
    assert.equal(result.sequence, 10)
    assert.deepEqual(result.evidence, { decisions: { actual: decision.actual, alternative: decision.alternative }, reason, completedLaps: [1, 2] })
    assert.deepEqual(result.cards.map(card => card.id), ['original', 'alternative', 'limit'])
    assert.doesNotMatch(JSON.stringify(result), /lawfulProceedsVnd|cashDeltaVnd|đạt mục tiêu/)
  }
})

test('Gemini is off even with a key and selects public learning cards only on opt-in', async () => {
  const { createFoxAssistance } = await import('../src/services/fox-assistance.ts')
  const { learningCards } = await import('../../../src/ai/mascot/learning.ts')
  const env = { EXE_FOX_GEMINI_API_KEY: 'fixture-only', EXE_FOX_GEMINI_MODEL: 'gemini-test' }
  let requests = 0
  const fetchMock: typeof fetch = async (_url, init) => {
    requests++
    const body = String(init?.body)
    assert.doesNotMatch(body, /PRIVATE_BALANCE|entry-123/)
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ids":["liquidity"]}' }] } }] })
  }
  assert.equal(createFoxAssistance(env, fetchMock), undefined)
  const assist = createFoxAssistance({ ...env, EXE_FOX_GEMINI_ENABLED: '1' }, fetchMock)!
  const cards = [...learningCards(null), { id: 'entry-123', scope: 'GAME_FACT' as const, text: 'PRIVATE_BALANCE', source: 'game' }]
  const answer = await assist('player-1', 'Giải thích khả năng chuyển đổi tài sản', cards)
  assert.equal(answer.status, 'used')
  assert.deepEqual(answer.cards.map(card => card.id), ['liquidity'])
  assert.equal(requests, 1)
})

test('Fox assistance rejects foreign IDs, oversized output, timeout and excess requests', async () => {
  const { createFoxAssistance } = await import('../src/services/fox-assistance.ts')
  const { learningCards } = await import('../../../src/ai/mascot/learning.ts')
  const env = { EXE_FOX_GEMINI_ENABLED: '1', EXE_FOX_GEMINI_API_KEY: 'fixture-only', EXE_FOX_GEMINI_MODEL: 'gemini-test' }
  const cards = learningCards(null)
  const envelope = (text: string) => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] })
  const question = 'Giải thích khả năng chuyển đổi tài sản'
  const cases: [string, typeof fetch][] = [
    ['unavailable', async () => envelope('{"ids":["entry-123"]}')],
    ['unavailable', async () => envelope('{"ids":["liquidity"],"amount":123}')],
    ['unavailable', async () => envelope('x'.repeat(9000))],
    ['no-match', async () => envelope('{"ids":[]}')],
    ['timeout', async () => new Promise<Response>(() => {})],
  ]
  const hold = setInterval(() => {}, 100)
  try {
    for (const [status, fetchMock] of cases) {
      const assist = createFoxAssistance(env, fetchMock, 25)!
      assert.deepEqual(await assist('player', question, cards), { status, cards: [] })
    }
  } finally { clearInterval(hold) }
  let requests = 0
  const limited = createFoxAssistance(env, async () => { requests++; return envelope('{"ids":[]}'); })!
  for (let i = 0; i < 4; i++) assert.equal((await limited('player', question, cards)).status, 'no-match')
  assert.equal((await limited('player', question, cards)).status, 'rate-limited')
  assert.equal(requests, 4)
})
