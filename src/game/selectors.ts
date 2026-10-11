import { ECONOMY, RULES } from '../data/config.ts'
import type { GameState, Portfolio, Snapshot, TradableAsset } from './types.ts'

export const netWorth = (p: Portfolio) => p.cash + p.savings + p.stocks + p.bonds + p.gold + p.business - p.debt
export const totalWorth = (s: GameState | Snapshot) => netWorth(s.portfolio) - s.obligations - (('pendingPayment' in s ? s.pendingPayment?.remaining : s.pendingCost) ?? 0)
export function victory(s: GameState) {
  const funds = liquidatableFunds(s)
  const wealth = funds >= RULES.goal
  const liquidity = funds - RULES.goal >= RULES.cashGoal
  return { wealth, liquidity, won: s.termination !== 'insolvent' && wealth && liquidity }
}
export function saleQuote(s: GameState, asset: TradableAsset, amount = s.portfolio[asset]) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > s.portfolio[asset]) throw new Error('Số lượng bán không hợp lệ.')
  const spread = asset === 'gold' ? Math.round(amount * ECONOMY.goldSpread) : 0
  const fee = Math.round((amount - spread) * ECONOMY.tradeFees[asset])
  return { gross: amount, spread, fee, net: amount - spread - fee }
}
export function liquidatableFunds(s: GameState): number {
  return s.portfolio.cash + s.deposits.filter(lot => lot.status === 'active').reduce((sum, lot) => sum + lot.principal, 0) +
    (['stocks', 'bonds', 'gold'] as TradableAsset[]).reduce((sum, asset) => sum + saleQuote(s, asset).net, 0) -
    s.portfolio.debt - s.obligations - (s.pendingPayment?.remaining ?? 0)
}
export const lostInterestOnWithdrawal = (s: GameState, lotId?: string) => s.deposits
  .filter(lot => lot.status === 'active' && (!lotId || lot.id === lotId))
  .reduce((sum, lot) => sum + Math.round(lot.principal * lot.rate * (lot.maturityLap - lot.startLap + 1)), 0)
