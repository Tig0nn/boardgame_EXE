import assert from 'node:assert/strict'
import { test } from 'node:test'
import { boardFor } from '../../../src/data/board.ts'
import { ECONOMY } from '../../../src/data/config.ts'
import { transact } from '../../../src/game/engine.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { liquidatableFunds } from '../../../src/game/selectors.ts'
import type { GameState } from '../../../src/game/types.ts'
import { publicBusinessState, quoteB18Business, transitionB18Business } from '../src/services/b18-business.ts'
import { gameActionBody } from '../src/validation.ts'

const buy = { kind: 'buy', asset: 'business', amount: ECONOMY.business.cost } as const
const upgrade = { kind: 'upgrade', asset: 'business', amount: ECONOMY.business.upgradeCost } as const
const visit = (game: GameState, turn: number): GameState => ({
  ...game, turn, phase: 'event', eventId: 'business', position: boardFor(game).findIndex(tile => tile.type === 'business'),
})

test('Business payload permits canonical zero-value sale and validates scope', () => {
  const parse = (payload: object) => gameActionBody.safeParse({ actionId: 'trade', expectedStateVersion: 0, payload })
  assert.ok(parse(buy).success)
  assert.ok(parse({ ...upgrade, customerPreferenceId: 'taste' }).success)
  assert.ok(parse({ ...buy, kind: 'sell', amount: 0 }).success)
  for (const payload of [
    { ...buy, amount: 0 }, { ...buy, cash: 20_000_000 }, { ...buy, completeEncounter: true },
    { ...upgrade, profit: 1 }, { ...upgrade, trend: 'growth' }, { ...upgrade, customerPreferenceId: 'forged' },
    { ...buy, kind: 'withdraw' },
  ]) assert.equal(parse(payload).success, false)
})

test('Business buy, upgrade and full sale use the engine at the correct visit', () => {
  const initial = visit(createMultiCourseGame('BUSINESS-UNIT'), 1)
  const original = structuredClone(initial)
  const bought = transact(initial, buy)
  assert.deepEqual(transitionB18Business(initial, buy), bought)
  const preview = quoteB18Business(initial, buy)!
  assert.equal(preview.cashAfter, bought.portfolio.cash)
  assert.equal(preview.businessAfter.currentSaleValue, bought.portfolio.business)
  assert.deepEqual(initial, original)
  const reopened = visit(bought, 1)
  assert.equal(transitionB18Business(reopened, upgrade), null)
  assert.equal(transitionB18Business(reopened, { ...buy, kind: 'sell', amount: bought.portfolio.business }), null)
  const revisit = visit(bought, 2)
  const upgraded = transact(revisit, upgrade)
  assert.deepEqual(transitionB18Business(revisit, upgrade), upgraded)
  assert.equal(transitionB18Business(upgraded, upgrade), null)
  const sell = { ...buy, kind: 'sell', amount: upgraded.portfolio.business } as const
  assert.deepEqual(transitionB18Business(upgraded, sell), transact(upgraded, sell))
  assert.equal(transitionB18Business(upgraded, { ...sell, amount: sell.amount - 1 }), null)
  assert.equal(transitionB18Business({ ...upgraded, phase: 'rebalancing' }, sell), null)
  assert.equal(liquidatableFunds(upgraded), upgraded.portfolio.cash)
  assert.equal(publicBusinessState(upgraded, true).actions.some(action => action.kind === 'sell'), true)
  const worthless = { ...upgraded, business: { ...upgraded.business, recoverableCapital: 0 }, portfolio: { ...upgraded.portfolio, business: 0 } }
  const zeroSale = { ...sell, amount: 0 }
  assert.deepEqual(transitionB18Business(worthless, zeroSale), transact(worthless, zeroSale))
})
