import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { advance, createGame, decide, roll, transact, fundPayment, snapshot } from '../src/game/engine.ts'
import { businessIncome, businessSaleQuote } from '../src/game/business.ts'
import { copyState } from '../src/game/state.ts'
import { applyMacroShock, updateNormalMarket } from '../src/game/market.ts'
import { beginSettlement, continueSettlement } from '../src/game/settlement.ts'
import { fundingSources } from '../src/game/transactions.ts'
import { liquidatableFunds } from '../src/game/selectors.ts'
import { serializeLog } from '../src/game/log.ts'
import { ECONOMY, MACRO_EVENTS, SCENARIOS } from '../src/data/config.ts'
import { EVENTS } from '../src/data/events.ts'
import { replayGameLog } from '../scripts/diagnostics/replay-game-log.ts'
import type { GameState } from '../src/game/types.ts'

function owned(): GameState {
  const state = { ...createGame('business-v23', 0, 1, 'experimental-b'), phase: 'event' as const, position: 8, eventId: 'business', turn: 1 }
  return transact(state, { kind: 'buy', asset: 'business', amount: 20_000_000 })
}

test('V2.3 new games explicitly version business rules in state, snapshots, copies and logs', () => {
  const state = owned()
  assert.equal(state.businessRulesVersion, 'v2.3-fixed-income')
  assert.equal(snapshot(state).businessRulesVersion, state.businessRulesVersion)
  assert.equal(copyState(state).businessRulesVersion, state.businessRulesVersion)
  const data = JSON.parse(serializeLog(state))
  assert.equal(data.schemaVersion, 5)
  assert.equal(data.businessRulesVersion, state.businessRulesVersion)
  assert.match(data.rulesVersion, /v2.3/)
  assert.ok(data.entries.every((e: { before: GameState; after: GameState }) => e.before.businessRulesVersion === state.businessRulesVersion && e.after.businessRulesVersion === state.businessRulesVersion))
})

for (const scenario of SCENARIOS) test(`V2.3 fixed 3M base in ${scenario.id}, with no income outside START`, () => {
  const state = { ...owned(), scenarioId: scenario.id }
  assert.equal(businessIncome(state), 3_000_000)
  assert.equal(state.portfolio.cash, 30_000_000)
  assert.equal(businessIncome(createGame('unowned', 0)), 0)
})

test('V2.3 each macro shock changes recovery exactly as before, never operating income', () => {
  const state = owned()
  for (const event of MACRO_EVENTS) {
    const shocked = applyMacroShock(state, event.id)
    assert.equal(businessIncome(shocked), 3_000_000)
    assert.equal(shocked.business.recoverableCapital, state.business.recoverableCapital * (1 + event.business))
    assert.equal(businessSaleQuote(shocked), Math.round(shocked.business.recoverableCapital))
    assert.deepEqual(applyMacroShock(shocked, event.id), shocked)
  }
  assert.notEqual(businessSaleQuote(applyMacroShock(state, 'credit-tightening')), businessSaleQuote(state))
})

test('V2.3 upgrade examples and scenario matching retain permanent bonuses', () => {
  const state = { ...owned(), scenarioId: 'growth' }
  assert.equal(businessIncome({ ...state, business: { ...state.business, upgrades: { growth: 1 } } }), 4_700_000)
  assert.equal(businessIncome({ ...state, business: { ...state.business, upgrades: { recovery: 1 } } }), 3_700_000)
  const two = { ...state, business: { ...state.business, upgrades: { growth: 2 } } }
  assert.equal(businessIncome(two), 6_400_000)
  assert.equal(businessIncome({ ...two, scenarioId: 'recovery' }), 4_400_000)
  assert.equal(businessIncome(applyMacroShock(two, 'credit-tightening')), 6_400_000)
})

test('V2.3 normal market recovery and RNG exactly match legacy rules', () => {
  const state = owned()
  const legacy = { ...state, businessRulesVersion: 'v2.2-trend-shock' as const }
  const current = updateNormalMarket(state)
  const previous = updateNormalMarket(legacy)
  assert.deepEqual(current.business, previous.business)
  assert.deepEqual(current.market, previous.market)
  assert.deepEqual(current.portfolio, previous.portfolio)
  assert.equal(current.rng, previous.rng)
  assert.notEqual(current.business.recoverableCapital, state.business.recoverableCapital)
  assert.equal(businessIncome(current), 3_000_000)
})

test('V2.3 purchase lock, multiple upgrades, sale and liquidity restrictions remain intact', () => {
  const state = owned()
  assert.throws(() => transact(state, { kind: 'upgrade', asset: 'business', amount: 5_000_000, trend: 'growth' }))
  const later = { ...state, turn: 2, scenarioId: 'growth' }
  const first = transact(later, { kind: 'upgrade', asset: 'business', amount: 5_000_000, trend: 'growth' })
  const second = transact(first, { kind: 'upgrade', asset: 'business', amount: 5_000_000, trend: 'growth' })
  assert.equal(second.portfolio.cash, 20_000_000)
  assert.equal(businessIncome(second), 6_400_000)
  assert.equal(businessSaleQuote(second), 19_000_000)
  assert.equal(liquidatableFunds(second), 20_000_000)
  const mandatory = decide({ ...second, eventId: 'medical', position: 7, portfolio: { ...second.portfolio, cash: 0 } }, 'pay')
  assert.ok(!fundingSources(mandatory).includes('business' as 'stocks'))
  assert.throws(() => fundPayment(mandatory, 'business' as 'stocks', 1_000_000))
  assert.throws(() => transact({ ...second, phase: 'rebalancing' }, { kind: 'sell', asset: 'business', amount: second.portfolio.business }))
  const sold = transact(second, { kind: 'sell', asset: 'business', amount: second.portfolio.business })
  assert.equal(sold.portfolio.cash, 39_000_000)
  assert.equal(businessIncome(sold), 0)
  assert.equal(liquidatableFunds(sold), 39_000_000)
})

