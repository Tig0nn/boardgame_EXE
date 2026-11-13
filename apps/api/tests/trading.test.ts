import assert from 'node:assert/strict'
import { test } from 'node:test'
import { boardFor } from '../../../src/data/board.ts'
import { transact } from '../../../src/game/engine.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { saleQuote } from '../../../src/game/selectors.ts'
import type { GameState, TradableAsset } from '../../../src/game/types.ts'
import { quoteB18Trade, transitionB18Trade } from '../src/services/b18-trading.ts'
import { gameActionBody } from '../src/validation.ts'

test('trade payload preserves canonical identifiers and rejects prices, balances and other commands', () => {
  const valid = [
    { kind: 'buy', asset: 'gold', amount: 1, completeEncounter: true },
    { kind: 'buy', asset: 'stocks', amount: 1, symbolId: 'FPT' },
    { kind: 'sell', asset: 'stocks', amount: 1 },
    { kind: 'buy', asset: 'bonds', amount: 1, issuerId: 'an-tam' },
    { kind: 'sell', asset: 'bonds', amount: 1, lotId: 'bond-1' },
  ]
  const parse = (payload: object) => gameActionBody.safeParse({ actionId: 'trade', expectedStateVersion: 0, payload })
  for (const trade of valid) assert.equal(parse(trade).success, true)
  for (const trade of [
    { ...valid[0], price: 1 }, { ...valid[0], cash: 1 }, { ...valid[0], holdings: {} },
    { ...valid[0], amount: 0 }, { ...valid[0], amount: 1.25 }, { ...valid[0], amount: Number.MAX_SAFE_INTEGER + 1 },
    { ...valid[0], asset: 'bank' }, { ...valid[0], kind: 'deposit' },
    { kind: 'buy', asset: 'bonds', amount: 1 }, { kind: 'sell', asset: 'bonds', amount: 1 },
    { kind: 'buy', asset: 'bonds', amount: 1, issuerId: 'unknown' },
  ]) assert.equal(parse(trade).success, false)
})

test('gold quote uses exact cash and canonical sale rounding without consuming an encounter', () => {
  const initial = createMultiCourseGame('trade-unit')
  const visit = (game: GameState, asset: TradableAsset, turn: number): GameState => ({
    ...game, phase: 'event', eventId: asset, position: boardFor(game).findIndex(tile => tile.type === asset), turn,
  })
  const game = visit(initial, 'gold', 1)
  const buy = { kind: 'buy', asset: 'gold', amount: 1_234_567 } as const
  const expected = transact(game, buy)
  const buyQuote = quoteB18Trade(game, buy)!
  assert.equal(buyQuote.cashPaid, buy.amount)
  assert.equal(buyQuote.quantity, expected.goldUnits)
  assert.equal(game.goldUnits, 0)
  assert.deepEqual(transitionB18Trade(game, buy), expected)
  const later = visit(expected, 'gold', 2)
  const sell = { kind: 'sell', asset: 'gold', amount: 765_431 } as const
  const sale = saleQuote(later, 'gold', sell.amount)
  const quoted = quoteB18Trade(later, sell)!
  assert.equal(quoted.cashReceived, sale.net)
  assert.equal(quoted.fee, sale.fee)
  assert.equal(quoted.spread, sale.spread)
  assert.equal(transitionB18Trade({ ...later, phase: 'rebalancing' }, sell), null)
  assert.equal(quoteB18Trade(game, sell), null)
})
