import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { createGameplayAnalytics, ANALYTICS_KEY, DAY_MS } from '../src/analytics/core.ts'
import type { AnalyticsEvent } from '../src/analytics/schema.ts'
import { GAME_SAVE_KEY } from '../../../src/game/saved-game.ts'

function fixture(configured = true) {
  let now = Date.UTC(2026, 10, 27), counter = 0, offline = false
  const data = new Map<string, string>(), received: AnalyticsEvent[][] = []
  const deps = {
    configured, testMode: true, build: '9', now: () => now,
    uuid: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
    hash: async (text: string) => createHash('sha256').update(text).digest('hex'),
    storage: { getItem: async (key: string) => data.get(key) ?? null, setItem: async (key: string, value: string) => { data.set(key, value) } },
    send: async (events: AnalyticsEvent[], signal: AbortSignal) => {
      if (offline || signal.aborted) throw Error('offline')
      received.push(structuredClone(events))
    },
  }
  return { deps, data, received, core: createGameplayAnalytics(deps),
    advance: (ms: number) => { now += ms }, offline: (value: boolean) => { offline = value } }
}
const state = (laps: number[] = [], outcome?: 'victory' | 'defeat' | 'insolvent') => ({ key: 'synthetic-private-seed', mode: 'local' as const, completedLaps: laps, outcome })

test('friend profile emits all six event types as non-QA only after consent', async () => {
  const f = fixture()
  const core = createGameplayAnalytics({ ...f.deps, testMode: false, build: '12' })
  const save = 'existing local save is not analytics storage'
  f.data.set(GAME_SAVE_KEY, save)
  await core.initialize(); await core.activate()
  await core.gameStarted(state(), false); await core.flush()
  assert.equal(f.received.length, 0)
  assert.equal(f.data.get(ANALYTICS_KEY), undefined)
  await core.setConsent(true)
  await core.gameStarted(state(), false); await core.gameStarted(state(), false)
  for (const lap of [1, 2, 3, 4]) {
    const before = state(Array.from({ length: lap - 1 }, (_, i) => i + 1))
    const after = state(Array.from({ length: lap }, (_, i) => i + 1), lap === 4 ? 'victory' : undefined)
    await core.transition(before, after); await core.transition(before, after)
  }
  await core.gameStarted({ ...state(), key: 'friend-replay' }, true)
  f.advance(DAY_MS); core.background(); await core.activate(); await core.flush()
  const events = f.received.flat()
  assert.deepEqual([...new Set(events.map(e => e.name))].sort(),
    ['app_open', 'game_started', 'lap_completed', 'game_completed', 'replay_started', 'return_visit'].sort())
  assert.ok(events.every(e => e.properties.test_mode === false && e.properties.app_build === '12'))
  assert.equal(new Set(events.map(e => e.id)).size, events.length)
  assert.equal(new Set(events.map(e => e.anonymousId)).size, 1)
  assert.doesNotMatch(JSON.stringify(events), /synthetic-private-seed|friend-replay|email|auth_id|portfolio|cash|lawfulProceeds/)
  assert.equal(f.data.get(GAME_SAVE_KEY), save)
  const delivered = f.received.length
  await core.setConsent(false); await core.gameStarted(state(), false); await core.flush()
  assert.equal(f.received.length, delivered)
})

test('switching build profile preserves queued QA labels and UUIDs instead of relabeling them as friends', async () => {
  const f = fixture()
  f.offline(true)
  await f.core.initialize(); await f.core.activate(); await f.core.setConsent(true); await f.core.flush()
  const queued = JSON.parse(f.data.get(ANALYTICS_KEY)!).outbox as AnalyticsEvent[]
  assert.equal(queued.length, 1); assert.equal(queued[0].properties.test_mode, true)
  const friend = createGameplayAnalytics({ ...f.deps, testMode: false, build: '12' })
  await friend.initialize(); await friend.activate()
  f.offline(false); await friend.flush()
  const events = f.received.flat()
  assert.equal(events.length, 2)
  assert.deepEqual(events[0], queued[0], 'pending QA event is not reclassified or assigned a new UUID')
  assert.equal(events[1].properties.test_mode, false); assert.equal(events[1].properties.app_build, '12')
  assert.equal(events[1].anonymousId, queued[0].anonymousId)
  assert.equal(events[1].properties.first_seen, queued[0].properties.first_seen)
})

test('default/declined consent and absent provider collect no gameplay or identity', async () => {
  for (const configured of [true, false]) {
    const f = fixture(configured)
    await f.core.initialize(); await f.core.activate()
    await f.core.gameStarted(state(), false); await f.core.transition(state(), state([1]))
    assert.equal(f.data.size, 0); assert.equal(f.received.length, 0)
    if (!configured) {
      await f.core.setConsent(true); await f.core.gameStarted(state(), false); await f.core.flush()
      assert.equal(f.received.length, 0)
      assert.doesNotMatch(f.data.get(ANALYTICS_KEY)!, /firstSeen|anonymousId|synthetic-private-seed/)
    }
    await f.core.setConsent(false); await f.core.gameStarted(state(), false); await f.core.flush()
    assert.equal(f.received.length, 0)
  }
})

