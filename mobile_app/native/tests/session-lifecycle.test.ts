import assert from 'node:assert/strict'
import test from 'node:test'
import { createAccountToken } from '../../src/game/account-token.ts'
import { ApiError, createGameApi, createServerSession, type SessionDetail } from '../../src/game/server-session.ts'

test('a response started by a signed-out owner is discarded after account change', async () => {
  let session: { user: { id: string }; access_token: string } | null = { user: { id: 'A' }, access_token: 'fixture-A' }
  let deliver: (response: Response) => void = () => {}
  const response = new Promise<Response>(resolve => { deliver = resolve })
  const token = createAccountToken('A', async () => session, async () => session, () => {})
  const api = createGameApi(token, async () => response)
  const pending = api.read('owner-A-game')
  await Promise.resolve()
  session = { user: { id: 'B' }, access_token: 'fixture-B' }
  deliver(Response.json({ session: { id: 'owner-A-game' } }))
  await assert.rejects(pending, (error: unknown) => error instanceof ApiError && error.status === 401)
})

test('a lost committed reply is retried with one key and restores the authoritative completion', async () => {
  const initial = { session: { id: 'game', stateVersion: 59, status: 'active' }, state: {}, result: null } as unknown as SessionDetail
  const final = { outcome: 'defeat' as const, lawfulProceedsVnd: '84000000' }
  const keys: string[] = []
  const controller = createServerSession({
    read: async () => ({ ...initial, session: { ...initial.session, stateVersion: 60, status: 'completed' }, result: final }),
    action: async (id, _body, key) => {
      keys.push(key)
      if (keys.length === 1) throw new TypeError('reply lost after commit')
      return { sessionId: id, stateVersion: 60, state: initial.state, result: final }
    },
  }, initial, () => 'one-action')
  assert.equal(await controller.send({ type: 'advance' }, 59), false)
  assert.equal(await controller.send({ type: 'advance' }, 59), false)
  assert.equal(await controller.retry(), true)
  assert.deepEqual(keys, ['one-action', 'one-action'])
  assert.equal(controller.getSnapshot().detail.session.stateVersion, 60)
  assert.deepEqual(controller.getSnapshot().detail.result, final)
})
