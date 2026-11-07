import { ECONOMY, MACRO_EVENTS, SCENARIOS } from '../data/config.ts'
import { stockCatalog } from '../data/stock-catalog.ts'
import { hashSeed, random } from './random.ts'
import { copyState, draw, record, snapshot } from './state.ts'
import { applyCreditMacro, creditBondLots, hasBondCredit, updateCreditMarket } from './bond-credit.ts'
import type { GameState, MarketInstrument, MarketState, PricePoint, StockCatalogVersion } from './types.ts'

export function initializeMarket(seed: string, catalogVersion?: StockCatalogVersion): MarketState {
  const historySeed = hashSeed(`${seed}:history-v2`)
  let rng = historySeed
  const sample = () => { const result = random(rng); rng = result[1]; return result[0] }
  const stocks = stockCatalog(catalogVersion).map(stock => ({ ...stock, currentPrice: ECONOMY.market.initialStockPrice, priceHistory: [] as PricePoint[] }))
  const gold: MarketInstrument = { currentPrice: ECONOMY.market.initialGoldPrice, priceHistory: [] }
  const bond: MarketInstrument = { currentPrice: ECONOMY.bond.facePrice, priceHistory: [] }
  const historicalChange = (instrument: MarketInstrument, rate: number, timestamp: number) => {
    const priceBefore = instrument.currentPrice
    const priceAfter = Math.max(1, Math.round(priceBefore * (1 + rate)))
    instrument.priceHistory.push({ timestamp, lap: 0, kind: 'history', priceBefore, priceAfter, returnRate: priceAfter / priceBefore - 1 })
    instrument.currentPrice = priceAfter
  }
  for (let index = 0; index < ECONOMY.market.historyPoints; index++) {
    const common = (sample() * 2 - 1) * ECONOMY.market.historyMarketVolatility
    const sectors = Object.fromEntries([...new Set(stocks.map(stock => stock.sector))].map(sector => [sector, (sample() * 2 - 1) * ECONOMY.market.historySectorVolatility]))
    const timestamp = index - ECONOMY.market.historyPoints
    for (const stock of stocks) historicalChange(stock, common + sectors[stock.sector] + (sample() * 2 - 1) * stock.volatility, timestamp)
    historicalChange(gold, (sample() * 2 - 1) * ECONOMY.market.historyGoldVolatility, timestamp)
    historicalChange(bond, (sample() * 2 - 1) * ECONOMY.market.historyBondVolatility, timestamp)
  }
  const rebase = (instrument: MarketInstrument, initial: number) => {
    const scale = initial / instrument.currentPrice
    instrument.currentPrice = initial
    instrument.priceHistory = instrument.priceHistory.map(point => {
      const priceBefore = Math.round(point.priceBefore * scale)
      const priceAfter = Math.round(point.priceAfter * scale)
      return { ...point, priceBefore, priceAfter, returnRate: priceAfter / priceBefore - 1 }
    })
  }
  stocks.forEach(stock => rebase(stock, ECONOMY.market.initialStockPrice))
  rebase(gold, ECONOMY.market.initialGoldPrice); rebase(bond, ECONOMY.bond.facePrice)
  return { ...(catalogVersion ? { catalogVersion } : {}), historySeed, stocks, gold, bond, appliedShocks: [], normalLaps: [] }
}

function change(instrument: MarketInstrument, rate: number, s: GameState, kind: 'normal' | 'shock', eventId?: string) {
  const priceBefore = instrument.currentPrice
  const priceAfter = Math.max(1, Math.round(priceBefore * (1 + Math.max(ECONOMY.market.minimumReturn, rate))))
  instrument.currentPrice = priceAfter
  instrument.priceHistory = [...instrument.priceHistory, { timestamp: s.turn, lap: s.lap, kind, ...(eventId ? { eventId } : {}), priceBefore, priceAfter, returnRate: priceAfter / priceBefore - 1 }]
}

