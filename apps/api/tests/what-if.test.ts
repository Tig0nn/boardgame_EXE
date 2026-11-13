import assert from 'node:assert/strict'
import { test } from 'node:test'
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
