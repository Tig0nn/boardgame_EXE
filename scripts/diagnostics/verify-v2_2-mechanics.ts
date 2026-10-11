// Independent artifact verification, including per-seed pairing and source protection.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream, readFileSync, writeFileSync } from 'node:fs'
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import { experiments } from './mechanics-model.ts'
import { distribution } from './game-length-model.ts'

const folder = 'docs/simulations'
const report = JSON.parse(readFileSync(`${folder}/v2_2-mechanics-results.json`, 'utf8'))
assert.equal(report.seedCount, 5000, 'Published review requires the full 5000-seed run')
assert.equal(report.totalGames, experiments.length * report.seedCount)
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const raw = `${folder}/v2_2-mechanics-runs.jsonl.gz`
assert.equal(digest(readFileSync(raw)), report.rawSha256)
const protectedFiles = JSON.parse(readFileSync(`${folder}/v2_2-protected-hashes.json`, 'utf8').replace(/^\uFEFF/, ''))
for (const [file, expected] of Object.entries(protectedFiles)) assert.equal(digest(readFileSync(file)), expected, file)
interface Row {
  seed: string; experiment: string; funds: number; won: boolean; pathHash: string
  accountingResidual: number; completedLaps: number; macroShocks: number; investmentProfit: number
  [key: string]: unknown
}
const groups: Record<string, Row[]> = {}
const lines = createInterface({ input: createReadStream(raw).pipe(createGunzip()), crlfDelay: Infinity })
for await (const line of lines) {
  const row: Row = JSON.parse(line)
  assert.ok(experiments.includes(row.experiment as typeof experiments[number]))
  const group = groups[row.experiment] ??= []
  assert.equal(row.seed, `XVTL-V2-${group.length}`)
  assert.equal(row.accountingResidual, 0)
  assert.equal(row.completedLaps, 4)
  assert.equal(row.won, row.funds >= 90e6)
  group.push(row)
}
let checkedNumericMetrics = 0
for (const id of experiments) {
  const rows = groups[id]
  assert.equal(rows.length, report.seedCount)
  const expected = report.results[id]
  for (const [key, value] of Object.entries(expected.metrics)) {
    assert.deepEqual(distribution(rows.flatMap(r => typeof r[key] === 'number' ? [r[key] as number] : [])), value, `${id}/${key}`)
    checkedNumericMetrics++
  }
  for (const [key, value] of Object.entries(expected.rates)) assert.equal(rows.filter(r => r[key]).length / rows.length, value)
  for (const [threshold, value] of Object.entries(expected.goalSensitivity)) {
    assert.equal(rows.filter(r => r.termination === 'completed' && r.funds >= Number(threshold) * 1e6).length / rows.length, value)
  }
  for (const [shocks, value] of Object.entries(expected.macroHistogram)) assert.equal(rows.filter(r => r.macroShocks === Number(shocks)).length, value)
  assert.equal(rows.filter(r => r.termination === 'insolvent').length, expected.insolvent)
  for (const row of rows) assert.equal(row.pathHash, groups.cash[Number(row.seed.split('-').at(-1))].pathHash)
}
for (const pair of report.paired) {
  const delta = groups[pair.a].map((r, i) => r.funds - groups[pair.reference][i].funds)
  assert.deepEqual(distribution(delta), pair.deltaFunds)
  assert.equal(pair.identicalPathCount, 5000)
}
assert.deepEqual(groups['business-early'].map(r => r.funds), groups['business-early-selective-upgrade'].map(r => r.funds))
// Recomputed legacy controls; the change from implicit scoped BOARD to explicit C20 must reproduce them.
for (const [id, win, median] of [
  ['cash', .2032, 81_500_000], ['saving', .6352, 94_894_600], ['stocks', .4628, 88_708_958],
  ['business-final', .4128, 86_400_000], ['diversified', .4286, 87_288_150],
] as const) {
  assert.equal(report.results[id].rates.won, win)
  assert.equal(report.results[id].metrics.funds.median, median)
}
const differences = (a: Row[], b: Row[], select: (row: Row) => boolean = () => true) => {
  const values = a.flatMap((r, i) => select(r) ? [r.funds - b[i].funds] : [])
  const d = distribution(values)!
  const sd = Math.sqrt(values.reduce((n, x) => n + (x - d.mean) ** 2, 0) / (values.length - 1))
  const half = 1.96 * sd / Math.sqrt(values.length)
  return { ...d, standardDeviation: sd, meanNormal95: [d.mean - half, d.mean + half] }
}
const verification = { totalGames: report.totalGames, seedCount: report.seedCount, checkedNumericMetrics,
  protectedFiles: Object.keys(protectedFiles).length, pairedPathsAllIdentical: true,
  incrementalFundsVsCashCourse: Object.fromEntries(experiments.map(id => [id, differences(groups[id], groups['cash-course'])])),
  momentumVsStocks: { noMacro: differences(groups['stocks-momentum'], groups.stocks, r => r.macroShocks === 0),
    macro: differences(groups['stocks-momentum'], groups.stocks, r => r.macroShocks > 0) } }
writeFileSync(`${folder}/v2_2-mechanics-verification.json`, JSON.stringify(verification, null, 2) + '\n')
console.log(`PASS ${report.totalGames} rows; ${checkedNumericMetrics} distributions; ${Object.keys(protectedFiles).length} protected files; paired paths exact.`)
