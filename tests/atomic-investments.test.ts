import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { advance, createGame, decide, roll, transact } from '../src/game/engine.ts'
import { EVENTS } from '../src/data/events.ts'
import { createMobileSession } from '../mobile_app/src/game/session.ts'
import { createMobileGame } from './helpers/legacy-mobile.ts'
import { serializeLog } from '../src/game/log.ts'
import { snapshot, copyState } from '../src/game/state.ts'
import { ECONOMY } from '../src/data/config.ts'
import { businessIncome } from '../src/game/business.ts'
import { saleQuote } from '../src/game/selectors.ts'
import { marketBulletin, investmentSignal, roundMarketReview } from '../mobile_app/src/game/market-news.ts'
import { replayGameLog } from '../scripts/diagnostics/replay-game-log.ts'
import type { GameState, TradableAsset } from '../src/game/types.ts'

const positions = { stocks: 2, gold: 9, bonds: 6 }
const policy = 'v2.4-atomic-investments'
function encounter(asset: TradableAsset, game = createMobileGame('atomic-investments', 0)): GameState {
  return { ...game, phase: 'event', eventId: asset, position: positions[asset], turn: game.turn || 1 }
}

test('new player policy is explicit; historical createGame and stored sessions keep their old version', () => {
  const current = createMobileGame('policy', 0)
  assert.equal(current.encounterRulesVersion, policy)
  assert.equal(snapshot(current).encounterRulesVersion, policy)
  assert.equal(copyState(current).encounterRulesVersion, policy)
  assert.equal(JSON.parse(serializeLog(current)).encounterRulesVersion, policy)
  const old = createGame('policy', 0, 1, 'experimental-b')
  assert.equal(old.encounterRulesVersion, 'v2.4-business-purchase-complete')
  assert.equal(createMobileSession(JSON.parse(JSON.stringify(old))).getSnapshot().encounterRulesVersion, old.encounterRulesVersion)
})

for (const asset of ['stocks', 'gold', 'bonds'] as const) {
  const action = { kind: 'buy' as const, asset, amount: 1_234_567 }
  test(`${asset}: success ends encounter with one transaction, preserving price/units/fees and RNG`, () => {
    const initial = encounter(asset)
    const before = JSON.stringify(initial)
    const old = transact({ ...initial, encounterRulesVersion: 'v2.4-business-purchase-complete' }, action)
    for (const completeEncounter of [undefined, false, true]) {
      const bought = transact(initial, { ...action, completeEncounter })
      assert.equal(bought.phase, 'rolling')
      assert.equal(bought.eventId, null)
      assert.equal(bought.portfolio.cash, 50_000_000 - action.amount)
      assert.equal(bought.turn, initial.turn)
      assert.equal(bought.rng, initial.rng)
      assert.deepEqual(bought.market, initial.market)
      assert.deepEqual(bought.portfolio, old.portfolio)
      assert.deepEqual(bought.stockHoldings, old.stockHoldings)
      assert.deepEqual(bought.bondLots, old.bondLots)
      assert.equal(bought.goldUnits, old.goldUnits)
      assert.deepEqual(saleQuote(bought, asset), saleQuote(old, asset))
      assert.equal(bought.log.length, initial.log.length + 1)
      assert.equal(bought.log.at(-1)?.decisionId, `buy-${asset}-complete`)
      assert.equal(bought.log.at(-1)?.cashDelta, -action.amount)
      assert.equal(bought.log.filter(entry => entry.decisionId === 'skip').length, 0)
      assert.deepEqual(decide(bought, 'skip'), bought)
    }
    assert.equal(JSON.stringify(initial), before)
  })
  test(`${asset}: rapid calls and artificially reopened JSON encounter cannot buy twice`, () => {
    const initial = encounter(asset)
    const session = createMobileSession(initial)
    assert.equal(session.dispatch({ type: 'trade', action }, initial), true)
    assert.equal(session.dispatch({ type: 'trade', action }, initial), false)
    const one = session.getSnapshot()
    const saved = JSON.stringify(one)
    assert.throws(() => transact(one, action))
    for (const other of ['stocks', 'gold', 'bonds'] as const) {
      const reopened = encounter(other, JSON.parse(saved))
      assert.throws(() => transact(reopened, { ...action, asset: other, completeEncounter: false, ...(other === 'stocks' ? { symbolId: initial.market.stocks[1].id } : {}) }), /một lần/)
    }
    assert.equal(JSON.stringify(one), saved)
  })
  test(`${asset}: invalid purchases consume nothing; a subsequent valid purchase still works`, () => {
    const initial = encounter(asset)
    const before = JSON.stringify(initial)
    for (const amount of [0, -1, 0.5, NaN, Infinity, 50_000_001]) assert.throws(() => transact(initial, { ...action, amount }))
    if (asset === 'stocks') assert.throws(() => transact(initial, { ...action, symbolId: 'missing' }))
    assert.equal(JSON.stringify(initial), before)
    assert.equal(transact(initial, action).phase, 'rolling')
  })
  test(`${asset}: skip has no financial effects and later visit permits another purchase`, () => {
    const initial = encounter(asset)
    const skipped = decide(initial, 'skip')
    assert.equal(skipped.phase, 'rolling')
    assert.equal(skipped.eventId, null)
    assert.deepEqual(skipped.portfolio, initial.portfolio)
    const one = transact(initial, action)
    const later = encounter(asset, { ...one, turn: one.turn + 1 })
    const two = transact(later, action)
    assert.equal(two.phase, 'rolling')
    assert.equal(two.portfolio.cash, 50_000_000 - action.amount * 2)
    assert.equal(two.log.filter(entry => entry.decisionId === `buy-${asset}-complete`).length, 2)
  })
  test(`${asset}: START and wrong tiles remain illegal purchase locations`, () => {
    const initial = encounter(asset)
    assert.throws(() => transact({ ...initial, phase: 'rebalancing', position: 0 }, action))
    assert.throws(() => transact({ ...initial, position: 1, eventId: 'bank' }, action))
    assert.throws(() => transact(initial, { kind: 'sell', asset, amount: 1_000_000 }))
  })
}

