import { advance, canChoose, decide } from '../../../src/game/engine.ts'
import { eventsForGame } from '../../../src/data/events.ts'
import type { GameState, LogEntry } from '../../../src/game/types.ts'
import { EndgameRejected, requireEndgame } from './endgame-whatif-contract.ts'
import type { SourceIdentity, WorkBudget, Followup, ContinuationBoundary } from './endgame-whatif-contract.ts'
import { applyRecorded } from './endgame-whatif-replay.ts'
import { commandIdentity, digest, canonical, equalData } from './endgame-whatif-identity.ts'
import { externalState, sameExternal } from './endgame-whatif-fairness.ts'

type Pair = { actual: GameState; alternative: GameState }
export type ContinuationStep = ({ ok: true; boundaries: number; advances: number } & Pair)
  | ({ ok: false; reason: string; boundary: ContinuationBoundary } & Pair)
const context = (s: GameState) => ({ phase: s.phase, turn: s.turn, lap: s.lap, position: s.position, eventId: s.eventId })
function difference(a: GameState, b: GameState): string | null {
  if (b.termination === 'insolvent') return 'early-insolvency'
  if (b.phase === 'finished' && a.phase !== 'finished') return 'early-terminal'
  if (a.phase === 'funding' && b.phase !== 'funding') return 'funding-no-longer-needed'
  if (b.phase === 'funding' && a.phase !== 'funding') return 'new-pending-funding'
  if (!equalData(a.pendingPayment, b.pendingPayment)) return 'funding-requirements-mismatch'
  if (a.phase !== b.phase || a.turn !== b.turn || a.lap !== b.lap || a.position !== b.position || a.eventId !== b.eventId) return 'context-mismatch'
  return sameExternal(a, b) ? null : 'external-mismatch'
}
/** Internal engine boundary also exported for adversarial engine-fixture tests, not a generic fork API. */
export function continueRecorded(actual: GameState, alternative: GameState, entry: LogEntry, work: WorkBudget): ContinuationStep {
  let a = actual, b = alternative, boundaries = 0, advances = 0
  const blocked = (reason: string, boundary: ContinuationBoundary = 'before-command'): ContinuationStep => ({ ok: false, reason, boundary, actual: a, alternative: b })
  for (let i = 0; a.phase !== entry.before.phase || a.lap !== entry.before.lap; i++) {
    const mismatch = difference(a, b)
    if (mismatch) return blocked(mismatch)
    if (i === 4) return blocked('advance-bound')
    work.step()
    const an = advance(a), bn = advance(b)
    if (an === a || bn === b) return blocked('engine-no-progress')
    a = an; b = bn; advances++
    const after = difference(a, b)
    if (after) return blocked(after, 'phase-advance')
    boundaries++
  }
  const mismatch = difference(a, b)
  if (mismatch) return blocked(mismatch)
  if (a.turn !== entry.before.turn || a.position !== entry.before.position
    || (entry.kind === 'decision' && a.eventId !== entry.eventId)) return blocked('recorded-context-mismatch')
  boundaries++
  let nextActual: GameState, nextAlternative: GameState
  try {
    nextActual = applyRecorded(a, entry, work)
    nextAlternative = applyRecorded(b, entry, work)
  } catch (error) {
    if (error instanceof EndgameRejected && ['cancelled', 'step-budget', 'time-budget'].includes(error.message)) throw error
    return blocked('illegal-recorded-action')
  }
  a = nextActual; b = nextAlternative
  const after = difference(a, b)
  return after ? blocked(after, 'after-command') : { ok: true, actual: a, alternative: b, boundaries: boundaries + 1, advances }
}
export function finalAdvancePair(actual: GameState, alternative: GameState, work: WorkBudget): ContinuationStep {
  let a = actual, b = alternative, advances = 0, boundaries = 0
  for (let i = 0; a.phase !== 'finished'; i++) {
    const reason = difference(a, b)
    if (reason) return { ok: false, reason, boundary: 'phase-advance', actual: a, alternative: b }
    if (i === 4) return { ok: false, reason: 'advance-bound', boundary: 'phase-advance', actual: a, alternative: b }
    work.step()
    const an = advance(a), bn = advance(b)
    if (an === a || bn === b) return { ok: false, reason: 'engine-no-progress', boundary: 'phase-advance', actual: a, alternative: b }
    a = an; b = bn; advances++
    const after = difference(a, b)
    if (after) return { ok: false, reason: after, boundary: 'phase-advance', actual: a, alternative: b }
    boundaries++
  }
  const reason = difference(a, b)
  return reason ? { ok: false, reason, boundary: 'phase-advance', actual: a, alternative: b } : { ok: true, actual: a, alternative: b, advances, boundaries }
}
export async function continuationFacts(identity: SourceIdentity, entry: LogEntry, sourceCommandIndex: number, alternative: GameState, reason: string, boundary: ContinuationBoundary = 'before-command'): Promise<Followup> {
  const legalOptions: Followup['legalOptions'] = []
  if (alternative.phase === 'event') {
    const options = eventsForGame(alternative).find(event => event.id === alternative.eventId)?.options ?? []
    requireEndgame(options.length <= 10, 'option-budget')
    for (const option of options) {
      if (!canChoose(alternative, option.id)) continue
      try {
        const probe = decide(structuredClone(alternative), option.id)
        if (probe.log.length > alternative.log.length) legalOptions.push({ id: option.id, label: option.label })
      } catch { /* A failed engine probe is never offered as a legal option. */ }
    }
  }
  return { source: structuredClone(identity), command: commandIdentity(entry), reason, context: context(alternative),
    cursor: { sourceCommandIndex, boundary, nextSourceCommandIndex: sourceCommandIndex + (boundary === 'after-command' ? 1 : 0), sourceSequence: entry.sequence, alternativeLogLength: alternative.log.length,
      alternativePrefixHash: await digest(canonical(alternative.log)), externalHash: await digest(canonical(externalState(alternative))) },
    legalOptions, resumeSupported: false }
}
