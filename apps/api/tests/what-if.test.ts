import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createWhatIfAssistant } from '../src/services/what-if-assistance.ts'
import { buildApp } from '../src/app.ts'
import type { DatabaseConnection } from '../src/db/client.ts'
import { startJwtIssuer } from './jwks.ts'

test('What-if uses the same authentication guard as Cloud Save', async t => {
  const issuer = await startJwtIssuer()
  const app = buildApp({ close: async () => {} } as DatabaseConnection, issuer.config)
  t.after(async () => { await app.close(); await issuer.close() })
  const url = '/v1/game-sessions/6e5bc9dd-4d29-47e9-9f22-47c343432ae9/what-if'
  assert.equal((await app.inject({ method: 'GET', url })).statusCode, 401)
  assert.equal((await app.inject({ method: 'POST', url, payload: {} })).statusCode, 401)
})

test('What-if assistant requires a JWT before any provider call', async t => {
  const issuer = await startJwtIssuer()
  const app = buildApp({ close: async () => {} } as DatabaseConnection, issuer.config)
  t.after(async () => { await app.close(); await issuer.close() })
  const url = '/v1/game-sessions/6e5bc9dd-4d29-47e9-9f22-47c343432ae9/what-if/assistant'
  assert.equal((await app.inject({ method: 'POST', url,
    payload: { operation: 'interpret', question: 'Bỏ mua vàng', stateVersion: 45, allowGemini: true },
  })).statusCode, 401)
})

test('What-if uses separate default-off flags and rejects ungrounded adapter replies', async () => {
  const env = { EXE_WHATIF_GEMINI_API_KEY: 'fixture-only', EXE_WHATIF_GEMINI_MODEL: 'gemini-test' }
  let mode = 'wrong-amount'
  const mock: typeof fetch = async (_url, init) => {
    const request = JSON.parse(JSON.parse(String(init?.body)).contents[0].parts[0].text)
    const reply = request.operation === 'interpret'
      ? { status: 'intent', intent: { kind: 'bank', action: 'deposit', amount: 1_234_568 } }
      : { decisionId: mode === 'foreign' ? 'bank:9' : 'bank:7', alternativeId: 'skip' }
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(reply) }] } }] })
  }
  assert.equal(createWhatIfAssistant({ ...env, EXE_FOX_GEMINI_ENABLED: '1' }, mock), undefined)
  assert.equal(createWhatIfAssistant({ ...env, EXE_WHATIF_GEMINI_ENABLED: '1' }, mock), undefined)
  const enabled = createWhatIfAssistant({ ...env, EXE_WHATIF_GEMINI_ENABLED: '1', EXE_WHATIF_GEMINI_ALLOW_LIVE_TRAFFIC: '1' }, mock)!
  const invalid = await enabled('player', { operation: 'interpret', question: 'Gửi tiết kiệm số tiền 1.234.567 VND kỳ hạn 2' })
  assert.deepEqual(invalid, { status: 'output-rejected' })
  mode = 'foreign'
  const foreign = await enabled('player', { operation: 'propose', question: 'Bỏ gửi tiết kiệm tại quyết định 7',
    catalog: [{ kind: 'bank', decisionId: 'bank:7', alternativeId: 'skip', lap: 1, turn: 4 }],
  })
  assert.deepEqual(foreign, { status: 'output-rejected' })
})
