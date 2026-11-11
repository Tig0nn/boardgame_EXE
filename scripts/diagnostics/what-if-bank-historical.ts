import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { advance, canChoose, decide, fundPayment, roll, transact } from '../../src/game/engine.ts'
import { createMultiCourseGame } from '../../src/game/new-game.ts'
import { snapshot } from '../../src/game/state.ts'
import { serializeLog } from '../../src/game/log.ts'
import { boardFor } from '../../src/data/board.ts'
import { depositPreview, liquidatableFunds, saleQuote, totalWorth } from '../../src/game/selectors.ts'
import { savingsProfileForGame } from '../../src/game/savings.ts'
import { replayGameLog } from './replay-game-log.ts'
import type { ReplayLog } from './replay-game-log.ts'
import type { GameState, LogEntry, Term, FundingSource } from '../../src/game/types.ts'

type HistoricalLog = ReplayLog & { rulesVersion?: string }

type Request = { sequence: number; mode: 'ex-ante' | 'ex-post'; expectedDigest: string }
class Stopped extends Error {}
function gate(value: unknown, reason: string): asserts value { if (!value) throw new Stopped(reason) }
const plain = (value: unknown) => JSON.parse(JSON.stringify(value))
const same = (a: unknown, b: unknown) => isDeepStrictEqual(plain(a), plain(b))
export const transcriptDigest = (data: ReplayLog): string => createHash('sha256').update(JSON.stringify(data)).digest('hex')
const actionKinds = new Set(['roll', 'decision', 'rebalancing', 'funding'])

// Replay real actions from genesis; never cast/merge a snapshot into full GameState.
function execute(state: GameState, entry: LogEntry): GameState {
  gate(actionKinds.has(entry.kind), 'continuation-illegal')
  for (let i = 0; i < 4 && (state.phase !== entry.before.phase || state.lap !== entry.before.lap); i++) {
    const next = advance(state); gate(next !== state, 'continuation-illegal'); state = next
  }
  gate(same(snapshot(state), entry.before), 'actual-replay-mismatch')
  let next: GameState
  if (entry.kind === 'roll') next = roll(state)
  else if (entry.kind === 'decision') {
    gate(entry.decisionId && canChoose(state, entry.decisionId), 'continuation-illegal')
    next = decide(state, entry.decisionId)
  } else if (entry.kind === 'rebalancing') {
    gate(entry.action, 'action-parameters-missing'); next = transact(state, entry.action)
  } else {
    gate(typeof entry.decisionId === 'string' && entry.decisionId.startsWith('fund-'), 'action-parameters-missing')
    const source = entry.decisionId.slice(5) as FundingSource
    const lot = entry.before.deposits.find(lot => lot.status === 'active'
      && entry.after.deposits.find(after => after.id === lot.id)?.status === 'withdrawn')
    const amount = source === 'debt' ? entry.after.portfolio.debt - entry.before.portfolio.debt
      : source === 'savings' ? lot?.principal : entry.forcedAssetSaleAmount
    gate(amount !== undefined, 'action-parameters-missing')
    next = fundPayment(state, source, amount, source === 'bonds' ? entry.fundingLotId : lot?.id)
  }
  gate(next !== state && next.log.length > state.log.length, 'continuation-illegal')
  return next
}
function external(s: GameState) {
  return { seed: s.seed, rng: s.rng, dice: s.dice, turn: s.turn, lap: s.lap, position: s.position,
    phase: s.phase, eventId: s.eventId, pendingLanding: s.pendingLanding, scenarioId: s.scenarioId,
    market: s.market, bondCredit: s.bondCredit, customerPreferenceId: s.customerPreferenceId }
}
function selectors(s: GameState) {
  return { cash: s.portfolio.cash, totalWorth: totalWorth(s), liquidatableFunds: liquidatableFunds(s),
    debt: s.portfolio.debt, obligations: s.obligations, pending: s.pendingPayment?.remaining ?? 0,
    quotes: Object.fromEntries((['stocks', 'bonds', 'gold'] as const).map(asset => [asset, saleQuote(s, asset)])) }
}

