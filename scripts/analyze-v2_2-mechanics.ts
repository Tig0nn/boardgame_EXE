import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, createWriteStream } from 'node:fs'
import { once } from 'node:events'
import { finished } from 'node:stream/promises'
import { createGzip } from 'node:zlib'
import { ECONOMY, RULES, SCENARIOS, MACRO_EVENTS } from '../src/data/config.ts'
import { C20_BOARD } from '../src/data/board.ts'
import { distribution } from './diagnostics/game-length-model.ts'
import { experiments, playMechanics } from './diagnostics/mechanics-model.ts'
import type { Experiment } from './diagnostics/mechanics-model.ts'
import { numericMetrics } from './diagnostics/mechanics-statistics.ts'

const count = Number(process.argv[2] ?? 5000)
assert.ok(Number.isSafeInteger(count) && count >= 10 && count <= 5000)
const folder = 'docs/simulations'
const hash = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')
const protectedHashes = JSON.parse(readFileSync(`${folder}/v2_2-protected-hashes.json`, 'utf8').replace(/^\uFEFF/, '')) as Record<string, string>
const verifyProtected = () => {
  for (const [file, expected] of Object.entries(protectedHashes)) assert.equal(hash(readFileSync(file)), expected, `Protected: ${file}`)
}
verifyProtected()
const configBefore = JSON.stringify({ RULES, ECONOMY, SCENARIOS, MACRO_EVENTS, C20_BOARD })
const gzip = createGzip({ level: 9 })
const destination = createWriteStream(`${folder}/v2_2-mechanics-runs.jsonl.gz`)
gzip.pipe(destination)
const all = {} as Record<Experiment, ReturnType<typeof compact>[]>
const results: Record<string, unknown> = {}
const examples: Record<string, unknown> = {}

function compact(seed: string, experiment: Experiment) {
  const { run, state } = playMechanics(seed, experiment)
  const { path, checkpoints, ...scalar } = run
  assert.equal(checkpoints.length, run.completedLaps)
  const sum = (fn: (e: typeof state.log[number]) => number) => state.log.reduce((n, e) => n + fn(e), 0)
  const assetCosts = -sum(e => ['buy-stocks', 'buy-bonds', 'buy-gold'].includes(e.decisionId ?? '') ? e.cashDelta : 0)
  const invested = assetCosts + (experiment.startsWith('saving') ? (experiment === 'saving-30M' ? 30_000_000 : 40_000_000) : experiment === 'diversified' ? 15_000_000 : 0) +
    sum(e => e.kind === 'rebalancing' && e.decisionId === 'deposit-bank' ? -e.cashDelta : 0)
  return { ...scalar, experiment, pathHash: hash(JSON.stringify(path)), assetCosts, invested,
    forcedSale: sum(e => e.forcedAssetSaleAmount), withdrawn: sum(e => e.forcedWithdrawalAmount),
    lostInterest: sum(e => e.lostSavingsInterest), businessLockedCost: state.business.capital,
    averageSavingsLockedPerRoll: sum(e => e.kind === 'roll' ? e.before.portfolio.savings : 0) / run.rolls,
    purchaseCount: state.log.filter(e => e.kind === 'rebalancing' && e.decisionId?.startsWith('buy-')).length }
}
type Row = ReturnType<typeof compact>
function describe(rows: Row[]) {
  const boolean = Object.keys(rows[0]).filter(k => typeof rows[0][k as keyof Row] === 'boolean') as (keyof Row)[]
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  const funds = rows.map(r => r.funds); const avg = mean(funds)
  return { n: rows.length,
    metrics: numericMetrics(rows),
    rates: Object.fromEntries(boolean.map(k => [k, mean(rows.map(r => Number(r[k])))])),
    fundsStandardDeviation: Math.sqrt(mean(funds.map(x => (x - avg) ** 2))),
    investmentLossRate: mean(rows.map(r => Number(r.investmentProfit < 0))),
    macroHistogram: Object.fromEntries([...new Set(rows.map(r => r.macroShocks))].sort((a, b) => a - b).map(n => [n, rows.filter(r => r.macroShocks === n).length])),
    visits: Object.fromEntries(Object.keys(rows[0].visits).map(k => [k, { count: distribution(rows.map(r => r.visits[k])), never: mean(rows.map(r => Number(r.visits[k] === 0))) }])),
    insolvent: rows.filter(r => r.termination === 'insolvent').length,
    buyerCount: rows.filter(r => r.businessBought).length,
    saleRateGivenBought: mean(rows.filter(r => r.businessBought).map(r => Number(r.businessSold))),
    lockedRateGivenBought: mean(rows.filter(r => r.businessBought).map(r => Number(r.businessLocked))),
    realizedBusinessProfitGivenSold: distribution(rows.filter(r => r.businessSold).map(r => r.businessRealizedProfit!)),
    goalSensitivity: Object.fromEntries([80, 85, 90, 95, 100].map(m => [m, mean(rows.map(r => Number(r.termination === 'completed' && r.funds >= m * 1e6)))])) }
}
function paired(a: Experiment, b: Experiment) {
  const delta = all[a].map((r, i) => { assert.equal(r.seed, all[b][i].seed); return r.funds - all[b][i].funds })
  const mean = delta.reduce((x, y) => x + y, 0) / count
  const variance = delta.reduce((n, x) => n + (x - mean) ** 2, 0) / (count - 1)
  const winDelta = all[a].map((r, i) => Number(r.won) - Number(all[b][i].won))
  const winMean = winDelta.reduce((x, y) => x + y, 0) / count
  const half = 1.96 * Math.sqrt(variance / count)
  return { a, reference: b, deltaFunds: distribution(delta), meanFundsNormal95: [mean - half, mean + half],
    higherFundsRate: delta.filter(x => x > 0).length / count, winDifference: winMean,
    identicalPathCount: all[a].filter((r, i) => r.pathHash === all[b][i].pathHash).length }
}