test('real transitions dedupe starts, laps, outcome and replay across cold restore', async () => {
  const f = fixture(); await f.core.initialize(); await f.core.activate(); await f.core.setConsent(true)
  await f.core.gameStarted(state(), false); await f.core.gameStarted(state(), false)
  for (const lap of [1, 2, 3, 4]) {
    const before = state(Array.from({ length: lap - 1 }, (_, i) => i + 1))
    const after = state(Array.from({ length: lap }, (_, i) => i + 1), lap === 4 ? 'defeat' : undefined)
    await f.core.transition(before, after); await f.core.transition(before, after)
  }
  await f.core.flush()
  const restarted = createGameplayAnalytics(f.deps); await restarted.initialize(); await restarted.activate()
  await restarted.transition(state([1, 2, 3, 4], 'defeat'), state([1, 2, 3, 4], 'defeat'))
  const replay = { ...state(), key: 'different-game' }
  await restarted.gameStarted(replay, true); await restarted.gameStarted(replay, true); await restarted.flush()
  const events = f.received.flat()
  assert.equal(events.filter(e => e.name === 'game_started').length, 2)
  assert.equal(events.filter(e => e.name === 'lap_completed').length, 4)
  assert.equal(events.filter(e => e.name === 'game_completed').length, 1)
  assert.equal(events.filter(e => e.name === 'replay_started').length, 1)
  assert.equal(new Set(events.map(e => e.id)).size, events.length)
  assert.equal(new Set(events.map(e => e.anonymousId)).size, 1, 'two games and a cold restart retain one player')
  assert.equal(new Set(events.map(e => e.properties.first_seen)).size, 1)
  assert.doesNotMatch(JSON.stringify(events), /synthetic-private-seed|different-game|email|lawfulProceeds|portfolio/)
})

test('restoring historical completion without a transition does not backfill events', async () => {
  const f = fixture(); await f.core.initialize(); await f.core.activate(); await f.core.setConsent(true)
  const old = state([1, 2, 3, 4], 'victory')
  await f.core.transition(old, old); await f.core.flush()
  assert.equal(f.received.flat().filter(e => e.name === 'game_completed' || e.name === 'lap_completed').length, 0)
})

test('D1/D7 require actual return in elapsed 24h buckets; same-day opens never imply retention', async () => {
  const f = fixture(); await f.core.initialize(); await f.core.activate(); await f.core.setConsent(true)
  for (let i = 0; i < 8; i++) { f.core.background(); f.advance(60_000); await f.core.activate() }
  await f.core.flush()
  assert.equal(f.received.flat().filter(e => e.name === 'app_open').length, 1)
  assert.equal(f.received.flat().filter(e => e.name === 'return_visit').length, 0)
  f.advance(DAY_MS); f.core.background(); await f.core.activate(); await f.core.flush()
  f.advance(6 * DAY_MS); f.core.background(); await f.core.activate(); await f.core.activate(); await f.core.flush()
  assert.deepEqual(f.received.flat().filter(e => e.name === 'return_visit').map(e => e.properties.days_since_first_seen), [1, 7])
  assert.equal(new Set(f.received.flat().map(e => e.anonymousId)).size, 1)
  assert.equal(new Set(f.received.flat().map(e => e.properties.first_seen)).size, 1)
})

test('offline queue persists and retry uses exact UUID; gameplay inputs are never mutated', async () => {
  const f = fixture(); await f.core.initialize(); await f.core.activate(); await f.core.setConsent(true)
  f.offline(true); const before = state(), after = state([1]); const original = structuredClone({ before, after })
  await f.core.gameStarted(before, false); await f.core.transition(before, after); await f.core.flush()
  const queued = JSON.parse(f.data.get(ANALYTICS_KEY)!).outbox as AnalyticsEvent[]
  assert.ok(queued.length >= 3); assert.equal(f.received.length, 0)
  const restarted = createGameplayAnalytics(f.deps); await restarted.initialize()
  f.offline(false); f.advance(60_000); await restarted.flush()
  assert.deepEqual(f.received.flat().map(e => e.id), queued.map(e => e.id))
  assert.deepEqual(f.received.flat().map(e => e.anonymousId), queued.map(e => e.anonymousId))
  assert.deepEqual({ before, after }, original)
  assert.equal(JSON.parse(f.data.get(ANALYTICS_KEY)!).outbox.length, 0)
})

test('withdrawal aborts active transport, clears queue/identity and blocks later captures', async () => {
  const f = fixture(); let started: () => void = () => {}, observedSignal: AbortSignal | undefined
  const entered = new Promise<void>(resolve => { started = resolve })
  const core = createGameplayAnalytics({ ...f.deps, send: async (_events, signal) => {
    observedSignal = signal; started(); await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }))
  } })
  await core.initialize(); await core.activate(); await core.setConsent(true)
  const sending = core.flush(); await entered
  const decline = core.setConsent(false)
  assert.equal(observedSignal?.aborted, true)
  await sending; await decline; await core.transition(state(), state([1])); await core.flush()
  assert.doesNotMatch(f.data.get(ANALYTICS_KEY)!, /anonymousId|firstSeen|game_id|app_open/)
})

