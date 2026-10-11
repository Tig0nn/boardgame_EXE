import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, advance, decide, roll, fundPayment, rebalance, victory, canChoose } from '../src/game/engine.ts'
import { beginSettlement, continueSettlement } from '../src/game/settlement.ts'
import { transact, fundingSources } from '../src/game/transactions.ts'
import { initializeMarket, applyMacroShock, updateNormalMarket, syncValuations } from '../src/game/market.ts'
import { liquidatableFunds, saleQuote } from '../src/game/selectors.ts'
import { businessIncome, businessSaleQuote } from '../src/game/business.ts'
import { BOARD } from '../src/data/board.ts'
import { EVENTS } from '../src/data/events.ts'
import { RULES, ECONOMY, MACRO_EVENTS } from '../src/data/config.ts'
import { hashSeed, random } from '../src/game/random.ts'
import { snapshot } from '../src/game/state.ts'
import type { Asset, GameState, FinancialEffects, Portfolio } from '../src/game/types.ts'

function tileState(state: GameState, eventId: string): GameState {
  const tile = BOARD.find(item => item.type === eventId)
  assert.ok(tile, `Missing tile for ${eventId}`)
  return { ...state, phase: 'event', eventId, position: tile.index }
}

function buy(state: GameState, asset: Asset, amount: number): GameState {
  return transact(tileState(state, asset), { kind: 'buy', asset, amount,
    symbolId: asset === 'stocks' ? state.market.stocks[0].id : undefined })
}

function finishSettlement(state: GameState): GameState {
  assert.equal(state.phase, 'summary')
  return advance(advance(state))
}

function nextLap(state: GameState): GameState {
  return finishSettlement(beginSettlement({ ...state, phase: 'rolling' }))
}

function mandatoryExpense(state: GameState, total: number): GameState {
  return { ...state, phase: 'funding', portfolio: { ...state.portfolio, cash: 0 }, pendingCost: total,
    pendingPayment: { origin: 'event', title: 'Test mandatory expense', total, remaining: total,
      eventId: 'medical', decisionId: 'pay' } }
}

test('V2 START pays 14M salary without deducting a fixed living expense', () => {
  const state = createGame('v2-salary', 0)
  const settled = beginSettlement(state)
  assert.equal(settled.portfolio.cash, 64_000_000)
  assert.equal(settled.summaries[0].incomeTotal, 14_000_000)
})

test('V2 self investment costs 6M and increases subsequent START salary by 3M', () => {
  const initial = advance(createGame('v2-course', 0))
  const bought = decide(tileState(initial, 'course'), 'upgrade')
  assert.equal(bought.portfolio.cash, 44_000_000)
  assert.equal(bought.recurringIncome, 17_000_000)
  assert.equal(beginSettlement(bought).portfolio.cash, 61_000_000)
})

test('V2 START never permits an asset purchase even after a prior asset encounter', () => {
  const initial = createGame('v2-start-rights', 0)
  const state = { ...initial, phase: 'rebalancing' as const, unlockedAssets: ['gold' as const] }
  assert.throws(() => rebalance(state, { kind: 'buy', asset: 'gold', amount: 1_000_000 }))
})

test('V2 80M item plus 10M retained cash requires 90M lawful proceeds', () => {
  const initial = createGame('v2-goal', 0)
  const state = { ...initial, portfolio: { ...initial.portfolio, cash: 80_000_000 } }
  assert.equal(victory(state).won, false)
})

test('V2 locked business cannot satisfy the final purchase goal', () => {
  const initial = buy(createGame('v2-locked-goal', 0), 'business', ECONOMY.business.cost)
  const state = { ...initial, portfolio: { ...initial.portfolio, cash: 75_000_000 } }
  assert.equal(victory(state).won, false)
})

test('V2 board retains 20 unique perimeter tiles and covers every dedicated opportunity', () => {
  assert.equal(BOARD.length, 20)
  assert.equal(new Set(BOARD.map(tile => `${tile.row}:${tile.col}`)).size, 20)
  for (const type of ['start', 'bank', 'stocks', 'bonds', 'gold', 'business', 'course', 'living', 'personal', 'macro', 'obligation']) {
    assert.ok(BOARD.some(tile => tile.type === type), type)
  }
})

test('V2 historical prices contain 12 past points for six fictional symbols in three sectors', () => {
  const state = createGame('v2-history', 0)
  assert.equal(state.market.stocks.length, 6)
  assert.equal(new Set(state.market.stocks.map(stock => stock.sector)).size, 3)
  for (const stock of state.market.stocks) {
    assert.equal(stock.priceHistory.length, 12)
    assert.equal(stock.priceHistory.at(-1)?.priceAfter, stock.currentPrice)
    assert.ok(stock.priceHistory.every(point => point.kind === 'history' && point.timestamp <= 0))
  }
  assert.equal(state.market.gold.priceHistory.length, 12)
})

