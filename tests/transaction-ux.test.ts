import test from 'node:test'
import assert from 'node:assert/strict'
import { advance, decide, roll, transact } from '../src/game/engine.ts'
import { createV23Game as createGame } from './helpers/v2_3.ts'
import { serializeLog } from '../src/game/log.ts'
import { replayGameLog } from '../scripts/diagnostics/replay-game-log.ts'
import { EVENTS } from '../src/data/events.ts'
import { parseMoneyInput, formatMoneyInput } from '../src/ui/money-input.ts'
import { businessOverview, purchasePreview, stockQuote } from '../src/game/selectors.ts'
import { businessIncome } from '../src/game/business.ts'

test('stock purchase completes once, preserves finances and RNG, and has no skip record', () => {
  const initial = { ...createGame('atomic-stock', 0, 1, 'experimental-b'), phase: 'event' as const, eventId: 'stocks', position: 2 }
  const original = JSON.stringify(initial)
  for (const stock of initial.market.stocks) {
    const action = { kind: 'buy' as const, asset: 'stocks' as const, amount: 1_234_567, symbolId: stock.id }
    const legacy = transact(initial, action)
    const completed = transact(initial, { ...action, completeEncounter: true })
    assert.equal(completed.phase, 'rolling')
    assert.equal(completed.eventId, null)
    assert.deepEqual(completed.portfolio, legacy.portfolio)
    assert.deepEqual(completed.stockHoldings, legacy.stockHoldings)
    assert.deepEqual(completed.rng, initial.rng)
    assert.equal(completed.turn, initial.turn)
    assert.equal(completed.log.length, initial.log.length + 1)
    assert.equal(completed.log.at(-1)?.decisionId, 'buy-stocks-complete')
    assert.equal(completed.log.filter(e => e.decisionId === 'skip').length, 0)
    assert.throws(() => transact(completed, { ...action, completeEncounter: true }))
    assert.equal(transact(legacy, action).portfolio.cash, 50_000_000 - 2 * action.amount)
    assert.equal(JSON.stringify(initial), original)
    for (const amount of [0, -1, 1.5, NaN, 50_000_001]) assert.throws(() => transact(initial, { ...action, amount, completeEncounter: true }))
  }
  const skipped = decide(initial, 'skip')
  assert.equal(skipped.phase, 'rolling')
  assert.deepEqual(skipped.portfolio, initial.portfolio)
  assert.deepEqual(skipped.stockHoldings, initial.stockHoldings)
})

test('explicit completion remains stock-only; legacy bank encounters allow independent lots', () => {
  const initial = { ...createGame('bank-multi', 0, 1, 'experimental-b', undefined, 'v2.2-trend-shock', 'legacy-multi-action'), phase: 'event' as const, eventId: 'bank', position: 1 }
  const action = { kind: 'deposit' as const, amount: 1_000_000, term: 1 as const }
  assert.throws(() => transact(initial, { ...action, completeEncounter: true }))
  const one = transact(initial, action)
  const two = transact(one, { ...action, term: 3 })
  assert.equal(two.phase, 'event')
  assert.deepEqual(two.deposits.map(l => [l.principal, l.maturityLap]), [[1_000_000, 1], [1_000_000, 3]])
})

test('new completed purchases replay exactly from a real seeded encounter, including purchase metrics', () => {
  let state = createGame('XVTL-V2-6', 0, 1, 'experimental-b')
  for (let guard = 0; guard < 100; guard++) {
    if (state.phase === 'event' && state.eventId === 'stocks') break
    if (state.phase === 'rolling') state = roll(state)
    else if (state.phase === 'event') {
      const event = EVENTS.find(e => e.id === state.eventId)!
      state = decide(state, event.options.find(o => o.id === 'skip')?.id ?? event.options[0].id)
    } else state = advance(state)
  }
  assert.equal(state.eventId, 'stocks')
  state = transact(state, { kind: 'buy', asset: 'stocks', amount: 2_000_000, symbolId: 'XV-MAY', completeEncounter: true })
  const data = JSON.parse(serializeLog(state))
  assert.equal(data.playtest.financialPurchases.stocks, 1)
  assert.deepEqual(replayGameLog(data), state)
})

test('Vietnamese money input preserves exact integer dong and rejects malformed values', () => {
  for (const value of [0, 1, 1_234_567, 90_000_000, Number.MAX_SAFE_INTEGER]) {
    assert.equal(parseMoneyInput(formatMoneyInput(value)), value)
  }
  for (const input of ['-1', '1,5', '12.34', 'abc', '9007199254740992']) assert.ok(Number.isNaN(parseMoneyInput(input)))
  assert.equal(parseMoneyInput(''), 0)
  assert.equal(parseMoneyInput('10000000'), 10_000_000)
})

test('read-only trade previews agree with executed business upgrades and recorded prices', () => {
  const initial = { ...createGame('business-preview', 0, 1, 'experimental-b'), phase: 'event' as const, eventId: 'business', position: 8, turn: 1 }
  const owned = { ...transact(initial, { kind: 'buy', asset: 'business', amount: 20_000_000 }), turn: 2 }
  const original = JSON.stringify(owned)
  for (const trend of ['growth', 'uncertain', 'recovery']) {
    const preview = businessOverview(owned, trend)
    const upgraded = transact(owned, { kind: 'upgrade', asset: 'business', amount: 5_000_000, trend })
    assert.equal(preview.incrementalIncome, businessIncome(upgraded) - businessIncome(owned))
    assert.equal(preview.locked, 20_000_000)
    assert.equal(preview.sale, 14_000_000)
    assert.equal(preview.remainingStarts, 4)
  }
  assert.equal(purchasePreview(owned, 1_234_567).cashAfter, 28_765_433)
  assert.equal(purchasePreview(owned, 30_000_001).cashAfter, null)
  const { stock, recent } = stockQuote(owned, 'XV-MAY')
  assert.equal(recent.returnRate, recent.priceAfter / recent.priceBefore - 1)
  assert.equal(recent.priceAfter, stock.currentPrice)
  assert.equal(JSON.stringify(owned), original)
})
