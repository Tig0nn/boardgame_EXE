import assert from 'node:assert/strict'
import { test } from 'node:test'
import { boardFor } from '../../../src/data/board.ts'
import { advance, rebalance, roll, transact } from '../../../src/game/engine.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { saleQuote } from '../../../src/game/selectors.ts'
import type { TradableAsset } from '../../../src/game/types.ts'
import { publicB18State } from '../src/services/b18-actions.ts'
import { quoteB18Trade, transitionB18Trade } from '../src/services/b18-trading.ts'
import type { TradePayload } from '../src/validation.ts'

test('START previews and sells all held financial assets at canonical prices', () => {
  let game = createMultiCourseGame('START-PARITY')
  const buys = [
    { kind: 'buy', asset: 'gold', amount: 1_500_001 },
    { kind: 'buy', asset: 'stocks', amount: 1_500_001, symbolId: game.market.stocks[0].id },
    { kind: 'buy', asset: 'bonds', amount: 1_500_001, issuerId: 'an-tam' },
  ] as const
  for (const [turn, action] of buys.entries()) {
    const position = boardFor(game).findIndex(tile => tile.type === action.asset)
    game = transact({ ...game, phase: 'event', eventId: action.asset, turn, position }, action)
  }
  const settled = roll({ ...game, phase: 'rolling', position: 17 })
  assert.equal(settled.phase, 'summary')
  assert.equal(publicB18State(settled).start.settlementStatus, 'completed')
  game = advance(settled)
  assert.equal(game.phase, 'rebalancing')
  const checkpoint = publicB18State(game).start
  assert.ok(checkpoint.canFinishRebalancing)
  assert.ok(checkpoint.sales.some(sale => sale.asset === 'bonds' && sale.lotId === 'bond-1'))

  for (const buy of buys) assert.equal(transitionB18Trade(game, buy), null)
  for (const asset of ['gold', 'stocks', 'bonds'] as TradableAsset[]) {
    const amount = 500_001
    const payload = (asset === 'bonds' ? { kind: 'sell', asset, amount, lotId: 'bond-1' }
      : { kind: 'sell', asset, amount }) satisfies TradePayload
    const original = structuredClone(game)
    const quote = quoteB18Trade(game, payload)!
    const net = saleQuote(game, asset, amount, 'lotId' in payload ? payload.lotId : undefined)
    const expected = rebalance(game, payload)
    assert.equal(quote.cashReceived, net.net)
    assert.equal(quote.fee, net.fee)
    assert.equal(quote.spread, net.spread)
    assert.equal(quote.cashAfter, expected.portfolio.cash)
    assert.deepEqual(game, original)
    assert.equal(transitionB18Trade(game, { ...payload, completeEncounter: true }), null)
    assert.equal(transitionB18Trade(settled, payload), null)
    assert.equal(transitionB18Trade(game, { ...payload, amount: quote.maxAmount + 1 }), null)
    const next = transitionB18Trade(game, payload)!
    assert.deepEqual(next, expected)
    assert.equal(next.phase, 'rebalancing')
    assert.equal(next.rng, game.rng)
    game = next
  }
})
