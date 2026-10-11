import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { advance, createGame, decide, roll, transact, fundPayment, snapshot } from '../src/game/engine.ts'
import { businessIncome } from '../src/game/business.ts'
import { customerPreferenceForLap } from '../src/game/customer-preferences.ts'
import { CUSTOMER_PREFERENCES } from '../src/data/customer-preferences.ts'
import { applyMacroShock, updateNormalMarket } from '../src/game/market.ts'
import { beginSettlement } from '../src/game/settlement.ts'
import { copyState } from '../src/game/state.ts'
import { businessOverview, liquidatableFunds } from '../src/game/selectors.ts'
import { serializeLog } from '../src/game/log.ts'
import { replayGameLog } from '../scripts/diagnostics/replay-game-log.ts'
import { EVENTS } from '../src/data/events.ts'
import { MACRO_EVENTS, SCENARIOS } from '../src/data/config.ts'
import type { CustomerPreferenceId, GameState } from '../src/game/types.ts'

function owned(): GameState {
  const s = { ...createGame('preferences', 0, 1, 'experimental-b'), phase: 'event' as const, eventId: 'business', position: 8, turn: 1 }
  return transact(s, { kind: 'buy', asset: 'business', amount: 20_000_000 })
}
function later(s: GameState): GameState { return { ...s, phase: 'event', eventId: 'business', turn: s.turn + 1 } }
const upgrade = (s: GameState, id: CustomerPreferenceId) => transact(later(s), { kind: 'upgrade', asset: 'business', amount: 5_000_000, customerPreferenceId: id })

test('V2.4 independently versions income and persists a strongly typed customer preference', () => {
  const s = owned()
  assert.equal(s.businessRulesVersion, 'v2.4-customer-preferences')
  assert.equal(s.encounterRulesVersion, 'v2.4-business-purchase-complete')
  assert.ok(CUSTOMER_PREFERENCES.some(p => p.id === s.customerPreferenceId))
  assert.equal(snapshot(s).customerPreferenceId, s.customerPreferenceId)
  assert.equal(copyState(s).customerPreferenceId, s.customerPreferenceId)
  assert.equal(JSON.parse(serializeLog(s)).state.customerPreferenceId, s.customerPreferenceId)
})

test('preference depends only on seed and lap; changes deterministically across laps without gameplay RNG', () => {
  const s = owned()
  const ids = Array.from({ length: 12 }, (_, i) => customerPreferenceForLap(s.seed, i + 1))
  assert.deepEqual(ids.slice(0, 4), ['taste', 'budget', 'taste', 'budget'])
  assert.ok(new Set(ids).size > 1)
  assert.deepEqual(ids, Array.from({ length: 12 }, (_, i) => customerPreferenceForLap(s.seed, i + 1)))
  assert.ok(ids.every(id => CUSTOMER_PREFERENCES.some(p => p.id === id)))
  const next = advance({ ...s, phase: 'rebalancing', lap: 1 })
  const legacy = advance({ ...s, phase: 'rebalancing', lap: 1, businessRulesVersion: 'v2.3-fixed-income' })
  assert.equal(next.customerPreferenceId, ids[1])
  assert.equal(next.rng, legacy.rng)
  for (const scenario of SCENARIOS) assert.equal(businessIncome({ ...s, scenarioId: scenario.id }), 3_000_000)
})

for (const preference of ['checkin', 'budget', 'taste'] as CustomerPreferenceId[]) test(`V2.4 ${preference}: permanent +700k and matching +1M track customer preference only`, () => {
  const s = { ...owned(), customerPreferenceId: preference }
  const upgraded = upgrade(s, preference)
  assert.equal(businessIncome(upgraded), 4_700_000)
  assert.equal(upgraded.business.upgrades[preference], 1)
  assert.equal(upgraded.portfolio.cash, 25_000_000)
  for (const scenario of SCENARIOS) assert.equal(businessIncome({ ...upgraded, scenarioId: scenario.id }), 4_700_000)
  const other = CUSTOMER_PREFERENCES.find(p => p.id !== preference)!.id
  assert.equal(businessIncome({ ...upgraded, customerPreferenceId: other }), 3_700_000)
  assert.deepEqual(upgraded.business.upgrades, { [preference]: 1 })
  const two = upgrade(upgraded, preference)
  assert.equal(businessIncome(two), 6_400_000)
  assert.equal(businessIncome({ ...two, customerPreferenceId: other }), 4_400_000)
  assert.equal(businessOverview(later(s), preference).incrementalIncome, 1_700_000)
  assert.equal(businessOverview(later(s), other).incrementalIncome, 700_000)
  assert.throws(() => transact(upgraded, { kind: 'upgrade', amount: 5_000_000, customerPreferenceId: other }))
})

