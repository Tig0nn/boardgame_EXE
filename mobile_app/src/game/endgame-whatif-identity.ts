import { captureDataIntegrity } from './endgame-whatif-integrity.ts'
import type { LogEntry } from '../../../src/game/types.ts'
import { COURSE_POLICY, ENDGAME_ENGINE, ENDGAME_PROFILE, EndgameRejected, requireEndgame } from './endgame-whatif-contract.ts'
import type { CommandIdentity, CourseRequest, Source, WorkBudget } from './endgame-whatif-contract.ts'

export const canonical = (value: unknown) => JSON.stringify(value, (_key, v) =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map(key => [key, v[key]])) : v)
export const equalData = (a: unknown, b: unknown) => canonical(a) === canonical(b)
export async function digest(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('')
}
export const metadataKeys = ['schemaVersion', 'rulesVersion', 'seed', 'gameplayProfile', 'goalRulesVersion', 'courseRulesVersion', 'courseConfig', 'livingExpenseRulesVersion', 'livingExpenseConfig', 'boardRevision', 'board', 'bondRulesVersion', 'bondCreditConfig', 'stockCatalogVersion', 'savingsProfile', 'businessRulesVersion', 'encounterRulesVersion', 'financialConfig', 'mode'] as const
export const sourceConfig = (source: Source) => Object.fromEntries(metadataKeys.filter(k => k !== 'seed').map(k => [k, source[k]]))
export function commandIdentity(entry: LogEntry): CommandIdentity {
  const action = entry.action ? { kind: entry.action.kind, amount: entry.action.amount,
    ...Object.fromEntries(['asset', 'symbolId', 'lotId', 'term', 'trend', 'issuerId', 'customerPreferenceId', 'completeEncounter']
      .filter(key => entry.action![key as keyof typeof entry.action] !== undefined)
      .map(key => [key, entry.action![key as keyof typeof entry.action]])) } : null
  if (action) for (const [key, value] of Object.entries(action)) {
    const valid = key === 'amount' ? Number.isSafeInteger(value) && Number(value) > 0
      : key === 'term' ? [1, 2, 3].includes(Number(value)) && typeof value === 'number'
        : key === 'completeEncounter' ? typeof value === 'boolean'
          : typeof value === 'string' && value.length > 0 && value.length <= 64
    requireEndgame(valid, 'identity-action-invalid')
  }
  return { sequence: entry.sequence, kind: entry.kind, turn: entry.turn, lap: entry.lap, tileId: entry.tileId,
    eventId: entry.eventId ?? null, decisionId: entry.decisionId ?? null, action }
}
export function parseHistory(text: string): Source {
  requireEndgame(typeof text === 'string' && text.length > 0 && text.length <= 20_000_000, 'source-size')
  let source: Source
  try { source = JSON.parse(text) as Source } catch { throw new EndgameRejected('invalid-source-json') }
  captureDataIntegrity(source)
  requireEndgame(source && source.schemaVersion === 7 && source.rulesVersion === 'gameplay-core-mvp-b18-multi-course-v1'
    && source.state?.gameplayProfile === ENDGAME_PROFILE && source.state.totalLaps === 4 && source.seed === source.state.seed, 'source-version')
  requireEndgame(typeof source.seed === 'string' && source.seed.length > 0 && source.seed.length <= 128
    && Array.isArray(source.entries) && source.entries.length > 1 && source.entries.length <= 500
    && source.entries.every((e, i) => e && e.sequence === i + 1)
    && equalData(source.entries, source.state.log), 'history-invalid')
  return source
}
export async function identifyCourse(text: string, sequence: number, work: WorkBudget): Promise<CourseRequest> {
  work.check()
  const source = parseHistory(text), entry = source.entries[sequence - 1]
  requireEndgame(Number.isSafeInteger(sequence) && sequence > 1 && entry?.kind === 'decision'
    && entry.eventId === 'course' && entry.decisionId === 'course-basic', 'explicit-basic-required')
  const sourceHash = await digest(text), configHash = await digest(canonical(sourceConfig(source)))
  work.check()
  return { source: text, identity: { sourceHash, configHash, engine: ENDGAME_ENGINE, policy: COURSE_POLICY,
    branch: 'alternative-skip', decision: commandIdentity(entry) } }
}
