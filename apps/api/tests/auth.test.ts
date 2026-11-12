import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { createAuthenticator } from '../src/auth.ts'
import { startJwtIssuer } from './jwks.ts'

test('verify Supabase-compatible bearer tokens against local JWKS', async t => {
  const issuer = await startJwtIssuer()
  t.after(issuer.close)
  const userId = randomUUID()
  const authenticate = createAuthenticator(issuer.config)
  const valid = await issuer.sign(userId)
  assert.equal(await authenticate('Bearer ' + valid), userId)

  const invalid = [
    undefined,
    'Basic ' + valid,
    'Bearer invalid',
    'Bearer ' + await issuer.sign(userId, {}, true),
    'Bearer ' + await issuer.sign(userId, { iss: 'https://different.example/auth/v1' }),
    'Bearer ' + await issuer.sign(userId, { aud: 'different' }),
    'Bearer ' + await issuer.sign(userId, { exp: 1 }),
    'Bearer ' + await issuer.sign(userId, { exp: undefined }),
    'Bearer ' + await issuer.sign(userId, { nbf: Math.floor(Date.now() / 1000) + 600 }),
    'Bearer ' + await issuer.sign('missing-uuid'),
    'Bearer ' + await issuer.sign(userId, { role: 'service_role' }),
    'Bearer ' + await issuer.sign(userId, { is_anonymous: true }),
  ]
  for (const header of invalid) {
    await assert.rejects(authenticate(header), { status: 401, code: 'UNAUTHORIZED' })
  }
})

test('health-only configuration leaves authenticated routes unavailable', async () => {
  await assert.rejects(createAuthenticator(undefined)('Bearer a.b.c'), {
    status: 503, code: 'AUTH_UNAVAILABLE',
  })
})