test('Bank, Customer Preferences and START sale/repayment retain their financial behavior', () => {
  const initial = createMobileGame('separate-systems', 0)
  const bank = { ...initial, phase: 'event' as const, position: 1, eventId: 'bank', turn: 1 }
  const deposited = transact(bank, { kind: 'deposit', amount: 1_000_000, term: 2 })
  assert.equal(deposited.phase, 'rolling')
  assert.throws(() => transact({ ...deposited, phase: 'event', eventId: 'bank' }, { kind: 'deposit', amount: 1_000_000 }))
  const next = transact({ ...deposited, phase: 'event', eventId: 'bank', turn: 2 }, { kind: 'deposit', amount: 2_000_000, term: 3 })
  assert.deepEqual(next.deposits[0], deposited.deposits[0])
  const business = transact({ ...initial, phase: 'event', position: 8, eventId: 'business', turn: 1 }, { kind: 'buy', asset: 'business', amount: ECONOMY.business.cost })
  assert.equal(business.phase, 'rolling')
  const reopened = { ...business, phase: 'event' as const, eventId: 'business' }
  assert.throws(() => transact(reopened, { kind: 'upgrade', asset: 'business', amount: 5_000_000 }))
  assert.throws(() => transact(reopened, { kind: 'sell', asset: 'business', amount: business.portfolio.business }))
  const later = { ...reopened, turn: 2 }
  const upgraded = transact(later, { kind: 'upgrade', asset: 'business', amount: 5_000_000, customerPreferenceId: later.customerPreferenceId })
  assert.equal(businessIncome(upgraded), 4_700_000)
  assert.throws(() => transact(upgraded, { kind: 'upgrade', asset: 'business', amount: 5_000_000 }))
  assert.equal(transact(upgraded, { kind: 'sell', asset: 'business', amount: upgraded.portfolio.business }).business.capital, 0)
  const gold = transact(encounter('gold'), { kind: 'buy', asset: 'gold', amount: 1_000_000 })
  const start = { ...gold, phase: 'rebalancing' as const, position: 0, portfolio: { ...gold.portfolio, debt: 1_000_000 } }
  assert.equal(transact(start, { kind: 'sell', asset: 'gold', amount: 1_000_000 }).portfolio.cash, 49_960_300)
  assert.equal(transact(start, { kind: 'repay', amount: 1_000_000 }).portfolio.cash, 47_900_000)
})

