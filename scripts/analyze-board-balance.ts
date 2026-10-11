// Diagnostic CLI only; no browser imports or production file writes.
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { BOARD } from '../src/data/board.ts'
import { RULES, ECONOMY, SCENARIOS, STOCKS, MACRO_EVENTS } from '../src/data/config.ts'
import { strategies, playDiagnostic } from './diagnostics/game-length-model.ts'
import type { Run, Strategy } from './diagnostics/game-length-model.ts'
import { aggregate, legacyProjection, paired } from './diagnostics/game-length-statistics.ts'
import { layouts, playBoard } from './diagnostics/board-balance-model.ts'
import { movementExpectation, summarizeBoard } from './diagnostics/board-balance-statistics.ts'
import type { BoardSummary } from './diagnostics/board-balance-statistics.ts'

const count = Number(process.argv[2] ?? 5000)
const smoke = process.argv.includes('--smoke')
assert.ok(Number.isSafeInteger(count) && count >= (smoke ? 1 : 5000))
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const oldManifest = JSON.parse(readFileSync('docs/simulations/v2-length-source-manifest.json','utf8')) as { files: Record<string,string> }
const extraProtected = ['scripts/analyze-game-length.ts', 'scripts/diagnostics/game-length-model.ts',
  'scripts/diagnostics/game-length-statistics.ts','scripts/diagnostics/game-length.test.ts',
  'scripts/diagnostics/render-game-length-report.ts','scripts/diagnostics/verify-game-length-results.ts',
  'docs/V2_GAME_LENGTH_ANALYSIS.md','docs/simulations/v2-game-length-results.json',
  'docs/simulations/v2-game-length-runs.csv.gz','docs/simulations/v2-length-source-manifest.json']
const protectedFiles = { ...oldManifest.files, ...Object.fromEntries(extraProtected.map(file => [file,hash(readFileSync(file))])) }
const productionConfig = structuredClone({ RULES, ECONOMY, SCENARIOS, STOCKS, MACRO_EVENTS, BOARD })
assert.equal(RULES.laps,3); assert.equal(RULES.tiles,20)
const verifyProtected = () => {
  for (const [file,before] of Object.entries(protectedFiles)) assert.equal(hash(readFileSync(file)),before, `Protected file: ${file}`)
  assert.deepEqual({ RULES, ECONOMY, SCENARIOS, STOCKS, MACRO_EVENTS, BOARD },productionConfig)
}
verifyProtected()
const baseline = JSON.parse(readFileSync('docs/simulations/v2-results.json','utf8'))
const lengthResults = JSON.parse(readFileSync('docs/simulations/v2-game-length-results.json','utf8'))
let games = 0; let pairedPathsChecked = 0
for (const strategy of strategies) {
  const runs = Array.from({ length: count },(_,i) => playDiagnostic(`XVTL-V2-${i}`,strategy,3).run)
  if (count === 5000) assert.deepEqual(legacyProjection(runs),baseline.baseline[strategy])
  games += count
}
const baselineReproduced = count === 5000
console.log(`PASS: 3-lap baseline checked (${5*count} games).`)
const results: Record<string,Record<string,BoardSummary>> = {}
const boardEffects: Record<string,Record<string,ReturnType<typeof paired>>> = {}
const policyEffects: Record<string,ReturnType<typeof paired>> = {}
const controlRuns: Record<string,Run[]> = {}
const paths: Record<string,string[]> = {}
const selected: Strategy[] = [...strategies,'business-exit-window']
const outputRows = 'docs/simulations/v2-board-balance-runs.jsonl.gz'
if (!smoke) writeFileSync(outputRows, new Uint8Array())
for (const layout of layouts) {
  results[layout.id] = {}; boardEffects[layout.id] = {}
  let businessRuns: Run[] = []
  for (const strategy of selected) {
    const rows = Array.from({ length: count },(_,i) => playBoard(`XVTL-V2-${i}`,strategy,layout))
    const runs = rows.map(row => row.run)
    const pathHashes = runs.map(run => hash(run.path.join('|')))
    if (strategy === 'cash-heavy') paths[layout.id] = pathHashes
    else runs.forEach((run,i) => {
      if (run.termination === 'completed') { assert.equal(pathHashes[i], paths[layout.id][i]); pairedPathsChecked++ }
    })
    if (layout.id !== 'A20' && layout.types.length === 20) {
      runs.forEach((run,i) => {
        if (run.termination === 'completed') { assert.equal(pathHashes[i],paths.A20[i]); pairedPathsChecked++ }
      })
    }
    const summary = summarizeBoard(rows,layout)
    results[layout.id][strategy] = summary
    if (layout.id === 'A20') {
      controlRuns[strategy] = runs
      // JSON canonicalization only normalizes signed zero from empty cash-flow sums.
      if (count === 5000) assert.deepEqual(JSON.parse(JSON.stringify(aggregate(runs))), strategy === 'business-exit-window'
        ? lengthResults.controls['4'].exitWindow : lengthResults.results['4'][strategy])
    } else boardEffects[layout.id][strategy] = paired(runs,controlRuns[strategy])
    if (strategy === 'business-heavy') businessRuns = runs
    if (strategy === 'business-exit-window') policyEffects[layout.id] = paired(runs,businessRuns)
    if (!smoke) {
      const text = rows.map(({ run, audit },i) => {
        const { path, checkpoints, ...scalarRun } = run
        assert.ok(path.length && checkpoints.length)
        return JSON.stringify({ layout: layout.id, run: scalarRun, audit, pathSha256: pathHashes[i] })
      }).join('\n') + '\n'
      // Concatenated gzip members are streaming-readable by standard gunzip.
      appendFileSync(outputRows,gzipSync(text))
    }
    games += count
    console.log(`${layout.id}/${strategy}: win=${(summary.summary.winRate*100).toFixed(2)}%; median=${summary.summary.metrics.funds.median}; rolls=${summary.summary.metrics.rolls.mean.toFixed(2)}; locked/buyer=${summary.summary.business.lockedRateGivenBought?.toFixed(4)}`)
  }
  verifyProtected()
}
const fourLapReproduced = count === 5000
const diagnosticFiles = ['scripts/analyze-board-balance.ts','scripts/diagnostics/board-balance-model.ts',
  'scripts/diagnostics/board-balance-statistics.ts','scripts/diagnostics/board-balance.test.ts']
