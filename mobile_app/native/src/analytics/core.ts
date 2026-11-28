import { sanitizeEvent, isUUID, type AnalyticsEvent, type EventName, type GameSignal } from './schema.ts'

export const ANALYTICS_KEY = 'exe:analytics:consent-and-outbox:v1'
export const DAY_MS = 86_400_000
const SESSION_GAP = 30 * 60_000, MAX_EVENTS = 200, MAX_GAMES = 128, TTL = 30 * DAY_MS
type GameRecord = { id: string; mode: 'local' | 'cloud'; started: boolean; laps: number[]; completed: boolean }
type State = { version: 1; consent: 'unknown' | 'enabled' | 'disabled'; anonymousId?: string; firstSeen?: number; lastReturnDay?: number; games: GameRecord[]; outbox: AnalyticsEvent[] }
export type AnalyticsStatus = { ready: boolean; consent: State['consent']; configured: boolean; storageAvailable: boolean }
export type AnalyticsDependencies = {
  configured: boolean; testMode: boolean; build: string; now: () => number; uuid: () => string
  hash: (text: string) => Promise<string>
  storage: { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> }
  send: (events: AnalyticsEvent[], signal: AbortSignal) => Promise<void>
}
const empty = (consent: State['consent'] = 'unknown'): State => ({ version: 1, consent, games: [], outbox: [] })
const laps = (values: number[]) => [...new Set(values.filter(n => [1, 2, 3, 4].includes(n)))].sort()
function restore(text: string | null, defaultEnabled: boolean): State {
  if (text === null) return empty(defaultEnabled ? 'enabled' : 'unknown')
  if (!text || text.length > 256_000) return empty()
  try {
    const v = JSON.parse(text) as State
    if (v.version !== 1 || !['unknown', 'enabled', 'disabled'].includes(v.consent)) return empty()
    if (v.consent === 'unknown' && defaultEnabled) return empty('enabled')
    if (v.consent !== 'enabled') return empty(v.consent)
    if (!v.anonymousId && !v.firstSeen) return empty('enabled')
    if (!isUUID(v.anonymousId) || !Number.isFinite(v.firstSeen) || !Array.isArray(v.games) || !Array.isArray(v.outbox)) return empty()
    const games = v.games.slice(-MAX_GAMES).filter(g => isUUID(g.id) && ['local', 'cloud'].includes(g.mode)
      && typeof g.started === 'boolean' && typeof g.completed === 'boolean' && Array.isArray(g.laps))
      .map(g => ({ id: g.id, mode: g.mode, started: g.started, completed: g.completed, laps: laps(g.laps) }))
    return { version: 1, consent: 'enabled', anonymousId: v.anonymousId, firstSeen: v.firstSeen,
      lastReturnDay: Number.isInteger(v.lastReturnDay) ? v.lastReturnDay : 0, games,
      outbox: v.outbox.slice(-MAX_EVENTS).map(sanitizeEvent).filter((e): e is AnalyticsEvent => !!e && e.anonymousId === v.anonymousId) }
  } catch { return empty() }
}

