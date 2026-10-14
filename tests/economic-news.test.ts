import test from 'node:test'
import assert from 'node:assert/strict'
import { SCENARIOS, MACRO_EVENTS } from '../src/data/config.ts'
import { advance } from '../src/game/engine.ts'
import { applyMacroShock, updateNormalMarket } from '../src/game/market.ts'
import { beginSettlement } from '../src/game/settlement.ts'
import { createMobileGame } from '../mobile_app/src/game/session.ts'
import { createMobileSession } from '../mobile_app/src/game/session.ts'
import { EVENTS } from '../src/data/events.ts'
import { serializeLog } from '../src/game/log.ts'
import { replayGameLog } from '../scripts/diagnostics/replay-game-log.ts'
import { marketBulletin, roundMarketReview, investmentSignal } from '../mobile_app/src/game/market-news.ts'

for (const scenario of SCENARIOS) test(`bulletin reflects official ${scenario.id} forecast, with three financial assets only`, () => {
  const game = { ...createMobileGame('news', 0), scenarioId: scenario.id, log: [] }
  const bulletin = marketBulletin(game)
  assert.equal(bulletin.headline, scenario.label)
  assert.equal(bulletin.context, scenario.description)
  assert.deepEqual(bulletin.assets.map(item => item.asset), ['stocks', 'bonds', 'gold'])
  for (const item of bulletin.assets) {
    assert.equal(item.forecast, scenario.tendencies[item.asset])
    assert.ok(item.characteristic.length > 0 && item.lesson.length > 0)
  }
})

test('no observations means unavailable, never historical pre-game returns or zero', () => {
  const game = createMobileGame('news', 0)
  for (const item of roundMarketReview(game).assets) assert.equal(item.returnRate, null)
  assert.equal(roundMarketReview(game).settled, false)
  assert.deepEqual(roundMarketReview(game).shocks, [])
  assert.equal(investmentSignal(game, 'gold').returnRate, null)
})

test('normal START update uses actual first/last prices, not portfolio returns', () => {
  const game = updateNormalMarket(createMobileGame('normal', 0))
  const review = roundMarketReview(game)
  assert.equal(review.settled, true)
  const gold = game.market.gold.priceHistory.at(-1)!
  assert.equal(review.assets[2].returnRate, gold.priceAfter / gold.priceBefore - 1)
  const mean = game.market.stocks.reduce((sum, stock) => {
    const point = stock.priceHistory.at(-1)!
    return sum + point.priceAfter / point.priceBefore - 1
  }, 0) / game.market.stocks.length
  assert.ok(Math.abs(review.assets[0].returnRate! - mean) < 1e-12)
  assert.equal(game.portfolio.stocks, 0)
})

test('macro shocks compound with normal prices once and remain separately attributed', () => {
  let game = createMobileGame('shock', 0)
  for (let i = 0; i < 2; i++) game = applyMacroShock({ ...game, turn: i + 1 }, MACRO_EVENTS[i].id)
  assert.deepEqual(applyMacroShock(game, MACRO_EVENTS[1].id), game)
  game = updateNormalMarket({ ...game, turn: 3 })
  const review = roundMarketReview(game)
  const points = game.market.gold.priceHistory.filter(point => point.lap === 1)
  assert.equal(review.assets[2].returnRate, points.at(-1)!.priceAfter / points[0].priceBefore - 1)
  assert.equal(review.shocks.length, 2)
  assert.deepEqual(review.shocks.map(shock => shock.label), MACRO_EVENTS.slice(0, 2).map(event => event.label))
})

test('unsettled partial shock observations are marked partial, not final results', () => {
  const game = applyMacroShock({ ...createMobileGame('partial', 0), turn: 1 }, 'credit-tightening')
  const review = roundMarketReview(game)
  assert.equal(review.settled, false)
  assert.equal(review.assets[2].returnRate, null)
  assert.ok(investmentSignal(game, 'gold').returnRate! > 0)
  assert.equal(review.shocks.length, 1)
})