test('V2 historical chart creation and viewing never consume future dice RNG', () => {
  const state = advance(createGame('v2-isolated-history', 0))
  assert.equal(state.rng, random(hashSeed(state.seed))[1])
  const serialized = JSON.stringify(state)
  initializeMarket(state.seed)
  initializeMarket(state.seed)
  JSON.stringify(state.market.stocks.map(stock => stock.priceHistory))
  assert.equal(JSON.stringify(state), serialized)
  const observed = roll(state)
  const replay = roll(JSON.parse(serialized))
  assert.deepEqual(observed, replay)
  assert.equal(observed.dice, Math.floor(random(state.rng)[0] * 6) + 1)
})

test('V2 historical stock returns share sector movement and retain distinct idiosyncratic paths', () => {
  const sectorSamples = new Map<string, [number, number][]>()
  for (let seed = 0; seed < 200; seed++) {
    const market = initializeMarket(`v2-history-correlation-${seed}`)
    for (const sector of new Set(market.stocks.map(stock => stock.sector))) {
      const [first, second] = market.stocks.filter(stock => stock.sector === sector)
      assert.notDeepEqual(first.priceHistory.map(point => point.priceAfter), second.priceHistory.map(point => point.priceAfter))
      const samples = sectorSamples.get(sector) ?? []
      for (let index = 0; index < first.priceHistory.length; index++) {
        samples.push([first.priceHistory[index].returnRate, second.priceHistory[index].returnRate])
      }
      sectorSamples.set(sector, samples)
    }
    for (const instrument of [...market.stocks, market.gold, market.bond]) {
      for (const point of instrument.priceHistory) {
        assert.equal(point.returnRate, point.priceAfter / point.priceBefore - 1)
      }
    }
  }
  for (const [sector, samples] of sectorSamples) {
    const means = [0, 1].map(index => samples.reduce((sum, sample) => sum + sample[index], 0) / samples.length)
    const covariance = samples.reduce((sum, sample) => sum + (sample[0] - means[0]) * (sample[1] - means[1]), 0)
    const variances = [0, 1].map(index => samples.reduce((sum, sample) => sum + (sample[index] - means[index]) ** 2, 0))
    assert.ok(covariance / Math.sqrt(variances[0] * variances[1]) > 0.2, `${sector} historical correlation`)
  }
})

test('V2 two macro shocks change all listed prices immediately without owning assets', () => {
  const initial = createGame('v2-empty-shocks', 0)
  const shocked = applyMacroShock(initial, MACRO_EVENTS[0].id)
  const twice = applyMacroShock({ ...shocked, turn: 1 }, MACRO_EVENTS[1].id)
  assert.equal(initial.portfolio.stocks, 0)
  assert.equal(twice.portfolio.stocks, 0)
  for (let index = 0; index < 6; index++) {
    const start = initial.market.stocks[index]
    const end = twice.market.stocks[index]
    assert.notEqual(end.currentPrice, start.currentPrice)
    assert.equal(end.priceHistory.length, start.priceHistory.length + 2)
    assert.equal(end.priceHistory.at(-1)?.priceBefore, shocked.market.stocks[index].currentPrice)
    assert.equal(end.priceHistory.at(-1)?.priceAfter, end.currentPrice)
    assert.equal(end.priceHistory.at(-1)?.eventId, MACRO_EVENTS[1].id)
  }
  assert.notEqual(twice.market.gold.currentPrice, initial.market.gold.currentPrice)
  assert.notEqual(twice.market.bond.currentPrice, initial.market.bond.currentPrice)
})

test('V2 reopening the same macro event does not apply its shock twice', () => {
  const first = applyMacroShock(createGame('v2-macro-once', 0), MACRO_EVENTS[0].id)
  const second = applyMacroShock(first, MACRO_EVENTS[0].id)
  assert.deepEqual(second, first)
})

test('V2 normal market updates compound from the current post-shock price', () => {
  const initial = createGame('v2-compounding', 0)
  const shocked = applyMacroShock(initial, MACRO_EVENTS[0].id)
  const settled = updateNormalMarket(shocked)
  for (let index = 0; index < 6; index++) {
    const stock = settled.market.stocks[index]
    const normal = stock.priceHistory.at(-1)!
    assert.equal(normal.kind, 'normal')
    assert.equal(normal.priceBefore, shocked.market.stocks[index].currentPrice)
    assert.equal(normal.priceAfter, stock.currentPrice)
    assert.ok(Math.abs(normal.priceAfter - normal.priceBefore * (1 + normal.returnRate)) <= 1)
    assert.equal(stock.priceHistory.filter(point => point.kind === 'shock').length, 1)
  }
})

