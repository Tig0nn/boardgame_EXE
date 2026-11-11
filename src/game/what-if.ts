import { boardFor } from '../data/board.ts'
import { eventsForGame } from '../data/events.ts'
import { canChoose, decide } from './engine.ts'
import { validateCourseState } from './courses.ts'
import { validateLivingBoard } from './living-expenses.ts'
import { totalWorth } from './selectors.ts'
import type { GameState } from './types.ts'
import { livingCostForGame } from './living-expenses.ts'
import { rulesForGame } from './rules-profile.ts'

export type RepairChoice = 'full' | 'temporary'
export type RepairOutcome = Readonly<{
  choice: RepairChoice
  status: 'paid' | 'funding-required' | 'insolvent'
  cashAfter: number
  immediateDue: number
  paidNow: number
  fundingRemaining: number
  obligationAdded: number
  obligationOnCompletion: number
  totalCommitted: number
}>
export type RepairWhatIf = Readonly<{
  context?: Readonly<{
    existingObligations: number
    livingAtStart: number
    savingsPrincipal: number
    debtPrincipal: number
    debtInterestAtStart: number
  }>
  cashBefore: number
  actual: RepairOutcome
  alternative: RepairOutcome
  temporaryCashKept: number
  temporaryExtraCost: number
}>
const validMoney = (n: number) => Number.isSafeInteger(n) && n >= 0

/** Only a revealed, supported decision. No seed, RNG, log or future state leaves this module. */
export function repairWhatIfEligible(state: GameState): boolean {
  try {
    validateCourseState(state)
    validateLivingBoard(state)
    const encounter = state.log.at(-1)
    return state.gameplayProfile === 'core-mvp-b18-multi-course-v1'
      && state.phase === 'event' && state.eventId === 'repair'
      && !state.pendingPayment && !state.settlement && !state.termination
      && boardFor(state)[state.position]?.type === 'personal'
      && state.totalLaps === 4 && Number.isInteger(state.lap) && state.lap >= 1 && state.lap <= state.totalLaps
      && encounter?.kind === 'encounter' && encounter.eventId === 'repair' && encounter.turn === state.turn
      && validMoney(state.portfolio.cash) && validMoney(state.obligations)
      && canChoose(state, 'full') && canChoose(state, 'temporary')
  } catch { return false }
}

/** Two isolated engine transitions from ONE pre-decision state; never advances time or funds a payment. */
export function simulateRepairWhatIf(before: GameState, chosen: string): RepairWhatIf | null {
  if (!repairWhatIfEligible(before) || (chosen !== 'full' && chosen !== 'temporary')) return null
  const event = eventsForGame(before).find(event => event.id === 'repair')!
  const outcomes = (['full', 'temporary'] as const).map(choice => {
    const option = event.options.find(option => option.id === choice)!
    const branch = decide(structuredClone(before), choice)
    const decision = branch.log.findLast(entry => entry.kind === 'decision')!
    const pending = branch.pendingPayment?.remaining ?? 0
    const immediateDue = option.cost ?? 0
    const obligationOnCompletion = option.obligation ?? 0
    const status = branch.termination === 'insolvent' ? 'insolvent' : pending ? 'funding-required' : 'paid'
    // Existing wealth selector verifies the resolved cost; unfinished rights are still conditional.
    const totalCommitted = status === 'paid'
      ? totalWorth(before) - totalWorth(branch)
      : immediateDue + obligationOnCompletion
    return Object.freeze({ choice, status, cashAfter: branch.portfolio.cash,
      immediateDue, paidNow: decision.expensePaid, fundingRemaining: pending,
      obligationAdded: decision.obligationCreated, obligationOnCompletion, totalCommitted })
  })
  if (outcomes.some(outcome => Object.entries(outcome).some(([key, value]) =>
    key !== 'choice' && key !== 'status' && !validMoney(value as number)))) return null
  const [full, temporary] = outcomes
  return Object.freeze({ cashBefore: before.portfolio.cash,
    context: Object.freeze({ existingObligations: before.obligations,
      livingAtStart: livingCostForGame(before), savingsPrincipal: before.portfolio.savings,
      debtPrincipal: before.portfolio.debt,
      debtInterestAtStart: Math.round(before.portfolio.debt * rulesForGame(before).debtRate) }),
    actual: chosen === 'full' ? full : temporary,
    alternative: chosen === 'full' ? temporary : full,
    temporaryCashKept: temporary.cashAfter - full.cashAfter,
    temporaryExtraCost: temporary.totalCommitted - full.totalCommitted })
}