test('V2.3 START pays once, including paused obligation funding and JSON continuation', () => {
  const state = { ...owned(), phase: 'rolling' as const, position: 0, obligations: 50_000_000 }
  const paused = beginSettlement(state)
  assert.equal(paused.phase, 'funding')
  assert.equal(paused.pendingPayment?.remaining, 3_000_000)
  assert.equal(paused.log.filter(e => e.title === 'Dòng tiền kinh doanh').length, 1)
  const settled = fundPayment(JSON.parse(JSON.stringify(paused)), 'debt', 3_000_000)
  assert.equal(settled.summaries[0].lines.find(line => line.label === 'Dòng tiền kinh doanh')?.amount, 3_000_000)
  assert.deepEqual(beginSettlement(settled), settled)
  assert.deepEqual(continueSettlement(settled), settled)
  assert.equal(settled.log.filter(e => e.title === 'Dòng tiền kinh doanh').length, 1)
  assert.equal(settled.businessRulesVersion, 'v2.3-fixed-income')
})

test('missing or explicit legacy version preserves trend and shock income, including re-export', () => {
  const state = { ...owned(), scenarioId: 'growth' }
  delete state.businessRulesVersion
  assert.equal(businessIncome(state), 3_750_000)
  const shocked = applyMacroShock(state, 'credit-tightening')
  const expected = Math.round(ECONOMY.business.baseIncome * ECONOMY.business.trendIncome.growth + (shocked.business.economicMultiplier - 1) * ECONOMY.business.economicIncomeImpact)
  assert.equal(businessIncome(shocked), expected)
  assert.notEqual(businessIncome(shocked), businessIncome(state))
  assert.equal(businessIncome({ ...shocked, businessRulesVersion: 'v2.2-trend-shock' }), expected)
  const data = JSON.parse(serializeLog(shocked))
  assert.equal(data.businessRulesVersion, 'v2.2-trend-shock')
  assert.equal(data.state.businessRulesVersion, 'v2.2-trend-shock')
})

for (const file of ['original-log.json', 'a-log.json', 'b-log.json', 'v2_2-b-log.json']) test(`V2.3 replays unchanged historical ${file}`, () => {
  const data = JSON.parse(readFileSync(`docs/playtests/${file}`, 'utf8'))
  replayGameLog(data)
  const exported = JSON.parse(serializeLog(data.state))
  assert.equal(exported.businessRulesVersion, 'v2.2-trend-shock')
  replayGameLog(exported)
})

test('V2.3 replays historical atomic stock log without applying new business rules', () => {
  const data = JSON.parse(gunzipSync(readFileSync('docs/playtests/transaction-ux/browser-game-log.json.gz')).toString())
  replayGameLog(data)
})

test('V2.3 seeded four-lap game with business and atomic stocks replays complete state', () => {
  let s = createGame('XVTL-V2-0', 0, 1, 'experimental-b')
  for (let guard = 0; s.phase !== 'finished' && guard < 180; guard++) {
    if (s.phase === 'rolling') s = roll(s)
    else if (s.phase === 'funding') s = fundPayment(s, 'debt', s.pendingPayment!.remaining)
    else if (s.phase !== 'event') s = advance(s)
    else if (s.eventId === 'stocks' && s.portfolio.cash >= 1_000_000) s = transact(s, { kind: 'buy', asset: 'stocks', amount: 1_000_000, completeEncounter: true })
    else {
      if (s.eventId === 'business') {
        if (s.business.capital === 0 && s.lap < 4 && s.portfolio.cash >= 20_000_000) s = transact(s, { kind: 'buy', asset: 'business', amount: 20_000_000 })
        else if (s.business.capital > 0 && s.lap === 4) s = transact(s, { kind: 'sell', asset: 'business', amount: s.portfolio.business })
        else if (s.business.capital > 0 && s.portfolio.cash >= 5_000_000 && s.turn > s.businessPurchaseTurn!) s = transact(s, { kind: 'upgrade', asset: 'business', amount: 5_000_000, trend: s.scenarioId })
      }
      const event = EVENTS.find(e => e.id === s.eventId)!
      s = decide(s, event.options.find(o => o.id === 'skip')?.id ?? event.options[0].id)
    }
  }
  assert.equal(s.termination, 'completed')
  assert.equal(s.summaries.length, 4)
  assert.ok(s.log.some(e => e.decisionId === 'buy-business'))
  assert.ok(s.log.some(e => e.decisionId === 'buy-stocks-complete'))
  const data = JSON.parse(serializeLog(s))
  assert.deepEqual(JSON.parse(JSON.stringify(replayGameLog(data))), JSON.parse(JSON.stringify(s)))
  const bad = { ...data, businessRulesVersion: 'unsupported-rules' }
  assert.throws(() => replayGameLog(bad))
})
