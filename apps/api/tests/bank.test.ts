import assert from 'node:assert/strict'
import { test } from 'node:test'
import { boardFor } from '../../../src/data/board.ts'
import { decide, fundPayment, transact } from '../../../src/game/engine.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { depositPreview, lostInterestOnWithdrawal } from '../../../src/game/selectors.ts'
import type { GameState } from '../../../src/game/types.ts'
import { bankQuoteBody, gameActionBody } from '../src/validation.ts'
import { quoteB18Bank, transitionB18Bank } from '../src/services/b18-bank.ts'

const deposit = { kind: 'deposit', amount: 1_234_567, term: 2 } as const
const repay = { kind: 'repay', amount: 1_234_567 } as const
const bank = (game: GameState): GameState => ({
  ...game, phase: 'event', eventId: 'bank', position: boardFor(game).findIndex(tile => tile.type === 'bank'),
})

test('bank schema accepts canonical trade and fund payloads and rejects client financial fields', () => {
  const parse = (payload: object) => gameActionBody.safeParse({ actionId: 'trade', payload, expectedStateVersion: 0 })
  assert.ok(parse(deposit).success)
  assert.ok(parse({ kind: 'deposit', amount: 1 }).success)
  assert.ok(parse(repay).success)
  for (const payload of [
    { ...deposit, term: 4 }, { ...deposit, amount: 0 }, { ...repay, amount: 1.5 },
    { ...deposit, interest: 1 }, { ...deposit, rate: 0.5 }, { ...deposit, cash: 50 },
    { ...repay, creditLimit: 50 }, { kind: 'borrow', amount: 1 }, { kind: 'withdraw', amount: 1 },
  ]) assert.equal(parse(payload).success, false)
  assert.equal(bankQuoteBody.safeParse({
    actionId: 'fund', expectedStateVersion: 0, payload: { source: 'stocks', amount: 1 },
  }).success, false)
})

test('Bank deposit quote is read-only and matches the canonical lot and interest', () => {
  const game = bank(createMultiCourseGame('BANK-UNIT'))
  const original = structuredClone(game)
  const expected = transact(game, deposit)
  assert.deepEqual(transitionB18Bank(game, deposit), expected)
  assert.deepEqual(transitionB18Bank(game, { kind: 'deposit', amount: 1 }), transact(game, { kind: 'deposit', amount: 1 }))
  const quoted = quoteB18Bank(game, { actionId: 'trade', payload: deposit, expectedStateVersion: 0 })!
  assert.equal(quoted.cashAfter, expected.portfolio.cash)
  assert.equal(quoted.savingsAfter, expected.portfolio.savings)
  assert.equal(quoted.deposit?.interestAtMaturity, depositPreview(game, deposit.amount, deposit.term).interest)
  assert.equal(quoted.deposit?.maturityLap, expected.deposits[0].maturityLap)
  assert.equal(transitionB18Bank({ ...game, phase: 'rolling' }, deposit), null)
  assert.equal(transitionB18Bank(game, { ...deposit, amount: game.portfolio.cash + 1 }), null)
  assert.deepEqual(game, original)
})

test('repayment uses canonical rounding and Funding preview reports lost savings interest', () => {
  const initial = createMultiCourseGame('BANK-FUND', 49_000_000, 3)
  const medical: GameState = {
    ...initial, phase: 'event', eventId: 'medical', position: boardFor(initial).findIndex(tile => tile.type === 'personal'),
  }
  const pending = decide(medical, 'pay')
  const action = { source: 'savings', amount: 49_000_000, lotId: 'deposit-1' } as const
  const expected = fundPayment(pending, action.source, action.amount, action.lotId)
  const preview = quoteB18Bank(pending, { actionId: 'fund', payload: action, expectedStateVersion: 0 })!
  assert.equal(preview.cashAfter, expected.portfolio.cash)
  assert.equal(preview.funding?.lostInterest, lostInterestOnWithdrawal(pending, action.lotId))
  const checkpoint: GameState = {
    ...expected, phase: 'rebalancing', portfolio: { ...expected.portfolio, debt: 2_000_000 },
  }
  for (const lap of [1, 4]) {
    const game = { ...checkpoint, lap }
    const repaid = transact(game, repay)
    assert.deepEqual(transitionB18Bank(game, repay), repaid)
    const quote = quoteB18Bank(game, { actionId: 'trade', payload: repay, expectedStateVersion: 0 })!
    assert.equal(quote.repayment?.interest, repaid.log.at(-1)!.debtInterestPaid)
    assert.equal(quote.repayment?.interest, lap === 4 ? 0 : 123_457)
    assert.equal(quote.debtAfter, repaid.portfolio.debt)
  }
})
