// Offline only. Reuses the validated engine and horizon-aware policies unchanged.
import assert from 'node:assert/strict'
import { BOARD } from '../../src/data/board.ts'
import { ECONOMY, RULES } from '../../src/data/config.ts'
import { EVENTS } from '../../src/data/events.ts'
import type { Snapshot, TileType } from '../../src/game/types.ts'
import { playDiagnostic } from './game-length-model.ts'
import type { Strategy } from './game-length-model.ts'

export interface Layout { id: string; types: TileType[]; rationale: string }
const original = BOARD.map(tile => tile.type)
export const layouts: Layout[] = [
  { id: 'A20', types: [...original], rationale: 'Bàn hiện tại, đối chứng.' },
  { id: 'B20', types: original.map((type, i) => i === 16 ? 'business' : type),
    rationale: 'Chỉ thay khóa học ô 17 bằng kinh doanh; giữ khóa học ô 5. Đo thay số lượng tối thiểu, kể cả nhược điểm hai ô kinh doanh liền nhau.' },
  { id: 'C20', types: original.map((type, i) => i === 13 ? 'business' : type),
    rationale: 'Chỉ thay macro ô 14 bằng kinh doanh; giữ macro ô 6. Tách tác động giảm macro khỏi giảm khóa học.' },
  { id: 'D20', types: ['start','bank','course','living','stocks','macro','business','personal','bonds','gold',
    'obligation','bank','course','living','stocks','macro','business','personal','bonds','gold'],
    rationale: 'Giữ mọi số lượng; từng cặp cách 10 ô. Khóa học đến sớm hơn, kinh doanh ở ô 7/17 thay 9/16.' },
  { id: 'E20', types: ['start','business','course','living','stocks','macro','bank','personal','business','gold',
    'obligation','bonds','bank','living','stocks','business','gold','personal','macro','bonds'],
    rationale: 'Cùng số lượng với B; kinh doanh ô 2/9/16, khoảng 7/7/6, khóa học ô 3. So B để phân biệt cùng phân bổ nhưng khác vị trí.' },
  { id: 'F16', types: ['start','bank','course','living','stocks','macro','business','personal',
    'obligation','bonds','course','living','gold','macro','business','personal'],
    rationale: '16 ô: bỏ một bank/stock/bond/gold; giữ hai business/course/living/personal/macro và một Dòng tiền. Kinh doanh cách 8 ô.' },
  { id: 'G24', types: ['start','bank','course','living','stocks','macro','business','personal','bonds','gold','obligation','bank',
    'course','business','living','stocks','gold','macro','bank','personal','business','bonds','gold','bonds'],
    rationale: '24 ô: thêm một business/bank/bond/gold so A; không thêm nghĩa vụ hoặc shock. Business ô 7/14/21; lấp khoảng bằng tài sản thay phí.' },
]
export const tileTypes = [...new Set(original)]
export function allocation(layout: Layout) {
  return Object.fromEntries(tileTypes.map(type => [type, layout.types.filter(t => t === type).length]))
}
export function withBoard<T>(layout: Layout, work: () => T): T {
  assert.ok([16,20,24].includes(layout.types.length))
  assert.equal(layout.types[0], 'start')
  assert.equal(layout.types.filter(type => type === 'start').length, 1)
  const saved = BOARD.slice(); const tiles = RULES.tiles
  const experiment = layout.types.map((type, index) => {
    const template = saved.find(tile => tile.type === type)
    assert.ok(template)
    return { ...template, index }
  })
  BOARD.splice(0, BOARD.length, ...experiment); RULES.tiles = experiment.length
  try { return work() } finally { BOARD.splice(0, BOARD.length, ...saved); RULES.tiles = tiles }
}
const investmentTypes: TileType[] = ['bank','stocks','bonds','gold','business']
const levels = (s: Snapshot) => Object.values(s.business.upgrades).reduce((sum, n) => sum + n, 0)
function canInvest(s: Snapshot, type: TileType, reserve: number) {
  const cash = s.portfolio.cash - reserve
  if (type === 'business') return s.business.capital > 0 || cash >= ECONOMY.business.cost
  return cash >= (reserve ? 1_000_000 : 1)
}
export function playBoard(seed: string, strategy: Strategy, layout: Layout) {
  return withBoard(layout, () => {
    const { run, state } = playDiagnostic(seed, strategy, 4)
    const rawLandings = layout.types.map(() => 0)
    const resolvedVisits = layout.types.map(() => 0)
    const resolvedByLap = Array.from({ length: 4 }, () => layout.types.map(() => 0))
    const types = Object.fromEntries(tileTypes.map(type => [type, {
      visits: 0, byLap: [0,0,0,0], firstLap: null as number | null,
      legalAvailable: 0, budgetAvailable: 0, targeted: 0, eligible: 0,
      blockedCash: 0, blockedHorizon: 0, blockedCap: 0, redundant: 0,
      purchaseAvailable: 0, purchaseBudgetAvailable: 0, upgradeAvailable: 0, saleAvailable: 0, transactions: 0,
    }])) as Record<TileType, { visits: number; byLap: number[]; firstLap: number | null;
      legalAvailable: number; budgetAvailable: number; targeted: number; eligible: number;
      blockedCash: number; blockedHorizon: number; blockedCap: number; redundant: number;
      purchaseAvailable: number; purchaseBudgetAvailable: number; upgradeAvailable: number; saleAvailable: number; transactions: number }>
    const rolls = state.log.filter(entry => entry.kind === 'roll')
    for (const entry of rolls) rawLandings[entry.after.position]++
    const finalRawPosition = rolls.at(-1)!.after.position
    const firstEvent = new Map<number, Snapshot>()
    const transactionTurns = new Set<number>()
    for (const entry of state.log) {
      if (entry.kind === 'rebalancing' || entry.kind === 'decision') {
        if (!firstEvent.has(entry.turn)) firstEvent.set(entry.turn, entry.before)
        if (entry.kind === 'rebalancing') transactionTurns.add(entry.turn)
      }
    }
    let meaningfulEncounters = 0; let investmentOpportunities = 0
    let fundedInvestmentOpportunities = 0; let unavailableInvestmentOpportunities = 0
    let mandatoryChoices = 0; let macroBeforeInvestment = 0; let meaningfulTransactions = 0
    let courseAffordableEarly = 0; let courseLateFirstVisit = 0
    const exitLap = strategy === 'business-exit-window' ? 3 : 4
    for (const entry of state.log.filter(entry => entry.kind === 'decision')) {
      const s = firstEvent.get(entry.turn)!
      const type = layout.types[entry.tileId]
      const item = types[type]
      item.visits++; item.byLap[s.lap - 1]++; item.firstLap ??= s.lap
      resolvedVisits[entry.tileId]++; resolvedByLap[s.lap - 1][entry.tileId]++
      const event = EVENTS.find(event => event.id === entry.eventId)!
      let meaningful = false
      if (investmentTypes.includes(type)) {
        investmentOpportunities++
        const legal = canInvest(s, type, 0)
        const funded = canInvest(s, type, 10_000_000)
        item.legalAvailable += Number(legal); item.budgetAvailable += Number(funded)
        fundedInvestmentOpportunities += Number(funded)
        meaningful ||= legal
        if (s.market.stocks[0].priceHistory.some(point => point.kind === 'shock' && point.lap === s.lap)) macroBeforeInvestment++
        const targeted = strategy === 'diversified' ||
          (type === 'bank' && ['saving-heavy','saving-no-course'].includes(strategy)) ||
          (type === 'stocks' && strategy === 'stock-heavy') ||
          (type === 'business' && ['business-heavy','business-exit-window'].includes(strategy))
        if (targeted) {
          item.targeted++
          const lateEmptyBusiness = type === 'business' && s.business.capital === 0 && s.lap >= exitLap
          if (lateEmptyBusiness) item.blockedHorizon++
          else if (type === 'business' && s.business.capital > 0 && s.lap < exitLap && levels(s) >= ECONOMY.business.maxUpgrades) item.blockedCap++
          else if ((type === 'business' && s.business.capital > 0 && s.lap < exitLap)
            ? s.portfolio.cash - 10_000_000 < ECONOMY.business.upgradeCost : !funded) {
            item.blockedCash++; unavailableInvestmentOpportunities++
          }
          else item.eligible++
        }
        if (type === 'business') {
          item.purchaseAvailable += Number(s.business.capital === 0 && s.portfolio.cash >= ECONOMY.business.cost)
          item.purchaseBudgetAvailable += Number(s.business.capital === 0 && s.portfolio.cash - 10_000_000 >= ECONOMY.business.cost)
          item.upgradeAvailable += Number(s.business.capital > 0 && levels(s) < ECONOMY.business.maxUpgrades && s.portfolio.cash >= ECONOMY.business.upgradeCost)
          item.saleAvailable += Number(s.business.capital > 0)
        }
      } else if (type === 'course') {
        const legal = !s.coursePurchased && s.portfolio.cash >= RULES.courseCost
        item.legalAvailable += Number(legal)
        item.redundant += Number(s.coursePurchased)
        if (s.lap <= 3 && legal) courseAffordableEarly++
        if (item.firstLap === 4 && item.visits === 1) courseLateFirstVisit++
        if (!s.coursePurchased && s.portfolio.cash < RULES.courseCost) item.blockedCash++
        if (!s.coursePurchased && s.lap === 4) item.blockedHorizon++
        meaningful ||= legal
      } else if (event.options.length > 1) { meaningful = true; mandatoryChoices++ }
      meaningfulEncounters += Number(meaningful)
      if (transactionTurns.has(entry.turn) || (type === 'course' && entry.decisionId === 'upgrade')) {
        item.transactions++; meaningfulTransactions++
      }
    }
    // Exact START landings are distinct from crossing START. Both settle once;
    // start visits have no event dialog and are not in resolvedVisits.
    types.start.visits = rawLandings[0]
    for (const entry of rolls.filter(entry => entry.after.position === 0)) types.start.byLap[entry.lap - 1]++
    types.start.firstLap = rolls.find(entry => entry.after.position === 0)?.lap ?? null
    const funding = state.log.filter(entry => entry.kind === 'funding')
    const macroByLap = types.macro.byLap
    const normalLogAbs = Array(8).fill(0) as number[]
    const shockLogAbs = Array(8).fill(0) as number[]
    const normalNet = Array.from({ length: 4 }, () => Array(8).fill(0) as number[])
    const shockNet = Array.from({ length: 4 }, () => Array(8).fill(0) as number[])
    const prices = (s: Snapshot) => [...s.market.stocks.map(stock => stock.currentPrice), s.market.bond.currentPrice, s.market.gold.currentPrice]
    for (const entry of state.log.filter(entry => entry.kind === 'market')) {
      const before = prices(entry.before); const after = prices(entry.after)
      const shock = !!entry.eventId
      after.forEach((price, i) => {
        const change = Math.log(price / before[i])
        ;(shock ? shockLogAbs : normalLogAbs)[i] += Math.abs(change)
        ;(shock ? shockNet : normalNet)[entry.lap - 1][i] += change
      })
    }
    let priceDirectionFlips = 0
    normalNet.forEach((normal, lap) => normal.forEach((n, i) => {
      priceDirectionFlips += Number(Math.sign(n) !== Math.sign(n + shockNet[lap][i]))
    }))
    const courseEntry = state.log.find(entry => entry.kind === 'decision' && entry.eventId === 'course' && entry.decisionId === 'upgrade')
    const audit = { rawLandings, resolvedVisits, resolvedByLap, types,
      finalRawPosition, terminalIgnoredLandings: Number(state.termination === 'completed' && finalRawPosition !== 0),
      meaningfulEncounters, mandatoryChoices, meaningfulTransactions,
      investmentOpportunities, fundedInvestmentOpportunities, unavailableInvestmentOpportunities,
      macroBeforeInvestment, macroByLap, shockLaps: macroByLap.filter(n => n > 0).length,
      multiShockLaps: macroByLap.filter(n => n > 1).length, normalLogAbs, shockLogAbs,
      priceDirectionFlips, courseAffordableEarly, courseLateFirstVisit,
      coursePurchaseLap: courseEntry?.lap ?? null,
      forcedSales: funding.filter(entry => entry.forcedAssetSaleAmount > 0).length,
      forcedSaleAmount: funding.reduce((sum, entry) => sum + entry.forcedAssetSaleAmount, 0),
      forcedWithdrawals: funding.filter(entry => entry.forcedWithdrawalAmount > 0).length,
      lostInterest: funding.reduce((sum, entry) => sum + entry.lostSavingsInterest, 0),
      courseTransactions: Number(run.course),
    }
    assert.equal(types.macro.visits, run.macroShocks)
    assert.equal(resolvedVisits.reduce((a,b) => a+b, 0), run.eventDecisions)
    assert.equal(rawLandings.reduce((a,b) => a+b, 0), run.rolls)
    return { run, audit }
  })
}
export type BoardRun = ReturnType<typeof playBoard>
