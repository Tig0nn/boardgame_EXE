import assert from 'node:assert/strict'
import test from 'node:test'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { restoreSavedGame, saveGameLocally } from '../../../src/game/saved-game.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { liquidatableFunds, victory } from '../../../src/game/selectors.ts'
import { createMobileSession } from '../../src/game/session.ts'
import { ApiError, createGameApi, createServerSession, type SessionDetail } from '../../src/game/server-session.ts'
import { createAccountToken } from '../../src/game/account-token.ts'
import type { WhatIfRequest } from '../../src/game/cloud-contract.ts'
import { fromLocal, setAmount } from '../src/arena-model.ts'

test('native B18 starts with 50M cash and exposes the unchanged 18-tile board', () => {
  const game = createMultiCourseGame('native-fresh', 0, 1)
  const arena = fromLocal(game)
  assert.equal(arena.board.length, 18)
  assert.equal(arena.totalLaps, 4)
  assert.deepEqual(arena.portfolio, { cash: 50_000_000, savings: 0, stocks: 0, bonds: 0, gold: 0, business: 0, debt: 0 })
  assert.equal(game.deposits.length, 0)
  assert.equal(arena.phase, 'forecast')
  assert.deepEqual(arena.fixed[0].command, { type: 'advance' })
})

test('native choice adapter reaches lap four and schema 7 local save round-trips', () => {
  const initial = createMultiCourseGame('native-four-rounds-fixed', 0, 1)
  const controller = createMobileSession(initial)
  for (let i = 0; i < 120; i++) {
    const state = controller.getSnapshot()
    const before = serializeLog(state)
    const arena = fromLocal(state)
    assert.equal(serializeLog(state), before, 'building mobile choices and peek does not mutate state')
    if (state.phase === 'finished') break
    const command = state.phase === 'rolling' ? { type: 'roll' as const }
      : (arena.fixed.find(choice => choice.skip) ?? arena.fixed[0])?.command
        ?? setAmount(arena.trades[0], arena.trades[0].max)
    assert.equal(controller.dispatch(command, state), true)
    assert.equal(controller.dispatch(command, state), false, 'a stale render cannot duplicate a decision')
  }
  const game = controller.getSnapshot()
  assert.equal(game.phase, 'finished')
  assert.deepEqual(game.summaries.map(item => item.lap), [1, 2, 3, 4])
  assert.equal(fromLocal(game).result?.lawfulProceedsVnd, String(liquidatableFunds(game)))
  assert.equal(fromLocal(game).result?.outcome, victory(game).won ? 'victory' : 'defeat')
  let saved = ''
  assert.ok(saveGameLocally(game, { setItem(_key, text) { saved = text } }))
  assert.equal(JSON.parse(saved).schemaVersion, 7)
  const restored = restoreSavedGame(saved)
  assert.deepEqual(JSON.parse(serializeLog(restored)), JSON.parse(serializeLog(game)))
})

test('cloud decision waits for authoritative response, deduplicating a double tap', async () => {
  const local = createMultiCourseGame('native-cloud-test', 0, 1)
  const initial = { session: { id: 'native-session', stateVersion: 4, status: 'active' }, state: local, result: null } as unknown as SessionDetail
  let release: () => void = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  const sent: string[] = []
  const controller = createServerSession({
    read: async () => initial,
    action: async (id, _input, key) => {
      sent.push(key)
      await gate
      return { sessionId: id, stateVersion: 5, state: initial.state, result: null }
    },
  }, initial, () => 'same-native-key')
  const pending = controller.send({ type: 'advance' }, 4)
  assert.equal(controller.getSnapshot().detail, initial)
  assert.equal(await controller.send({ type: 'advance' }, 4), false)
  release()
  assert.equal(await pending, true)
  assert.deepEqual(sent, ['same-native-key'])
  assert.equal(controller.getSnapshot().detail.session.stateVersion, 5)
})

test('network retry reuses idempotency and old versions reload without auto-applying', async () => {
  const initial = { session: { id: 'native-session', stateVersion: 4, status: 'active' }, state: {}, result: null } as unknown as SessionDetail
  const next = { ...initial, session: { ...initial.session, stateVersion: 6 } }
  const keys: string[] = []
  const controller = createServerSession({
    read: async () => next,
    action: async (_id, _request, key) => {
      keys.push(key)
      if (keys.length === 1) throw new TypeError('transport failure')
      throw new ApiError(409, 'STATE_VERSION_CONFLICT')
    },
  }, initial, () => 'action-1')
  assert.equal(await controller.send({ type: 'advance' }, 4), false)
  assert.equal(controller.getSnapshot().retryable, true)
  assert.equal(controller.getSnapshot().detail, initial)
  assert.equal(await controller.retry(), false)
  assert.deepEqual(keys, ['action-1','action-1'])
  assert.equal(controller.getSnapshot().detail, next)
})

test('native default can run canonical What-if without requesting Gemini', async () => {
  const input: WhatIfRequest = { stateVersion: 8, sequence: 2, alternative: { mode: 'omit' } }
  let attempts = 0
  const api = createGameApi(async () => 'mock-only', async (_url, options) => {
    attempts++
    assert.equal(JSON.parse(String(options?.body)).allowGemini, false)
    return Response.json({ version: 1, operation: 'explain', assistance: 'not-requested',
      stateVersion: 8, evaluation: { stateVersion: 8, sequence: 2 } })
  }, false)
  const first = await api.simulateWhatIf('native-session', input)
  assert.strictEqual(await api.simulateWhatIf('native-session', input), first)
  assert.equal(attempts, 1)
})

test('expired Cloud Save token refreshes once and an account switch prevents further requests', async () => {
  let session = { user: { id: 'fixture-a' }, access_token: 'fixture-old' }
  let refreshes = 0
  const tokens = createAccountToken('fixture-a', async () => session, async () => {
    refreshes++
    session = { ...session, access_token: 'fixture-new' }
    return session
  }, () => assert.fail('the owning fixture still has a session'))
  const headers: (string | null)[] = []
  const api = createGameApi(tokens, async (_url, options) => {
    const header = new Headers(options?.headers).get('authorization')
    headers.push(header)
    return header === 'Bearer fixture-old' ? new Response(null, { status: 401 }) : Response.json({ sessions: [] })
  })
  assert.deepEqual(await api.list(), { sessions: [] })
  assert.deepEqual(headers, ['Bearer fixture-old', 'Bearer fixture-new'])
  assert.equal(refreshes, 1)

  session = { user: { id: 'fixture-b' }, access_token: 'fixture-other-owner' }
  await assert.rejects(api.list(), (error: unknown) => error instanceof ApiError && error.status === 401)
  assert.equal(headers.length, 2)
})

test('What-if ownership errors do not trigger a second endpoint', async () => {
  let requests = 0
  const api = createGameApi(async () => 'fixture-token', async () => {
    requests++
    return Response.json({ error: { code: 'SESSION_NOT_FOUND' } }, { status: 404 })
  }, false)
  await assert.rejects(api.simulateWhatIf('fixture-session', {
    stateVersion: 8, sequence: 2, alternative: { mode: 'omit' },
  }), (error: unknown) => error instanceof ApiError && error.status === 404)
  assert.equal(requests, 1)
})
