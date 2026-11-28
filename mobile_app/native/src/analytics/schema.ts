export const EVENT_NAMES = ['app_open', 'game_started', 'lap_completed', 'game_completed', 'replay_started', 'return_visit'] as const
export type EventName = typeof EVENT_NAMES[number]
export type Outcome = 'victory' | 'defeat' | 'insolvent'
export type GameSignal = { key: string; mode: 'local' | 'cloud'; completedLaps: number[]; outcome?: Outcome }
export type AnalyticsEvent = { id: string; anonymousId: string; name: EventName; properties: Record<string, string | number | boolean> }
export const isUUID = (value: unknown): value is string => typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(value)
const common = ['schema_version', 'platform', 'app_build', 'test_mode', 'first_seen', 'occurred_at', 'visit_id']
const isoDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value) && Number.isFinite(Date.parse(value))
const specific: Record<EventName, string[]> = {
  app_open: ['opening'], game_started: ['game_id', 'mode', 'start_reason'],
  lap_completed: ['game_id', 'mode', 'lap'],
  game_completed: ['game_id', 'mode', 'outcome', 'completed_laps', 'completed_four_laps'],
  replay_started: ['game_id', 'mode'], return_visit: ['days_since_first_seen'],
}

/** Reconstruct the whitelist at both disk and SDK boundaries. No arbitrary payload survives. */
export function sanitizeEvent(value: unknown): AnalyticsEvent | null {
  if (!value || typeof value !== 'object') return null
  const e = value as Partial<AnalyticsEvent>
  if (!isUUID(e.id) || !isUUID(e.anonymousId) || !EVENT_NAMES.includes(e.name as EventName) || !e.properties) return null
  const name = e.name as EventName, p = e.properties, properties: AnalyticsEvent['properties'] = {}
  for (const key of [...common, ...specific[name]]) {
    const v = p[key]
    if (!['string', 'number', 'boolean'].includes(typeof v)) return null
    properties[key] = v
  }
  if (p.schema_version !== 1 || p.platform !== 'android' || typeof p.test_mode !== 'boolean'
    || typeof p.app_build !== 'string' || !/^\d{1,10}$/.test(p.app_build)
    || !isUUID(p.visit_id) || !isoDate(p.first_seen) || !isoDate(p.occurred_at)) return null
  if ('game_id' in properties && (!isUUID(p.game_id) || !['local', 'cloud'].includes(String(p.mode)))) return null
  if (name === 'app_open' && !['cold_start', 'foreground', 'consent_enabled'].includes(String(p.opening))) return null
  if (name === 'game_started' && !['fresh', 'replay'].includes(String(p.start_reason))) return null
  if (name === 'lap_completed' && (typeof p.lap !== 'number' || ![1, 2, 3, 4].includes(p.lap))) return null
  if (name === 'game_completed' && (!['victory', 'defeat', 'insolvent'].includes(String(p.outcome))
    || typeof p.completed_laps !== 'number' || ![0, 1, 2, 3, 4].includes(p.completed_laps)
    || p.completed_four_laps !== (p.completed_laps === 4))) return null
  if (name === 'return_visit' && (!Number.isInteger(p.days_since_first_seen) || Number(p.days_since_first_seen) < 1)) return null
  return { id: e.id, anonymousId: e.anonymousId, name, properties }
}
