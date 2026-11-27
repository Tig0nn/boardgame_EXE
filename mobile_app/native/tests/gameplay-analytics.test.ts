import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { createGameplayAnalytics, ANALYTICS_KEY, DAY_MS } from '../src/analytics/core.ts'
import type { AnalyticsEvent } from '../src/analytics/schema.ts'

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
