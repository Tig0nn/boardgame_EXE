import test from 'node:test'
import assert from 'node:assert/strict'
import { advance, decide, roll, fundPayment, rebalance, victory, totalWorth, canChoose } from '../src/game/engine.ts'
import { createV23Game as createGame } from './helpers/v2_3.ts'
import type { GameState } from '../src/game/types.ts'
import { beginSettlement } from '../src/game/settlement.ts'
import { RULES, CATEGORIES } from '../src/data/config.ts'
import { EVENTS } from '../src/data/events.ts'
import { BOARD } from '../src/data/board.ts'
import { transact, fundingSources, borrowingAvailable } from '../src/game/transactions.ts'
import { liquidatableFunds, saleQuote } from '../src/game/selectors.ts'
import { businessIncome } from '../src/game/business.ts'
import type { TradableAsset } from '../src/game/types.ts'

function atTile(state: GameState, id: string): GameState {
  const type = ['medical', 'repair', 'family'].includes(id) ? 'personal' : id
  return { ...state, phase: 'event', eventId: id, position: BOARD.find(tile => tile.type === type)?.index ?? state.position }
}

function buy(state: GameState, asset: TradableAsset, amount: number) {
  return transact(atTile(state, asset), { kind: 'buy', asset, amount })
}

function event(id: string, cash = 3_000_000): GameState {
  const state = advance(createGame('finance', 20_000_000))
  return atTile({ ...state, portfolio: { ...state.portfolio, cash } }, id)
}

test('victory requires 90M lawful proceeds and excludes locked business and unpaid obligations', () => {
  const s = createGame('goal', 50_000_000)
  const business = transact(atTile(createGame('locked-goal', 0), 'business'), { kind: 'buy', asset: 'business', amount: 20_000_000 })
  const assetOnly = { ...business, portfolio: { ...business.portfolio, cash: 75_000_000 } }
  assert.equal(victory(assetOnly).won, false)
  const exact = { ...s, portfolio: { ...s.portfolio, cash: 40_000_000 } }
  assert.equal(liquidatableFunds(exact), 90_000_000)
  assert.deepEqual(victory(exact), { wealth: true, liquidity: true, won: true })
  assert.equal(victory({ ...exact, obligations: 1 }).won, false)
})

test('a shortage spends available cash but never automatically withdraws or borrows', () => {
  const before = event('medical')
  const s = decide(before, 'pay')
  assert.equal(s.phase, 'funding')
  assert.equal(s.portfolio.cash, 0)
  assert.equal(s.portfolio.savings, before.portfolio.savings)
  assert.equal(s.portfolio.debt, 0)
  assert.equal(s.pendingPayment?.remaining, 2_000_000)
  assert.equal(s.savingsEligible, true)
})

test('player can combine funding sources; early withdrawal logs lost interest once', () => {
  const initial = createGame('combination', 2_000_000)
  let s = decide(atTile({ ...initial, portfolio: { ...initial.portfolio, cash: 0 } }, 'medical'), 'pay')
  s = fundPayment(s, 'savings', 2_000_000, s.deposits[0].id)
  assert.equal(s.pendingPayment?.remaining, 3_000_000)
  assert.equal(s.portfolio.savings, 0)
  assert.equal(s.log.at(-1)?.lostSavingsInterest, 120_000)
  assert.equal(s.log.at(-1)?.forcedWithdrawalAmount, 2_000_000)
  assert.throws(() => fundPayment(s, 'savings', 2_000_000, s.deposits[0].id))
  s = fundPayment(s, 'debt', 1_000_000)
  assert.equal(s.log.at(-1)?.lostSavingsInterest, 0)
  s = fundPayment(s, 'debt', 2_000_000)
  assert.equal(s.phase, 'rolling')
  assert.equal(s.pendingPayment, null)
  assert.equal(s.portfolio.debt, 3_000_000)
  assert.equal(s.portfolio.cash, 0)
})

