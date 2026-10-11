import { BOARD } from '../../src/data/board.ts'
import { distribution } from './game-length-model.ts'
import type { Run } from './game-length-model.ts'

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
const rate = (runs: Run[], condition: (run: Run) => boolean) => runs.length ? runs.filter(condition).length / runs.length : null
const histogram = (values: (number | null)[]) => Object.fromEntries([...new Set(values)].sort((a, b) => (a ?? Infinity) - (b ?? Infinity)).map(value => [value ?? 'never', values.filter(item => item === value).length]))

export function aggregate(runs: Run[]) {
  const numericKeys = ['funds', 'shortfall', 'debt', 'completedLaps', 'livingCount', 'livingPaid', 'livingDue',
    'extraordinaryPaid', 'extraordinaryDue', 'financialShocks', 'macroShocks', 'rolls', 'eventDecisions',
    'alternativeChoices', 'voluntaryActions', 'fundingDecisions', 'financialDecisions', 'monetaryDecisions',
    'uiEventInterruptions', 'uiCheckpointInterruptions', 'courseCost', 'salary', 'baseSalary', 'courseSalary',
    'bonus', 'savingsInterest', 'investmentProfit', 'debtInterest', 'shortageEpisodes', 'shortageAmount',
    'businessEncounters', 'businessCosts', 'businessIncome', 'businessResale', 'businessUpgrades',
    'businessLockedQuote', 'businessCashContribution', 'businessMarkedProfit', 'terminalSavings'] as const
  const metrics = Object.fromEntries(numericKeys.map(key => [key, distribution(runs.map(run => run[key]))!])) as Record<typeof numericKeys[number], NonNullable<ReturnType<typeof distribution>>>
  const buyers = runs.filter(run => run.businessBought)
  const sellers = buyers.filter(run => run.businessSold)
  const locked = buyers.filter(run => run.businessLocked)
  const wins = runs.filter(run => run.won).length
  const p = wins / runs.length
  const z = 1.96; const n = runs.length; const denominator = 1 + z * z / n
  const center = (p + z * z / (2 * n)) / denominator
  const half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denominator
  const reach = (key: 'first90Lap' | 'first90Checkpoint') => ({
    histogram: histogram(runs.map(run => run[key])), neverRate: rate(runs, run => run[key] === null),
    reachedLap: distribution(runs.flatMap(run => run[key] === null ? [] : [run[key]!])),
    reachedThenLostRate: rate(runs, run => run[key] !== null && !run.won),
  })
  const cohort = (items: Run[]) => ({ n: items.length, winRate: rate(items, run => run.won), funds: distribution(items.map(run => run.funds)) })
  return { n, wins, winRate: p, winRateWilson95: [center - half, center + half], metrics,
    insolvencyRate: rate(runs, run => run.termination === 'insolvent'),
    everBorrowedRate: rate(runs, run => run.everBorrowed), terminalDebtRate: rate(runs, run => run.debt > 0),
    courseUptake: rate(runs, run => run.course),
    accountingResidualMax: Math.max(...runs.map(run => Math.abs(run.accountingResidual))),
    first90: { actionBoundary: reach('first90Lap'), postSettlement: reach('first90Checkpoint') },
    business: { buyRate: buyers.length / n, purchaseLap: distribution(buyers.map(run => run.purchaseLap!)),
      purchaseLapHistogram: histogram(buyers.map(run => run.purchaseLap)),
      noEligibleTileRate: rate(runs, run => run.eligibleBusinessEncounters === 0),
      returnAfterPurchaseRate: rate(buyers, run => run.businessReturnsAfterPurchase > 0),
      meanReturnsAfterPurchaseGivenBought: buyers.length ? mean(buyers.map(run => run.businessReturnsAfterPurchase)) : null,
      upgradeRate: rate(runs, run => run.businessUpgrades > 0), upgradeRateGivenBought: rate(buyers, run => run.businessUpgrades > 0),
      upgradesGivenBought: distribution(buyers.map(run => run.businessUpgrades)),
      incomeGivenBought: distribution(buyers.map(run => run.businessIncome)),
      costsGivenBought: distribution(buyers.map(run => run.businessCosts)),
      resaleGivenSold: distribution(sellers.map(run => run.businessResale)),
      saleRate: sellers.length / n, saleRateGivenBought: rate(buyers, run => run.businessSold),
      lockedRate: locked.length / n, lockedRateGivenBought: rate(buyers, run => run.businessLocked),
      realizedProfitGivenSold: distribution(sellers.map(run => run.businessRealizedProfit!)),
      realizedProfitPositiveRateGivenSold: rate(sellers, run => run.businessRealizedProfit! > 0),
      cashContributionGivenBought: distribution(buyers.map(run => run.businessCashContribution)),
      markedProfitGivenBought: distribution(buyers.map(run => run.businessMarkedProfit)),
      markedProfitPositiveRateGivenBought: rate(buyers, run => run.businessMarkedProfit > 0),
      profitableButLockedRate: rate(runs, run => run.businessLocked && run.businessMarkedProfit > 0),
      profitableButLockedRateGivenBought: rate(buyers, run => run.businessLocked && run.businessMarkedProfit > 0),
      profitableButLockedRateGivenLocked: rate(locked, run => run.businessMarkedProfit > 0),
      lockedQuoteGivenLocked: distribution(locked.map(run => run.businessLockedQuote)),
      buyerCohort: cohort(buyers), sellerCohort: cohort(sellers), lockedCohort: cohort(locked), nonbuyerCohort: cohort(runs.filter(run => !run.businessBought)) },
    meanStopsByTile: BOARD.map(tile => ({ index: tile.index, type: tile.type, label: tile.label,
      mean: mean(runs.map(run => run.stopsByTile[tile.index])), noStopRate: rate(runs, run => run.stopsByTile[tile.index] === 0) })),
    termination: { completed: runs.filter(run => run.termination === 'completed').length, insolvent: runs.filter(run => run.termination === 'insolvent').length },
  }
}

