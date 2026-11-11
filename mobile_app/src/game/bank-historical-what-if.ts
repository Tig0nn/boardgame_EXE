import { advance, canChoose, decide, fundPayment, roll, transact } from '../../../src/game/engine.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { snapshot } from '../../../src/game/state.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { depositPreview, liquidatableFunds, saleQuote, totalWorth } from '../../../src/game/selectors.ts'
import { savingsProfileForGame } from '../../../src/game/savings.ts'
import type { GameState, LogEntry, Term, FundingSource } from '../../../src/game/types.ts'
import { contextFor, parseSource, requireProof, equal } from './bank-historical-contract.ts'
import type { Envelope } from './bank-historical-contract.ts'

const action = (e: LogEntry) => ['roll', 'decision', 'rebalancing', 'funding'].includes(e.kind)
function execute(state: GameState, entry: LogEntry) {
  for (let i = 0; i < 4 && (state.phase !== entry.before.phase || state.lap !== entry.before.lap); i++) {
    const next = advance(state); requireProof(next !== state, 'continuation-illegal'); state = next
  }
  requireProof(equal(snapshot(state), entry.before), 'actual-replay-mismatch')
  let next: GameState
  if (entry.kind === 'roll') next = roll(state)
  else if (entry.kind === 'decision') {
    requireProof(entry.decisionId && canChoose(state, entry.decisionId), 'decision-illegal')
    next = decide(state, entry.decisionId)
  } else if (entry.kind === 'rebalancing') {
    requireProof(entry.action, 'action-missing'); next = transact(state, entry.action)
  } else {
    requireProof(entry.kind === 'funding' && entry.decisionId?.startsWith('fund-'), 'funding-unsupported')
    const source = entry.decisionId!.slice(5) as FundingSource
    const lot = entry.before.deposits.find(l => l.status === 'active' && entry.after.deposits.find(a => a.id === l.id)?.status === 'withdrawn')
    const amount = source === 'debt' ? entry.after.portfolio.debt - entry.before.portfolio.debt
      : source === 'savings' ? lot?.principal : entry.forcedAssetSaleAmount
    requireProof(amount !== undefined, 'funding-unsupported')
    next = fundPayment(state, source, amount, source === 'bonds' ? entry.fundingLotId : lot?.id)
  }
  requireProof(next !== state && next.log.length > state.log.length, 'continuation-illegal')
  return next
}
function external(s: GameState) {
  return { seed: s.seed, rng: s.rng, dice: s.dice, turn: s.turn, lap: s.lap, position: s.position,
    phase: s.phase, eventId: s.eventId, pendingLanding: s.pendingLanding, scenarioId: s.scenarioId,
    market: s.market, bondCredit: s.bondCredit, customerPreferenceId: s.customerPreferenceId }
}
/** Exported only for rejection fault-injection tests; never repairs/changes a branch. */
export function assertCompletedPair(actual: GameState, alternative: GameState, before: GameState) {
  requireProof([actual, alternative].every(s => s.phase === 'summary' && s.lap === before.lap
    && s.turn === before.turn + 1 && !s.pendingPayment && !s.settlement && !s.termination), 'funding-or-checkpoint-unmatched')
  requireProof(equal(external(actual), external(alternative)), 'exogenous-diverged')
}

