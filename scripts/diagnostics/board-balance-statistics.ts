import { aggregate } from './game-length-statistics.ts'
import { distribution } from './game-length-model.ts'
import { allocation, tileTypes, withBoard } from './board-balance-model.ts'
import type { BoardRun, Layout } from './board-balance-model.ts'

const average = (values: number[]) => values.reduce((sum,n) => sum+n,0) / values.length
const rate = (values: boolean[]) => average(values.map(Number))
export function summarizeBoard(rows: BoardRun[], layout: Layout) {
  const auditKeys = ['meaningfulEncounters','mandatoryChoices','meaningfulTransactions','investmentOpportunities',
    'fundedInvestmentOpportunities','unavailableInvestmentOpportunities','macroBeforeInvestment','shockLaps',
    'multiShockLaps','priceDirectionFlips','courseAffordableEarly','courseLateFirstVisit','forcedSales',
    'forcedSaleAmount','forcedWithdrawals','lostInterest','terminalIgnoredLandings'] as const
  const typeKeys = ['visits','legalAvailable','budgetAvailable','targeted','eligible','blockedCash','blockedHorizon',
    'blockedCap','redundant','purchaseAvailable','purchaseBudgetAvailable','upgradeAvailable','saleAvailable','transactions'] as const
  const auditMetrics = Object.fromEntries(auditKeys.map(key => [key, distribution(rows.map(row => row.audit[key]))!]))
  const byType = Object.fromEntries(tileTypes.map(type => [type, {
    metrics: Object.fromEntries(typeKeys.map(key => [key, distribution(rows.map(row => row.audit.types[type][key]))!])),
    neverRate: rate(rows.map(row => row.audit.types[type].visits === 0)),
    noEarlyVisitRate: rate(rows.map(row => row.audit.types[type].byLap.slice(0,3).every(n => n === 0))),
    noFundedOpportunityRate: ['bank','stocks','bonds','gold','business'].includes(type)
      ? rate(rows.map(row => row.audit.types[type].budgetAvailable === 0)) : null,
    byLap: [0,1,2,3].map(lap => ({ mean: average(rows.map(row => row.audit.types[type].byLap[lap])),
      neverRate: rate(rows.map(row => row.audit.types[type].byLap[lap] === 0)) })),
    firstLapHistogram: Object.fromEntries([1,2,3,4,null].map(lap => [lap ?? 'never', rows.filter(row => row.audit.types[type].firstLap === lap).length])),
  }]))
  const tile = (index: number) => ({ position: index + 1, type: layout.types[index],
    rawLandings: distribution(rows.map(row => row.audit.rawLandings[index])),
    resolvedEvents: distribution(rows.map(row => row.audit.resolvedVisits[index])),
    noResolvedEventRate: rate(rows.map(row => row.audit.resolvedVisits[index] === 0)),
    resolvedByLap: [0,1,2,3].map(lap => average(rows.map(row => row.audit.resolvedByLap[lap][index]))),
  })
  const covariance = (a: number[], b: number[]) => {
    const ma = average(a); const mb = average(b)
    return average(a.map((n,i) => (n-ma)*(b[i]-mb)))
  }
  const funds = rows.map(row => row.run.funds)
  const living = rows.map(row => row.run.livingPaid)
  const extra = rows.map(row => row.run.extraordinaryPaid)
  const correlation = (a: number[], b: number[]) => {
    const denominator = Math.sqrt(covariance(a,a)*covariance(b,b))
    return denominator ? covariance(a,b)/denominator : null
  }
  const normalLogAbs = Array.from({ length: 8 }, (_,i) => average(rows.map(row => row.audit.normalLogAbs[i])))
  const shockLogAbs = Array.from({ length: 8 }, (_,i) => average(rows.map(row => row.audit.shockLogAbs[i])))
  return {
    summary: withBoard(layout, () => aggregate(rows.map(row => row.run))), auditMetrics, byType,
    tiles: layout.types.map((_,index) => tile(index)),
    actualTransactionRates: Object.fromEntries(['bank','stocks','bonds','gold','business','course'].map(type => [type,
      rate(rows.map(row => row.audit.types[type as keyof typeof row.audit.types].transactions > 0))])),
    forcedSaleRate: rate(rows.map(row => row.audit.forcedSales > 0)),
    forcedWithdrawalRate: rate(rows.map(row => row.audit.forcedWithdrawals > 0)),
    courseUnavailableEarlyRate: rate(rows.map(row => row.audit.courseAffordableEarly === 0)),
    coursePurchaseLapHistogram: Object.fromEntries([1,2,3,4,null].map(lap => [lap ?? 'never', rows.filter(row => row.audit.coursePurchaseLap === lap).length])),
    exposure: { normalLogAbs, shockLogAbs,
      shockShareAbsoluteLogMove: shockLogAbs.map((n,i) => n / (n + normalLogAbs[i])),
      meanPriceDirectionFlipShare: average(rows.map(row => row.audit.priceDirectionFlips / 32)),
      fractionLapsWithShock: average(rows.map(row => row.audit.shockLaps / 4)),
      fractionLapsWithMultipleShocks: average(rows.map(row => row.audit.multiShockLaps / 4)),
    },
    covariance: { fundsVariance: covariance(funds,funds), livingVariance: covariance(living,living),
      extraVariance: covariance(extra,extra), livingExtraCovariance: covariance(living,extra),
      fundsLivingCorrelation: correlation(funds,living), fundsExtraCorrelation: correlation(funds,extra) },
  }
}

// Exact renewal calculation for an ideal independent, fair d6. The application RNG
// is unchanged. Ignore terminal non-START landings just as the engine does.
export function movementExpectation(layout: Layout, horizon = 4) {
  const size = layout.types.length; const end = horizon * size
  const p = Array(end + 6).fill(0) as number[]; p[0] = 1
  for (let m = 0; m < end; m++) for (let die = 1; die <= 6; die++) p[m + die] += p[m] / 6
  const visitsByTile = layout.types.map((_,i) => p.reduce((sum,probability,m) =>
    sum + (m > 0 && m < end && m % size === i && i !== 0 ? probability : 0), 0))
  const neverRateByType = Object.fromEntries(tileTypes.filter(type => type !== 'start').map(type => {
    const q = Array(end + 6).fill(0) as number[]; q[0] = 1
    let never = 0
    for (let m = 0; m < end; m++) for (let die = 1; die <= 6; die++) {
      const next = m + die; const mass = q[m] / 6
      if (next >= end) never += mass
      else if (layout.types[next % size] !== type) q[next] += mass
    }
    return [type, never]
  }))
  return { allocation: allocation(layout), expectedRolls: p.slice(0,end).reduce((sum,n) => sum+n,0),
    expectedRollsPerLap: p.slice(0,end).reduce((sum,n) => sum+n,0)/horizon,
    expectedResolvedVisitsByTile: visitsByTile,
    expectedResolvedVisitsByType: Object.fromEntries(tileTypes.map(type => [type,
      visitsByTile.reduce((sum,n,i) => sum + (layout.types[i] === type ? n : 0),0)])), neverRateByType }
}
export type BoardSummary = ReturnType<typeof summarizeBoard>