for (const experiment of experiments) {
  const rows: Row[] = []
  for (let i = 0; i < count; i++) {
    const row = compact(`XVTL-V2-${i}`, experiment)
    assert.equal(row.accountingResidual, 0)
    rows.push(row)
    if (!gzip.write(JSON.stringify(row) + '\n')) await once(gzip, 'drain')
    if (i < 50 && (row.everBorrowed || row.businessSold || row.withdrawn > 0)) examples[`${experiment}/${row.seed}`] = {
      funds: row.funds, bought: row.businessBought, upgrades: row.businessUpgrades, sold: row.businessSold,
      withdrawn: row.withdrawn, borrowed: row.everBorrowed, macro: row.macroShocks }
  }
  all[experiment] = rows
  results[experiment] = describe(rows)
  assert.equal(JSON.stringify({ RULES, ECONOMY, SCENARIOS, MACRO_EVENTS, C20_BOARD }), configBefore)
  console.log(`${experiment}: ${count}, win ${(rows.filter(r => r.won).length / count * 100).toFixed(2)}%, median ${(distribution(rows.map(r => r.funds))!.median / 1e6).toFixed(3)}M`)
}
gzip.end()
await finished(destination)
const comparisons: [Experiment, Experiment][] = [
  ['cash-course', 'cash'], ['saving', 'cash-course'], ['saving-456', 'saving'], ['saving-30M', 'saving'],
  ['saving-debt-first', 'saving'], ['stocks-forecast', 'stocks'], ['stocks-momentum', 'stocks'],
  ['stocks-partial-funding', 'stocks'], ['bonds-yield', 'bonds'], ['gold-forecast', 'gold'],
  ['business-early', 'business-final'], ['business-final-no-upgrade', 'business-final'],
  ['business-early-no-upgrade', 'business-final-no-upgrade'], ['business-early-selective-upgrade', 'business-early-no-upgrade'],
]
verifyProtected()
writeFileSync(`${folder}/v2_2-mechanics-results.json`, JSON.stringify({ schema: 1, seedCount: count, totalGames: count * experiments.length,
  scenario: { mode: 'experimental-b', laps: 4, board: C20_BOARD.map(t => t.type), lawfulGoal: 90e6 },
  productionConfig: JSON.parse(configBefore), offlineSavingsCandidate: { 1: .04, 2: .05, 3: .06 },
  protectedFileCount: Object.keys(protectedHashes).length, productionHashesUnchanged: true,
  rawSha256: hash(readFileSync(`${folder}/v2_2-mechanics-runs.jsonl.gz`)),
  results, paired: comparisons.map(([a, b]) => paired(a, b)), examples }, null, 2) + '\n')
console.log(`Completed ${count * experiments.length} games; protected sources unchanged.`)
