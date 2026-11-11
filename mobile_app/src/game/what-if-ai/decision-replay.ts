import { canChoose, decide } from '../../../../src/game/engine.ts'
import { serializeLog } from '../../../../src/game/log.ts'
import type { GameState, LogEntry } from '../../../../src/game/types.ts'
import { comparableEndings, completedFour, endingMetrics, signedMetrics } from '../endgame-whatif-comparison.ts'
import { EndgameRejected, requireEndgame, WorkBudget } from '../endgame-whatif-contract.ts'
import type { WorkOptions } from '../endgame-whatif-contract.ts'
import { sameExternal } from '../endgame-whatif-fairness.ts'
import { captureDataIntegrity, captureEnvironment } from '../endgame-whatif-integrity.ts'
import { commandIdentity, digest, equalData, parseHistory } from '../endgame-whatif-identity.ts'
import { finishRecordedPair, RECORDED_PAIR_POLICY, stepRecordedPair } from '../endgame-whatif-paired.ts'
import { replayHistory } from '../endgame-whatif-replay.ts'
import { adapterFor, decisionChoice, forkDecision } from './decision-adapters.ts'
import type { ReplayKind } from './decision-adapters.ts'
import type { WhatIfDecision } from './orchestrator.ts'
import { flexibleAdapterFor, historyDecision, parameterAlternative, prefixControls } from './flexible-catalog.ts'
import type { CatalogPage, CatalogQuery } from './flexible-catalog.ts'
import { matchingHistory, readIntentReply } from './natural-language.ts'

export type ReplayComparison = {
  actual: ReturnType<typeof endingMetrics>
  alternative: ReturnType<typeof endingMetrics>
  delta: ReturnType<typeof signedMetrics>
  lap: number
  turn: number
  principal?: number
  proof: { actualReplay: true; alternativeReplay: true; sourceUnchanged: true; externalCheckpoints: number; alternativeExportHash: string }
}
export type ReplayFollowUp = { id: string; sequence: number; event: string; options: { id: 'skip'; label: string }[] }
export type ReplayResult = { status: 'supported-final'; comparison: ReplayComparison }
  | { status: 'needs-followup'; followUp: ReplayFollowUp }
  | { status: 'blocked' | 'cancelled'; reason: string }
type Choice = { sequence: number; optionId: 'skip' }
const diagnostic = (error: unknown): Extract<ReplayResult, { reason: string }> => ({
  status: error instanceof EndgameRejected && error.status === 'cancelled' ? 'cancelled' : 'blocked',
  reason: error instanceof EndgameRejected ? error.message : 'decision-replay-failed',
})

export async function listDecisionChoices(text: string, kind: ReplayKind, options: WorkOptions = {}): Promise<WhatIfDecision[]> {
  const work = new WorkBudget(options), environment = captureEnvironment()
  const source = parseHistory(text), adapter = adapterFor(kind)
  const entries = source.entries.filter(adapter.matches)
  requireEndgame(entries.length <= 16, 'adapter-catalog-cap')
  requireEndgame(completedFour((await replayHistory(source, work)).final), 'adapter-source-not-completed4')
  const catalog: WhatIfDecision[] = []
  for (const entry of entries) {
    const { before } = await replayHistory(source, work, entry.sequence)
    requireEndgame(before, 'adapter-decision-missing')
    for (const alternative of adapter.alternatives(before, entry)) {
      try {
        forkDecision(adapter, before, entry, alternative, work)
        catalog.push(decisionChoice(adapter, entry, alternative))
      } catch (error) {
        work.check()
        if (error instanceof EndgameRejected && ['step-budget', 'time-budget', 'cancelled'].includes(error.message)) throw error
      }
    }
  }
  work.check()
  requireEndgame(environment(), 'adapter-environment-changed')
  requireEndgame(catalog.length <= 16, 'adapter-catalog-cap')
  return catalog
}