test('V2 stock quotes, chart values and portfolio valuation use the same engine price', () => {
  let state = buy(createGame('v2-stock-price', 0), 'stocks', 10_000_000)
  const id = state.market.stocks[0].id
  assert.ok(Math.abs(state.stockHoldings[id].units * state.market.stocks[0].currentPrice - state.portfolio.stocks) <= 1)
  state = syncValuations(applyMacroShock(state, MACRO_EVENTS[0].id))
  assert.ok(Math.abs(state.portfolio.stocks - state.stockHoldings[id].units * state.market.stocks[0].currentPrice) <= 1)
  assert.equal(state.market.stocks[0].priceHistory.at(-1)?.priceAfter, state.market.stocks[0].currentPrice)
  const quote = saleQuote(state, 'stocks')
  const sold = rebalance({ ...state, phase: 'rebalancing' }, { kind: 'sell', asset: 'stocks', amount: state.portfolio.stocks })
  assert.equal(sold.portfolio.cash - state.portfolio.cash, quote.net)
  assert.equal(sold.portfolio.stocks, 0)
  assert.equal(sold.stockHoldings[id]?.units ?? 0, 0)
})

test('V2 symbols in a sector retain distinct idiosyncratic normal returns', () => {
  const state = updateNormalMarket(createGame('v2-sectors', 0))
  const sectors = [...new Set(state.market.stocks.map(stock => stock.sector))]
  for (const sector of sectors) {
    const returns = state.market.stocks.filter(stock => stock.sector === sector).map(stock => stock.priceHistory.at(-1)!.returnRate)
    assert.notEqual(returns[0], returns[1])
  }
})

test('V2 same-sector prices share market movement across independent seeds', () => {
  const samples: [number, number][] = []
  for (let seed = 0; seed < 200; seed++) {
    const initial = createGame(`v2-correlation-${seed}`, 0)
    const state = updateNormalMarket({ ...initial, scenarioId: 'growth' })
    samples.push([state.market.stocks[0].priceHistory.at(-1)!.returnRate,
      state.market.stocks[1].priceHistory.at(-1)!.returnRate])
  }
  const means = [0, 1].map(index => samples.reduce((sum, sample) => sum + sample[index], 0) / samples.length)
  const covariance = samples.reduce((sum, sample) => sum + (sample[0] - means[0]) * (sample[1] - means[1]), 0)
  const variances = [0, 1].map(index => samples.reduce((sum, sample) => sum + (sample[index] - means[index]) ** 2, 0))
  assert.ok(covariance / Math.sqrt(variances[0] * variances[1]) > 0.5)
})

for (const asset of ['stocks', 'bonds', 'gold'] as const) {
  test(`V2 ${asset} can be purchased only at its corresponding landed tile`, () => {
    const initial = createGame(`v2-gate-${asset}`, 0)
    const action = { kind: 'buy' as const, asset, amount: 1_000_000,
      symbolId: asset === 'stocks' ? initial.market.stocks[0].id : undefined }
    assert.throws(() => transact({ ...initial, phase: 'rolling' }, action))
    assert.throws(() => transact(tileState(initial, asset === 'gold' ? 'stocks' : 'gold'), action))
    const bought = transact(tileState(initial, asset), action)
    assert.equal(bought.portfolio.cash, initial.portfolio.cash - action.amount)
    assert.ok(bought.portfolio[asset] > 0)
    assert.throws(() => transact(bought, { kind: 'sell', asset, amount: bought.portfolio[asset] }))
  })

  test(`V2 ${asset} emergency and START sales use the identical net quote`, () => {
    const bought = buy(createGame(`v2-quote-${asset}`, 0), asset, 5_000_000)
    const amount = bought.portfolio[asset]
    const quote = saleQuote(bought, asset, amount)
    const voluntary = rebalance({ ...bought, phase: 'rebalancing' }, { kind: 'sell', asset, amount })
    const emergency = fundPayment(mandatoryExpense(bought, quote.net + 1_000_000), asset, amount)
    assert.equal(voluntary.portfolio.cash - bought.portfolio.cash, quote.net)
    assert.equal(emergency.pendingPayment?.remaining, 1_000_000)
    assert.equal(emergency.portfolio[asset], 0)
    assert.equal(emergency.log.findLast(entry => entry.kind === 'funding')?.cashProceeds, quote.net)
  })
}

test('V2 gold has a disclosed sale spread and no periodic coupon', () => {
  const state = buy(createGame('v2-gold-spread', 0), 'gold', 5_000_000)
  assert.ok(saleQuote(state, 'gold').net < 5_000_000)
  const settled = beginSettlement(state)
  assert.equal(settled.portfolio.cash, state.portfolio.cash + 14_000_000)
})

