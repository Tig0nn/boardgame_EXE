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
