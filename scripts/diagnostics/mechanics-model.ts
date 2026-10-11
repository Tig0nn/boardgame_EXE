// Offline, synchronous policies. Imported only by diagnostics, never by the app.
import assert from 'node:assert/strict'
import { ECONOMY } from '../../src/data/config.ts'
import { fundPayment, transact } from '../../src/game/engine.ts'
import { borrowingAvailable, fundingSources } from '../../src/game/transactions.ts'
import { saleQuote } from '../../src/game/selectors.ts'
import type { GameState, TradableAsset } from '../../src/game/types.ts'
import { playDiagnostic, tileAction } from './game-length-model.ts'
import type { DiagnosticPolicy, Strategy } from './game-length-model.ts'

export const experiments = [
  'cash', 'cash-course', 'saving', 'saving-456', 'saving-30M', 'saving-debt-first',
  'stocks', 'stocks-forecast', 'stocks-momentum', 'stocks-partial-funding',
  'bonds', 'bonds-yield', 'gold', 'gold-forecast', 'diversified',
  'business-final', 'business-early', 'business-final-no-upgrade',
  'business-early-no-upgrade', 'business-early-selective-upgrade',
] as const
export type Experiment = typeof experiments[number]

export function withSavingsRates<T>(rates: typeof ECONOMY.savingsRates, work: () => T): T {
  const before = { ...ECONOMY.savingsRates }
  Object.assign(ECONOMY.savingsRates, rates)
  try { return work() } finally { Object.assign(ECONOMY.savingsRates, before) }
}

export function fundConservatively(s: GameState, debtFirst = false): GameState {
  const sources = fundingSources(s)
  const source = debtFirst && sources.includes('debt') ? 'debt' : sources[0]
  assert.ok(source)
  if (source === 'debt') return fundPayment(s, source, Math.min(s.pendingPayment!.remaining, borrowingAvailable(s)))
  if (source === 'savings') {
    const lot = s.deposits.find(lot => lot.status === 'active')!
    return fundPayment(s, source, lot.principal, lot.id)
  }
  // Find the smallest integer gross sale covering the actual shortfall, including rounding.
  const remaining = s.pendingPayment!.remaining
  let low = 1; let high = s.portfolio[source]
  if (saleQuote(s, source, high).net < remaining) return fundPayment(s, source, high)
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (saleQuote(s, source, mid).net >= remaining) high = mid
    else low = mid + 1
  }
  return fundPayment(s, source, low)
}

function buyAsset(s: GameState, asset: TradableAsset, informed: boolean, momentum = false) {
  if (s.eventId !== asset) return s
  const remaining = s.totalLaps - s.lap + 1
  if (asset === 'bonds' && (remaining < ECONOMY.bond.term || informed &&
    s.market.bond.currentPrice >= ECONOMY.bond.facePrice * (1 + ECONOMY.bond.coupon * ECONOMY.bond.term))) return s
  if (informed && asset === 'stocks' && s.scenarioId === 'uncertain') return s
  if (informed && asset === 'gold' && s.scenarioId !== 'uncertain') return s
  const amount = Math.floor(Math.min(25_000_000, s.portfolio.cash - 10_000_000))
  if (amount < 1_000_000) return s
  let stock = s.market.stocks[s.turn % s.market.stocks.length]
  if (momentum) stock = [...s.market.stocks].sort((a, b) => {
    const change = (x: typeof a) => x.currentPrice / x.priceHistory.at(-12)!.priceBefore - 1
    return change(b) - change(a) || a.id.localeCompare(b.id)
  })[0]
  return transact(s, { kind: 'buy', asset, amount, symbolId: asset === 'stocks' ? stock.id : undefined })
}

function business(s: GameState, exitLap: number, selectiveUpgrade: boolean) {
  if (s.eventId !== 'business') return s
  if (s.business.capital > 0 && s.lap >= exitLap) return transact(s, { kind: 'sell', asset: 'business', amount: s.portfolio.business })
  const budget = s.portfolio.cash - 10_000_000
  // All custom variants share the same entry window (laps 1–2).
  if (s.business.capital === 0 && s.lap <= 2 && budget >= ECONOMY.business.cost) return transact(s, { kind: 'buy', asset: 'business', amount: ECONOMY.business.cost })
  // With >=3 remaining income payments, persistent uplift plus matching bonus can cover lost capital.
  if (selectiveUpgrade && s.business.capital > 0 && s.turn > s.businessPurchaseTurn! &&
    s.lap <= 2 && s.totalLaps - s.lap + 1 >= 3 && budget >= ECONOMY.business.upgradeCost &&
    Object.values(s.business.upgrades).reduce((a, b) => a + b, 0) < ECONOMY.business.maxUpgrades) {
    return transact(s, { kind: 'upgrade', asset: 'business', amount: ECONOMY.business.upgradeCost, trend: s.scenarioId })
  }
  return s
}

export function playMechanics(seed: string, experiment: Experiment) {
  let strategy: Strategy = 'cash-course'
  const policy: DiagnosticPolicy = { mode: 'experimental-b' }
  if (experiment === 'cash') strategy = 'cash-heavy'
  if (experiment.startsWith('saving')) strategy = 'saving-heavy'
  if (experiment === 'saving-30M') policy.initialSavings = 30_000_000
  if (experiment === 'saving-debt-first') policy.fund = s => fundConservatively(s, true)
  if (experiment.startsWith('stocks')) {
    strategy = 'stock-heavy'
    policy.act = s => buyAsset(s, 'stocks', experiment === 'stocks-forecast', experiment === 'stocks-momentum')
    if (experiment === 'stocks-partial-funding') policy.fund = s => fundConservatively(s)
  }
  if (experiment.startsWith('bonds')) policy.act = s => buyAsset(s, 'bonds', experiment === 'bonds-yield')
  if (experiment.startsWith('gold')) policy.act = s => buyAsset(s, 'gold', experiment === 'gold-forecast')
  if (experiment === 'diversified') strategy = 'diversified'
  if (experiment === 'business-final') strategy = 'business-heavy'
  if (experiment === 'business-early') strategy = 'business-exit-window'
  if (experiment.includes('no-upgrade') || experiment === 'business-early-selective-upgrade') {
    strategy = 'business-heavy'
    policy.act = s => business(s, experiment === 'business-final-no-upgrade' ? 4 : 3, experiment.endsWith('selective-upgrade'))
  }
  // Explicitly retain legacy savings/diversification actions in the reference groups.
  if (!policy.act) policy.act = s => tileAction(s, strategy, 4)
  const run = () => playDiagnostic(seed, strategy, 4, policy)
  return experiment === 'saving-456' ? withSavingsRates({ 1: 0.04, 2: 0.05, 3: 0.06 }, run) : run()
}