// Projection uses exactly the published baseline's field names and quantile convention.
export function legacyProjection(runs: Run[]) {
  const dist = (key: 'funds' | 'debt' | 'shortfall') => {
    const { p10, median, p90, mean } = distribution(runs.map(run => run[key]))!
    return { p10, median, p90, mean }
  }
  const wins = runs.filter(run => run.won).length
  const p90 = (values: number[]) => distribution(values)!.p90
  return { seeds: runs.length, wins, winRate: wins / runs.length, funds: dist('funds'), debt: dist('debt'), shortfall: dist('shortfall'),
    shortages: runs.reduce((sum, run) => sum + run.shortageEpisodes, 0), meanShortageAmount: mean(runs.map(run => run.shortageAmount)),
    indebtedRate: rate(runs, run => run.debt > 0), courseUptake: rate(runs, run => run.course),
    business: { meanEncounters: mean(runs.map(run => run.businessEncounters)), repeatEncounterRate: rate(runs, run => run.businessEncounters >= 2),
      noEncounterRate: rate(runs, run => run.businessEncounters === 0), buyRate: rate(runs, run => run.businessBought),
      upgradeRate: rate(runs, run => run.businessUpgrades > 0), saleRate: rate(runs, run => run.businessSold),
      meanUpgrades: mean(runs.map(run => run.businessUpgrades)), lockedAtFinishRate: rate(runs, run => run.businessLocked) },
    stockBuyRate: rate(runs, run => run.stockBuys > 0),
    living: { mean: mean(runs.map(run => run.livingCount)), p90: p90(runs.map(run => run.livingCount)) },
    macro: { mean: mean(runs.map(run => run.macroShocks)), p90: p90(runs.map(run => run.macroShocks)) },
    meanRolls: mean(runs.map(run => run.rolls)),
    meanTileVisits: Object.fromEntries(Object.keys(runs[0].visits).map(type => [type, mean(runs.map(run => run.visits[type]))])),
    noEncounterRateByType: Object.fromEntries(Object.keys(runs[0].visits).map(type => [type, rate(runs, run => run.visits[type] === 0)])),
    meanStopsByTile: BOARD.map(tile => ({ index: tile.index, label: tile.label, type: tile.type,
      mean: mean(runs.map(run => run.stopsByTile[tile.index])), noStopRate: rate(runs, run => run.stopsByTile[tile.index] === 0) })),
    termination: { completed: runs.filter(run => run.termination === 'completed').length, insolvent: runs.filter(run => run.termination === 'insolvent').length } }
}

export function paired(a: Run[], reference: Run[]) {
  if (a.length !== reference.length || a.some((run, index) => run.seed !== reference[index].seed)) throw new Error('Unpaired seeds')
  const winDifference = a.map((run, index) => Number(run.won) - Number(reference[index].won))
  const delta = mean(winDifference)
  const variance = winDifference.reduce((sum, value) => sum + (value - delta) ** 2, 0) / Math.max(1, a.length - 1)
  const half = 1.96 * Math.sqrt(variance / a.length)
  return { seeds: a.length, meanWinRateDifference: delta, pairedWinDifferenceNormal95: [delta - half, delta + half],
    fundsDifference: distribution(a.map((run, index) => run.funds - reference[index].funds)),
    higherFundsRate: a.filter((run, index) => run.funds > reference[index].funds).length / a.length,
    winOnlyStrategyRate: a.filter((run, index) => run.won && !reference[index].won).length / a.length,
    winOnlyReferenceRate: a.filter((run, index) => !run.won && reference[index].won).length / a.length,
  }
}