export function createGameplayAnalytics(deps: AnalyticsDependencies) {
  let state = empty(), blocked = false, gate = false, ready: Promise<void> | undefined
  let tail = Promise.resolve(), epoch = 0, flight: Promise<void> | undefined, request: AbortController | undefined
  let active = false, backgroundAt: number | undefined, session: string | undefined, failures = 0, retryAt = 0
  let wantedConsent: boolean | undefined
  let status: AnalyticsStatus = { ready: false, consent: 'unknown', configured: deps.configured, storageAvailable: true }
  const listeners = new Set<() => void>()
  const allowed = () => deps.configured && gate && !blocked && state.consent === 'enabled'
  function publish() {
    status = { ready: true, consent: blocked ? 'disabled' : state.consent, configured: deps.configured, storageAvailable: !blocked }
    for (const listener of listeners) { try { listener() } catch { /* observer cannot break gameplay */ } }
  }
  function failClosed() { blocked = true; gate = false; request?.abort(); publish() }
  function initialize() {
    ready ??= Promise.resolve().then(() => deps.storage.getItem(ANALYTICS_KEY)).then(text => {
      // Friend Beta defaults ON only without a saved choice. QA remains opt-in;
      // saved OFF and malformed preferences never fall through to this default.
      state = restore(text, deps.configured && !deps.testMode)
      gate = wantedConsent ?? state.consent === 'enabled'; publish()
    }).catch(failClosed)
    return ready
  }
  function enqueue(work: () => Promise<void>) {
    tail = tail.then(initialize).then(work).catch(failClosed)
    return tail
  }
  async function persist() {
    state.games = state.games.slice(-MAX_GAMES)
    state.outbox = state.outbox.filter(e => deps.now() - Date.parse(String(e.properties.occurred_at)) <= TTL).slice(-MAX_EVENTS)
    const text = JSON.stringify(state)
    if (text.length > 256_000) throw Error('Analytics capacity exceeded')
    await deps.storage.setItem(ANALYTICS_KEY, text); publish()
  }
  async function id(key: string) {
    const hash = await deps.hash(state.anonymousId + '|' + key)
    if (!/^[a-f\d]{64}$/i.test(hash)) throw Error('Invalid analytics hash')
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-${((parseInt(hash[16], 16) & 3) | 8).toString(16)}${hash.slice(17, 20)}-${hash.slice(20, 32)}`
  }
  async function push(name: EventName, semanticKey: string, extra: AnalyticsEvent['properties']) {
    const eventId = await id(semanticKey)
    if (!allowed() || !state.anonymousId || !state.firstSeen || !session) return
    const event = sanitizeEvent({ id: eventId, anonymousId: state.anonymousId, name, properties: {
      schema_version: 1, platform: 'android', app_build: deps.build, test_mode: deps.testMode,
      first_seen: new Date(state.firstSeen).toISOString(), occurred_at: new Date(deps.now()).toISOString(), visit_id: session, ...extra,
    } })
    if (event && !state.outbox.some(e => e.id === event.id)) state.outbox.push(event)
  }
  async function opening(reason: 'cold_start' | 'foreground' | 'consent_enabled', newSession: boolean) {
    if (!allowed()) return
    state.anonymousId ??= deps.uuid(); state.firstSeen ??= deps.now()
    if (!isUUID(state.anonymousId)) throw Error('Invalid anonymous ID')
    if (!session || newSession) {
      session = deps.uuid()
      await push('app_open', 'open:' + session, { opening: reason })
    }
    const day = Math.floor((deps.now() - state.firstSeen) / DAY_MS)
    if (day > 0 && day > (state.lastReturnDay ?? 0)) {
      await push('return_visit', 'return:' + day, { days_since_first_seen: day }); state.lastReturnDay = day
    }
  }
  async function gameRecord(signal: GameSignal) {
    if (!signal.key || signal.key.length > 256 || !['local', 'cloud'].includes(signal.mode)) throw Error('Invalid game signal')
    const gameId = await id(signal.mode + ':' + signal.key)
    let record = state.games.find(g => g.id === gameId)
    if (!record) { record = { id: gameId, mode: signal.mode, started: false, laps: laps(signal.completedLaps), completed: !!signal.outcome }; state.games.push(record) }
    return record
  }
  function setConsent(enabled: boolean) {
    wantedConsent = enabled; epoch++; request?.abort()
    // Revoke synchronously, before waiting on storage or a network operation.
    if (!enabled) gate = false
    return enqueue(async () => {
      if (blocked) return
      if (!enabled) { state = empty('disabled'); session = undefined; retryAt = 0; await persist(); return }
      if (state.consent === 'enabled' && gate) return
      state.consent = 'enabled'; await persist(); gate = true
      if (active) { await opening('consent_enabled', false); await persist() }
    })
  }
  function activate() {
    const wasActive = active, gap = backgroundAt === undefined ? 0 : deps.now() - backgroundAt
    active = true; backgroundAt = undefined
    return enqueue(async () => {
      if (!allowed() || wasActive && session) return
      await opening(session ? 'foreground' : 'cold_start', gap >= SESSION_GAP); await persist()
    })
  }
  function background() { if (active) { active = false; backgroundAt = deps.now() } }
  function gameStarted(signal: GameSignal, replay: boolean) {
    if (!gate || !deps.configured) return Promise.resolve()
    return enqueue(async () => {
      if (!allowed() || !session) return
      const g = await gameRecord(signal)
      if (!allowed() || g.started) return
      await push('game_started', 'started:' + g.id, { game_id: g.id, mode: g.mode, start_reason: replay ? 'replay' : 'fresh' })
      if (replay) await push('replay_started', 'replay:' + g.id, { game_id: g.id, mode: g.mode })
      g.started = true; await persist()
    })
  }
  function transition(before: GameSignal, after: GameSignal) {
    if (!gate || !deps.configured || before.key !== after.key || before.mode !== after.mode) return Promise.resolve()
    return enqueue(async () => {
      if (!allowed() || !session) return
      const g = await gameRecord(before)
      for (const lap of laps(after.completedLaps)) if (!g.laps.includes(lap)) {
        await push('lap_completed', 'lap:' + g.id + ':' + lap, { game_id: g.id, mode: g.mode, lap }); g.laps.push(lap)
      }
      if (!before.outcome && after.outcome && !g.completed) {
        await push('game_completed', 'completed:' + g.id, { game_id: g.id, mode: g.mode, outcome: after.outcome,
          completed_laps: laps(after.completedLaps).length, completed_four_laps: laps(after.completedLaps).length === 4 })
        g.completed = true
      }
      if (allowed()) await persist()
    })
  }
  function flush(): Promise<void> {
    if (flight) return flight
    flight = (async () => {
      await initialize(); await tail
      if (!allowed() || deps.now() < retryAt || !state.outbox.length) return
      const currentEpoch = epoch, batch = state.outbox.filter(e => deps.now() - Date.parse(String(e.properties.occurred_at)) <= TTL).slice(0, 20)
      if (!batch.length) return
      request = new AbortController()
      try {
        await deps.send(batch, request.signal)
        await enqueue(async () => {
          if (currentEpoch !== epoch || !allowed()) return
          const sent = new Set(batch.map(e => e.id)); state.outbox = state.outbox.filter(e => !sent.has(e.id))
          failures = 0; retryAt = 0; await persist()
        })
      } catch { retryAt = deps.now() + Math.min(60_000, 1_000 * 2 ** Math.min(++failures, 6)) }
      finally { request = undefined }
    })().catch(() => {}).finally(() => { flight = undefined })
    return flight
  }
  return { initialize, setConsent, activate, background, gameStarted, transition, flush,
    getSnapshot: () => status, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } } }
}