for (const asset of ['stocks', 'bonds', 'gold'] as const) {
  test(`${asset} funding sells actual units at the current net quote and records proceeds`, () => {
    const bought = buy(createGame(`fund-${asset}`, 20_000_000), asset, 4_000_000)
    let s = decide(atTile({ ...bought, portfolio: { ...bought.portfolio, cash: 3_000_000 } }, 'medical'), 'pay')
    const quote = saleQuote(s, asset, 2_000_000)
    s = fundPayment(s, asset, 2_000_000)
    assert.equal(s.portfolio[asset], 2_000_000)
    assert.equal(s.portfolio.cash, 0)
    const sale = s.log.findLast(entry => entry.kind === 'funding')!
    assert.equal(sale.forcedAssetSaleAmount, 2_000_000)
    assert.equal(sale.assetSaleAmounts[asset], 2_000_000)
    assert.equal(sale.cashProceeds, quote.net)
    assert.equal(s.pendingPayment?.remaining, 2_000_000 - quote.net)
    s = fundPayment(s, 'debt', s.pendingPayment!.remaining)
    assert.equal(s.phase, 'rolling')
  })
}

test('business cannot fund expenses or be sold at START, and rebalancing is checkpoint-only', () => {
  const s = decide(event('medical'), 'pay')
  assert.throws(() => fundPayment(s, 'business' as 'stocks', 1_000_000))
  assert.throws(() => rebalance({ ...s, phase: 'rebalancing' }, { kind: 'sell', asset: 'business', amount: 1_000_000 }))
  assert.throws(() => rebalance(advance(createGame('locked', 0)), { kind: 'deposit', amount: 1_000_000 }))
})

test('recurring income upgrade changes each remaining settlement without immediate cash', () => {
  let s = decide(event('course', 20_000_000), 'upgrade')
  assert.equal(s.portfolio.cash, 14_000_000)
  assert.equal(s.recurringIncome, 17_000_000)
  s = roll({ ...s, position: 19 })
  assert.equal(s.phase, 'summary')
  assert.equal(s.portfolio.cash, 52_200_000)
  assert.equal(s.summaries[0].incomeTotal, 17_000_000)
  s = advance(s)
  assert.equal(s.phase, 'rebalancing')
  s = advance(s)
  assert.equal(s.phase, 'forecast')
  assert.equal(s.recurringIncome, 17_000_000)
  s = advance(s)
  // Ignore the carried landing only to isolate the next income settlement.
  s = roll({ ...s, phase: 'rolling', position: 19 })
  assert.equal(s.summaries[1].incomeTotal, 17_000_000)
})

test('bank transfers preserve worth and prior encounters never grant checkpoint purchase rights', () => {
  let s = createGame('checkpoint', 20_000_000, 3)
  const initialWorth = totalWorth(s)
  s = transact(atTile(s, 'bank'), { kind: 'deposit', amount: 2_000_000, term: 2 })
  assert.equal(totalWorth(s), initialWorth)
  s = buy(s, 'gold', 1_000_000)
  s = advance(roll({ ...s, phase: 'rolling', position: 19 }))
  const worth = totalWorth(s)
  const quote = saleQuote(s, 'gold')
  assert.throws(() => rebalance(s, { kind: 'withdraw', amount: 5_000_000 }))
  assert.throws(() => rebalance(s, { kind: 'deposit', amount: 2_000_000 }))
  assert.throws(() => rebalance(s, { kind: 'buy', asset: 'gold', amount: 1_000_000 }))
  s = rebalance(s, { kind: 'sell', asset: 'gold', amount: s.portfolio.gold })
  assert.equal(s.portfolio.gold, 0)
  assert.ok(s.unlockedAssets.includes('gold'))
  assert.equal(totalWorth(s), worth - quote.fee - quote.spread)
  assert.throws(() => rebalance(s, { kind: 'buy', asset: 'gold', amount: 500_000 }))
})

test('checkpoint debt repayment charges interest rather than offering free borrowing', () => {
  let s = advance(roll({ ...advance(createGame('repay', 0)), position: 19 }))
  s = { ...s, portfolio: { ...s.portfolio, debt: 2_000_000 } }
  const cash = s.portfolio.cash
  s = rebalance(s, { kind: 'repay', amount: 2_000_000 })
  assert.equal(s.portfolio.cash, cash - 2_200_000)
  assert.equal(s.portfolio.debt, 0)
})

