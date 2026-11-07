import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { ECONOMY, RULES } from '../src/data/config.ts'
import { playSavingsPolicy, strategies } from './diagnostics/savings-lot-policy.ts'

const seedCount = Number(process.argv[2] ?? 10_000)
assert.ok(Number.isSafeInteger(seedCount) && seedCount > 0)
const globalConfig = JSON.stringify({ RULES, ECONOMY })
const results = []
const started = Date.now()
for (const strategy of strategies) for (const initialSavings of [0, 20e6, 40e6]) {
  const totals: Record<string, Record<string, number>> = { A: {}, B: {} }
  const differences: Record<string, { sum: number; sumSquares: number }> = {}
  let identicalPaths = 0
  for (let index = 0; index < seedCount; index++) {
    const seed = `XVTL-LOTS-V24-${index}`
    const a = playSavingsPolicy(seed, strategy, 'A', initialSavings)
    const b = playSavingsPolicy(seed, strategy, 'B', initialSavings)
    assert.ok(a.path.startsWith(b.path) || b.path.startsWith(a.path), 'Paired RNG paths must share a prefix')
    if (a.path === b.path) identicalPaths++
    for (const key of Object.keys(a.metrics) as (keyof typeof a.metrics)[]) {
      totals.A[key] = (totals.A[key] ?? 0) + a.metrics[key]
      totals.B[key] = (totals.B[key] ?? 0) + b.metrics[key]
      const delta = a.metrics[key] - b.metrics[key]
      const stats = differences[key] ??= { sum: 0, sumSquares: 0 }
      stats.sum += delta; stats.sumSquares += delta * delta
    }
  }
  const mean = (values: Record<string, number>) => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v / seedCount]))
  const paired = Object.fromEntries(Object.entries(differences).map(([k, { sum, sumSquares }]) => {
    const meanDelta = sum / seedCount
    const half = seedCount > 1 ? 1.96 * Math.sqrt(Math.max(0, (sumSquares - sum * sum / seedCount) / (seedCount - 1)) / seedCount) : 0
    return [k, { meanDelta, normal95: [meanDelta - half, meanDelta + half] }]
  }))
  const result = { strategy, initialSavings, seedCount, identicalPaths,
    A: { ...mean(totals.A), bankUtilization: totals.A.bankDeposits / totals.A.bankEncounters },
    B: { ...mean(totals.B), bankUtilization: totals.B.bankDeposits / totals.B.bankEncounters }, paired }
  results.push(result)
  console.log(JSON.stringify(result))
}
assert.equal(JSON.stringify({ RULES, ECONOMY }), globalConfig)
mkdirSync('docs/simulations', { recursive: true })
writeFileSync('docs/simulations/v2_4-savings-lot-comparison.json', JSON.stringify({ seedCount,
  totalGames: seedCount * strategies.length * 3 * 2, elapsedSeconds: (Date.now() - started) / 1000,
  seedPattern: 'XVTL-LOTS-V24-0..N-1', rules: 'V2.4 / Experimental B / C20 / vn-v1',
  comparison: 'A minus B; B only suppresses a new Bank deposit while any lot is active; production rules unchanged',
  initialTerm: 3, cashSampling: 'before each roll', confidenceIntervals: 'paired normal 95%, descriptive; no multiple-comparison adjustment',
  globalConfigUnchanged: true, results }, null, 2) + '\n')