test('original forecast and old round outcome survive a different next forecast and shocks', () => {
  const first = beginSettlement(createMobileGame('boundaries', 0))
  const expected = roundMarketReview(first)
  let later = advance(advance(first))
  later = { ...later, scenarioId: first.scenarioId === 'growth' ? 'uncertain' : 'growth' }
  later = applyMacroShock({ ...later, turn: later.turn + 1 }, 'supply-recovery')
  later = beginSettlement(later)
  assert.deepEqual(roundMarketReview(later, 1), expected)
  assert.equal(roundMarketReview(later, 2).forecastId, later.scenarioId)
  assert.notEqual(roundMarketReview(later, 2).forecastId, first.scenarioId)
})

test('no future round, future timestamp, or hidden event leaks into bulletin/review', () => {
  const game = createMobileGame('future', 0)
  const future = applyMacroShock({ ...game, turn: 5 }, 'demand-boom')
  const hidden = { ...future, turn: 0, log: game.log }
  assert.deepEqual(marketBulletin(hidden), marketBulletin(game))
  assert.deepEqual(roundMarketReview(hidden).shocks, [])
  assert.equal(investmentSignal(hidden, 'gold').returnRate, null)
  assert.equal(roundMarketReview(hidden, 2).forecastId, null)
})

test('current stock signal follows selected symbol and actual quote, no invented market price', () => {
  const game = applyMacroShock({ ...createMobileGame('symbol', 0), turn: 1 }, 'supply-recovery')
  for (const stock of game.market.stocks) {
    const signal = investmentSignal(game, 'stocks', stock.id)
    assert.equal(signal.price, stock.currentPrice)
    assert.equal(signal.returnRate, stock.priceHistory.at(-1)!.returnRate)
    assert.equal(signal.label, stock.id)
  }
})

test('missing forecast or broken/missing observations fail closed', () => {
  const game = updateNormalMarket(createMobileGame('missing', 0))
  const missing = { ...game, scenarioId: 'unknown', log: [] }
  assert.equal(marketBulletin(missing).available, false)
  assert.equal(roundMarketReview(missing).assets[0].returnRate, null)
  const broken = structuredClone(game)
  broken.market.stocks[0].priceHistory = []
  broken.market.gold.priceHistory.at(-1)!.priceBefore = 0
  assert.equal(roundMarketReview(broken).assets[0].returnRate, null)
  assert.equal(roundMarketReview(broken).assets[2].returnRate, null)
})

test('reading all news selectors is deterministic and leaves RNG, snapshots and legal state intact', () => {
  const game = beginSettlement(applyMacroShock({ ...createMobileGame('readonly', 10_000_000), turn: 1 }, 'credit-tightening'))
  const before = JSON.stringify(game)
  const one = roundMarketReview(game)
  for (let i = 0; i < 10; i++) {
    marketBulletin(game)
    for (const asset of ['stocks', 'bonds', 'gold'] as const) investmentSignal(game, asset)
    assert.deepEqual(roundMarketReview(game), one)
  }
  assert.equal(JSON.stringify(game), before)
})

test('four complete rounds with news opened at every step keep full-state replay and START boundaries', () => {
  const session = createMobileSession(createMobileGame('news-four-rounds', 0))
  const reviews = []
  for (let step = 0; step < 500 && session.getSnapshot().phase !== 'finished'; step++) {
    const game = session.getSnapshot()
    const before = serializeLog(game)
    marketBulletin(game)
    for (const asset of ['stocks', 'bonds', 'gold'] as const) investmentSignal(game, asset)
    const review = roundMarketReview(game)
    assert.equal(serializeLog(game), before)
    if (game.phase === 'summary') {
      reviews.push(review)
      assert.equal(review.lap, game.lap)
      assert.equal(review.endTurn, game.turn)
      assert.equal(review.forecastId, game.scenarioId)
      assert.ok(review.assets.every(item => item.returnRate !== null))
    }
    assert.notEqual(game.phase, 'funding', 'conservative fixture keeps enough cash')
    session.dispatch(game.phase === 'rolling' ? { type: 'roll' } : game.phase === 'event'
      ? { type: 'choose', id: EVENTS.find(event => event.id === game.eventId)!.options.find(option => option.id === 'skip')?.id ?? EVENTS.find(event => event.id === game.eventId)!.options[0].id }
      : { type: 'advance' }, game)
  }
  const final = session.getSnapshot()
  assert.equal(final.phase, 'finished')
  assert.equal(reviews.length, 4)
  for (const review of reviews) assert.deepEqual(roundMarketReview(final, review.lap), review)
  assert.deepEqual(replayGameLog(JSON.parse(serializeLog(final))), final)
})