/** Offline proof only. No gameplay/Companion DTO, arbitrary policy or future simulation API. */
export function historicalBankProof(data: HistoricalLog, request: Request) {
  try {
    gate(request.mode === 'ex-ante' || request.mode === 'ex-post', 'mode-invalid')
    gate(transcriptDigest(data) === request.expectedDigest, 'stale-transcript')
    gate(data.schemaVersion === 7 && data.gameplayProfile === 'core-mvp-b18-multi-course-v1'
      && data.state?.seed === data.seed && data.rulesVersion === 'gameplay-core-mvp-b18-multi-course-v1', 'identity-or-version-unsupported')
    gate(same(data.entries, data.state.log), 'history-copies-disagree')
    gate(data.entries.every((e, i) => e.sequence === i + 1), 'sequence-ambiguous')
    gate(Number.isSafeInteger(request.sequence) && request.sequence > 1, 'actual-decision-missing')
    const selected = data.entries[request.sequence - 1]
    gate(selected, 'actual-decision-missing')
    gate(selected.kind === 'decision' && selected.eventId === 'bank' && selected.decisionId === 'skip', 'actual-not-bank-skip')
    // Existing validator proves current engine can reproduce the complete saved history.
    const complete = replayGameLog(data)
    const normalized = JSON.parse(serializeLog(complete)) as ReplayLog
    gate(same(data.financialConfig, normalized.financialConfig), 'financial-config-mismatch')
    const initial = data.entries[0].after
    const term = initial.deposits[0] ? initial.deposits[0].maturityLap - initial.deposits[0].startLap + 1 : 1
    let state = createMultiCourseGame(data.seed, initial.portfolio.savings, term as Term)
    gate(same(state.log, data.entries.slice(0, state.log.length)), 'actual-replay-mismatch')
    for (const entry of data.entries) {
      if (entry.sequence >= request.sequence) break
      if (!actionKinds.has(entry.kind)) continue
      state = execute(state, entry)
      gate(same(state.log, data.entries.slice(0, state.log.length)), 'actual-replay-mismatch')
    }
    gate(state.log.length === request.sequence - 1 && same(snapshot(state), selected.before), 'actual-replay-mismatch')
    const before = state
    gate(before.phase === 'event' && before.eventId === 'bank' && before.position === boardFor(before).length - 1
      && boardFor(before)[before.position].type === 'bank' && !before.pendingPayment && !before.settlement && !before.termination,
    'boundary-unsupported')
    gate(selected.turn === before.turn && selected.lap === before.lap && selected.tileId === before.position, 'decision-identity-mismatch')
    const principal = 5_000_000 // Fixed analysis budget, never inferred from an absent transaction or future returns.
    gate(before.portfolio.cash >= principal && canChoose(before, 'skip'), 'alternative-illegal')
    const afterActual = execute(structuredClone(before), selected)
    gate(same(afterActual.log, data.entries.slice(0, afterActual.log.length))
      && same(snapshot(afterActual), selected.after), 'actual-replay-mismatch')
    const afterAlternative = transact(structuredClone(before), { kind: 'deposit', amount: principal, term: 1 })
    gate(afterActual.phase === 'rolling' && afterAlternative.phase === 'rolling'
      && afterAlternative.log.length === before.log.length + 1, 'alternative-illegal')
    gate(same(external(afterActual), external(afterAlternative)) && before.rng === afterActual.rng, 'exogenous-diverged')
    gate(afterActual.portfolio.cash - afterAlternative.portfolio.cash === principal, 'capital-mismatch')
    const identity = { transcript: request.expectedDigest, decisionPrefix: transcriptDigest(JSON.parse(serializeLog(afterActual))),
      seed: data.seed, schemaVersion: data.schemaVersion, sequence: selected.sequence, turn: selected.turn,
      lap: selected.lap, tileId: selected.tileId, eventId: selected.eventId, decisionId: selected.decisionId }
    const preview = depositPreview(before, principal, 1)
    const known = { principal, cashIfKeep: afterActual.portfolio.cash, cashIfDeposit: afterAlternative.portfolio.cash,
      rate: savingsProfileForGame(before).rates[1], maturityLap: preview.maturityLap,
      liquidity: 'locked-until-next-start', voluntaryWithdrawal: false }
    if (request.mode === 'ex-ante') return { status: 'ex-ante' as const, identity, known }

    // Do not even roll the alternative until the real log contains the next roll AND complete settlement.
    const nextAction = data.entries.find(e => e.sequence > selected.sequence && actionKinds.has(e.kind))
    gate(nextAction, 'checkpoint-not-recorded')
    gate(nextAction.kind === 'roll' && nextAction.sequence === selected.sequence + 1, 'continuation-unsupported')
    const completed = data.entries.find(e => e.sequence > nextAction.sequence && e.kind === 'settlement'
      && e.lap === before.lap && e.after.turn === before.turn + 1)
    gate(completed, 'checkpoint-not-recorded')
    const actual = execute(structuredClone(afterActual), nextAction)
    gate(actual.phase === 'summary' && actual.log.length === completed.sequence
      && same(actual.log, data.entries.slice(0, completed.sequence))
      && same(snapshot(actual), completed.after), 'actual-checkpoint-mismatch')
    const alternative = roll(structuredClone(afterAlternative))
    gate([actual, alternative].every(s => s.phase === 'summary' && s.lap === before.lap
      && s.turn === before.turn + 1 && !s.pendingPayment && !s.settlement && !s.termination), 'funding-or-checkpoint-unmatched')
    gate(same(external(actual), external(alternative)), 'exogenous-diverged')
    const lot = alternative.deposits.at(-1)
    gate(lot && lot.principal === principal && lot.startLap === before.lap && lot.maturityLap === before.lap
      && lot.status === 'matured' && lot.earnedInterest === preview.interest, 'maturity-unproved')
    gate(same(actual.deposits, alternative.deposits.slice(0, -1)), 'other-deposits-diverged')
    const cashLines = actual.summaries.at(-1)!.lines
    const altLines = alternative.summaries.at(-1)!.lines
    const maturity = altLines.filter(line => line.label === `Đáo hạn ${lot.id} (gốc + lãi)`)
    gate(maturity.length === 1 && maturity[0].amount === principal + lot.earnedInterest
      && same(cashLines, altLines.filter(line => !maturity.includes(line))), 'schedule-diverged')
    for (const key of ['stocks', 'bonds', 'gold', 'business', 'savings', 'debt'] as const) {
      gate(actual.portfolio[key] === alternative.portfolio[key], 'net-value-unproved')
    }
    gate(actual.portfolio.debt === 0 && actual.obligations === 0 && alternative.obligations === 0
      && actual.pendingCost === 0 && alternative.pendingCost === 0, 'net-value-unproved')
    const a = selectors(actual), b = selectors(alternative)
    gate(same(a.quotes, b.quotes) && b.cash - a.cash === lot.earnedInterest
      && b.totalWorth - a.totalWorth === lot.earnedInterest
      && b.liquidatableFunds - a.liquidatableFunds === lot.earnedInterest, 'net-value-unproved')
    // Full deterministic replay of the fork too, independent of Actual's archived after-snapshots.
    replayGameLog(JSON.parse(serializeLog(alternative)))
    return { status: 'supported' as const, identity, principal, before, afterActual,
      actualNetCash: a.cash, alternativeNetCash: b.cash, difference: lot.earnedInterest,
      liquidBuffer: { actual: known.cashIfKeep, alternative: known.cashIfDeposit },
      checkpoint: { lap: actual.lap, turn: actual.turn, dice: actual.dice, sequence: completed.sequence, phase: actual.phase },
      selectors: { actual: a, alternative: b }, schedules: { actual: cashLines, alternative: altLines },
      branches: { actual, alternative },
      proof: { actualMatchesHistory: true, exogenousEqual: true, continuationActions: 1,
        fees: 0, principalReturned: principal, earnedInterest: lot.earnedInterest, stoppedBeforePendingLanding: true } }
  } catch (error) {
    return { status: 'blocked' as const, reason: error instanceof Stopped ? error.message : 'actual-replay-mismatch' }
  }
}