test('frozen pre-change V2.4 log with repeated Gold and Bonds purchases replays exactly', () => {
  const data = JSON.parse(gunzipSync(readFileSync('docs/playtests/atomic-investments-v24/historical-multi-purchase.json.gz')).toString())
  assert.equal(data.encounterRulesVersion, 'v2.4-business-purchase-complete')
  for (const asset of ['gold', 'bonds']) assert.ok(data.entries.some((entry: { turn: number; decisionId: string }, index: number) => entry.decisionId === `buy-${asset}` && data.entries.slice(0, index).some((prior: { turn: number; decisionId: string }) => prior.turn === entry.turn && prior.decisionId === entry.decisionId)))
  assert.deepEqual(JSON.parse(JSON.stringify(replayGameLog(data))), data.state)
  assert.deepEqual(JSON.parse(JSON.stringify(replayGameLog(JSON.parse(serializeLog(data.state))))), data.state)
  const resumed = createMobileSession(data.state).getSnapshot()
  assert.equal(resumed.encounterRulesVersion, 'v2.4-business-purchase-complete')
})

test('V2.3 historical replay remains exact and legacy Gold/Bonds explicit completion is rejected', () => {
  const data = JSON.parse(gunzipSync(readFileSync('docs/playtests/encounter-limits-v2_3/browser-game-log.json.gz')).toString())
  assert.deepEqual(JSON.parse(JSON.stringify(replayGameLog(data))), data.state)
  for (const asset of ['gold', 'bonds'] as const) {
    const initial = encounter(asset, createGame('old-multi', 0, 1, 'experimental-b', undefined, 'v2.3-fixed-income', 'v2.3-single-action'))
    assert.throws(() => transact(initial, { kind: 'buy', asset, amount: 1_000_000, completeEncounter: true }))
    const two = transact(transact(initial, { kind: 'buy', asset, amount: 1_000_000 }), { kind: 'buy', asset, amount: 1_000_000 })
    assert.equal(two.phase, 'event')
    assert.equal(two.portfolio.cash, 48_000_000)
  }
})

test('new policy still leaves all Economic News selectors read-only', () => {
  const game = encounter('stocks')
  const before = JSON.stringify(game)
  marketBulletin(game); roundMarketReview(game)
  for (const asset of ['stocks', 'gold', 'bonds'] as const) investmentSignal(game, asset)
  assert.equal(JSON.stringify(game), before)
})

test('new four-round game records all three completed asset buys and replays full state exactly', () => {
  let game = createMobileGame('atomic-history-fixture', 0)
  for (let step = 0; game.phase !== 'finished' && step < 400; step++) {
    if (game.phase === 'rolling') game = roll(game)
    else if (game.phase === 'event') {
      if (['stocks', 'gold', 'bonds'].includes(game.eventId!)) game = transact(game, { kind: 'buy', asset: game.eventId as TradableAsset, amount: 1_000_000 })
      else {
        const event = EVENTS.find(event => event.id === game.eventId)!
        game = decide(game, event.options.find(option => option.id === 'skip')?.id ?? event.options[0].id)
      }
    } else if (game.phase === 'funding') assert.fail('Conservative fixture must keep enough cash')
    else game = advance(game)
  }
  assert.equal(game.termination, 'completed')
  assert.equal(game.summaries.length, 4)
  const data = JSON.parse(serializeLog(game))
  for (const asset of ['stocks', 'gold', 'bonds']) {
    const buys = game.log.filter(entry => entry.decisionId === `buy-${asset}-complete`)
    assert.ok(buys.length > 0)
    assert.equal(data.playtest.financialPurchases[asset], buys.length)
    assert.equal(new Set(buys.map(entry => entry.turn)).size, buys.length)
  }
  assert.deepEqual(replayGameLog(data), game)
})
