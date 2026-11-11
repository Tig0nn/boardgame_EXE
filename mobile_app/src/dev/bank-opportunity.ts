import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { advance, canChoose, decide, roll, transact } from '../../../src/game/engine.ts'
import { eventsForGame } from '../../../src/data/events.ts'
import { boardFor } from '../../../src/data/board.ts'
import type { GameState } from '../../../src/game/types.ts'

export type BankChoice = 'cash' | 'deposit'
type Request = { amount: number; actual: BankChoice; seed?: string }
class SliceStopped extends Error {}
function requireSlice(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new SliceStopped(reason)
}

// Policy uses only revealed options. No seed search or future-return ranking.
function firstBank(seed: string): GameState {
  let state = createMultiCourseGame(seed, 0, 1)
  for (let step = 0; step < 48; step++) {
    requireSlice(!state.pendingPayment && !state.termination && state.lap === 1, 'funding-or-termination')
    if (state.phase === 'event' && state.eventId === 'bank') return state
    if (state.phase === 'forecast') state = advance(state)
    else if (state.phase === 'rolling') state = roll(state)
    else if (state.phase === 'event') {
      const options = eventsForGame(state).find(event => event.id === state.eventId)?.options ?? []
      const option = options.find(o => o.id === 'skip') ?? options.find(o => ['pay', 'full'].includes(o.id))
        ?? options.find(o => ['acknowledge', 'receive'].includes(o.id))
      requireSlice(option && canChoose(state, option.id), 'continuation-illegal')
      state = decide(state, option.id)
    } else throw new SliceStopped('boundary-unavailable')
  }
  throw new SliceStopped('boundary-unavailable')
}

function external(state: GameState) {
  return { seed: state.seed, rng: state.rng, dice: state.dice, position: state.position, turn: state.turn,
    lap: state.lap, phase: state.phase, eventId: state.eventId, pendingLanding: state.pendingLanding,
    scenarioId: state.scenarioId, market: state.market, bondCredit: state.bondCredit,
    customerPreferenceId: state.customerPreferenceId }
}
const identical = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** DEV review slice: naturally generated first bank only, never arbitrary saved-state input. */
export function compareBankOpportunity(input: Request) {
  try {
    requireSlice(input.actual === 'cash' || input.actual === 'deposit', 'choice-invalid')
    const seed = input.seed ?? 'whatif-bank-v3'
    requireSlice(typeof seed === 'string' && seed.trim() === seed && seed.length > 0 && seed.length <= 128, 'identity-missing')
    const before = firstBank(seed)
    const frozenBefore = JSON.stringify(before)
    requireSlice(before.gameplayProfile === 'core-mvp-b18-multi-course-v1' && before.phase === 'event'
      && before.eventId === 'bank' && boardFor(before)[before.position].type === 'bank'
      && !before.settlement && !before.pendingPayment && !before.termination, 'boundary-unsupported')
    // Final tile means every legal dice result crosses START once. No later action is replayed.
    requireSlice(before.position === boardFor(before).length - 1 && before.lap === 1, 'horizon-unsupported')
    requireSlice(Number.isSafeInteger(input.amount) && input.amount > 0 && input.amount <= before.portfolio.cash, 'principal-invalid')
    requireSlice(canChoose(before, 'skip'), 'alternative-illegal')
    const cashChoice = decide(structuredClone(before), 'skip')
    const depositChoice = transact(structuredClone(before), { kind: 'deposit', amount: input.amount, term: 1 })
    requireSlice([cashChoice, depositChoice].every(s => s.phase === 'rolling' && s.log.length === before.log.length + 1), 'alternative-illegal')
    requireSlice(identical(external(cashChoice), external(depositChoice)) && cashChoice.rng === before.rng, 'exogenous-diverged')
    requireSlice(cashChoice.portfolio.cash === before.portfolio.cash
      && depositChoice.portfolio.cash === before.portfolio.cash - input.amount, 'capital-mismatch')
    const cashState = roll(cashChoice), depositState = roll(depositChoice)
    requireSlice([cashState, depositState].every(s => !s.pendingPayment && !s.termination && !s.settlement), 'funding-or-termination')
    requireSlice([cashState, depositState].every(s => s.phase === 'summary' && s.lap === before.lap
      && s.turn === before.turn + 1 && s.summaries.length === before.summaries.length + 1), 'checkpoint-unmatched')
    requireSlice(identical(external(cashState), external(depositState)), 'exogenous-diverged')
    const lot = depositState.deposits.at(-1)
    requireSlice(lot && lot.principal === input.amount && lot.startLap === before.lap
      && lot.maturityLap === before.lap && lot.status === 'matured', 'maturity-unproved')
    for (const asset of ['stocks', 'gold', 'bonds', 'business', 'savings', 'debt'] as const) {
      requireSlice(cashState.portfolio[asset] === depositState.portfolio[asset], 'net-value-unproved')
    }
    requireSlice(cashState.obligations === depositState.obligations && cashState.obligations === 0
      && cashState.pendingCost === 0 && depositState.pendingCost === 0, 'net-value-unproved')
    const realizedInterest = lot.earnedInterest
    requireSlice(Number.isSafeInteger(realizedInterest) && realizedInterest >= 0
      && depositState.portfolio.cash - cashState.portfolio.cash === realizedInterest, 'net-value-unproved')
    const cashLines = cashState.summaries.at(-1)!.lines
    const depositLines = depositState.summaries.at(-1)!.lines
    const maturityLines = depositLines.filter(line => line.label === `Đáo hạn ${lot.id} (gốc + lãi)`)
    requireSlice(maturityLines.length === 1 && maturityLines[0].amount === input.amount + realizedInterest
      && identical(cashLines, depositLines.filter(line => !maturityLines.includes(line))), 'net-value-unproved')
    requireSlice(identical(before, JSON.parse(frozenBefore)), 'source-mutated')
    const commonPaid = -cashLines.filter(line => line.amount < 0).reduce((n, line) => n + line.amount, 0)
    return { status: 'supported' as const, actualChoice: input.actual, seed, principal: input.amount,
      before, cash: { initialCash: cashChoice.portfolio.cash, liquidBuffer: cashChoice.portfolio.cash,
        netCash: cashState.portfolio.cash, state: cashState },
      deposit: { initialCash: depositChoice.portfolio.cash, liquidBuffer: depositChoice.portfolio.cash,
        netCash: depositState.portfolio.cash, principalReturned: lot.principal, rate: lot.rate, state: depositState },
      checkpoint: { phase: 'summary' as const, lap: cashState.lap, turn: cashState.turn, dice: cashState.dice },
      realizedInterest, alternativeMinusActual: input.actual === 'cash' ? realizedInterest : -realizedInterest,
      fees: 0, commonPaid }
  } catch (error) {
    // No financial fields escape a failed validity gate, including engine rejection.
    return { status: 'unsupported' as const, reason: error instanceof SliceStopped ? error.message : 'engine-rejected' }
  }
}