test('V2.4 rejects macro specialization keys, invalid preferences and missing preference metadata', () => {
  const s = later(owned())
  assert.throws(() => transact(s, { kind: 'upgrade', amount: 5_000_000, trend: 'growth' }))
  assert.throws(() => transact(s, { kind: 'upgrade', amount: 5_000_000, customerPreferenceId: 'growth' as CustomerPreferenceId }))
  const missing = { ...s }; delete missing.customerPreferenceId
  assert.throws(() => businessIncome(missing))
  assert.throws(() => transact({ ...s, business: { ...s.business, upgrades: { taste: 6 } } }, { kind: 'upgrade', amount: 5_000_000, customerPreferenceId: 'taste' }))
})

test('macro shocks and normal markets preserve operating income/preference, still changing recovery', () => {
  const s = upgrade(owned(), owned().customerPreferenceId!)
  const legacy = { ...s, businessRulesVersion: 'v2.3-fixed-income' as const }
  for (const event of MACRO_EVENTS) {
    const shocked = applyMacroShock(s, event.id)
    assert.equal(businessIncome(shocked), businessIncome(s))
    assert.equal(shocked.customerPreferenceId, s.customerPreferenceId)
    assert.notEqual(shocked.business.recoverableCapital, s.business.recoverableCapital)
    assert.deepEqual(shocked.business, applyMacroShock(legacy, event.id).business)
    assert.deepEqual(shocked.market, applyMacroShock(legacy, event.id).market)
  }
  const updated = updateNormalMarket(s)
  assert.equal(businessIncome(updated), businessIncome(s))
  assert.equal(updated.customerPreferenceId, s.customerPreferenceId)
  assert.notEqual(updated.business.recoverableCapital, s.business.recoverableCapital)
  assert.equal(updated.rng, updateNormalMarket(legacy).rng)
  assert.deepEqual(updated.business, updateNormalMarket(legacy).business)
  assert.deepEqual(updated.market, updateNormalMarket(legacy).market)
  const settled = beginSettlement({ ...s, phase: 'rolling', position: 0 })
  assert.equal(settled.summaries[0].lines.find(l => l.label === 'Dòng tiền kinh doanh')?.amount, businessIncome(s))
  assert.equal(settled.customerPreferenceId, s.customerPreferenceId)
  const restored = JSON.parse(JSON.stringify(settled))
  assert.deepEqual(beginSettlement(restored), restored)
  assert.equal(liquidatableFunds(s), s.portfolio.cash)
})

test('V2.3 still matches scenario keys and never silently reinterprets them as preferences', () => {
  const s = { ...createGame('old-trends', 0, 1, 'experimental-b', undefined, 'v2.3-fixed-income', 'v2.3-single-action'), phase: 'event' as const, eventId: 'business', position: 8, turn: 1, scenarioId: 'growth' }
  const upgraded = transact(later(transact(s, { kind: 'buy', asset: 'business', amount: 20_000_000 })), { kind: 'upgrade', amount: 5_000_000, trend: 'growth' })
  assert.equal(upgraded.customerPreferenceId, undefined)
  assert.equal(businessIncome(upgraded), 4_700_000)
  assert.equal(businessIncome({ ...upgraded, scenarioId: 'recovery' }), 3_700_000)
  assert.throws(() => transact(later(upgraded), { kind: 'upgrade', amount: 5_000_000, customerPreferenceId: 'taste' }))
  for (const path of ['business-v2_3', 'encounter-limits-v2_3']) {
    const data = JSON.parse(gunzipSync(readFileSync(`docs/playtests/${path}/browser-game-log.json.gz`)).toString())
    replayGameLog(data)
    replayGameLog(JSON.parse(serializeLog(data.state)))
  }
})

test('V2.4 JSON continuation keeps the lap preference during paused START and pays business once', () => {
  const s = upgrade(owned(), owned().customerPreferenceId!)
  const paused = beginSettlement({ ...s, phase: 'rolling', obligations: 60_000_000 })
  assert.equal(paused.phase, 'funding')
  assert.equal(paused.customerPreferenceId, s.customerPreferenceId)
  const settled = fundPayment(JSON.parse(JSON.stringify(paused)), 'debt', paused.pendingPayment!.remaining)
  assert.equal(settled.customerPreferenceId, s.customerPreferenceId)
  assert.equal(settled.log.filter(e => e.title === 'Dòng tiền kinh doanh').length, 1)
  assert.equal(settled.summaries[0].lines.find(l => l.label === 'Dòng tiền kinh doanh')?.amount, 4_700_000)
  const next = advance(advance(settled))
  assert.equal(next.customerPreferenceId, customerPreferenceForLap(s.seed, 2))
  assert.deepEqual(next.business.upgrades, s.business.upgrades)
})

