// Offline experiment. Never imported by the browser app; never writes production files.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { RULES, ECONOMY, SCENARIOS, STOCKS, MACRO_EVENTS } from '../src/data/config.ts'
import { BOARD } from '../src/data/board.ts'
import { playDiagnostic, strategies, distribution } from './diagnostics/game-length-model.ts'
import type { Run, Strategy } from './diagnostics/game-length-model.ts'
import { aggregate, legacyProjection, paired } from './diagnostics/game-length-statistics.ts'

const count = Number(process.argv[2] ?? 5000)
const smoke = process.argv.includes('--smoke')
assert.ok(Number.isSafeInteger(count) && count >= (smoke ? 1 : 5000))
const prefix = 'XVTL-V2-'
const originalConfig = structuredClone({ RULES, ECONOMY, SCENARIOS, STOCKS, MACRO_EVENTS, BOARD })
assert.equal(RULES.laps, 3)
const baseline = JSON.parse(readFileSync('docs/simulations/v2-results.json', 'utf8'))
assert.deepEqual(originalConfig, baseline.config)
const manifest = JSON.parse(readFileSync('docs/simulations/v2-length-source-manifest.json', 'utf8')) as { files: Record<string, string> }
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const verifyProtected = () => {
  for (const [file, before] of Object.entries(manifest.files)) assert.equal(hash(readFileSync(file)), before, `Protected file changed: ${file}`)
  assert.deepEqual({ RULES, ECONOMY, SCENARIOS, STOCKS, MACRO_EVENTS, BOARD }, originalConfig)
}
verifyProtected()
const fields = ['seed', 'strategy', 'horizon', 'funds', 'won', 'debt', 'termination', 'shortfall', 'completedLaps',
  'livingCount', 'livingPaid', 'extraordinaryPaid', 'financialShocks', 'macroShocks', 'rolls', 'eventDecisions',
  'alternativeChoices', 'voluntaryActions', 'fundingDecisions', 'financialDecisions', 'monetaryDecisions',
  'course', 'courseCost', 'salary', 'baseSalary', 'courseSalary', 'bonus', 'savingsInterest', 'investmentProfit',
  'debtInterest', 'accountingResidual', 'everBorrowed', 'shortageEpisodes', 'businessEncounters',
  'eligibleBusinessEncounters', 'businessExitEncounters', 'purchaseLap', 'businessReturnsAfterPurchase',
  'businessBought', 'businessUpgrades', 'businessIncome', 'businessCosts', 'businessResale', 'businessSold',
  'businessLocked', 'businessLockedQuote', 'businessCashContribution', 'businessMarkedProfit',
  'businessRealizedProfit', 'first90Lap', 'first90Checkpoint', 'terminalSavings'] as const
