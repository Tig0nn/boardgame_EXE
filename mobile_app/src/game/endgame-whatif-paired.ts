import { advance } from '../../../src/game/engine.ts'
import { snapshot } from '../../../src/game/state.ts'
import type { GameState, LogEntry } from '../../../src/game/types.ts'
import { EndgameRejected, requireEndgame } from './endgame-whatif-contract.ts'
import type { WorkBudget } from './endgame-whatif-contract.ts'
import { sameExternal } from './endgame-whatif-fairness.ts'
import { commandIdentity, equalData } from './endgame-whatif-identity.ts'
import { applyRecorded, isCommand } from './endgame-whatif-replay.ts'

export type ReplayPair = { actual: GameState; alternative: GameState }
export type PairStats = { externalCheckpoints: number; advances: number }
export type StoppedPair = ReplayPair & {
  ok: false
  reason: string
  engineReason: string | null
  boundary: 'before-command' | 'after-command' | 'phase-advance'
  actualCandidate?: GameState
  alternativeUnchanged: boolean
}
export type PairStep = StoppedPair | (ReplayPair & { ok: true })
export type PairPolicy = {
  prefix: string
  advancesPerGap: number
  advances: number
  beforeCommand?: (actual: GameState, alternative: GameState, entry: LogEntry) => string | null
  verifyRetainedCommand?: boolean
  allowLogRenumbering?: boolean
}
export const RECORDED_PAIR_POLICY: PairPolicy = Object.freeze({
  prefix: 'paired', advancesPerGap: 4, advances: 200, verifyRetainedCommand: true,
})

export function pairReason(actual: GameState, alternative: GameState): string | null {
  if (alternative.termination === 'insolvent') return 'early-insolvency'
  if (alternative.phase === 'finished' && actual.phase !== 'finished') return 'early-terminal'
  if (actual.pendingPayment || alternative.pendingPayment || actual.phase === 'funding' || alternative.phase === 'funding') {
    return 'unsupported-funding-context'
  }
  return sameExternal(actual, alternative) ? null : 'exogenous-or-context-mismatch'
}

function checkPair(actual: GameState, alternative: GameState, stats: PairStats) {
  const reason = pairReason(actual, alternative)
  if (!reason) stats.externalCheckpoints++
  return reason
}

/** Replays exact recorded actions on private branches. Policy guards never repair a state or choose a follow-up. */
export function stepRecordedPair(actual: GameState, alternative: GameState, entry: LogEntry,
  sourceEntries: LogEntry[], work: WorkBudget, stats: PairStats, policy = RECORDED_PAIR_POLICY,
): PairStep {
  let a = actual, b = alternative
  const stop = (reason: string, boundary: StoppedPair['boundary'] = 'before-command',
    engineReason: string | null = null, actualCandidate?: GameState, alternativeUnchanged = true): StoppedPair =>
    ({ ok: false, reason, boundary, engineReason, actual: a, alternative: b, actualCandidate, alternativeUnchanged })
  for (let i = 0; a.phase !== entry.before.phase || a.lap !== entry.before.lap; i++) {
    const reason = checkPair(a, b, stats)
    if (reason) return stop(reason)
    if (i >= policy.advancesPerGap || stats.advances >= policy.advances) return stop(`${policy.prefix}-advance-budget`)
    work.step()
    const nextActual = advance(a), nextAlternative = advance(b)
    if (nextActual === a || nextAlternative === b) return stop('engine-no-progress')
    a = nextActual
    b = nextAlternative
    stats.advances++
    const after = checkPair(a, b, stats)
    if (after) return stop(after, 'phase-advance')
  }
  requireEndgame(equalData(snapshot(a), entry.before), `${policy.prefix}-actual-snapshot-mismatch`)
  const mismatch = checkPair(a, b, stats)
  if (mismatch) return stop(mismatch)
  const restriction = policy.beforeCommand?.(a, b, entry)
  if (restriction) return stop(restriction)
  let candidate: GameState
  try { candidate = applyRecorded(a, entry, work) }
  catch (error) {
    if (error instanceof EndgameRejected) throw error
    throw new EndgameRejected(`${policy.prefix}-actual-replay-failed`)
  }
  requireEndgame(equalData(candidate.log.slice(a.log.length), sourceEntries.slice(a.log.length, candidate.log.length)),
    `${policy.prefix}-actual-prefix-mismatch`)
  // Keep the complete pre-command snapshot. Normalize key order only if the command is rejected.
  const original = JSON.stringify(b)
  let next: GameState
  try { next = applyRecorded(b, entry, work) }
  catch (error) {
    if (error instanceof EndgameRejected && ['cancelled', 'step-budget', 'time-budget'].includes(error.message)) throw error
    requireEndgame(equalData(JSON.parse(original), b), `${policy.prefix}-alternative-mutated-on-rejection`)
    return stop('illegal-recorded-action', 'before-command', error instanceof Error ? error.message.slice(0, 200) : 'engine-rejected', candidate)
  }
  if (policy.verifyRetainedCommand) {
    const retained = next.log.slice(b.log.length).filter(isCommand).map(commandIdentity)
    const expected = commandIdentity(entry)
    if (policy.allowLogRenumbering && retained.length === 1) expected.sequence = retained[0].sequence
    if (!equalData(retained, [expected])) return stop('recorded-command-drift', 'before-command', null, candidate)
  }
  a = candidate
  b = next
  const after = checkPair(a, b, stats)
  return after ? stop(after, 'after-command') : { ok: true, actual: a, alternative: b }
}

export function finishRecordedPair(actual: GameState, alternative: GameState, work: WorkBudget,
  stats: PairStats, policy = RECORDED_PAIR_POLICY,
) {
  let a = actual, b = alternative
  const stop = (reason: string) => ({ ok: false as const, reason, actual: a, alternative: b })
  for (let i = 0; a.phase !== 'finished'; i++) {
    const reason = checkPair(a, b, stats)
    if (reason) return stop(reason)
    if (i >= policy.advancesPerGap || stats.advances >= policy.advances) return stop(`${policy.prefix}-final-advance-budget`)
    work.step()
    const nextActual = advance(a), nextAlternative = advance(b)
    if (nextActual === a || nextAlternative === b) return stop('engine-no-progress')
    a = nextActual
    b = nextAlternative
    stats.advances++
    const after = checkPair(a, b, stats)
    if (after) return stop(after)
  }
  const reason = checkPair(a, b, stats)
  return reason ? stop(reason) : { ok: true as const, actual: a, alternative: b }
}