test('V2 bond coupons and maturity principal are paid once per lot and lap', () => {
  const bought = buy(createGame('v2-bond-schedule', 0), 'bonds', 8_000_000)
  assert.equal(bought.bondLots.length, 1)
  const principal = bought.bondLots[0].principal
  const coupon = Math.round(principal * ECONOMY.bond.coupon)
  const first = beginSettlement(bought)
  assert.equal(first.portfolio.cash, bought.portfolio.cash + 14_000_000 + coupon)
  assert.equal(first.bondLots[0].lastCouponLap, 1)
  assert.deepEqual(beginSettlement(first), first)
  const second = beginSettlement(finishSettlement(first))
  assert.equal(second.portfolio.cash, first.portfolio.cash + 14_000_000 + coupon + principal)
  assert.equal(second.portfolio.bonds, 0)
  assert.equal(second.bondLots[0].status, 'matured')
  assert.deepEqual(beginSettlement(second), second)
  const third = beginSettlement(finishSettlement(second))
  assert.equal(third.portfolio.cash, second.portfolio.cash + 14_000_000)
})

test('V2 a fully sold bond lot receives no subsequent coupon or maturity payment', () => {
  const bought = buy(createGame('v2-bond-sold', 0), 'bonds', 8_000_000)
  const sold = rebalance({ ...bought, phase: 'rebalancing' }, { kind: 'sell', asset: 'bonds', amount: bought.portfolio.bonds })
  assert.equal(sold.portfolio.bonds, 0)
  const first = beginSettlement(sold)
  assert.equal(first.portfolio.cash, sold.portfolio.cash + 14_000_000)
  const second = beginSettlement(finishSettlement(first))
  assert.equal(second.portfolio.cash, first.portfolio.cash + 14_000_000)
})

test('V2 savings terms accept only 1, 2 and 3 laps and never create free money', () => {
  for (const term of [1, 2, 3]) {
    const state = createGame('v2-terms', 10_000_000, term)
    assert.equal(state.deposits.length, 1)
    assert.equal(state.deposits[0].principal, 10_000_000)
    assert.equal(state.portfolio.cash + state.portfolio.savings, 50_000_000)
    assert.equal(state.deposits[0].maturityLap - state.deposits[0].startLap + 1, term)
  }
  for (const term of [0, -1, 4, 1.5, Number.NaN]) {
    assert.throws(() => createGame('v2-invalid-term', 10_000_000, term))
  }
})

test('V2 bank deposits are separate lots and mature once on their respective START', () => {
  const initial = createGame('v2-deposit-lots', 10_000_000, 1)
  const deposited = transact(tileState(initial, 'bank'), { kind: 'deposit', amount: 5_000_000, term: 2 })
  assert.equal(deposited.deposits.length, 2)
  assert.deepEqual(deposited.deposits[0], initial.deposits[0])
  assert.notEqual(deposited.deposits[0].id, deposited.deposits[1].id)
  const first = beginSettlement(deposited)
  assert.equal(first.portfolio.savings, 5_000_000)
  assert.equal(first.portfolio.cash, 35_000_000 + 14_000_000 + 10_000_000 + first.deposits[0].earnedInterest)
  assert.equal(first.deposits[1].earnedInterest, 0)
  assert.deepEqual(beginSettlement(first), first)
  const second = beginSettlement(finishSettlement(first))
  assert.equal(second.portfolio.savings, 0)
  assert.ok(second.deposits[1].earnedInterest > 0)
  assert.deepEqual(beginSettlement(second), second)
})

test('V2 deposits beyond the remaining horizon remain separate and disclose late maturity', () => {
  const initial = { ...createGame('v2-late-deposit', 0), lap: RULES.laps }
  const deposited = transact(tileState(initial, 'bank'), { kind: 'deposit', amount: 5_000_000, term: 3 })
  assert.ok(deposited.deposits[0].maturityLap > RULES.laps)
  assert.match(deposited.log.at(-1)!.consequence, /chưa đáo hạn/)
  const settled = beginSettlement(deposited)
  assert.equal(settled.portfolio.savings, 5_000_000)
  assert.equal(settled.deposits[0].earnedInterest, 0)
})

test('V2 emergency savings withdrawal redeems the whole lot and leaves unused proceeds in cash', () => {
  const initial = createGame('v2-whole-lot', 10_000_000, 3)
  const pending = mandatoryExpense(initial, 2_000_000)
  const id = initial.deposits[0].id
  assert.throws(() => fundPayment(pending, 'savings', 2_000_000, id))
  const withdrawn = fundPayment(pending, 'savings', 10_000_000, id)
  assert.equal(withdrawn.portfolio.cash, 8_000_000)
  assert.equal(withdrawn.portfolio.savings, 0)
  assert.equal(withdrawn.deposits[0].earnedInterest, 0)
  assert.ok(withdrawn.log.find(entry => entry.kind === 'funding')!.lostSavingsInterest > 0)
  assert.throws(() => fundPayment(mandatoryExpense(withdrawn, 1_000_000), 'savings', 10_000_000, id))
})

