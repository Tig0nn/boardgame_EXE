import assert from 'node:assert/strict'
import { test } from 'node:test'
import { actionRequest, createServerSession, ApiError } from './server-session.ts'
import type { SessionDetail } from './server-session.ts'

test('maps the existing UI commands to canonical server commands', () => {
  assert.deepEqual(actionRequest({ type: 'choose', id: 'skip' }, 4),
    { actionId: 'choose', payload: { optionId: 'skip' }, expectedStateVersion: 4 })
  assert.deepEqual(actionRequest({ type: 'fund', source: 'debt', amount: 10 }, 5),
    { actionId: 'fund', payload: { source: 'debt', amount: 10 }, expectedStateVersion: 5 })
})

test('retries the exact action after an ambiguous failure and reloads on conflict', async () => {
  const detail = (stateVersion: number) => ({
    session: { id: 'session', stateVersion }, state: { phase: 'rolling' }, result: null,
  }) as SessionDetail
  const calls: unknown[] = []
  let count = 0
  const session = createServerSession({
    async action(_id, body, key) {
      calls.push({ body, key })
      if (++count === 1) throw new TypeError('connection lost')
      if (count === 3) throw new ApiError(409, 'STATE_VERSION_CONFLICT')
      return { sessionId: 'session', stateVersion: 1, state: detail(1).state, result: null }
    },
    async read() { return detail(2) },
  }, detail(0))
  const dispatched = session.send({ type: 'roll' }, 0)
  assert.equal(await session.send({ type: 'roll' }, 0), false)
  assert.equal(await dispatched, false)
  assert.equal(session.getSnapshot().detail.session.stateVersion, 0)
  assert.equal(await session.retry(), true)
  assert.deepEqual(calls[0], calls[1])
  assert.equal(await session.send({ type: 'roll' }, 1), false)
  assert.equal(session.getSnapshot().detail.session.stateVersion, 2)
})