test('storage failure is fail-closed for analytics and fail-open for callers', async () => {
  const f = fixture(); const core = createGameplayAnalytics({ ...f.deps, storage: {
    getItem: async () => { throw Error('storage unavailable') }, setItem: async () => { throw Error('storage unavailable') },
  } })
  await assert.doesNotReject(async () => { await core.initialize(); await core.setConsent(true); await core.activate(); await core.gameStarted(state(), false); await core.flush() })
  assert.equal(f.received.length, 0)
})

test('queue is bounded, expired data is not sent, renewed consent gets a new install identity', async () => {
  const f = fixture(); await f.core.initialize(); await f.core.activate(); await f.core.setConsent(true)
  for (let i = 0; i < 210; i++) await f.core.gameStarted({ ...state(), key: 'game-' + i }, false)
  const saved = JSON.parse(f.data.get(ANALYTICS_KEY)!)
  assert.equal(saved.outbox.length, 200); assert.equal(saved.games.length, 128)
  assert.ok(f.data.get(ANALYTICS_KEY)!.length <= 256_000)
  f.advance(31 * DAY_MS); await f.core.flush(); assert.equal(f.received.length, 0)
  await f.core.setConsent(false); await f.core.setConsent(true); await f.core.flush()
  assert.notEqual(f.received.flat()[0].anonymousId, saved.anonymousId)
})

test('corrupt storage fails closed and rejects unexpected identity/payload fields', async () => {
  const f = fixture(); f.data.set(ANALYTICS_KEY, '{malformed')
  await f.core.initialize(); await f.core.activate(); await f.core.flush()
  assert.equal(f.core.getSnapshot().consent, 'unknown'); assert.equal(f.received.length, 0)
})

test('revocation discards offline retries, preserves the local save and starts a new consent epoch', async () => {
  const f = fixture(), localSave = 'existing local game save must remain byte-for-byte unchanged'
  f.data.set(GAME_SAVE_KEY, localSave)
  await f.core.initialize(); await f.core.activate(); await f.core.setConsent(true); await f.core.flush()
  const old = f.received.flat()[0]
  f.offline(true); await f.core.gameStarted(state(), false); await f.core.flush()
  assert.ok(JSON.parse(f.data.get(ANALYTICS_KEY)!).outbox.length)
  await f.core.setConsent(false)
  const writesAfterRevoke = f.data.get(ANALYTICS_KEY), sendsAfterRevoke = f.received.length
  f.advance(7 * DAY_MS); f.offline(false)
  await f.core.flush(); await f.core.activate(); await f.core.gameStarted(state(), false)
  assert.equal(f.received.length, sendsAfterRevoke)
  assert.equal(f.data.get(ANALYTICS_KEY), writesAfterRevoke)
  await f.core.setConsent(true); await f.core.flush()
  const renewed = f.received.at(-1)!
  assert.equal(renewed.length, 1); assert.equal(renewed[0].name, 'app_open')
  assert.notEqual(renewed[0].anonymousId, old.anonymousId)
  assert.notEqual(renewed[0].properties.first_seen, old.properties.first_seen)
  assert.equal(f.data.get(GAME_SAVE_KEY), localSave)
  const restored = createGameplayAnalytics(f.deps)
  await restored.initialize(); await restored.activate(); await restored.flush()
  assert.equal(f.received.at(-1)![0].anonymousId, renewed[0].anonymousId)
  assert.equal(f.received.at(-1)![0].properties.first_seen, renewed[0].properties.first_seen)
  assert.equal(f.data.get(GAME_SAVE_KEY), localSave)
})

test('a late completion after revoke cannot remove or send events from the new consent epoch', async () => {
  const f = fixture(); let entered: () => void = () => {}, release: () => void = () => {}, sends = 0
  const started = new Promise<void>(resolve => { entered = resolve })
  const finish = new Promise<void>(resolve => { release = resolve })
  const core = createGameplayAnalytics({ ...f.deps, send: async (events, signal) => {
    if (++sends === 1) { entered(); await finish; assert.equal(signal.aborted, true); return }
    f.received.push(structuredClone(events))
  } })
  await core.initialize(); await core.activate(); await core.setConsent(true)
  const firstIdentity = JSON.parse(f.data.get(ANALYTICS_KEY)!).anonymousId
  const pending = core.flush(); await started
  await core.setConsent(false); await core.setConsent(true)
  const nextIdentity = JSON.parse(f.data.get(ANALYTICS_KEY)!).anonymousId
  assert.notEqual(firstIdentity, nextIdentity)
  release(); await pending; await core.flush()
  assert.equal(f.received.flat().length, 1)
  assert.equal(f.received.flat()[0].anonymousId, nextIdentity)
  assert.equal(JSON.parse(f.data.get(ANALYTICS_KEY)!).outbox.length, 0)
})