export async function listDecisionPage(text: string, kind: ReplayKind, query: CatalogQuery, options: WorkOptions = {}): Promise<CatalogPage> {
  captureDataIntegrity(query)
  const allowed = query.mode === 'history' ? ['mode', 'offset', 'limit', 'locator'] : ['mode', 'sequence', 'offset', 'limit', 'parameters']
  requireEndgame(Object.keys(query).every(key => allowed.includes(key)), 'adapter-page-invalid')
  if (query.mode === 'history' && query.locator) {
    requireEndgame(Object.keys(query.locator).every(key => ['sequence', 'lap', 'turn', 'occurrence', 'originalAction', 'originalSymbolId', 'originalIssuerId', 'originalLotId'].includes(key))
      && readIntentReply({ status: 'intent', intent: { kind, action: 'skip', ...query.locator } }), 'adapter-locator-invalid')
  }
  const limit = query.limit ?? 8
  requireEndgame(Number.isSafeInteger(query.offset) && query.offset >= 0 && query.offset <= 500
    && Number.isSafeInteger(limit) && limit > 0 && limit <= 16, 'adapter-page-invalid')
  const work = new WorkBudget(options), environment = captureEnvironment(), source = parseHistory(text), adapter = flexibleAdapterFor(kind)
  const verified = await replayHistory(source, work, query.mode === 'alternatives' ? query.sequence : undefined)
  requireEndgame(completedFour(verified.final), 'adapter-source-not-completed4')
  let history: CatalogPage['history'] = [], controls: CatalogPage['controls'], total: number
  const decisions: WhatIfDecision[] = []
  if (query.mode === 'history') { history = matchingHistory(query.locator ?? {}, source.entries.filter(adapter.matches).map(historyDecision)); total = history.length }
  else {
    requireEndgame(query.mode === 'alternatives' && Number.isSafeInteger(query.sequence), 'adapter-page-invalid')
    const entry = source.entries.find(row => row.sequence === query.sequence)
    requireEndgame(entry && adapter.matches(entry) && verified.before, 'adapter-decision-missing')
    controls = prefixControls(verified.before)
    const palette = adapter.alternatives(verified.before, entry)
    // Numeric choices require user-selected parameters; the legacy palette remains available to its existing callers.
    const alternatives = query.parameters ? [parameterAlternative(kind, query.parameters)]
      : ['stocks', 'bonds', 'bank'].includes(kind) ? palette.filter(choice => choice.id === 'skip') : palette
    total = alternatives.length
    for (const alternative of alternatives.slice(query.offset, query.offset + limit)) {
      try {
        forkDecision(adapter, verified.before, entry, alternative, work)
        decisions.push({ ...decisionChoice(adapter, entry, alternative), ...(query.parameters ? { parameters: structuredClone(query.parameters) } : {}) })
      } catch (error) {
        work.check()
        if (error instanceof EndgameRejected && ['step-budget', 'time-budget', 'cancelled'].includes(error.message)) throw error
      }
    }
  }
  work.check()
  requireEndgame(environment(), 'adapter-environment-changed')
  const nextOffset = query.offset + limit < total ? query.offset + limit : null
  return { history: history.slice(query.offset, query.offset + limit), decisions,
    ...(controls ? { controls } : {}), offset: query.offset, total, nextOffset }
}

function skipRecorded(actual: GameState, alternative: GameState, entry: LogEntry, work: WorkBudget) {
  work.step()
  const event = alternative.phase === 'event' && ['course', 'stocks', 'bonds', 'business', 'gold'].includes(alternative.eventId ?? '')
  const checkpoint = alternative.phase === 'rebalancing' && entry.kind === 'rebalancing' && entry.action?.kind === 'sell'
  requireEndgame(event || checkpoint, 'followup-unsupported')
  let replacement = structuredClone(alternative)
  if (actual.phase === 'rolling' && event && canChoose(alternative, 'skip')) replacement = decide(replacement, 'skip')
  else requireEndgame(entry.kind === 'rebalancing' && actual.phase === alternative.phase, 'followup-unsupported')
  requireEndgame(sameExternal(actual, replacement) && !replacement.pendingPayment, 'followup-context-diverged')
  return replacement
}

function bondOrigin(state: GameState, lotId: string) {
  const purchase = state.log.find(entry => entry.kind === 'rebalancing' && entry.action?.kind === 'buy' && entry.action.asset === 'bonds'
    && !entry.before.bondLots.some(lot => lot.id === lotId) && entry.after.bondLots.some(lot => lot.id === lotId))
  // Native encounters admit one purchase. Its turn/lap/tile identify the same forked purchase even if its issuer changed.
  return purchase ? { ...commandIdentity(purchase), sequence: 0, action: null } : null
}
const replayPolicy = { ...RECORDED_PAIR_POLICY, allowLogRenumbering: true,
  beforeCommand(actual: GameState, alternative: GameState, entry: LogEntry) {
    const lotId = entry.action?.asset === 'bonds' && entry.action.kind === 'sell' ? entry.action.lotId : undefined
    // A reused native lot ID must never redirect the recorded sale to a different purchase.
    if (lotId && alternative.bondLots.some(lot => lot.id === lotId)
      && !equalData(bondOrigin(actual, lotId), bondOrigin(alternative, lotId))) return 'bond-lot-origin-mismatch'
    return null
  },
}