/** Browser-safe DEV-only historical verifier. Whitelisted DTO; no raw state reaches consumers. */
export async function verifyBank(text: string, sequence: number, signal: AbortSignal): Promise<Envelope> {
  const deadline = Date.now() + 20_000
  const check = () => {
    requireProof(!signal.aborted, 'cancelled'); requireProof(Date.now() <= deadline, 'execution-budget')
  }
  check()
  const data = parseSource(text)
  const context = await contextFor(text, sequence); check()
  const initial = data.entries[0].after
  const term = initial.deposits[0] ? initial.deposits[0].maturityLap - initial.deposits[0].startLap + 1 : 1
  let current = createMultiCourseGame(data.state.seed, initial.portfolio.savings, term as Term)
  const setup = JSON.parse(serializeLog(current))
  const keys = ['schemaVersion', 'rulesVersion', 'seed', 'gameplayProfile', 'goalRulesVersion', 'courseRulesVersion', 'courseConfig',
    'livingExpenseRulesVersion', 'livingExpenseConfig', 'boardRevision', 'board', 'bondRulesVersion', 'bondCreditConfig',
    'stockCatalogVersion', 'savingsProfile', 'businessRulesVersion', 'encounterRulesVersion', 'financialConfig', 'mode']
  const sourceRecord = data as unknown as Record<string, unknown>
  requireProof(keys.every(k => equal(sourceRecord[k], setup[k])), 'engine-config-mismatch')
  requireProof(equal(current.log, data.entries.slice(0, current.log.length)), 'setup-mismatch')
  let before: GameState | undefined, afterActual: GameState | undefined, checkpoint: GameState | undefined
  for (const entry of data.entries) {
    check()
    if (!action(entry)) continue
    if (entry.sequence === sequence) before = structuredClone(current)
    const previousCount = current.log.length
    current = execute(current, entry)
    requireProof(equal(current.log.slice(previousCount), data.entries.slice(previousCount, current.log.length)), 'history-mismatch')
    if (entry.sequence === sequence) afterActual = structuredClone(current)
    if (context.checkpoint && current.log.length === context.checkpoint.sequence) checkpoint = structuredClone(current)
    if (action(entry)) { await new Promise(resolve => setTimeout(resolve, 0)); check() }
  }
  for (let i = 0; i < 4 && (current.phase !== data.state.phase || current.lap !== data.state.lap); i++) current = advance(current)
  requireProof(equal(current, data.state), 'complete-actual-mismatch')
  requireProof(before && afterActual && before.log.length === sequence - 1
    && before.phase === 'event' && before.eventId === 'bank' && before.position === 17
    && !before.pendingPayment && !before.settlement && !before.termination, 'boundary-unsupported')
  const selected = data.entries[sequence - 1]
  requireProof(selected.turn === before.turn && selected.lap === before.lap && selected.tileId === before.position
    && equal(snapshot(before), selected.before) && equal(snapshot(afterActual), selected.after), 'decision-identity-mismatch')
  const principal = 5_000_000
  requireProof(before.portfolio.cash >= principal && canChoose(before, 'skip'), 'alternative-illegal')
  const alternativeChoice = transact(structuredClone(before), { kind: 'deposit', amount: principal, term: 1 })
  requireProof(alternativeChoice.phase === 'rolling' && alternativeChoice.log.length === afterActual.log.length
    && equal(external(afterActual), external(alternativeChoice)) && before.rng === alternativeChoice.rng
    && afterActual.portfolio.cash - alternativeChoice.portfolio.cash === principal, 'alternative-illegal')
  const known = { principal, cashNow: afterActual.portfolio.cash, cashIfDeposit: alternativeChoice.portfolio.cash,
    rate: savingsProfileForGame(before).rates[1], term: 1 as const, lockedUntilLap: before.lap }
  check()
  if (!context.checkpoint) return { context, result: { status: 'known', ...known } }
  const continuation = data.entries[sequence]
  requireProof(continuation?.kind === 'roll' && checkpoint, 'checkpoint-not-recorded')
  // This roll is unreachable when Actual has not recorded a completed checkpoint.
  const alternative = roll(structuredClone(alternativeChoice))
  assertCompletedPair(checkpoint, alternative, before)
  const lot = alternative.deposits.at(-1), preview = depositPreview(before, principal, 1)
  requireProof(lot && lot.principal === principal && lot.status === 'matured' && lot.maturityLap === before.lap
    && lot.startLap === before.lap && lot.earnedInterest === preview.interest, 'maturity-unproved')
  requireProof(equal(checkpoint.deposits, alternative.deposits.slice(0, -1)), 'other-deposits-diverged')
  const actualLines = checkpoint.summaries.at(-1)!.lines, altLines = alternative.summaries.at(-1)!.lines
  const maturity = altLines.filter(l => l.label === `Đáo hạn ${lot.id} (gốc + lãi)`)
  requireProof(maturity.length === 1 && maturity[0].amount === principal + lot.earnedInterest
    && equal(actualLines, altLines.filter(l => !maturity.includes(l))), 'schedule-diverged')
  const difference = alternative.portfolio.cash - checkpoint.portfolio.cash
  requireProof(difference === lot.earnedInterest && totalWorth(alternative) - totalWorth(checkpoint) === difference
    && liquidatableFunds(alternative) - liquidatableFunds(checkpoint) === difference, 'net-value-unproved')
  for (const asset of ['stocks', 'bonds', 'gold'] as const) requireProof(equal(saleQuote(checkpoint, asset), saleQuote(alternative, asset)), 'quote-diverged')
  for (const asset of ['stocks', 'bonds', 'gold', 'business', 'savings', 'debt'] as const) requireProof(checkpoint.portfolio[asset] === alternative.portfolio[asset], 'net-value-unproved')
  requireProof(checkpoint.portfolio.debt === 0 && checkpoint.obligations === 0 && alternative.obligations === 0
    && checkpoint.pendingCost === 0 && alternative.pendingCost === 0, 'net-value-unproved')
  check()
  return { context, result: { status: 'supported', principal, actualCash: checkpoint.portfolio.cash,
    alternativeCash: alternative.portfolio.cash, difference, actualLiquidBuffer: known.cashNow,
    alternativeLiquidBuffer: known.cashIfDeposit, fees: 0, debt: checkpoint.portfolio.debt, obligations: checkpoint.obligations,
    checkpointLap: checkpoint.lap, checkpointTurn: checkpoint.turn } }
}