test('V2 START is sell-only and cannot open a new deposit or withdraw outside mandatory funding', () => {
  const state = { ...createGame('v2-start-bank-gate', 10_000_000, 3), phase: 'rebalancing' as const }
  assert.throws(() => rebalance(state, { kind: 'deposit', amount: 1_000_000, term: 1 }))
  assert.throws(() => rebalance(state, { kind: 'withdraw', amount: 10_000_000, lotId: state.deposits[0].id }))
})

test('V2 maturity is credited before obligations and settlement retries never duplicate income', () => {
  const initial = createGame('v2-maturity-obligation', 20_000_000, 1)
  const obligations = 25_000_000
  const settled = beginSettlement({ ...initial, portfolio: { ...initial.portfolio, cash: 0 }, obligations })
  assert.equal(settled.phase, 'summary')
  assert.equal(settled.obligations, 0)
  assert.equal(settled.portfolio.cash, 14_000_000 + 20_000_000 + settled.deposits[0].earnedInterest - obligations)
  assert.deepEqual(beginSettlement(settled), settled)
  assert.deepEqual(continueSettlement(settled), settled)
})

test('V2 paused START obligations resume once without rerunning market or salary', () => {
  const initial = createGame('v2-paused-start', 0)
  const pending = beginSettlement({ ...initial, portfolio: { ...initial.portfolio, cash: 0 }, obligations: 16_000_000 })
  assert.equal(pending.phase, 'funding')
  assert.equal(pending.pendingPayment?.remaining, 2_000_000)
  const prices = JSON.stringify(pending.market)
  assert.deepEqual(beginSettlement(pending), pending)
  const settled = fundPayment(pending, 'debt', 2_000_000)
  assert.equal(settled.phase, 'summary')
  assert.equal(settled.portfolio.cash, 0)
  assert.equal(settled.portfolio.debt, 2_000_000)
  assert.equal(JSON.stringify(settled.market), prices)
  assert.equal(settled.summaries.length, 1)
  assert.equal(settled.summaries[0].incomeTotal, 14_000_000)
})

test('V2 after a maturity the player may choose stock sale and borrowing to finish START obligations', () => {
  let initial = createGame('v2-maturity-shortfall', 5_000_000, 1)
  initial = buy(initial, 'stocks', 5_000_000)
  const pending = beginSettlement({ ...initial, portfolio: { ...initial.portfolio, cash: 0 }, obligations: 30_000_000 })
  assert.equal(pending.phase, 'funding')
  assert.equal(pending.portfolio.savings, 0)
  assert.ok(pending.deposits[0].earnedInterest > 0)
  const remaining = pending.pendingPayment!.remaining
  const quote = saleQuote(pending, 'stocks')
  const sold = fundPayment(pending, 'stocks', pending.portfolio.stocks)
  assert.equal(sold.pendingPayment?.remaining, remaining - quote.net)
  const settled = fundPayment(sold, 'debt', sold.pendingPayment!.remaining)
  assert.equal(settled.phase, 'summary')
  assert.equal(settled.obligations, 0)
  assert.equal(settled.portfolio.stocks, 0)
  assert.equal(settled.summaries.length, 1)
})

test('V2 purchased course is permanent and may never be purchased twice', () => {
  const first = decide(tileState(createGame('v2-course-once', 0), 'course'), 'upgrade')
  assert.equal(first.coursePurchased, true)
  const prior = JSON.stringify(first)
  assert.throws(() => decide(tileState(first, 'course'), 'upgrade'))
  assert.equal(JSON.stringify(first), prior)
  const secondLap = nextLap(first)
  assert.equal(secondLap.recurringIncome, 17_000_000)
  assert.equal(beginSettlement(secondLap).summaries[1].incomeTotal, 17_000_000)
})

test('V2 business upgrades preserve base income and retain tiers for multiple trends', () => {
  let state = buy(createGame('v2-business-upgrades', 0), 'business', 20_000_000)
  state = { ...state, turn:state.turn+1 } // Subsequent encounter under V2.1.
  const before = businessIncome(state)
  state = transact(tileState(state, 'business'), { kind: 'upgrade', asset: 'business', amount: ECONOMY.business.upgradeCost, trend: 'growth' })
  const growth = businessIncome({ ...state, scenarioId: 'growth' })
  const other = businessIncome({ ...state, scenarioId: 'recovery' })
  assert.ok(growth > other)
  assert.ok(other > before)
  state = transact(tileState(state, 'business'), { kind: 'upgrade', asset: 'business', amount: ECONOMY.business.upgradeCost, trend: 'recovery' })
  assert.equal(state.business.upgrades.growth, 1)
  assert.equal(state.business.upgrades.recovery, 1)
  state = transact(tileState(state, 'business'), { kind: 'upgrade', asset: 'business', amount: ECONOMY.business.upgradeCost, trend: 'growth' })
  assert.equal(state.business.upgrades.growth, 2)
  assert.equal(state.business.upgrades.recovery, 1)
})