async function reconstruct(text: string, selection: WhatIfDecision, transcript: Choice[], options: WorkOptions): Promise<ReplayResult> {
  const work = new WorkBudget(options), environment = captureEnvironment()
  const source = parseHistory(text)
  requireEndgame(selection.kind !== 'gold', 'adapter-unsupported')
  const adapter = flexibleAdapterFor(selection.kind)
  const entry = source.entries.find(e => `${adapter.kind}:${e.sequence}` === selection.decisionId)
  requireEndgame(entry && adapter.matches(entry), 'adapter-selection-invalid')
  const verified = await replayHistory(source, work, entry.sequence)
  requireEndgame(completedFour(verified.final), 'adapter-source-not-completed4')
  requireEndgame(verified.before, 'adapter-decision-missing')
  const alternatives = selection.parameters ? [parameterAlternative(selection.kind, selection.parameters)] : adapter.alternatives(verified.before, entry)
  const alternative = alternatives.find(choice => equalData(selection, { ...decisionChoice(adapter, entry, choice),
    ...(selection.parameters ? { parameters: selection.parameters } : {}) }))
  requireEndgame(alternative, 'adapter-selection-invalid')
  let { actual, alternative: simulated } = forkDecision(adapter, verified.before, entry, alternative, work)
  const stats = { externalCheckpoints: 1, advances: 0 }
  let consumed = 0
  for (const command of verified.commands) {
    if (command.sequence <= entry.sequence) continue
    const step = stepRecordedPair(actual, simulated, command, source.entries, work, stats, replayPolicy)
    if (!step.ok) {
      // Stop before applying a replacement. Only an explicit omission at the same native event/checkpoint is supported.
      requireEndgame(step.reason === 'illegal-recorded-action' && step.boundary === 'before-command'
        && step.actualCandidate && sameExternal(step.actual, step.alternative), `continuation:${command.sequence}:${step.reason}`)
      const replacement = skipRecorded(step.actualCandidate, step.alternative, command, work)
      const prior = transcript[consumed]
      if (!prior) {
        work.check()
        requireEndgame(environment(), 'adapter-environment-changed')
        return { status: 'needs-followup', followUp: { id: crypto.randomUUID(), sequence: command.sequence,
          event: step.alternative.eventId ?? 'checkpoint', options: [{ id: 'skip',
            label: step.alternative.eventId === 'course' ? 'Bỏ qua lần học sau' : 'Bỏ qua giao dịch sau' }] } }
      }
      requireEndgame(prior.sequence === command.sequence && prior.optionId === 'skip', 'followup-transcript-mismatch')
      consumed++
      actual = step.actualCandidate
      simulated = replacement
      stats.externalCheckpoints++
    } else {
      actual = step.actual
      simulated = step.alternative
    }
    await work.yield()
  }
  requireEndgame(consumed === transcript.length, 'followup-transcript-unreached')
  const end = finishRecordedPair(actual, simulated, work, stats)
  if (!end.ok) throw new EndgameRejected(`ending:${end.reason}`)
  requireEndgame(equalData(end.actual, verified.final) && comparableEndings(end.actual, end.alternative), 'adapter-ending-unproved')
  const exported = serializeLog(end.alternative)
  const independent = await replayHistory(parseHistory(exported), work)
  requireEndgame(equalData(independent.final, end.alternative), 'adapter-alternative-replay-mismatch')
  const alternativeExportHash = await digest(exported)
  work.check()
  requireEndgame(environment(), 'adapter-environment-changed')
  const played = endingMetrics(end.actual), simulatedMetrics = endingMetrics(end.alternative)
  return { status: 'supported-final', comparison: { actual: played, alternative: simulatedMetrics,
    delta: signedMetrics(played, simulatedMetrics), lap: end.actual.lap, turn: end.actual.turn,
    ...(alternative.principal === undefined ? {} : { principal: alternative.principal }),
    proof: { actualReplay: true, alternativeReplay: true, sourceUnchanged: true,
      externalCheckpoints: stats.externalCheckpoints, alternativeExportHash } } }
}

/** Private transcript, explicit single-flight continuation, and detached reads. No game/save writes. */
export async function createDecisionReplay(text: string, selection: WhatIfDecision, options: WorkOptions = {}) {
  let result: ReplayResult, transcript: Choice[] = [], disposed = false, busy = false
  let owned: WhatIfDecision
  try {
    const witness = captureDataIntegrity(selection)
    owned = structuredClone(selection)
    result = await reconstruct(text, owned, [], options)
    requireEndgame(witness(), 'adapter-selection-mutated')
  } catch (error) { result = diagnostic(error) }
  return {
    get result(): ReplayResult { return structuredClone(result) },
    async resume(input: { id: string; optionId: string }, workOptions: WorkOptions = {}): Promise<ReplayResult> {
      if (disposed || busy) return { status: 'blocked', reason: 'followup-unavailable' }
      busy = true
      try {
        const witness = captureDataIntegrity(input), pending = result
        requireEndgame(pending.status === 'needs-followup' && equalData(Object.keys(input).sort(), ['id', 'optionId'])
          && input.id === pending.followUp.id && input.optionId === 'skip', 'followup-stale-or-invalid')
        const nextTranscript = [...transcript, { sequence: pending.followUp.sequence, optionId: 'skip' as const }]
        requireEndgame(nextTranscript.length <= 8, 'followup-cap')
        const next = await reconstruct(text, owned, nextTranscript, workOptions)
        requireEndgame(!disposed && witness(), 'followup-revoked')
        new WorkBudget(workOptions).check()
        transcript = nextTranscript
        result = next
        return structuredClone(result)
      } catch (error) { return diagnostic(error) }
      finally { busy = false }
    },
    dispose() { disposed = true; result = { status: 'cancelled', reason: 'disposed' }; transcript = [] },
  }
}
