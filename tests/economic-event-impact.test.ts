import test from 'node:test'
import assert from 'node:assert/strict'
import { createMobileGame } from '../mobile_app/src/game/session.ts'
import { buildEconomicEventImpact } from '../mobile_app/src/game/economic-event.ts'
import { applyMacroShock, syncValuations } from '../src/game/market.ts'
import { createGame, decide, transact } from '../src/game/engine.ts'
import { businessIncome } from '../src/game/business.ts'
import { serializeLog } from '../src/game/log.ts'
import { roundMarketReview } from '../mobile_app/src/game/market-news.ts'

function shock(id: string, game = createMobileGame('event-ux', 0)) {
  return applyMacroShock({ ...game, phase: 'event', eventId: id, position: 5, turn: game.turn + 1 }, id)
}
for (const id of ['credit-tightening', 'demand-boom', 'supply-recovery']) test(`${id}: actual instrument/sector/gold/issuer movement from one snapshot pair`, () => {
  const game = shock(id), event = buildEconomicEventImpact(game)!, entry = game.log.at(-1)!
  assert.equal(event.id, id); assert.equal(event.available, true)
  assert.equal(event.groups.length, 3)
  assert.deepEqual(event.groups.map(group => group.asset), ['stocks', 'bonds', 'gold'])
  assert.equal(event.groups[0].items.length, 6)
  for (const item of event.groups[0].items) {
    const before = entry.before.market.stocks.find(stock => stock.id === item.id)!.currentPrice
    const after = entry.after.market.stocks.find(stock => stock.id === item.id)!.currentPrice
    assert.equal(item.returnRate, after / before - 1)
  }
  for (const sector of event.sectors) {
    const members = event.groups[0].items.filter(item => item.sector === sector.id)
    assert.equal(sector.returnRate, members.reduce((sum, item) => sum + item.returnRate!, 0) / members.length)
  }
  assert.equal(event.groups[2].items[0].returnRate, entry.after.market.gold.currentPrice / entry.before.market.gold.currentPrice - 1)
  assert.equal(event.groups[1].items.length, 2)
  for (const item of event.groups[1].items) {
    const before = entry.before.bondCredit!.issuers.find(issuer => issuer.id === item.id)!
    const after = entry.after.bondCredit!.issuers.find(issuer => issuer.id === item.id)!
    assert.equal(item.returnRate, after.currentPrice / before.currentPrice - 1)
    assert.equal(item.credit!.stressBefore, before.stress); assert.equal(item.credit!.stressAfter, after.stress)
    assert.equal(item.credit!.statusAfter, before.status) // macro reprices, doesn't invent a default
  }
  assert.equal(event.portfolio.length, 0)
})
test('historical single-issuer and fictional stock catalog retain their actual observations', () => {
  const game = shock('credit-tightening', createGame('old-event', 0, 1, 'experimental-b'))
  const event = buildEconomicEventImpact(game)!, entry = game.log.at(-1)!
  assert.equal(event.groups[1].items.length, 1)
  assert.equal(event.groups[1].items[0].credit, null)
  assert.equal(event.groups[1].items[0].returnRate, entry.after.market.bond.currentPrice / entry.before.market.bond.currentPrice - 1)
})
test('missing, stale, wrong-turn, wrong-lap and unrelated logs never substitute a different event', () => {
  const game = shock('demand-boom')
  for (const broken of [{ ...game, log: [] }, { ...game, turn: game.turn + 1 }, { ...game, lap: game.lap + 1 },
    { ...game, eventId: 'credit-tightening' }]) {
    const event = buildEconomicEventImpact(broken)!
    assert.equal(event.available, false)
    assert.ok(event.groups.every(group => group.items.every(item => item.returnRate === null)))
  }
  assert.equal(buildEconomicEventImpact({ ...game, phase: 'rolling' }), null)
  assert.equal(buildEconomicEventImpact({ ...game, eventId: 'repair' }), null)
  assert.equal(buildEconomicEventImpact({ ...game, position: 6 }), null)
})
test('invalid/missing prices are unavailable, never invented or averaged as zero', () => {
  for (const value of [0, -1, NaN, Infinity]) {
    const game = shock('supply-recovery')
    game.log.at(-1)!.before.market.stocks[0].currentPrice = value
    game.log.at(-1)!.before.market.gold.currentPrice = value
    const event = buildEconomicEventImpact(game)!
    assert.equal(event.groups[0].items[0].returnRate, null)
    assert.equal(event.groups[0].returnRate, null)
    assert.equal(event.sectors.find(sector => sector.id === 'technology')!.returnRate, null)
    assert.equal(event.groups[2].items[0].returnRate, null)
  }
  const game = shock('credit-tightening')
  game.log.at(-1)!.after.market.stocks = []
  assert.ok(buildEconomicEventImpact(game)!.groups[0].items.every(item => item.returnRate === null))
})
test('unchanged prices are zero; no quote is not a guaranteed loss or fresh default', () => {
  let game = createMobileGame('zero', 0)
  game.scenarioId = 'growth'
  game.bondCredit!.issuers[0].stress = 0
  game = shock('demand-boom', game)
  const event = buildEconomicEventImpact(game)!
  assert.equal(event.groups[1].items[0].returnRate, 0)
  const old = createMobileGame('default', 0)
  old.bondCredit!.issuers[0].status = 'defaulted'; old.bondCredit!.issuers[0].currentPrice = 0
  const defaults = buildEconomicEventImpact(shock('credit-tightening', old))!
  assert.equal(defaults.groups[1].items[0].returnRate, null)
  assert.equal(defaults.groups[1].items[0].credit!.statusBefore, 'defaulted')
  assert.equal(defaults.groups[1].items[0].credit!.statusAfter, 'defaulted')
})
test('current prices and later market records cannot replace the matched shock boundary', () => {
  const game = shock('demand-boom'), expected = buildEconomicEventImpact(game)
  game.market = structuredClone(game.market)
  game.market.gold.currentPrice = 999
  game.log = [...game.log, { ...game.log.at(-1)!, turn: game.turn + 1, after: { ...game.log.at(-1)!.after, turn: game.turn + 1 } }]
  assert.deepEqual(buildEconomicEventImpact(game), expected)
})
test('repeated reads/duplicate reference/acknowledgement cannot reapply a shock or consume RNG', () => {
  const game = shock('credit-tightening'), before = serializeLog(game), rng = game.rng, creditRng = game.bondCredit!.rng
  const expected = buildEconomicEventImpact(game), news = roundMarketReview(game, 1)
  for (let n = 0; n < 5; n++) assert.deepEqual(buildEconomicEventImpact(game), expected)
  assert.deepEqual(buildEconomicEventImpact({ ...game, log: [...game.log, game.log.at(-1)!] }), expected)
  assert.equal(serializeLog(game), before)
  assert.equal(game.rng, rng); assert.equal(game.bondCredit!.rng, creditRng)
  assert.deepEqual(roundMarketReview(game, 1), news)
  const acknowledged = decide(game, 'acknowledge')
  assert.equal(acknowledged.phase, 'rolling'); assert.equal(acknowledged.log.length, game.log.length + 1)
  assert.deepEqual(acknowledged.market, game.market); assert.deepEqual(acknowledged.bondCredit, game.bondCredit)
  assert.equal(acknowledged.rng, rng); assert.equal(acknowledged.portfolio.cash, game.portfolio.cash)
})
test('optional portfolio uses pre-shock holdings, rounded engine values and excludes coupon/cash', () => {
  let game = createMobileGame('owned-event', 0)
  for (const [asset, position, amount] of [['stocks', 2, 3_000_001], ['bonds', 6, 5_000_003], ['gold', 9, 2_000_007], ['business', 8, 20e6]] as const)
    game = transact({ ...game, phase: 'event', eventId: asset, position, turn: game.turn + 1 }, { kind: 'buy', asset, issuerId: 'an-tam', amount })
  const income = businessIncome(game)
  game = shock('credit-tightening', game)
  const event = buildEconomicEventImpact(game)!, entry = game.log.at(-1)!
  assert.equal(event.portfolio.length, 4)
  assert.equal(businessIncome(game), income)
  for (const item of event.portfolio) {
    assert.equal(item.before, entry.before.portfolio[item.asset])
    assert.equal(item.after, entry.after.portfolio[item.asset])
    assert.equal(item.delta, item.after! - item.before!)
  }
  assert.equal(game.portfolio.cash, entry.before.portfolio.cash)
  assert.deepEqual(entry.before.bondLots, entry.after.bondLots)
  assert.ok(!event.groups.some(group => String(group.asset) === 'business'))
  syncValuations(game)
  assert.deepEqual(buildEconomicEventImpact(game), event)
})
