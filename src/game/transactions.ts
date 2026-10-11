import { ASSETS, ECONOMY, RULES, SCENARIOS } from '../data/config.ts'
import { boardFor } from '../data/board.ts'
import { copyState, record, snapshot } from './state.ts'
import { lostInterestOnWithdrawal, saleQuote } from './selectors.ts'
import { syncValuations } from './market.ts'
import { businessRulesForGame, businessSaleQuote, businessUpgradeUnlocked } from './business.ts'
import { CUSTOMER_PREFERENCES } from '../data/customer-preferences.ts'
import { currentCustomerPreference } from './customer-preferences.ts'
import { businessPurchaseCompletes, encounterActionUsed, singleActionEncounters } from './encounters.ts'
import { money } from './format.ts'
import { savingsProfileForGame } from './savings.ts'
import type { FundingSource, GameState, PendingPayment, RebalanceAction, Term, TradableAsset } from './types.ts'

export function validateAmount(amount: number, max: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > max) throw new Error('Số tiền không hợp lệ hoặc vượt số dư khả dụng.')
}
export function openDeposit(s: GameState, amount: number, term: Term) {
  validateAmount(amount, s.portfolio.cash)
  if (![1, 2, 3].includes(term)) throw new Error('Kỳ hạn phải là 1, 2 hoặc 3 vòng.')
  s.portfolio.cash -= amount
  s.deposits.push({ id: `deposit-${s.deposits.length + 1}`, principal: amount, startLap: s.lap,
    maturityLap: s.lap + term - 1, rate: savingsProfileForGame(s).rates[term], status: 'active', earnedInterest: 0 })
  syncValuations(s)
}
export function collectPayment(s: GameState, payment: Omit<PendingPayment, 'remaining'>) {
  const cashUsed = Math.min(s.portfolio.cash, payment.total)
  s.portfolio.cash -= cashUsed
  const remaining = payment.total - cashUsed
  if (remaining > 0) {
    s.pendingPayment = { ...payment, remaining }; s.pendingCost = remaining; s.phase = 'funding'
  }
  return cashUsed
}
export const borrowingAvailable = (s: GameState) => Math.max(0, s.borrowingLimit - s.portfolio.debt)
export function fundingSources(s: GameState): FundingSource[] {
  const sources: FundingSource[] = []
  if (s.deposits.some(lot => lot.status === 'active')) sources.push('savings')
  for (const asset of ['stocks', 'bonds', 'gold'] as TradableAsset[]) if (saleQuote(s, asset).net > 0) sources.push(asset)
  if (borrowingAvailable(s) > 0) sources.push('debt')
  return sources
}
export function resolveInsolvency(state: GameState): GameState {
  if (state.phase !== 'funding' || !state.pendingPayment || state.pendingPayment.remaining <= 0 || fundingSources(state).length > 0) return state
  const s = copyState(state)
  s.phase = 'finished'; s.termination = 'insolvent'; s.pendingLanding = false
  return record(s, snapshot(state), { kind: 'insolvency', title: 'Mất khả năng thanh toán', decision: 'Kết thúc hành trình',
    consequence: `Còn thiếu ${money(s.pendingPayment!.remaining)}, không còn nguồn hợp lệ hoặc hạn mức vay. Kinh doanh không được bán khẩn cấp.` })
}
function redeemDeposit(s: GameState, lotId: string | undefined, amount: number) {
  const lot = s.deposits.find(lot => lot.status === 'active' && (!lotId || lot.id === lotId))
  if (!lot || amount !== lot.principal) throw new Error('Phải rút toàn bộ một khoản tiết kiệm đang hoạt động.')
  const lost = lostInterestOnWithdrawal(s, lot.id)
  lot.status = 'withdrawn'; s.portfolio.cash += lot.principal; s.savingsEligible = false
  syncValuations(s)
  return lost
}
function sellAsset(s: GameState, asset: TradableAsset, amount: number, symbolId?: string) {
  validateAmount(amount, s.portfolio[asset])
  const quote = saleQuote(s, asset, amount)
  if (asset === 'stocks') {
    const targets = symbolId ? s.market.stocks.filter(stock => stock.id === symbolId) : s.market.stocks
    const total = targets.reduce((sum, stock) => sum + stock.currentPrice * (s.stockHoldings[stock.id]?.units ?? 0), 0)
    if (amount > Math.round(total) || total <= 0) throw new Error('Không đủ cổ phiếu của mã đã chọn.')
    const fraction = Math.min(1, amount / total)
    for (const stock of targets) {
      const holding = s.stockHoldings[stock.id]
      if (holding) { holding.units *= 1 - fraction; holding.costBasis *= 1 - fraction }
    }
  } else if (asset === 'gold') {
    const fraction = amount / s.portfolio.gold
    s.goldUnits *= 1 - fraction; s.goldCostBasis *= 1 - fraction
  } else {
    const fraction = amount / s.portfolio.bonds
    for (const lot of s.bondLots.filter(lot => lot.status === 'active')) {
      lot.units *= 1 - fraction; lot.principal *= 1 - fraction
      if (fraction === 1) lot.status = 'sold'
    }
  }
  s.portfolio.cash += quote.net; syncValuations(s)
  return quote
}
export function fundSource(state: GameState, source: FundingSource, amount: number, lotId?: string): GameState {
  if (state.phase !== 'funding' || !state.pendingPayment) throw new Error('Không có khoản thiếu hụt cần xử lý.')
  if (!fundingSources(state).includes(source)) throw new Error('Nguồn tiền không khả dụng. Kinh doanh chỉ bán tại ô Kinh doanh.')
  const s = copyState(state)
  const payment = s.pendingPayment!
  let lostInterest = 0
  let net = amount
  let fee = 0
  if (source === 'savings') lostInterest = redeemDeposit(s, lotId, amount)
  else if (source === 'debt') {
    validateAmount(amount, Math.min(payment.remaining, borrowingAvailable(s)))
    s.portfolio.debt += amount; s.portfolio.cash += amount
  } else {
    const quote = sellAsset(s, source, amount); net = quote.net; fee = quote.fee + quote.spread
  }
  const used = Math.min(payment.remaining, s.portfolio.cash)
  s.portfolio.cash -= used; payment.remaining -= used; s.pendingCost = payment.remaining
  const label = source === 'debt' ? 'Vay nợ' : source === 'savings' ? 'Rút toàn khoản tiết kiệm' : `Bán ${ASSETS[source].label.toLowerCase()}`
  const consequence = `${label}: giá trị ${money(amount)}, nhận ${money(net)}, phí/spread ${money(fee)}, mất lãi ${money(lostInterest)}; dùng ${money(used)} trả nghĩa vụ.`
  if (s.settlement) s.settlement.fundingNotes.push(consequence)
  return resolveInsolvency(record(s, snapshot(state), { kind: 'funding', title: payment.title, eventId: payment.eventId,
    decisionId: `fund-${source}`, decision: label, consequence,
    forcedWithdrawalAmount: source === 'savings' ? amount : 0, lostSavingsInterest: lostInterest,
    forcedAssetSaleAmount: ['stocks', 'bonds', 'gold'].includes(source) ? amount : 0,
    assetSaleAmounts: { stocks: source === 'stocks' ? amount : 0, bonds: source === 'bonds' ? amount : 0, gold: source === 'gold' ? amount : 0 },
    cashProceeds: net, expensePaid: used }))
}

