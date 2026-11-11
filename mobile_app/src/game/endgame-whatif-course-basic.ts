import type { GameState, LogEntry } from '../../../src/game/types.ts'
import { canChoose, decide } from '../../../src/game/engine.ts'
import { boardFor } from '../../../src/data/board.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { COURSE_POLICY, EndgameRejected, WorkBudget, requireEndgame } from './endgame-whatif-contract.ts'
import type { CourseRequest, SimulationResult, WorkOptions } from './endgame-whatif-contract.ts'
import { identifyCourse, equalData, parseHistory, digest } from './endgame-whatif-identity.ts'
import { captureDataIntegrity, captureEnvironment } from './endgame-whatif-integrity.ts'
import { replayHistory, applyRecorded } from './endgame-whatif-replay.ts'
import { sameExternal } from './endgame-whatif-fairness.ts'
import { continueRecorded, finalAdvancePair, continuationFacts } from './endgame-whatif-continuation.ts'
import { completedFour, comparableEndings, endingMetrics, signedMetrics, endingFacts } from './endgame-whatif-comparison.ts'

export async function prepareCourseRequest(source: string, sequence: number, options: WorkOptions = {}) {
  return identifyCourse(source, sequence, new WorkBudget(options))
}
/** Only the approved fork; lower-level continuation probes do not add supported scenarios. */
export function forkCourseBasic(before: GameState, selected: LogEntry, work: WorkBudget) {
  requireEndgame(selected.kind === 'decision' && selected.eventId === 'course' && selected.decisionId === 'course-basic'
    && before.phase === 'event' && before.eventId === 'course' && boardFor(before)[before.position].type === 'course'
    && selected.turn === before.turn && selected.lap === before.lap && selected.tileId === before.position
    && selected.sequence === before.log.length + 1 && !before.pendingPayment && !before.settlement && !before.termination
    && canChoose(before, 'course-basic') && canChoose(before, 'skip'), 'fork-not-legal')
  const actual = applyRecorded(structuredClone(before), selected, work), alternative = decide(structuredClone(before), 'skip')
  requireEndgame(sameExternal(actual, alternative) && alternative.log.length > before.log.length, 'fork-external-mismatch')
  return { actual, alternative }
}
/** Sole scenario entry point. No callbacks, live session, storage, DOM, native worker or resume execution. */
export async function simulateCourseBasic(request: CourseRequest, options: WorkOptions = {}): Promise<SimulationResult> {
  try {
    const work = new WorkBudget(options), inputCurrent = captureDataIntegrity(request), environmentCurrent = captureEnvironment()
    const current = () => { work.check(); requireEndgame(inputCurrent() && environmentCurrent(), 'input-or-engine-changed') }
    current()
    const captured = structuredClone(request)
    requireEndgame(captured && typeof captured.source === 'string' && captured.identity?.decision, 'request-shape')
    const expected = await identifyCourse(captured.source, captured.identity.decision.sequence, work)
    requireEndgame(equalData(expected.identity, captured.identity), 'request-identity-mismatch')
    const source = parseHistory(captured.source)
    let actual: Awaited<ReturnType<typeof replayHistory>>
    try { actual = await replayHistory(source, work, captured.identity.decision.sequence) }
    catch (error) {
      if (error instanceof EndgameRejected) throw error
      throw new EndgameRejected('source-replay-failed')
    }
    current()
    if (!completedFour(actual.final)) return { status: 'limited', policy: COURSE_POLICY, reason: 'actual-ending-not-completed4', endings: { actual: endingFacts(actual.final) } }
    const before = actual.before
    requireEndgame(before, 'decision-missing')
    const selectedIndex = actual.commands.findIndex(entry => entry.sequence === captured.identity.decision.sequence)
    const selected = actual.commands[selectedIndex]
    requireEndgame(selected && selected.eventId === 'course' && selected.decisionId === 'course-basic', 'fork-identity')
    const fork = forkCourseBasic(before, selected, work)
    let a = fork.actual, b = fork.alternative
    let pairedBoundaries = 1, finalAdvances = 0
    for (let i = selectedIndex + 1; i < actual.commands.length; i++) {
      const step = continueRecorded(a, b, actual.commands[i], work)
      a = step.actual; b = step.alternative
      if (!step.ok) {
        const followup = await continuationFacts(captured.identity, actual.commands[i], i, b, step.reason, step.boundary)
        current()
        if (step.reason === 'early-insolvency' || step.reason === 'early-terminal') return { status: 'limited', policy: COURSE_POLICY, reason: step.reason, endings: { actual: endingFacts(actual.final), alternative: endingFacts(b) }, blocker: followup }
        if (step.reason === 'illegal-recorded-action' && followup.legalOptions.length) return { status: 'needs-followup', policy: COURSE_POLICY, followup }
        return { status: 'limited', policy: COURSE_POLICY, reason: step.reason, blocker: followup }
      }
      pairedBoundaries += step.boundaries
      if (i % 8 === 0) { await work.yield(); current() }
    }
    const terminal = finalAdvancePair(a, b, work)
    if (!terminal.ok) { current(); return { status: 'limited', policy: COURSE_POLICY, reason: terminal.reason } }
    a = terminal.actual; b = terminal.alternative; finalAdvances = terminal.advances; pairedBoundaries += terminal.boundaries
    requireEndgame(equalData(a, actual.final), 'actual-continuation-mismatch')
    if (!comparableEndings(a, b)) { current(); return { status: 'limited', policy: COURSE_POLICY, reason: 'incomparable-ending', endings: { actual: endingFacts(a), alternative: endingFacts(b) } } }
    const alternativeText = serializeLog(b), independent = await replayHistory(parseHistory(alternativeText), work)
    requireEndgame(equalData(independent.final, b), 'alternative-replay-mismatch')
    const alternativeTranscriptHash = await digest(alternativeText)
    requireEndgame(await digest(captured.source) === captured.identity.sourceHash, 'source-identity-mismatch')
    current()
    const actualMetrics = endingMetrics(a), alternativeMetrics = endingMetrics(b)
    return { status: 'supported-final', policy: COURSE_POLICY, identity: structuredClone(captured.identity),
      comparability: 'same-completed-horizon', actual: actualMetrics, alternative: alternativeMetrics,
      delta: signedMetrics(actualMetrics, alternativeMetrics), endings: { actual: endingFacts(a), alternative: endingFacts(b) },
      proof: { actualReplay: true, alternativeReplay: true, pairedBoundaries, finalAdvances, alternativeTranscriptHash, steps: work.steps } }
  } catch (error) {
    if (error instanceof EndgameRejected) return { status: error.status, policy: COURSE_POLICY, reason: error.message }
    return { status: 'error', policy: COURSE_POLICY, reason: 'verification-failed' }
  }
}
