import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAccountToken } from './account-token.ts'
import { createGameApi } from './server-session.ts'

test('reuses one refreshed token across concurrent rejections for the same account', async () => {
  let current = { user: { id: 'alice' }, access_token: 'old' }
  let refreshes = 0
  const token = createAccountToken('alice', async () => current, async () => {
    refreshes++
    current = { ...current, access_token: 'new' }
    return current
  }, () => assert.fail('The account should remain signed in'))
  assert.equal(await token(), 'old')
  assert.deepEqual(await Promise.all([token('old'), token('old')]), ['new', 'new'])
  assert.equal(refreshes, 1)
})

test('does not refresh or resend a command under a different account', async () => {
  let expired = 0
  const token = createAccountToken('alice', async () => ({ user: { id: 'bob' }, access_token: 'other' }),
    async () => assert.fail('Wrong account'), () => { expired++ })
  assert.equal(await token('old'), null)
  assert.equal(expired, 0)
})

test('a missing refresh session returns to authentication, while a transient refresh error is recoverable', async () => {
  const current = { user: { id: 'alice' }, access_token: 'old' }
  let expired = 0
  const missing = createAccountToken('alice', async () => current, async () => null, () => { expired++ })
  assert.equal(await missing('old'), null)
  assert.equal(expired, 1)
  const offline = createAccountToken('alice', async () => current, async () => { throw new TypeError('offline') }, () => { expired++ })
  await assert.rejects(offline('old'), /offline/)
  assert.equal(expired, 1)
})

test('401 retries once with a new token and the original idempotency key and body', async () => {
  const requests: RequestInit[] = []
  const api = createGameApi(async rejected => rejected ? 'fresh' : 'expired', async (_url, init) => {
    requests.push(init!)
    return requests.length === 1
      ? Response.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 })
      : Response.json({ session: { id: 'test' } }, { status: 201 })
  })
  assert.deepEqual(await api.create({ initialSavings: 0, savingsTerm: 3 }, 'same-key'), { session: { id: 'test' } })
  assert.deepEqual(requests.map(request => new Headers(request.headers).get('authorization')), ['Bearer expired', 'Bearer fresh'])
  assert.deepEqual(requests.map(request => new Headers(request.headers).get('idempotency-key')), ['same-key', 'same-key'])
  assert.equal(requests[0].body, requests[1].body)
})