test('V2 business pays at the next START and sale recovers less than nominal invested capital', () => {
  const state = buy(createGame('v2-business-income', 0), 'business', 20_000_000)
  assert.equal(state.portfolio.cash, 30_000_000)
  const income = businessIncome(state)
  const settled = beginSettlement(state)
  assert.equal(settled.portfolio.cash, state.portfolio.cash + 14_000_000 + income)
  const quote = businessSaleQuote(state)
  assert.ok(quote > 0 && quote < state.business.capital)
  assert.throws(() => rebalance({ ...state, phase: 'rebalancing' }, { kind: 'sell', asset: 'business', amount: state.portfolio.business }))
  assert.throws(() => fundPayment(mandatoryExpense(state, 1_000_000), 'business' as 'stocks', 1_000_000))
  const sold = transact(tileState(state, 'business'), { kind: 'sell', asset: 'business', amount: state.portfolio.business })
  assert.equal(sold.portfolio.cash - state.portfolio.cash, quote)
  assert.equal(sold.portfolio.business, 0)
  assert.equal(businessIncome(sold), 0)
})

test('V2 final liquidatable funds subtract outstanding debt and exclude unsold business', () => {
  const bought = buy(createGame('v2-real-locked-goal', 0), 'business', 20_000_000)
  assert.equal(liquidatableFunds(bought), bought.portfolio.cash)
  const borrowing = { ...bought, portfolio: { ...bought.portfolio, cash: 95_000_000, debt: 10_000_000 } }
  assert.equal(liquidatableFunds(borrowing), 85_000_000)
  assert.equal(victory(borrowing).won, false)
  const exact = { ...bought, portfolio: { ...bought.portfolio, cash: 90_000_000 } }
  assert.equal(victory(exact).won, true)
})

test('V2 financial assets count after sale costs and savings count without unearned interest', () => {
  let state = createGame('v2-lawful-proceeds', 5_000_000, 3)
  for (const asset of ['stocks', 'bonds', 'gold'] as const) state = buy(state, asset, 5_000_000)
  const expected = state.portfolio.cash + 5_000_000 + saleQuote(state, 'stocks').net + saleQuote(state, 'bonds').net + saleQuote(state, 'gold').net
  assert.equal(liquidatableFunds(state), expected)
})

test('V2 borrowing is capped and exhausted liquidity produces explicit insolvency', () => {
  const initial = createGame('v2-insolvent', 0)
  const capped = { ...initial, borrowingLimit: 1_000_000 }
  const pending = mandatoryExpense(capped, 2_000_000)
  assert.throws(() => fundPayment(pending, 'debt', 1_000_001))
  const bankrupt = fundPayment(pending, 'debt', 1_000_000)
  assert.equal(bankrupt.phase, 'finished')
  assert.equal(bankrupt.termination, 'insolvent')
  assert.equal(bankrupt.portfolio.debt, 1_000_000)
  assert.equal(victory(bankrupt).won, false)
  assert.ok(!fundingSources(bankrupt).includes('debt'))
})

test('V2 an unfundable mandatory expense ends immediately instead of leaving a trapped dialog', () => {
  const initial = createGame('v2-no-funding', 0)
  const poor = { ...initial, phase: 'event' as const, eventId: 'medical', borrowingLimit: 0,
    portfolio: { ...initial.portfolio, cash: 0 } }
  const finished = decide(poor, 'pay')
  assert.equal(finished.phase, 'finished')
  assert.equal(finished.termination, 'insolvent')
  assert.equal(victory(finished).won, false)
})

test('V2 overshoot settles once before the pending destination and final lap keeps sell checkpoint', () => {
  const initial = advance(createGame('v2-overshoot', 0))
  const crossed = roll({ ...initial, position: 19 })
  const destination = crossed.position
  assert.equal(crossed.phase, 'summary')
  assert.equal(crossed.pendingLanding, destination !== 0)
  const checkpoint = advance(crossed)
  assert.equal(checkpoint.phase, 'rebalancing')
  const forecast = advance(checkpoint)
  assert.equal(forecast.phase, 'forecast')
  assert.equal(forecast.position, destination)
  const landed = advance(forecast)
  assert.equal(landed.turn, crossed.turn)
  assert.equal(landed.summaries.length, 1)
  assert.equal(landed.pendingLanding, false)
  assert.equal(landed.phase, destination === 0 ? 'rolling' : 'event')
  const final = roll({ ...initial, lap: RULES.laps, position: 19 })
  assert.equal(advance(final).phase, 'rebalancing')
  const finished = advance(advance(final))
  assert.equal(finished.phase, 'finished')
  assert.equal(finished.position, 0)
  assert.equal(finished.eventId, null)
  assert.equal(finished.pendingLanding, false)
})