test('invalid funding and rebalancing values are rejected without mutating state', () => {
  const s = decide(event('medical'), 'pay')
  const before = JSON.stringify(s)
  for (const amount of [0, -1, Number.NaN, Infinity, 0.5, 3_000_000]) {
    assert.throws(() => fundPayment(s, 'savings', amount))
  }
  assert.equal(JSON.stringify(s), before)
})

test('early withdrawal forfeits the whole lot term interest at settlement', () => {
  const s = fundPayment(decide(event('medical'), 'pay'), 'savings', 20_000_000)
  const settled = beginSettlement(s)
  assert.equal(settled.portfolio.savings, 0)
  assert.equal(settled.deposits[0].status, 'withdrawn')
  assert.equal(settled.deposits[0].earnedInterest, 0)
  assert.equal(settled.portfolio.cash, s.portfolio.cash + RULES.recurringIncome)
  assert.equal(settled.log.find(e => e.kind === 'funding')?.lostSavingsInterest, 1_200_000)
})

test('settlement can pause twice without repeating income or charging newly borrowed principal', () => {
  const initial = createGame('resume', 0)
  let s = beginSettlement({ ...initial, portfolio: { ...initial.portfolio, cash: 0, debt: 20_000_000 }, obligations: 4_000_000 })
  assert.equal(s.phase, 'funding')
  assert.equal(s.pendingPayment?.remaining, 8_000_000)
  assert.equal(s.portfolio.debt, 0)
  s = fundPayment(s, 'debt', 8_000_000)
  assert.equal(s.phase, 'funding')
  assert.equal(s.pendingPayment?.remaining, 4_000_000)
  s = fundPayment(s, 'debt', 4_000_000)
  assert.equal(s.phase, 'summary')
  assert.equal(s.portfolio.debt, 12_000_000)
  assert.equal(s.portfolio.cash, 0)
  assert.equal(s.obligations, 0)
  assert.equal(s.summaries[0].incomeTotal, 14_000_000)
  assert.equal(s.summaries[0].debtPrincipalPaid, 20_000_000)
  assert.equal(s.log.filter(e => e.kind === 'settlement').length, 1)
  assert.equal(s.log.findLast(entry => entry.kind === 'schedule' && entry.debtInterestPaid > 0)?.debtInterestPaid, 2_000_000)
  assert.equal(s.log.reduce((sum, entry) => sum + entry.debtInterestPaid, 0), 2_000_000)
})

test('mature savings and business income fund obligations without clawing back earned interest', () => {
  const initial = createGame('loss-17', 20_000_000)
  const invested = transact(atTile(initial, 'business'), { kind: 'buy', asset: 'business', amount: 20_000_000 })
  const before = { ...invested, scenarioId: 'uncertain', portfolio: { ...invested.portfolio, cash: 0 }, obligations: 40_000_000 }
  let s = beginSettlement(before)
  assert.equal(s.phase, 'funding')
  assert.equal(s.pendingPayment?.title, 'Nghĩa vụ đã hẹn')
  assert.equal(s.pendingCost, 40_000_000 - 14_000_000 - 21_200_000 - businessIncome(before))
  assert.equal(s.portfolio.savings, 0)
  assert.equal(s.savingsMatured, true)
  assert.equal(s.deposits[0].earnedInterest, 1_200_000)
  const rng = s.rng
  const businessValue = s.portfolio.business
  s = fundPayment(s, 'debt', s.pendingCost)
  assert.equal(s.phase, 'summary')
  assert.equal(s.portfolio.savings, 0)
  assert.equal(s.log.find(e => e.kind === 'funding')?.lostSavingsInterest, 0)
  assert.equal(s.rng, rng)
  assert.equal(s.portfolio.business, businessValue)
})

