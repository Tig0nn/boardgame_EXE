// Diagnostic only: this module is never imported by the application.
import assert from 'node:assert/strict'
import { advance, canChoose, createGame, decide, fundPayment, roll, transact } from '../../src/game/engine.ts'
import { borrowingAvailable, fundingSources } from '../../src/game/transactions.ts'
import { liquidatableFunds, saleQuote, victory } from '../../src/game/selectors.ts'
import { boardFor } from '../../src/data/board.ts'
import { ECONOMY, RULES } from '../../src/data/config.ts'
import { EVENTS } from '../../src/data/events.ts'
import type { GameModeId, GameState, Term, SavingsProfileId } from '../../src/game/types.ts'

export const strategies = ['cash-heavy', 'saving-heavy', 'stock-heavy', 'business-heavy', 'diversified'] as const
export type Strategy = typeof strategies[number] | 'cash-course' | 'saving-no-course' | 'business-exit-window'

// All engine references share this same process-local object. No source file is edited.
// Calls must be synchronous and sequential; restoration also applies when validation fails.
export function withHorizon<T>(horizon: number, work: () => T): T {
  assert.ok(Number.isSafeInteger(horizon) && horizon >= 1 && horizon <= 12)
  const original = RULES.laps
  RULES.laps = horizon
  try { return work() } finally { RULES.laps = original }
}

export function tileAction(s: GameState, strategy: Strategy, horizon: number): GameState {
  const id = s.eventId
  const budget = Math.max(0, s.portfolio.cash - 10_000_000)
  const savingOnly = strategy === 'saving-heavy' || strategy === 'saving-no-course'
  if (id === 'bank' && budget >= 1_000_000 && (savingOnly || strategy === 'diversified')) {
    s = transact(s, { kind: 'deposit', amount: Math.floor(budget * (savingOnly ? 0.85 : 0.25)),
      term: savingOnly ? Math.min(3, horizon - s.lap + 1) as Term : 1 })
  }
  if (id === 'stocks' && budget >= 1_000_000 && (strategy === 'stock-heavy' || strategy === 'diversified')) {
    const selected = s.market.stocks[s.turn % s.market.stocks.length]
    s = transact(s, { kind: 'buy', asset: 'stocks', amount: Math.floor(Math.min(strategy === 'stock-heavy' ? 25_000_000 : 5_000_000, budget)), symbolId: selected.id })
  }
  if ((id === 'bonds' || id === 'gold') && strategy === 'diversified' && budget >= 1_000_000) {
    s = transact(s, { kind: 'buy', asset: id, amount: Math.floor(Math.min(id === 'bonds' ? 5_000_000 : 3_000_000, budget)) })
  }
  if (id === 'business' && ['business-heavy', 'diversified', 'business-exit-window'].includes(strategy)) {
    // One action per encounter: purchase cannot flow into upgrade. This also matches V2.1's enforced purchase lock.
    const exitLap = strategy === 'business-exit-window' ? Math.max(2, horizon - 1) : horizon
    if (s.business.capital > 0 && s.lap >= exitLap) s = transact(s, { kind: 'sell', asset: 'business', amount: s.portfolio.business })
    else if (s.business.capital === 0 && s.lap < exitLap && budget >= ECONOMY.business.cost) {
      s = transact(s, { kind: 'buy', asset: 'business', amount: ECONOMY.business.cost })
    } else if (s.business.capital > 0 && s.lap < exitLap && budget >= ECONOMY.business.upgradeCost &&
      Object.values(s.business.upgrades).reduce((sum, value) => sum + value, 0) < ECONOMY.business.maxUpgrades) {
      s = transact(s, { kind: 'upgrade', asset: 'business', amount: ECONOMY.business.upgradeCost, trend: s.scenarioId })
    }
  }
  return s
}