test('V2 landing exactly on living expenses charges once while passing over them charges nothing', () => {
  const living = BOARD.find(tile => tile.type === 'living')!
  let initial: GameState | undefined
  for (let seed = 0; seed < 100; seed++) {
    const candidate = advance(createGame(`v2-living-${seed}`, 0))
    const die = Math.floor(random(candidate.rng)[0] * 6) + 1
    if (die >= 2 && die <= living.index) { initial = candidate; break }
  }
  assert.ok(initial)
  const die = Math.floor(random(initial.rng)[0] * 6) + 1
  const landed = roll({ ...initial, position: living.index - die })
  assert.equal(landed.eventId, 'living')
  const paid = decide(landed, EVENTS.find(event => event.id === 'living')!.options[0].id)
  assert.ok(paid.portfolio.cash < initial.portfolio.cash)
  const passed = roll({ ...initial, position: living.index - die + 1 })
  assert.notEqual(passed.eventId, 'living')
  assert.equal(passed.portfolio.cash, initial.portfolio.cash)
  assert.equal(decide(paid, 'pay'), paid)
})

test('V2 a START overshoot into living expenses pays salary before charging the destination once', () => {
  let initial: GameState | undefined
  for (let seed = 0; seed < 100; seed++) {
    const candidate = advance(createGame(`v2-cross-living-${seed}`, 0))
    if (Math.floor(random(candidate.rng)[0] * 6) + 1 === 4) { initial = candidate; break }
  }
  assert.ok(initial)
  const crossed = roll({ ...initial, position: 19 })
  assert.equal(BOARD[crossed.position].type, 'living')
  assert.equal(crossed.portfolio.cash, 64_000_000)
  const arrived = advance(advance(advance(crossed)))
  assert.equal(arrived.eventId, 'living')
  const option = EVENTS.find(event => event.id === 'living')!.options[0]
  const paid = decide(arrived, option.id)
  assert.equal(paid.portfolio.cash, 64_000_000 - option.cost!)
  assert.equal(paid.turn, 1)
  assert.equal(paid.summaries.length, 1)
})

test('V2 JSON replay preserves deterministic future state and immutable financial snapshots', () => {
  const initial = createGame('v2-json-replay', 10_000_000, 2)
  const storedSnapshot = snapshot(initial)
  const snapshotText = JSON.stringify(storedSnapshot)
  const bought = buy(initial, 'stocks', 10_000_000)
  const changed = applyMacroShock(bought, MACRO_EVENTS[0].id)
  assert.equal(JSON.stringify(storedSnapshot), snapshotText)
  assert.equal(JSON.stringify(initial.market), JSON.stringify(storedSnapshot.market))
  const reloaded: GameState = JSON.parse(JSON.stringify(changed))
  assert.deepEqual(beginSettlement(reloaded), beginSettlement(changed))
  assert.deepEqual(roll({ ...reloaded, phase: 'rolling' }), roll({ ...changed, phase: 'rolling' }))
  assert.notEqual(changed.market.stocks[0].priceHistory, initial.market.stocks[0].priceHistory)
})

test('V2 rejected transactions leave prices, RNG, holdings and log unchanged', () => {
  const initial = tileState(createGame('v2-rollback', 0), 'stocks')
  const saved = JSON.stringify(initial)
  for (const amount of [0, -1, Number.NaN, Infinity, 0.5, initial.portfolio.cash + 1]) {
    assert.throws(() => transact(initial, { kind: 'buy', asset: 'stocks', amount, symbolId: initial.market.stocks[0].id }))
  }
  assert.equal(JSON.stringify(initial), saved)
  const bought = buy(initial, 'stocks', 1_000_000)
  const checkpoint = { ...bought, phase: 'rebalancing' as const }
  const prior = JSON.stringify(checkpoint)
  assert.throws(() => rebalance(checkpoint, { kind: 'sell', asset: 'stocks', amount: bought.portfolio.stocks + 1 }))
  assert.equal(JSON.stringify(checkpoint), prior)
})