test('debt first borrowed during final settlement includes its contractual interest in final net worth', () => {
  const initial = createGame('terminal-debt', 0)
  let s = beginSettlement({ ...initial, lap: 3, portfolio: { ...initial.portfolio, cash: 0 }, obligations: 17_000_000 })
  assert.equal(s.pendingPayment?.remaining, 3_000_000)
  s = fundPayment(s, 'debt', 3_000_000)
  assert.equal(s.phase, 'summary')
  assert.equal(s.portfolio.debt, 3_300_000)
  assert.equal(s.log.at(-1)?.debtInterestAccrued, 300_000)
  assert.equal(totalWorth(s), -3_300_000)
})

test('optional course requires cash and grants its recurring benefit only once', () => {
  const poor = event('course', 0)
  assert.throws(() => decide(poor, 'upgrade'))
  assert.equal(poor.recurringIncome, RULES.recurringIncome)
  const s = decide(event('course', RULES.courseCost), 'upgrade')
  assert.equal(s.portfolio.cash, 0)
  assert.equal(s.recurringIncome, RULES.recurringIncome + RULES.courseBoost)
  assert.equal(s.log.at(-1)?.recurringIncomeDelta, RULES.courseBoost)
  assert.throws(() => decide(atTile(s, 'course'), 'upgrade'))
  assert.throws(() => fundPayment(s, 'debt', 1))
})

test('buying at matching tiles and selling all holdings at START moves the quoted net cash', () => {
  for (const asset of ['stocks', 'bonds', 'gold'] as const) {
    const initial = createGame('sale', 0)
    const bought = buy(initial, asset, 4_000_000)
    const quote = saleQuote(bought, asset)
    const sold = rebalance({ ...bought, phase: 'rebalancing' }, { kind: 'sell', asset, amount: bought.portfolio[asset] })
    assert.equal(sold.portfolio.cash, initial.portfolio.cash - 4_000_000 + quote.net)
    assert.equal(sold.portfolio[asset], 0)
    assert.equal(sold.log.at(-1)?.assetSaleAmounts[asset], 4_000_000)
    assert.equal(sold.log.at(-1)?.cashProceeds, quote.net)
  }
})

test('financial decisions never alter seeded dice, event selection or economic draws', () => {
  function run(aggressive: boolean) {
    let s = createGame('financial-strategy', aggressive ? 45_000_000 : 0)
    for (let step = 0; s.phase !== 'finished' && step < 300; step++) {
      if (s.phase === 'rolling') s = roll(s)
      else if (s.phase === 'event') {
        const options = EVENTS.find(e => e.id === s.eventId)!.options
        const candidates = aggressive ? options : [...options].reverse()
        s = decide(s, candidates.find(option => canChoose(s, option.id))!.id)
      } else if (s.phase === 'funding') {
        const source = fundingSources(s)[0]
        const lot = s.deposits.find(lot => lot.status === 'active')
        const amount = source === 'savings' ? lot!.principal : source === 'debt'
          ? Math.min(s.pendingPayment!.remaining, borrowingAvailable(s)) : s.portfolio[source]
        s = fundPayment(s, source, amount, lot?.id)
      }
      else s = advance(s)
    }
    assert.equal(s.phase, 'finished')
    return { rolls: s.log.filter(e => e.kind === 'roll').map(e => [e.after.dice, e.after.position, e.after.scenarioId]),
      events: s.log.filter(e => e.kind === 'decision').map(e => e.eventId), market: s.market }
  }
  assert.deepEqual(run(true), run(false))
})

test('all categories and deferred payment choices have clear financial trade-offs', () => {
  assert.deepEqual(Object.values(CATEGORIES).map(c => c.label), ['Cơ hội sinh lời', 'Cơ hội tăng thu nhập', 'Biến cố tài chính', 'Dòng tiền & nghĩa vụ'])
  for (const e of EVENTS.filter(e => ['medical', 'repair', 'family', 'bills', 'contract'].includes(e.id))) {
    const [pay, defer] = e.options
    assert.ok((defer.cost ?? 0) < pay.cost!)
    assert.ok((defer.cost ?? 0) + (defer.obligation ?? 0) > pay.cost!)
  }
  for (const e of EVENTS.filter(e => e.category === 'income')) {
    assert.ok(e.options[0].cost! > 0)
    assert.ok(e.options[0].recurringIncomeIncrease! > 0)
    assert.equal(e.options[0].income, undefined)
  }
})