test('real V2.3 log buying and immediately selling in one encounter replays exactly', () => {
  let s = createGame('XVTL-V2-0', 0, 1, 'experimental-b', undefined, 'v2.3-fixed-income', 'v2.3-single-action')
  for (let guard = 0; s.eventId !== 'business' && guard < 80; guard++) {
    if (s.phase === 'rolling') s = roll(s)
    else if (s.phase === 'event') {
      const event = EVENTS.find(e => e.id === s.eventId)!
      s = decide(s, event.options.find(o => o.id === 'skip')?.id ?? event.options[0].id)
    } else s = advance(s)
  }
  assert.equal(s.eventId, 'business')
  s = transact(s, { kind: 'buy', asset: 'business', amount: 20_000_000 })
  s = transact(s, { kind: 'sell', asset: 'business', amount: s.portfolio.business })
  assert.equal(s.phase, 'event')
  const data = JSON.parse(serializeLog(s))
  assert.equal(data.entries.at(-2).turn, data.entries.at(-1).turn)
  assert.deepEqual(replayGameLog(data), s)
})

test('V2.4 complete game replays all snapshots, preferences, Bank/stock atomics and business actions', () => {
  let s = createGame('XVTL-V2-0', 0, 1, 'experimental-b')
  let reference = createGame('XVTL-V2-0', 0, 1, 'experimental-b', undefined, 'v2.3-fixed-income')
  const act = (fn: (state: GameState) => GameState) => { s = fn(s); reference = fn(reference) }
  const preferences = new Map<number, CustomerPreferenceId>()
  let stocks = 0; let upgrades = 0
  for (let guard = 0; s.phase !== 'finished' && guard < 180; guard++) {
    const expected = customerPreferenceForLap(s.seed, s.lap)
    assert.equal(s.customerPreferenceId, expected)
    if (preferences.has(s.lap)) assert.equal(preferences.get(s.lap), s.customerPreferenceId)
    preferences.set(s.lap, s.customerPreferenceId!)
    if (s.phase === 'rolling') {
      act(roll)
      assert.deepEqual([s.dice, s.position, s.rng], [reference.dice, reference.position, reference.rng])
    } else if (s.phase === 'event') {
      const event = EVENTS.find(e => e.id === s.eventId)!
      if (s.eventId === 'business' && s.business.capital === 0 && s.lap < 4) act(state => transact(state, { kind: 'buy', asset: 'business', amount: 20_000_000 }))
      else if (s.eventId === 'bank') act(state => transact(state, { kind: 'deposit', amount: 1_000_000, term: 3 }))
      else if (s.eventId === 'stocks') { act(state => transact(state, { kind: 'buy', asset: 'stocks', amount: 1_000_000, completeEncounter: true })); stocks++ }
      else {
        if (s.eventId === 'business' && s.business.capital > 0 && s.lap < 4) {
          s = transact(s, { kind: 'upgrade', amount: 5_000_000, customerPreferenceId: s.customerPreferenceId })
          reference = transact(reference, { kind: 'upgrade', amount: 5_000_000, trend: reference.scenarioId })
          upgrades++
        } else if (s.eventId === 'business' && s.business.capital > 0) act(state => transact(state, { kind: 'sell', asset: 'business', amount: state.portfolio.business }))
        act(state => decide(state, event.options.find(o => o.id === 'skip')?.id ?? event.options[0].id))
      }
    } else if (s.phase === 'funding') act(state => fundPayment(state, 'debt', state.pendingPayment!.remaining))
    else act(advance)
  }
  assert.equal(s.termination, 'completed')
  assert.equal(s.summaries.length, 4)
  assert.ok(upgrades > 0 && stocks > 0)
  const data = JSON.parse(serializeLog(s))
  assert.equal(data.businessRulesVersion, 'v2.4-customer-preferences')
  assert.deepEqual(replayGameLog(data), s)
  const purchase = s.log.find(e => e.decisionId === 'buy-business')!
  assert.equal(purchase.after.phase, 'rolling')
  assert.ok(!s.log.some(e => e.turn === purchase.turn && e.decisionId === 'skip'))
})

test('V2.4 Bank single deposits across encounters and atomic stocks remain protected', () => {
  const initial = { ...createGame('bank-stock-v24', 0, 1, 'experimental-b'), phase: 'event' as const, eventId: 'bank', position: 1, turn: 1 }
  const one = transact(initial, { kind: 'deposit', amount: 1_000_000, term: 1 })
  assert.equal(one.phase, 'rolling')
  assert.throws(() => transact(one, { kind: 'deposit', amount: 1_000_000 }))
  const two = transact({ ...one, phase: 'event', eventId: 'bank', turn: 2 }, { kind: 'deposit', amount: 1_000_000, term: 3 })
  assert.equal(two.deposits.length, 2)
  assert.deepEqual(two.deposits.map(l => [l.rate, l.maturityLap]), [[.04, 1], [.06, 3]])
  const stocks = transact({ ...two, phase: 'event', eventId: 'stocks', position: 2, turn: 3 }, { kind: 'buy', asset: 'stocks', amount: 1_000_000, completeEncounter: true })
  assert.equal(stocks.phase, 'rolling')
  assert.equal(stocks.portfolio.cash, 47_000_000)
  assert.throws(() => transact(stocks, { kind: 'buy', asset: 'stocks', amount: 1_000_000, completeEncounter: true }))
})