// Offline experiments may replace policy decisions, never the accounting audit.
export interface DiagnosticPolicy {
  savingsProfileId?: SavingsProfileId
  mode?: GameModeId
  initialSavings?: number
  initialTerm?: Term
  act?: (state: GameState) => GameState
  course?: (state: GameState) => boolean
  fund?: (state: GameState) => GameState
  choose?: (state: GameState, preferred: string) => string
}
export function playDiagnostic(seed: string, strategy: Strategy, horizon: number, policy: DiagnosticPolicy = {}) {
  const runGame = () => {
    const savingOnly = strategy === 'saving-heavy' || strategy === 'saving-no-course'
    const initialSavings = policy.initialSavings ?? (savingOnly ? 40_000_000 : strategy === 'diversified' ? 15_000_000 : 0)
    // This published diagnostic models the V2.3 scenario-based upgrade policy.
    let s = createGame(seed, initialSavings, policy.initialTerm ?? (savingOnly ? 3 : 1), policy.mode, policy.savingsProfileId, 'v2.3-fixed-income', 'v2.3-single-action')
    assert.equal(s.totalLaps, horizon)
    const BOARD = boardFor(s)
    const visits: Record<string, number> = Object.fromEntries([...new Set(BOARD.map(tile => tile.type))].map(type => [type, 0]))
    const stopsByTile = BOARD.map(() => 0)
    const path: string[] = []
    const checkpoints: { lap: number; turn: number; funds: number; savings: number; business: number }[] = []
    let first90Lap: number | null = null
    let first90Checkpoint: number | null = null
    let purchaseLap: number | null = null
    let businessReturnsAfterPurchase = 0
    let eligibleBusinessEncounters = 0
    let businessExitEncounters = 0
    let alternativeChoices = 0
    let transitions = 0
    const exitLap = strategy === 'business-exit-window' ? Math.max(2, horizon - 1) : horizon
    const observe = () => {
      const funds = liquidatableFunds(s)
      if (first90Lap === null && funds >= 90_000_000) first90Lap = s.lap
      if (s.phase === 'summary' && !checkpoints.some(point => point.lap === s.lap)) {
        checkpoints.push({ lap: s.lap, turn: s.turn, funds, savings: s.portfolio.savings, business: s.portfolio.business })
        if (first90Checkpoint === null && funds >= 90_000_000) first90Checkpoint = s.lap
      }
    }
    observe()
    while (s.phase !== 'finished' && transitions++ < horizon * 160) {
      if (s.phase === 'rolling') {
        s = roll(s)
        path.push(`${s.lap}:${s.turn}:${s.dice}:${s.position}:${s.scenarioId}`)
        if (s.position === 0) { visits.start++; stopsByTile[0]++ }
      } else if (s.phase === 'event') {
        const type = BOARD[s.position].type
        visits[type]++; stopsByTile[s.position]++
        if (type === 'business') {
          if (s.lap < exitLap) eligibleBusinessEncounters++
          if (s.lap >= exitLap) businessExitEncounters++
          if (purchaseLap !== null) businessReturnsAfterPurchase++
        }
        const hadBusiness = s.business.capital > 0
        s = policy.act ? policy.act(s) : tileAction(s, strategy, horizon)
        if (!hadBusiness && s.business.capital > 0 && purchaseLap === null) purchaseLap = s.lap
        observe()
        // A versioned Bank deposit completes the encounter atomically.
        if (s.phase !== 'event') continue
        const event = EVENTS.find(event => event.id === s.eventId)!
        if (event.options.filter(option => canChoose(s, option.id)).length > 1) alternativeChoices++
        // At least two future salary payments cover the 6M course cost. No future prices are inspected.
        const preferred = event.id === 'course' && (policy.course ? policy.course(s) : !['cash-heavy', 'saving-no-course'].includes(strategy) && horizon - s.lap + 1 >= 2) && canChoose(s, 'upgrade') ? 'upgrade'
          : event.options.find(option => canChoose(s, option.id) && option.id !== 'upgrade')!.id
        s = decide(s, policy.choose ? policy.choose(s, preferred) : preferred)
      } else if (s.phase === 'funding') {
        if (policy.fund) { s = policy.fund(s); observe(); continue }
        const source = fundingSources(s)[0]
        assert.ok(source, `Unresolved funding: ${seed}/${strategy}/${horizon}`)
        const lot = s.deposits.find(lot => lot.status === 'active')
        const amount = source === 'savings' ? lot!.principal : source === 'debt' ? Math.min(s.pendingPayment!.remaining, borrowingAvailable(s)) : s.portfolio[source]
        s = fundPayment(s, source, amount, source === 'savings' ? lot!.id : undefined)
      } else s = advance(s)
      observe()
    }
    assert.equal(s.phase, 'finished', `Deadlock: ${seed}/${strategy}/${horizon}`)
    const entries = s.log
    const actions = entries.filter(entry => entry.kind === 'rebalancing')
    const decisions = entries.filter(entry => entry.kind === 'decision')
    const funding = entries.filter(entry => entry.kind === 'funding')
    const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
    const salaryEntries = entries.filter(entry => entry.kind === 'schedule' && entry.title === 'Nhận lương')
    const salary = sum(salaryEntries.map(entry => entry.cashDelta))
    let livingDue = 0; let extraordinaryDue = 0; let courseCost = 0
    for (const entry of decisions) {
      const option = EVENTS.find(event => event.id === entry.eventId)!.options.find(option => option.id === entry.decisionId)!
      const cost = (option.cost ?? 0) + (option.obligation ?? 0)
      if (entry.eventId === 'living') livingDue += cost
      else if (entry.eventId === 'course') courseCost += cost
      else extraordinaryDue += cost
    }
    const paymentEntries = [...decisions, ...funding]
    const livingPaid = sum(paymentEntries.filter(entry => entry.eventId === 'living').map(entry => entry.expensePaid))
    const extraordinaryPaid = sum(paymentEntries.filter(entry => ['medical', 'repair', 'family', 'bills', 'contract'].includes(entry.eventId ?? '')).map(entry => entry.expensePaid))
    const bonus = sum(decisions.filter(entry => entry.eventId === 'bonus').map(entry => entry.cashDelta))
    const businessIncome = sum(entries.filter(entry => entry.kind === 'schedule' && entry.title === 'Dòng tiền kinh doanh').map(entry => entry.cashDelta))
    const businessCosts = -sum(actions.filter(entry => ['buy-business', 'upgrade-business'].includes(entry.decisionId ?? '')).map(entry => entry.cashDelta))
    const businessResale = sum(actions.filter(entry => entry.decisionId === 'sell-business').map(entry => entry.cashProceeds))
    const sold = actions.some(entry => entry.decisionId === 'sell-business')
    const businessCashContribution = businessIncome + businessResale - businessCosts
    const businessMarkedProfit = businessCashContribution + s.portfolio.business
    const businessRealizedProfit = sold ? businessCashContribution : null
    const savingsInterest = sum(s.deposits.filter(lot => lot.status === 'matured').map(lot => lot.earnedInterest))
    let bondCoupons = 0; let bondRedemptions = 0
    for (const entry of entries.filter(entry => entry.kind === 'schedule' && entry.title === 'Đáo hạn và coupon')) {
      for (const lot of entry.after.bondLots) {
        const before = entry.before.bondLots.find(before => before.id === lot.id)!
        if (lot.lastCouponLap > before.lastCouponLap) bondCoupons += Math.round(lot.principal * ECONOMY.bond.coupon)
        if (lot.status === 'matured' && before.status === 'active') bondRedemptions += Math.round(lot.principal)
      }
    }
    const assetCosts = -sum(actions.filter(entry => ['buy-stocks', 'buy-bonds', 'buy-gold'].includes(entry.decisionId ?? '')).map(entry => entry.cashDelta))
    const assetSales = sum(entries.filter(entry => ['sell-stocks', 'sell-bonds', 'sell-gold', 'fund-stocks', 'fund-bonds', 'fund-gold'].includes(entry.decisionId ?? '')).map(entry => entry.cashProceeds))
    const terminalFinancialAssets = sum((['stocks', 'bonds', 'gold'] as const).map(asset => saleQuote(s, asset).net))
    const investmentProfit = savingsInterest + bondCoupons + bondRedemptions + assetSales + terminalFinancialAssets - assetCosts
    const debtInterest = sum(entries.map(entry => entry.debtInterestPaid + entry.debtInterestAccrued))
    const funds = liquidatableFunds(s)
    const expectedFunds = RULES.startingCapital + salary + bonus - livingDue - extraordinaryDue - courseCost - debtInterest + investmentProfit + businessCashContribution
    const accountingResidual = funds - expectedFunds
    assert.equal(accountingResidual, 0, `Financial reconciliation: ${seed}/${strategy}/${horizon}`)
    assert.equal(sum(entries.map(entry => entry.cashDelta)), s.portfolio.cash - RULES.startingCapital)
    assert.equal(new Set(salaryEntries.map(entry => entry.lap)).size, salaryEntries.length)
    assert.equal(new Set(s.market.normalLaps).size, s.market.normalLaps.length)
    assert.equal(new Set(s.market.appliedShocks).size, s.market.appliedShocks.length)
    assert.ok(s.portfolio.debt >= 0 && s.portfolio.cash >= 0)
    assert.ok(Object.values(s.stockHoldings).every(holding => holding.units >= 0))
    assert.ok(s.bondLots.every(lot => lot.units >= 0 && lot.principal >= 0))
    if (s.termination === 'completed') {
      assert.equal(s.summaries.length, horizon)
      assert.equal(salaryEntries.length, horizon)
      assert.equal(s.market.normalLaps.length, horizon)
      assert.deepEqual(s.summaries.map(summary => summary.lap), Array.from({ length: horizon }, (_, index) => index + 1))
      assert.equal(s.pendingLanding, false); assert.equal(s.position, 0)
      assert.ok(s.deposits.every(lot => lot.status !== 'active' || lot.maturityLap > horizon))
    }
    const run = { seed, strategy, horizon, funds, won: victory(s).won, debt: s.portfolio.debt,
      termination: s.termination!, shortfall: Math.max(0, 90_000_000 - funds), completedLaps: s.summaries.length,
      livingCount: visits.living, livingPaid, livingDue, extraordinaryPaid, extraordinaryDue,
      financialShocks: visits.personal, macroShocks: s.market.appliedShocks.length, rolls: path.length,
      eventDecisions: decisions.length, alternativeChoices, voluntaryActions: actions.length, fundingDecisions: funding.length,
      financialDecisions: decisions.length + actions.length + funding.length,
      stockBuys: actions.filter(entry => entry.decisionId === 'buy-stocks').length,
      monetaryDecisions: decisions.filter(entry => entry.expensePaid > 0 || entry.cashDelta !== 0 || entry.obligationCreated > 0 || entry.recurringIncomeDelta !== 0).length + actions.length + funding.length,
      uiEventInterruptions: decisions.length, uiCheckpointInterruptions: s.summaries.length * 2,
      course: s.coursePurchased, courseCost, salary, baseSalary: salaryEntries.length * RULES.recurringIncome,
      courseSalary: salary - salaryEntries.length * RULES.recurringIncome, bonus, savingsInterest,
      investmentProfit, debtInterest, accountingResidual,
      everBorrowed: funding.some(entry => entry.decisionId === 'fund-debt'),
      shortageEpisodes: entries.filter(entry => entry.before.phase !== 'funding' && entry.after.phase === 'funding').length,
      shortageAmount: sum(entries.filter(entry => entry.before.phase !== 'funding' && entry.after.phase === 'funding').map(entry => entry.after.pendingCost)),
      businessEncounters: visits.business, eligibleBusinessEncounters, businessExitEncounters,
      purchaseLap, businessReturnsAfterPurchase, businessBought: purchaseLap !== null,
      businessUpgrades: actions.filter(entry => entry.decisionId === 'upgrade-business').length,
      businessIncome, businessCosts, businessResale, businessSold: sold,
      businessLocked: s.business.capital > 0, businessLockedQuote: s.portfolio.business,
      businessCashContribution, businessMarkedProfit, businessRealizedProfit,
      first90Lap, first90Checkpoint, terminalSavings: s.portfolio.savings,
      path, checkpoints, visits, stopsByTile }
    return { run, state: s }
  }
  // Explicit browser modes already carry their horizon; leave global config untouched.
  return policy.mode ? runGame() : withHorizon(horizon, runGame)
}

export type Run = ReturnType<typeof playDiagnostic>['run']

export function distribution(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const at = (p: number) => sorted[Math.floor((sorted.length - 1) * p)]
  return { n: values.length, mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    p10: at(0.1), median: at(0.5), p90: at(0.9), min: sorted[0], max: sorted.at(-1)! }
}