export function transact(state: GameState, action: RebalanceAction): GameState {
  const tile = boardFor(state)[state.position].type
  const checkpoint = state.phase === 'rebalancing'
  const tileAccess = state.phase === 'event' && state.eventId === tile
  if (!checkpoint && !tileAccess) throw new Error('Không có quyền giao dịch tại thời điểm này.')
  if (action.completeEncounter && !(tileAccess && tile === 'stocks' && action.kind === 'buy' && action.asset === 'stocks')) {
    throw new Error('Chỉ hoàn tất sự kiện cùng một giao dịch mua cổ phiếu hợp lệ.')
  }
  const s = copyState(state)
  const { kind, amount, asset, symbolId } = action
  let label: string; let net = 0; let fee = 0; const lost = 0; let interest = 0
  if (kind === 'deposit') {
    if (!tileAccess || tile !== 'bank') throw new Error('Chỉ mở tiết kiệm tại ô Ngân hàng.')
    if (encounterActionUsed(s, 'deposit')) throw new Error('Mỗi lần gặp ô Ngân hàng chỉ được gửi một khoản mới.')
    openDeposit(s, amount, action.term ?? 1); label = 'Mở khoản tiết kiệm mới'
  } else if (kind === 'withdraw') {
    throw new Error('Khoản tiết kiệm tự đáo hạn; rút sớm chỉ khi thiếu tiền bắt buộc.')
  } else if (kind === 'buy') {
    if (!tileAccess || asset !== tile) throw new Error('Chỉ mua tại đúng ô tài sản, không mua tại START.')
    validateAmount(amount, s.portfolio.cash)
    if (asset === 'stocks') {
      const stock = s.market.stocks.find(stock => stock.id === (symbolId ?? s.market.stocks[0].id))
      if (!stock) throw new Error('Mã cổ phiếu không hợp lệ.')
      const holding = s.stockHoldings[stock.id] ?? { units: 0, costBasis: 0 }
      holding.units += amount / stock.currentPrice; holding.costBasis += amount; s.stockHoldings[stock.id] = holding
    } else if (asset === 'gold') {
      s.goldUnits += amount / s.market.gold.currentPrice; s.goldCostBasis += amount
    } else if (asset === 'bonds') {
      s.bondLots.push({ id: `bond-${s.bondLots.length + 1}`, units: amount / s.market.bond.currentPrice,
        principal: amount / s.market.bond.currentPrice * ECONOMY.bond.facePrice, startLap: s.lap,
        maturityLap: s.lap + ECONOMY.bond.term - 1, lastCouponLap: s.lap - 1, status: 'active' })
    } else if (asset === 'business') {
      if (s.business.capital > 0 || amount !== ECONOMY.business.cost) throw new Error('Đã có cơ sở kinh doanh hoặc sai giá vốn.')
      s.business.capital = amount; s.business.recoverableCapital = amount * ECONOMY.business.capitalRecovery
      s.businessPurchaseTurn = s.turn
    } else throw new Error('Tài sản không hợp lệ.')
    s.portfolio.cash -= amount; label = `Mua ${ASSETS[asset].label.toLowerCase()}`
    s.unlockedAssets = [...new Set([...s.unlockedAssets, asset])]
  } else if (kind === 'sell') {
    if (asset === 'business') {
      if (businessPurchaseCompletes(s) && s.businessPurchaseTurn === s.turn) throw new Error('Không bán cơ sở trong lần gặp ô vừa mua. Hãy quay lại ở lượt sau.')
      if (!tileAccess || tile !== 'business' || s.business.capital <= 0 || amount !== s.portfolio.business) throw new Error('Chỉ bán toàn cơ sở tại ô Kinh doanh.')
      net = businessSaleQuote(s); s.portfolio.cash += net
      s.business = { ...s.business, capital: 0, recoverableCapital: 0, upgrades: {} }; label = 'Bán cơ sở kinh doanh'
      s.businessPurchaseTurn = null
    } else {
      if (!checkpoint || !asset || !['stocks', 'bonds', 'gold'].includes(asset)) throw new Error('Chỉ bán tài sản tài chính tại START hoặc khi thiếu tiền bắt buộc.')
      const quote = sellAsset(s, asset, amount, symbolId); net = quote.net; fee = quote.fee + quote.spread; label = `Bán ${ASSETS[asset].label.toLowerCase()}`
    }
  } else if (kind === 'upgrade') {
    if (encounterActionUsed(s, 'upgrade')) throw new Error('Mỗi lần gặp ô Kinh doanh chỉ được nâng cấp một lần. Hãy quay lại ở lượt sau.')
    if (!businessUpgradeUnlocked(s)) throw new Error('Nâng cấp chỉ mở từ lần gặp ô Kinh doanh tiếp theo sau khi mua.')
    const preferences = businessRulesForGame(s) === 'v2.4-customer-preferences'
    if (preferences ? action.trend !== undefined : action.customerPreferenceId !== undefined) throw new Error('Chuyên môn nâng cấp không đúng phiên bản luật kinh doanh.')
    const trend = preferences ? action.customerPreferenceId ?? currentCustomerPreference(s).id : action.trend ?? s.scenarioId
    const choice = preferences ? CUSTOMER_PREFERENCES.find(p => p.id === trend) : SCENARIOS.find(p => p.id === trend)
    if (!tileAccess || tile !== 'business' || s.business.capital <= 0 || !choice) throw new Error('Chỉ nâng cấp cơ sở đang sở hữu tại ô Kinh doanh với chuyên môn hợp lệ.')
    const levels = Object.values(s.business.upgrades).reduce((sum, count) => sum + count, 0)
    if (levels >= ECONOMY.business.maxUpgrades || amount !== ECONOMY.business.upgradeCost) throw new Error('Vượt giới hạn hoặc sai giá nâng cấp.')
    validateAmount(amount, s.portfolio.cash)
    s.portfolio.cash -= amount; s.business.capital += amount
    s.business.recoverableCapital += amount * ECONOMY.business.upgradeRecovery
    s.business.upgrades[trend] = (s.business.upgrades[trend] ?? 0) + 1; label = preferences ? `Nâng cấp ${choice.label}` : `Nâng cấp theo xu hướng ${choice.label}`
  } else if (kind === 'repay') {
    if (!checkpoint) throw new Error('Trả nợ chủ động tại START.')
    validateAmount(amount, s.portfolio.debt); interest = s.lap === s.totalLaps ? 0 : Math.round(amount * RULES.debtRate)
    validateAmount(amount + interest, s.portfolio.cash)
    s.portfolio.debt -= amount; s.portfolio.cash -= amount + interest; label = 'Trả gốc nợ và lãi'
  } else throw new Error('Giao dịch không hợp lệ.')
  syncValuations(s)
  if (action.completeEncounter || (kind === 'deposit' && singleActionEncounters(s)) ||
    (kind === 'buy' && asset === 'business' && businessPurchaseCompletes(s))) { s.phase = 'rolling'; s.eventId = null }
  return record(s, snapshot(state), { kind: 'rebalancing', title: label, decisionId: `${kind}-${asset ?? tile}${action.completeEncounter ? '-complete' : ''}`,
    decision: `${label}: ${money(amount)}`, consequence: `${label}. Nhận ${money(net)}, phí/spread ${money(fee)}, mất lãi ${money(lost)}.${kind === 'deposit' && s.deposits.at(-1)!.maturityLap > s.totalLaps ? ' Khoản này chưa đáo hạn trong màn; chỉ rút sớm hợp lệ khi thiếu tiền hoặc xét mục tiêu cuối màn.' : ''}`,
    debtInterestPaid: interest, cashProceeds: net, lostSavingsInterest: lost,
    assetSaleAmounts: { stocks: kind === 'sell' && asset === 'stocks' ? amount : 0, bonds: kind === 'sell' && asset === 'bonds' ? amount : 0, gold: kind === 'sell' && asset === 'gold' ? amount : 0 } })
}
export const rebalance = (s: GameState, action: RebalanceAction) => {
  if (s.phase !== 'rebalancing') throw new Error('Chỉ điều chỉnh danh mục tại START.')
  return transact(s, action)
}
export const withdrawSavings = (state: GameState, amount: number, lotId?: string) => fundSource(state, 'savings', amount, lotId)