const output = { version: 'v2-board-balance-2026-10-11', countPerGroup: count,
  seedPrefix: 'XVTL-V2-', firstSeed: 0, lastSeed: count-1, games, experimentGames: games-5*count,
  experimentalHorizon: 4, experimentalGoal: 90_000_000, productionConfig,
  layouts: layouts.map(layout => ({ ...layout, theoreticalMovement: movementExpectation(layout) })),
  policies: lengthResults.policy,
  definitions: {
    layoutVsPolicy: 'Compare identical strategy across layouts; separate last-two-laps policy within each layout. The latter stops buying/upgrading one lap earlier too, exactly as the previous diagnostic.',
    visit: 'Resolved non-START event encounter, including pending landing after earlier START; final overshoot is raw landing only, ignored by gameplay.',
    meaningfulEncounters: 'Distinct event moments offering a legal invest/upgrade/sale/course choice, or multiple mandatory-payment options; no macro acknowledgments, forced living payment or redundant course dialogs. Legal investment minima are 1 VND, business20M/course6M/upgrade5M.',
    unavailableInvestmentOpportunities: 'Targeted investment visits blocked by the unchanged 10M cash-reserve policy and ticket floor (1M for financial assets,20M business,5M upgrade). Horizon and upgrade-cap blocks reported separately; this is policy-relative, not an engine prohibition.',
    fundedInvestmentOpportunities: 'Visits with enough cash after 10M reserve for a financial ticket or new business, or existing business sale possibility. Does not imply a transaction or policy willingness.',
    decisionCount: 'Meaningful event moments reported separately from actual voluntary transactions and funding actions; no assertion that every feasible choice has educational value.',
    pairedSeeds: 'All same-size layouts share verified full dice/forecast paths. Different sizes use seed-matched outcomes but consume RNG at different event/settlement times, so paths are not identical.',
    exposure: 'Eight financial price series: sum absolute log-price changes from macro versus normal; direction flips compare normal-only factor with macro+normal factor in the same lap, not counterfactual future prices or forecast prediction accuracy.',
  },
  verification: { baselineReproduced, fourLapReproduced, pairedPathsChecked,
    protectedFilesUnchanged: true, protectedFileCount: Object.keys(protectedFiles).length,
    runtimeRestored: RULES.laps===3 && RULES.tiles===20, node: process.version },
  protectedFiles, diagnosticSourceHashes: Object.fromEntries(diagnosticFiles.map(file => [file,hash(readFileSync(file))])),
  results, boardEffects, policyEffects }
verifyProtected()
if (!smoke) {
  writeFileSync('docs/simulations/v2-board-balance-results.json',JSON.stringify(output,null,2)+'\n')
  console.log(`PASS: ${games} games incl. baseline; wrote JSON + compressed per-seed JSONL; protected files unchanged.`)
} else console.log(`Smoke passed: ${games} games; no artifacts written.`)
