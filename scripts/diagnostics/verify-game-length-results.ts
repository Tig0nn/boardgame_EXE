import assert from 'node:assert/strict'
import { createReadStream, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import { distribution } from './game-length-model.ts'

const output = JSON.parse(readFileSync('docs/simulations/v2-game-length-results.json', 'utf8'))
const manifest = JSON.parse(readFileSync('docs/simulations/v2-length-source-manifest.json', 'utf8'))
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
for (const [file, before] of Object.entries(manifest.files)) assert.equal(hash(readFileSync(file)), before, file)
for (const [file, before] of Object.entries(output.diagnosticSourceHashes)) assert.equal(hash(readFileSync(file)), before, file)
assert.equal(output.verification.baselineReproduced, true)
assert.equal(output.productionConfig.RULES.laps, 3)
const stream = createReadStream('docs/simulations/v2-game-length-runs.csv.gz').pipe(createGunzip())
const lines = createInterface({ input: stream, crlfDelay: Infinity })
const metricNames = ['funds', 'shortfall', 'salary', 'livingPaid', 'extraordinaryPaid', 'investmentProfit', 'rolls', 'financialDecisions', 'businessIncome']
type Group = { n: number; wins: number; buyers: number; insolvent: number; metrics: Record<string, number[]>; realizedProfits: number[] }
const groups = new Map<string, Group>()
const paths = new Map<string, string[]>()
const goalWins: Record<string, Record<string, number>> = {}
let keys: string[] = []
let rowCount = 0
let checked = 0
for await (const line of lines) {
  if (!keys.length) { keys = line.split(','); continue }
  const cells = line.split(',')
  assert.equal(cells.length, keys.length)
  const row = Object.fromEntries(keys.map((key, index) => [key, cells[index]]))
  const id = `${row.horizon}/${row.strategy}`
  const group = groups.get(id) ?? { n: 0, wins: 0, buyers: 0, insolvent: 0,
    metrics: Object.fromEntries(metricNames.map(name => [name, []])), realizedProfits: [] }
  assert.equal(row.seed, `XVTL-V2-${group.n}`)
  if (row.strategy === 'cash-heavy') {
    const reference = paths.get(row.horizon) ?? []
    reference.push(row.pathSha256); paths.set(row.horizon, reference)
  } else assert.equal(row.pathSha256, paths.get(row.horizon)![group.n], `${id}/${row.seed}/path`)
  group.n++; group.wins += Number(row.won); group.buyers += Number(row.businessBought)
  group.insolvent += Number(row.termination === 'insolvent')
  for (const metric of metricNames) group.metrics[metric].push(Number(row[metric]))
  if (row.businessSold === '1') group.realizedProfits.push(Number(row.businessRealizedProfit))
  groups.set(id, group)
  assert.equal(Number(row.accountingResidual), 0)
  if (row.horizon === '4' && output.results['4'][row.strategy]) {
    for (const requirement of Object.keys(output.fourLapGoalExperiments)) {
      goalWins[requirement] ??= {}
      goalWins[requirement][row.strategy] ??= 0
      goalWins[requirement][row.strategy] += Number(row.termination === 'completed' && Number(row.funds) >= Number(requirement))
    }
  }
  rowCount++; checked++
}
assert.equal(rowCount, output.games)
assert.equal(groups.size, 42)
for (const [id, group] of groups) {
  const [horizon, strategy] = id.split('/')
  const expected = output.results[horizon][strategy] ?? (strategy === 'cash-course' ? output.controls[horizon].cashCourse
    : strategy === 'saving-no-course' ? output.controls[horizon].savingsNoCourse : output.controls[horizon].exitWindow)
  assert.ok(expected, id)
  assert.equal(group.n, 5000, id)
  assert.equal(group.wins, expected.wins)
  for (const metric of metricNames) {
    assert.deepEqual(distribution(group.metrics[metric]), expected.metrics[metric], `${id}/${metric}`)
  }
  assert.equal(group.buyers / group.n, expected.business.buyRate)
  assert.deepEqual(distribution(group.realizedProfits), expected.business.realizedProfitGivenSold)
  assert.equal(group.insolvent, expected.termination.insolvent)
}
for (const [requirement, strategies] of Object.entries(output.fourLapGoalExperiments)) {
  for (const [strategy, expected] of Object.entries(strategies as Record<string, { wins: number; winRate: number }>)) {
    const wins = goalWins[requirement][strategy]
    assert.equal(wins, expected.wins); assert.equal(wins / 5000, expected.winRate)
  }
}
console.log(`PASS: ${rowCount} per-seed rows / ${groups.size} groups, summary statistics and goal variants match JSON.`)
console.log(`PASS: ${checked} paired path hashes; ${Object.keys(manifest.files).length} protected files and diagnostic source hashes unchanged.`)
