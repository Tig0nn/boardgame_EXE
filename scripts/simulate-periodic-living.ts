import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { LIVING_STRATEGIES } from './diagnostics/periodic-living-model.ts'
import type { livingGameMetrics } from './diagnostics/periodic-living-model.ts'

const out = resolve('docs/playtests/periodic-living-v26')
const count = Number(process.argv[2] ?? 500)
if (!Number.isSafeInteger(count) || count < 1) throw new Error('Invalid seed count')
mkdirSync(out, { recursive: true })
const configs = [
  { id: 'legacy', policy: 'v2.4-on-landing', amount: 7e6, layout: 'historical' },
  { id: '7m-a', policy: 'v2.6-periodic-start', amount: 7e6, layout: 'A' },
  { id: '5m-a', policy: 'v2.6-periodic-start', amount: 5e6, layout: 'A' },
  { id: '6m-a', policy: 'v2.6-periodic-start', amount: 6e6, layout: 'A' },
  { id: '7m-b', policy: 'v2.6-periodic-start', amount: 7e6, layout: 'B' },
  { id: '7m-c', policy: 'v2.6-periodic-start', amount: 7e6, layout: 'C' },
]
type Row = ReturnType<typeof livingGameMetrics>
const all: Record<string, Row[]> = {}
const sourceHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
const sourceFiles = ['src/game/living-expenses.ts', 'src/data/board.ts', 'src/data/bond-issuers.ts', 'scripts/diagnostics/periodic-living-model.ts']
const hashes = Object.fromEntries(sourceFiles.map(path => [path, sourceHash(path)]))
for (const config of configs) {
  const target = join(out, `balance-${config.id}.json.gz`)
  if (process.argv.includes('--aggregate-only')) {
    all[config.id] = JSON.parse(gunzipSync(readFileSync(target)).toString())
    if (all[config.id].length !== count * LIVING_STRATEGIES.length) throw new Error('Unexpected saved sample size')
    continue
  }
  // Research variation lives in a temporary isolated copy. No runtime switch,
  // environment variable or research option is available to playable Mobile.
  const dir = mkdtempSync(join(tmpdir(), 'periodic-research-'))
  cpSync('src', join(dir, 'src'), { recursive: true })
  mkdirSync(join(dir, 'scripts/diagnostics'), { recursive: true })
  for (const file of ['periodic-living-model.ts', 'periodic-living-worker.ts']) cpSync(`scripts/diagnostics/${file}`, join(dir, 'scripts/diagnostics', file))
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}')
  const rulesPath = join(dir, 'src/game/living-expenses.ts')
  const replaceExact = (path: string, from: string, to: string) => {
    const text = readFileSync(path, 'utf8')
    if (text.split(from).length !== 2) throw new Error(`Research substitution must match exactly once: ${from}`)
    writeFileSync(path, text.replace(from, to))
  }
  replaceExact(rulesPath, 'PERIODIC_LIVING_COST = 7_000_000', `PERIODIC_LIVING_COST = ${config.amount}`)
  const boardPath = join(dir, 'src/data/board.ts')
  const stock = "type: 'stocks' as const, category: 'investment' as const, label: 'Cổ phiếu', icon: 'chart'"
  const gold = "type: 'gold' as const, category: 'investment' as const, label: 'Vàng', icon: 'gold'"
  const bank = "type: 'bank' as const, category: 'investment' as const, label: 'Ngân hàng', icon: 'bank'"
  if (config.layout === 'B') { replaceExact(boardPath, stock, bank); replaceExact(boardPath, gold, stock) }
  if (config.layout === 'C') { replaceExact(boardPath, stock, bank); replaceExact(boardPath, gold, stock); replaceExact(boardPath, bank, gold); replaceExact(boardPath, stock, bank) }
  const child = spawnSync(process.execPath, ['--experimental-strip-types', join(dir, 'scripts/diagnostics/periodic-living-worker.ts'), target, String(count), config.policy], { encoding: 'utf8', maxBuffer: 1e6 })
  if (child.status !== 0) throw new Error(child.stderr || child.stdout)
  all[config.id] = JSON.parse(gunzipSync(readFileSync(target)).toString())
  console.log(`${config.id}: ${all[config.id].length} games`)
}
for (const path of sourceFiles) if (sourceHash(path) !== hashes[path]) throw new Error(`Production source changed: ${path}`)
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const stats = (xs: number[]) => { const sorted = xs.toSorted((a, b) => a - b); return { mean: mean(xs), median: (sorted[Math.floor((xs.length - 1) / 2)] + sorted[Math.floor(xs.length / 2)]) / 2 } }
const aggregate = (rows: Row[]) => {
  const wins = rows.filter(r => r.won).length, n = rows.length, p = wins / n, z = 1.959963984540054
  const center = (p + z * z / (2 * n)) / (1 + z * z / n), half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
  // Six strategies share each seed. The pooled Wilson interval is descriptive;
  // use the seed-cluster normal interval for overall uncertainty, and Wilson
  // within each fixed strategy (one observation per seed).
  const seeds = [...new Set(rows.map(r => r.seed))]
  const seedRates = seeds.map(seed => { const group = rows.filter(r => r.seed === seed); return group.filter(r => r.won).length / group.length })
  const clusterHalf = z * Math.sqrt(seedRates.reduce((sum, x) => sum + (x - p) ** 2, 0) / (seeds.length - 1) / seeds.length)
  return { n, wins, winRate: p, wilson95: [center - half, center + half], seedCluster95: [Math.max(0, p - clusterHalf), Math.min(1, p + clusterHalf)], funds: stats(rows.map(r => r.funds)),
    insolvencyRate: rows.filter(r => r.insolvent).length / n,
    metrics: Object.fromEntries(['cash', 'meanTurnCash', 'livingPaid', 'livingFunding', 'emergencyPaid', 'borrowing', 'savingsWithdrawals', 'latePurchaseCost', 'terminalFinancialExposure', 'unmaturedBondFace', 'completedStarts'].map(key => [key, mean(rows.map(r => r[key as keyof Row] as number))])),
    livingFundingGameRate: rows.filter(r => r.livingFunding > 0).length / n,
    borrowingGameRate: rows.filter(r => r.borrowing > 0).length / n,
    savingsWithdrawalGameRate: rows.filter(r => r.savingsWithdrawals > 0).length / n,
    opportunities: Object.fromEntries(Object.keys(rows[0].opportunities).map(key => [key, mean(rows.map(r => r.opportunities[key]))])),
    lateOpportunities: Object.fromEntries(Object.keys(rows[0].lateOpportunities).map(key => [key, mean(rows.map(r => r.lateOpportunities[key]))])) }
}
const results = { seedsPerStrategy: count, games: configs.length * count * LIVING_STRATEGIES.length, sourceHashes: hashes, conditions: { initialSavings: 20e6, term: 3, capital: 50e6, goal: 90e6, laps: 4, bond: 'v2.5-credit-risk', seedPrefix: 'PERIODIC-V26-' },
  configs: configs.map(config => ({ ...config, researchOnly: config.id !== 'legacy' && config.id !== '7m-a',
    aggregate: aggregate(all[config.id]), strategies: Object.fromEntries(LIVING_STRATEGIES.map(strategy => [strategy, aggregate(all[config.id].filter(r => r.strategy === strategy))])),
    sameDicePathAsLegacy: all[config.id].filter((r, i) => r.dicePath === all.legacy[i].dicePath).length,
    sameEncounterPathAsLegacy: all[config.id].filter((r, i) => r.encounterPath === all.legacy[i].encounterPath).length })) }
writeFileSync(join(out, 'balance-results.json'), JSON.stringify(results, null, 2) + '\n')
console.log(JSON.stringify({ games: results.games, results: join(out, 'balance-results.json') }))