test('V2 financial log deltas reconcile allocation, trades, funding, shocks and all START stages', () => {
  function personal(state: GameState, decision: 'pay' | 'defer'): GameState {
    const position = BOARD.find(tile => tile.type === 'personal')!.index
    return decide({ ...state, phase: 'event', eventId: 'medical', position }, decision)
  }
  function reconcile(state: GameState) {
    const deltas: Record<keyof Portfolio, keyof FinancialEffects> = {
      cash: 'cashDelta', savings: 'savingsDelta', stocks: 'stockDelta', bonds: 'bondDelta',
      gold: 'goldDelta', business: 'businessDelta', debt: 'debtDelta',
    }
    for (const asset of Object.keys(deltas) as (keyof Portfolio)[]) {
      const total = state.log.reduce((sum, entry) => sum + (entry[deltas[asset]] as number), 0)
      assert.equal(total, state.portfolio[asset] - (asset === 'cash' ? RULES.startingCapital : 0), `${asset} log reconciliation`)
    }
    assert.equal(state.log.reduce((sum, entry) => sum + entry.recurringIncomeDelta, 0), state.recurringIncome - RULES.recurringIncome)
  }
  let state = createGame('v2-log-reconciliation', 10_000_000, 2)
  reconcile(state)
  state = decide(tileState(state, 'course'), 'upgrade')
  for (const asset of ['stocks', 'bonds', 'gold'] as const) state = buy(state, asset, 3_000_000)
  state = buy(state, 'business', ECONOMY.business.cost)
  state = applyMacroShock(state, MACRO_EVENTS[0].id)
  reconcile(state)
  state = personal(state, 'pay')
  state = personal(state, 'pay')
  state = fundPayment(state, 'savings', 10_000_000, state.deposits[0].id)
  state = personal(state, 'pay')
  state = personal(state, 'pay')
  state = fundPayment(state, 'gold', state.portfolio.gold)
  state = fundPayment(state, 'debt', state.pendingPayment!.remaining)
  state = personal(state, 'defer')
  reconcile(state)
  state = beginSettlement(state)
  assert.equal(state.phase, 'summary')
  reconcile(state)
  state = finishSettlement(state)
  state = transact(tileState(state, 'bank'), { kind: 'deposit', amount: 2_000_000, term: 1 })
  state = { ...state, turn:state.turn+1 } // Subsequent business encounter fixture.
  state = transact(tileState(state, 'business'), { kind: 'upgrade', asset: 'business', amount: ECONOMY.business.upgradeCost, trend: state.scenarioId })
  state = applyMacroShock({ ...state, turn: 1 }, MACRO_EVENTS[1].id)
  state = beginSettlement(state)
  reconcile(state)
  state = advance(state)
  state = rebalance(state, { kind: 'sell', asset: 'stocks', amount: state.portfolio.stocks })
  state = transact(tileState(state, 'business'), { kind: 'sell', asset: 'business', amount: state.portfolio.business })
  reconcile(state)
})

test('V2 final START debt repayment never charges interest twice after capitalization', () => {
  function medical(state: GameState, decision: 'pay' | 'defer') {
    return decide({ ...state, phase: 'event', eventId: 'medical', position: 7 }, decision)
  }
  let state = buy(createGame('v2-terminal-interest-once', 0), 'gold', 4_000_000)
  for (let count = 0; count < 9; count++) state = medical(state, 'pay')
  for (let count = 0; count < 3; count++) state = medical(state, 'defer')
  state = beginSettlement({ ...state, lap: RULES.laps })
  assert.equal(state.pendingPayment!.remaining, 3_000_000)
  state = fundPayment(state, 'debt', 3_000_000)
  assert.equal(state.portfolio.debt, 3_300_000)
  assert.equal(state.log.reduce((sum, entry) => sum + entry.debtInterestAccrued, 0), 300_000)
  state = advance(state)
  state = rebalance(state, { kind: 'sell', asset: 'gold', amount: state.portfolio.gold })
  const cash = state.portfolio.cash
  const debt = state.portfolio.debt
  state = rebalance(state, { kind: 'repay', amount: debt })
  assert.equal(state.portfolio.cash, cash - debt)
  assert.equal(state.portfolio.debt, 0)
  assert.equal(state.log.at(-1)!.debtInterestPaid, 0)
})

test('V2 SAIGON-2026 engine replay matches the completed three-lap 320px browser game', () => {
  let state = createGame('SAIGON-2026', 20_000_000, 1)
  let stockPurchased = false
  let bondPurchased = false
  for (let step = 0; state.phase !== 'finished' && step < 200; step++) {
    if (state.phase === 'rolling') state = roll(state)
    else if (state.phase === 'event') {
      if (state.turn === 1 && state.eventId === 'stocks' && !stockPurchased) {
        state = transact(state, { kind: 'buy', asset: 'stocks', symbolId: 'XV-MAY', amount: 10_000_000 })
        stockPurchased = true
      }
      if (state.turn === 7 && state.eventId === 'bonds' && !bondPurchased) {
        state = transact(state, { kind: 'buy', asset: 'bonds', amount: 8_000_000 })
        bondPurchased = true
      }
      const event = EVENTS.find(event => event.id === state.eventId)!
      const option = event.options.find(option => canChoose(state, option.id))!
      state = decide(state, option.id)
    } else {
      assert.notEqual(state.phase, 'funding', 'The browser replay never required emergency funding')
      state = advance(state)
    }
  }
  assert.equal(state.phase, 'finished')
  assert.equal(state.termination, 'completed')
  assert.equal(stockPurchased, true)
  assert.equal(bondPurchased, true)
  assert.equal(state.coursePurchased, true)
  assert.deepEqual(state.summaries.map(summary => summary.after), [62_148_100, 75_769_316, 78_449_528])
  assert.equal(state.portfolio.cash, 65_681_028)
  assert.equal(liquidatableFunds(state), 78_321_843)
  assert.equal(state.portfolio.debt, 0)
  assert.equal(victory(state).won, false)
})
