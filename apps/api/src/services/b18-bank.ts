import { boardFor } from '../../../../src/data/board.ts'
import { fundPayment, transact } from '../../../../src/game/engine.ts'
import { encounterActionUsed } from '../../../../src/game/encounters.ts'
import { savingsProfileForGame } from '../../../../src/game/savings.ts'
import { depositPreview, liquidatableFunds, netWorth, purchasePreview, totalWorth } from '../../../../src/game/selectors.ts'
import { borrowingAvailable } from '../../../../src/game/transactions.ts'
import type { GameState } from '../../../../src/game/types.ts'
import type { BankPayload, BankQuoteRequest } from '../validation.ts'
import { canFundB18 } from './b18-funding.ts'

function canDeposit(game: GameState) {
  return game.phase === 'event' && game.eventId === 'bank' && boardFor(game)[game.position].type === 'bank' &&
    !encounterActionUsed(game, 'deposit') && game.portfolio.cash > 0
}

export function transitionB18Bank(game: GameState, action: BankPayload) {
  if (action.kind === 'deposit') {
    return canDeposit(game) && purchasePreview(game, action.amount).valid ? transact(game, action) : null
  }

  if (game.phase !== 'rebalancing' || action.amount > game.portfolio.debt) return null
  try {
    return transact(game, action)
  } catch (error) {
    // The engine validates principal and principal-plus-rounded-interest against the balance.
    if (error instanceof Error && error.message === 'Số tiền không hợp lệ hoặc vượt số dư khả dụng.') return null
    throw error
  }
}

export function publicBankState(game: GameState, active: boolean) {
  return {
    canDeposit: active && canDeposit(game),
    canRepay: active && game.portfolio.debt > 0 && transitionB18Bank(game, { kind: 'repay', amount: 1 }) !== null,
    savingsRates: savingsProfileForGame(game).rates,
    deposits: game.deposits,
    borrowingLimit: game.borrowingLimit,
    borrowingAvailable: borrowingAvailable(game),
    netWorth: netWorth(game.portfolio),
    totalWorth: totalWorth(game),
    liquidatableFunds: liquidatableFunds(game),
  }
}

export function quoteB18Bank(game: GameState, request: BankQuoteRequest) {
  let next: GameState
  let deposit
  let repayment
  let funding

  if (request.actionId === 'trade') {
    const action = request.payload
    const transitioned = transitionB18Bank(game, action)
    if (!transitioned) return null
    next = transitioned
    if (action.kind === 'deposit') {
      const term = action.term ?? 1
      const lot = next.deposits.at(-1)!
      const preview = depositPreview(game, action.amount, term)
      deposit = { ...lot, term, interestAtMaturity: preview.interest, withinGame: lot.maturityLap <= game.totalLaps }
    } else {
      const interest = next.log.at(-1)!.debtInterestPaid
      repayment = { principal: action.amount, interest, cashPaid: game.portfolio.cash - next.portfolio.cash }
    }
  } else {
    const { source, amount } = request.payload
    const lotId = 'lotId' in request.payload ? request.payload.lotId : undefined
    if (!canFundB18(game, source, amount, lotId)) return null
    next = fundPayment(game, source, amount, lotId)
    const entry = next.log[game.log.length]
    if (entry?.kind !== 'funding') throw new Error('Missing canonical funding log entry')
    const withdrawn = next.deposits.find((lot, index) => lot.status === 'withdrawn' && game.deposits[index]?.status === 'active')
    funding = {
      source, lotId: withdrawn?.id, amount, appliedToPayment: entry.expensePaid,
      lostInterest: entry.lostSavingsInterest,
    }
  }

  return {
    cashAfter: next.portfolio.cash,
    savingsAfter: next.portfolio.savings,
    debtAfter: next.portfolio.debt,
    phaseAfter: next.phase,
    pendingPaymentAfter: next.pendingPayment,
    terminationAfter: next.termination,
    deposit,
    repayment,
    funding,
  }
}
