import { ECONOMY, RULES } from '../data/config.ts'
import type { GameState, Portfolio, Snapshot, TradableAsset } from './types.ts'
import { businessIncome, businessMatchingKey, businessSaleQuote } from './business.ts'
import { savingsProfileForGame } from './savings.ts'
import type { Term } from './types.ts'
import { goalForGame, isCoreMvp } from './rules-profile.ts'
import { bondLotQuote, creditBondLots, hasBondCredit } from './bond-credit.ts'

export const netWorth = (p: Portfolio) => p.cash + p.savings + p.stocks + p.bonds + p.gold + p.business - p.debt
export const totalWorth = (s: GameState | Snapshot) => netWorth(s.portfolio) - s.obligations - (('pendingPayment' in s ? s.pendingPayment?.remaining : s.pendingCost) ?? 0)
export function victory(s: GameState) {
  const funds = liquidatableFunds(s)
  if (isCoreMvp(s)) {
    const wealth = funds >= goalForGame(s).target
    const completed = s.phase === 'finished' && s.termination === 'completed' && s.totalLaps === 4 && s.summaries.length === 4
      && [1,2,3,4].every(lap => s.summaries.some(summary => summary.lap === lap))
    return { wealth, liquidity:wealth, won:completed && wealth }
  }
  const wealth = funds >= RULES.goal
  const liquidity = funds - RULES.goal >= RULES.cashGoal
  return { wealth, liquidity, won: s.termination !== 'insolvent' && wealth && liquidity }
}
export function goalProgress(s: GameState) {
  const funds=liquidatableFunds(s),target=goalForGame(s).target
  return { funds,target,percent:Math.max(0,Math.min(100,funds/target*100)),remaining:Math.max(0,target-funds) }
}
export function saleQuote(s: GameState, asset: TradableAsset, amount = s.portfolio[asset], lotId?: string) {
  if (asset === 'bonds' && hasBondCredit(s)) {
    if (lotId) return bondLotQuote(s, lotId, amount)
    if (amount !== s.portfolio.bonds && amount !== 0) throw new Error('Chọn một khoản trái phiếu để xem giá bán từng phần.')
    if (amount === 0 && s.portfolio.bonds !== 0) return { gross: 0, fee: 0, spread: 0, net: 0 }
    return creditBondLots(s).reduce((sum, { quote }) => ({ gross: sum.gross + quote.gross,
      fee: sum.fee + quote.fee, spread: 0, net: sum.net + quote.net }), { gross: 0, fee: 0, spread: 0, net: 0 })
  }
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

export function purchasePreview(s: GameState, amount: number) {
  const valid = Number.isSafeInteger(amount) && amount > 0 && amount <= s.portfolio.cash
  return { valid, cashAfter: valid ? s.portfolio.cash - amount : null,
    error: !Number.isSafeInteger(amount) || amount <= 0 ? 'Nhập số tiền nguyên dương.' : amount > s.portfolio.cash ? 'Số tiền vượt tiền mặt hiện có.' : '' }
}

export function stockQuote(s: GameState, symbolId: string) {
  const stock = s.market.stocks.find(item => item.id === symbolId)!
  return { stock, units: s.stockHoldings[symbolId]?.units ?? 0, recent: stock.priceHistory.at(-1)! }
}

export function depositPreview(s: GameState, amount: number, term: Term) {
  return { maturityLap: s.lap + term - 1, interest: purchasePreview(s, amount).valid
    ? Math.round(amount * savingsProfileForGame(s).rates[term] * term) : 0 }
}

export function businessOverview(s: GameState, trend = businessMatchingKey(s)) {
  const upgraded = { ...s, business: { ...s.business, upgrades: { ...s.business.upgrades,
    [trend]: (s.business.upgrades[trend] ?? 0) + 1 } } }
  return { income: businessIncome(s), sale: businessSaleQuote(s), locked: s.business.capital,
    initialSale: Math.round(ECONOMY.business.cost * ECONOMY.business.capitalRecovery),
    levels: Object.values(s.business.upgrades).reduce((sum, n) => sum + n, 0),
    remainingStarts: Math.max(0, s.totalLaps - s.lap + 1),
    incrementalIncome: s.business.capital > 0 ? businessIncome(upgraded) - businessIncome(s) : 0 }
}