const csv: string[] = [fields.join(',') + ',pathSha256,checkpointFunds\n']
let games = 0
let pairedPathsChecked = 0
let crossHorizonPathsChecked = 0
let baselineReproduced = false
const results: Record<string, Record<string, ReturnType<typeof aggregate>>> = {}
const controls: Record<string, { cashCourse: ReturnType<typeof aggregate>; savingsNoCourse: ReturnType<typeof aggregate>; savingsNoCourseVsCash: ReturnType<typeof paired>; businessVsCashCourse: ReturnType<typeof paired>; diversifiedVsCashCourse?: ReturnType<typeof paired>; exitWindow?: ReturnType<typeof aggregate>; exitWindowVsBusiness?: ReturnType<typeof paired> }> = {}
const horizonDifferences: Record<string, ReturnType<typeof paired>> = {}
const goalExperiments: Record<string, Record<string, { wins: number; winRate: number; shortfall: ReturnType<typeof distribution> }>> = {}
let previousCash: Run[] | null = null
const execute = (horizon: number, strategy: Strategy) => {
  const runs = Array.from({ length: count }, (_, index) => playDiagnostic(`${prefix}${index}`, strategy, horizon).run)
  games += runs.length
  if (!smoke) csv.push(runs.map(run => fields.map(key => run[key] === null ? '' : typeof run[key] === 'boolean' ? Number(run[key]) : run[key]).join(',') +
    ',' + hash(run.path.join('|')) + ',' + run.checkpoints.map(point => `${point.lap}:${point.funds}`).join('|')).join('\n') + '\n')
  const summary = aggregate(runs)
  console.log(`${horizon} laps / ${strategy}: ${summary.wins}/${count}, median=${summary.metrics.funds.median}, bought=${summary.business.buyRate.toFixed(4)}, locked/buyer=${summary.business.lockedRateGivenBought ?? '-'}`)
  return { runs, summary }
}
const checkPaths = (runs: Run[], reference: Run[], crossHorizon = false) => {
  runs.forEach((run, index) => {
    assert.equal(run.seed, reference[index].seed)
    const length = Math.min(run.path.length, reference[index].path.length)
    assert.deepEqual(run.path.slice(0, length), reference[index].path.slice(0, length), `Dice path mismatch ${run.seed}`)
    if (crossHorizon) crossHorizonPathsChecked++; else pairedPathsChecked++
  })
}
for (const horizon of [3, 4, 5, 6, 8, 12]) {
  const selected: readonly Strategy[] = horizon <= 6 ? strategies : ['cash-heavy', 'saving-heavy', 'business-heavy']
  const group: Record<string, Run[]> = {}
  results[horizon] = {}
  for (const strategy of selected) {
    const { runs, summary } = execute(horizon, strategy)
    results[horizon][strategy] = summary; group[strategy] = runs
    if (horizon === 3 && count === 5000) assert.deepEqual(legacyProjection(runs), baseline.baseline[strategy], `Published 3-lap baseline: ${strategy}`)
    if (strategy !== 'cash-heavy') checkPaths(runs, group['cash-heavy'])
  }
  if (horizon === 3 && count === 5000) { baselineReproduced = true; console.log('PASS: all published 3-lap baseline fields reproduced exactly.') }
  if (previousCash) {
    checkPaths(group['cash-heavy'], previousCash, true)
    horizonDifferences[`${horizon}-vs-${previousCash[0].horizon}-cash`] = paired(group['cash-heavy'], previousCash)
  }
  previousCash = group['cash-heavy']
  const control = execute(horizon, 'cash-course')
  checkPaths(control.runs, group['cash-heavy'])
  const savingsControl = execute(horizon, 'saving-no-course')
  checkPaths(savingsControl.runs, group['cash-heavy'])
  controls[horizon] = { cashCourse: control.summary, savingsNoCourse: savingsControl.summary,
    savingsNoCourseVsCash: paired(savingsControl.runs, group['cash-heavy']), businessVsCashCourse: paired(group['business-heavy'], control.runs),
    ...(group.diversified ? { diversifiedVsCashCourse: paired(group.diversified, control.runs) } : {}) }
  if (horizon <= 6) {
    const exitWindow = execute(horizon, 'business-exit-window')
    checkPaths(exitWindow.runs, group['cash-heavy'])
    controls[horizon].exitWindow = exitWindow.summary
    controls[horizon].exitWindowVsBusiness = paired(exitWindow.runs, group['business-heavy'])
  }
  if (horizon === 4) {
    for (const requirement of [90, 100, 110, 120, 130, 140].map(value => value * 1_000_000)) {
      goalExperiments[requirement] = Object.fromEntries(strategies.map(strategy => {
        const runs = group[strategy]
        const wins = runs.filter(run => run.termination === 'completed' && run.funds >= requirement).length
        return [strategy, { wins, winRate: wins / count, shortfall: distribution(runs.map(run => Math.max(0, requirement - run.funds))) }]
      }))
    }
  }
  verifyProtected()
}
verifyProtected()
const diagnosticFiles = ['scripts/analyze-game-length.ts', 'scripts/diagnostics/game-length-model.ts', 'scripts/diagnostics/game-length-statistics.ts', 'scripts/diagnostics/game-length.test.ts']
const output = { version: 'v2-game-length-diagnostic-2026-10-11', seedPrefix: prefix, firstSeed: 0, lastSeed: count - 1,
  games, productionConfig: originalConfig, diagnosticSourceHashes: Object.fromEntries(diagnosticFiles.map(file => [file, hash(readFileSync(file))])),
  policy: { reserve: 10_000_000, course: 'Non-cash-heavy only with >=2 remaining STARTs; same as old lap<=2 at H=3.',
    business: 'Buy/upgrade before final lap; sell at business tile in final lap. No future RNG/price access.',
    exitWindow: 'Separate sensitivity: buy/upgrade before penultimate lap; attempt sale at business tiles in last two laps; never reopen in exit window.',
    cashCourse: 'Cash-only plus the same course policy; controls salary uplift when assessing business.',
    savingsNoCourse: 'Same savings policy but never buys course; isolates saving returns against cash-heavy.',
    savings: 'Same 40M initial term3, new lots at 85% excess cash, term=min(3, remaining STARTs); diversified 15M term1 and 25% excess.',
    assets: 'Unchanged published ticket amounts, buying gates, fees and funding order; no discretionary START sales; business sells only at its own tile.',
    goalVariants: 'Reclassify identical 4-lap terminal trajectories; total requirement = item price + unchanged 10M reserve. No goal-dependent strategy changes.' },
  definitions: { financialShocks: 'Personal financial event encounters only; macro and ordinary obligation tiles reported separately.',
    financialDecisions: 'All event choices/acknowledgments + voluntary trades/deposits/upgrades + funding actions; not all are meaningful alternatives.',
    first90: 'Earliest observed action boundary or post-settlement summary; temporary threshold crossing is not terminal victory.',
    businessRealizedProfit: 'For sold businesses: collected income + net resale - initial cost - upgrades. Unsold businesses have no completed-cycle realized P/L.',
    investmentProfit: 'Savings earned interest + bond coupons/redemption + net financial sales + terminal net financial quotes - financial asset purchases; excludes business/course.',
    accounting: 'Funds=50M+salary+bonus-living due-extraordinary due-course-interest+financial investment profit+business cash contribution; locked book value excluded.' },
  verification: { baselineReproduced, protectedFileCount: Object.keys(manifest.files).length, protectedFilesUnchanged: true,
    runtimeConfigRestored: RULES.laps === 3, pairedPathsChecked, crossHorizonPathsChecked, allRunAccountingResidualsZero: true,
    node: process.version, diagnosticTestsCommand: 'node --experimental-strip-types --test scripts/diagnostics/game-length.test.ts' },
  results, controls, horizonDifferences, fourLapGoalExperiments: goalExperiments }
if (!smoke) {
  writeFileSync('docs/simulations/v2-game-length-runs.csv.gz', gzipSync(csv.join('')))
  writeFileSync('docs/simulations/v2-game-length-results.json', JSON.stringify(output, null, 2) + '\n')
  console.log(`Wrote diagnostic JSON and compressed per-seed CSV; ${games} games. Production and published artifacts unchanged.`)
} else console.log(`Smoke validation passed; ${games} games, no result artifacts written.`)
