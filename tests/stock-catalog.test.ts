import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, advance, roll, snapshot } from '../src/game/engine.ts'
import { createPlayerGame } from '../src/game/new-game.ts'
import { updateNormalMarket, applyMacroShock } from '../src/game/market.ts'
import { serializeLog } from '../src/game/log.ts'
import { replayGameLog } from '../scripts/diagnostics/replay-game-log.ts'

test('new player games use verified Vietnamese identifiers and versioned simulated history', () => {
  const s = createPlayerGame('catalog', 0)
  assert.equal(s.market.catalogVersion, 'vn-v1')
  assert.deepEqual(s.market.stocks.map(s => s.id), ['FPT', 'CMG', 'VCB', 'TCB', 'HPG', 'BMP'])
  assert.ok(s.market.stocks.every(s => s.priceHistory.length === 12 && s.currentPrice === 100_000))
  assert.equal(snapshot(s).market.catalogVersion, 'vn-v1')
  assert.deepEqual(replayGameLog(JSON.parse(serializeLog(s))), s)
})

test('catalog identity does not change historical RNG draw order or price dynamics', () => {
  const old = createGame('identity', 0, 1, 'experimental-b')
  const current = createPlayerGame('identity', 0)
  assert.equal(old.market.catalogVersion, undefined)
  assert.equal(old.market.stocks[0].id, 'XV-MAY')
  const financial = (s: typeof old) => ({ rng: s.rng, dice: s.dice,
    history: s.market.stocks.map(stock => ({ sector: stock.sector, currentPrice: stock.currentPrice, priceHistory: stock.priceHistory })) })
  assert.deepEqual(financial(current), financial(old))
  assert.deepEqual(financial(roll(advance(current))), financial(roll(advance(old))))
  assert.deepEqual(financial(updateNormalMarket(current)), financial(updateNormalMarket(old)))
  assert.deepEqual(financial(applyMacroShock(current, 'credit-tightening')), financial(applyMacroShock(old, 'credit-tightening')))
})

test('replay rejects inconsistent or unsupported catalog metadata', () => {
  const log = JSON.parse(serializeLog(createPlayerGame('catalog-invalid', 0)))
  log.stockCatalogVersion = 'fictional-v1'
  assert.throws(() => replayGameLog(log))
  log.stockCatalogVersion = 'vn-v1'
  log.state.market.catalogVersion = 'future'
  assert.throws(() => replayGameLog(log))
})