// Aggregate portfolio fields are derived views; instruments and units own valuation.
export function syncValuations(s: GameState): GameState {
  s.portfolio.stocks = Math.round(s.market.stocks.reduce((sum, stock) => sum + stock.currentPrice * (s.stockHoldings[stock.id]?.units ?? 0), 0))
  s.portfolio.gold = Math.round(s.goldUnits * s.market.gold.currentPrice)
  s.portfolio.bonds = hasBondCredit(s) ? creditBondLots(s).reduce((sum, item) => sum + item.quote.gross, 0)
    : Math.round(s.bondLots.filter(lot => lot.status === 'active').reduce((sum, lot) => sum + lot.units * s.market.bond.currentPrice, 0))
  s.portfolio.savings = s.deposits.filter(lot => lot.status === 'active').reduce((sum, lot) => sum + lot.principal, 0)
  s.portfolio.business = Math.round(s.business.recoverableCapital)
  return s
}

export function applyMacroShock(state: GameState, eventId: string): GameState {
  const event = MACRO_EVENTS.find(event => event.id === eventId)
  if (!event) throw new Error('Sự kiện kinh tế không hợp lệ.')
  const key = `${state.turn}:${eventId}`
  if (state.market.appliedShocks.includes(key)) return state
  const before = snapshot(state)
  const s = copyState(state)
  for (const stock of s.market.stocks) change(stock, event.stocks[stock.sector as keyof typeof event.stocks], s, 'shock', eventId)
  if (hasBondCredit(s)) applyCreditMacro(s, eventId)
  else change(s.market.bond, event.bonds, s, 'shock', eventId)
  change(s.market.gold, event.gold, s, 'shock', eventId)
  s.business.economicMultiplier = Math.max(ECONOMY.business.minimumEconomicMultiplier,
    Math.min(ECONOMY.business.maximumEconomicMultiplier, s.business.economicMultiplier + event.business))
  s.business.recoverableCapital *= 1 + event.business
  s.market.appliedShocks = [...s.market.appliedShocks, key]
  syncValuations(s)
  return record(s, before, { kind: 'market', eventId, title: event.label, decision: 'Cú sốc kinh tế tức thời', consequence: 'Đã đổi báo giá từng mã, trái phiếu, vàng và trạng thái kinh doanh đúng một lần.' })
}

export function updateNormalMarket(state: GameState): GameState {
  if (state.market.normalLaps.includes(state.lap)) return state
  const before = snapshot(state)
  const s = copyState(state)
  const scenario = SCENARIOS.find(scenario => scenario.id === s.scenarioId)!
  const sample = ([low, high]: [number, number]) => low + draw(s) * (high - low)
  const common = sample(scenario.ranges.stocks)
  const sectors = Object.fromEntries([...new Set(s.market.stocks.map(stock => stock.sector))].map(sector => [sector, (draw(s) * 2 - 1) * ECONOMY.market.sectorVolatility]))
  for (const stock of s.market.stocks) change(stock, common + sectors[stock.sector] + (draw(s) * 2 - 1) * stock.volatility, s, 'normal')
  // Consume the historical draw to preserve every other instrument/dice sequence.
  const bondRate = sample(scenario.ranges.bonds)
  if (hasBondCredit(s)) updateCreditMarket(s)
  else change(s.market.bond, bondRate, s, 'normal')
  change(s.market.gold, sample(scenario.ranges.gold), s, 'normal')
  const businessReturn = sample(scenario.ranges.business)
  s.business.recoverableCapital *= Math.max(0, 1 + businessReturn - ECONOMY.business.depreciation)
  s.market.normalLaps = [...s.market.normalLaps, s.lap]
  syncValuations(s)
  return record(s, before, { kind: 'market', title: `Giá thông thường vòng ${s.lap}`, decision: 'Cập nhật thị trường tại START', consequence: 'Tính từ báo giá hiện tại sau cú sốc; không áp lại sự kiện kinh tế.' })
}
