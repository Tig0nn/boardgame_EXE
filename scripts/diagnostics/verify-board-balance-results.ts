import assert from 'node:assert/strict'
import { createReadStream, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import { layouts } from './board-balance-model.ts'
import type { BoardRun } from './board-balance-model.ts'
import { summarizeBoard } from './board-balance-statistics.ts'
import { strategies, distribution } from './game-length-model.ts'
import { BOARD } from '../../src/data/board.ts'

const result = JSON.parse(readFileSync('docs/simulations/v2-board-balance-results.json','utf8'))
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
for (const [file, expected] of Object.entries({ ...result.protectedFiles, ...result.diagnosticSourceHashes })) {
  assert.equal(hash(readFileSync(file)),expected,`Source changed: ${file}`)
}
const selected = [...strategies,'business-exit-window']
const groups = layouts.flatMap(layout => selected.map(strategy => ({ layout, strategy })))
const lines = createInterface({ input: createReadStream('docs/simulations/v2-board-balance-runs.jsonl.gz').pipe(createGunzip()), crlfDelay: Infinity })
let groupIndex = 0; let rows: BoardRun[] = []; let total = 0; let pathChecks = 0
const controlPaths: string[] = []; let currentPaths: string[] = []
const categoryResults: Record<string,Record<string,Record<string,{ visits: ReturnType<typeof distribution>; neverRate: number }>>> = {}
for await (const line of lines) {
  const parsed = JSON.parse(line) as { layout: string; run: Omit<BoardRun['run'],'path'|'checkpoints'>;
    audit: BoardRun['audit']; pathSha256: string }
  const group = groups[groupIndex]
  assert.ok(group,'Too many rows')
  assert.equal(parsed.layout,group.layout.id); assert.equal(parsed.run.strategy,group.strategy)
  assert.equal(parsed.run.seed,`XVTL-V2-${rows.length}`)
  assert.equal(parsed.run.horizon,4); assert.equal(parsed.run.accountingResidual,0)
  assert.equal(parsed.audit.rawLandings.reduce((sum,n) => sum+n,0),parsed.run.rolls)
  assert.equal(parsed.audit.resolvedVisits.reduce((sum,n) => sum+n,0),parsed.run.eventDecisions)
  assert.equal(parsed.run.won,parsed.run.termination === 'completed' && parsed.run.funds >= 90_000_000)
  assert.ok(parsed.audit.meaningfulEncounters <= parsed.run.eventDecisions)
  for (const type of ['bank','stocks','bonds','gold','business'] as const) {
    const item = parsed.audit.types[type]
    assert.equal(item.targeted,item.eligible+item.blockedCash+item.blockedHorizon+item.blockedCap)
  }
  assert.equal(parsed.audit.types.course.transactions,Number(parsed.run.course))
  if (group.layout.id === 'A20' && group.strategy === 'cash-heavy') controlPaths.push(parsed.pathSha256)
  else if (group.layout.types.length === 20 && parsed.run.termination === 'completed') {
    assert.equal(parsed.pathSha256,controlPaths[rows.length]); pathChecks++
  }
  if (group.strategy === 'cash-heavy') currentPaths.push(parsed.pathSha256)
  else if (parsed.run.termination === 'completed') {
    assert.equal(parsed.pathSha256,currentPaths[rows.length]); pathChecks++
  }
  rows.push({ run: { ...parsed.run,path: [],checkpoints: [] },audit: parsed.audit }); total++
  if (rows.length === result.countPerGroup) {
    const summary = summarizeBoard(rows,group.layout)
    assert.deepEqual(JSON.parse(JSON.stringify(summary)),result.results[group.layout.id][group.strategy],`Raw summary mismatch: ${group.layout.id}/${group.strategy}`)
    categoryResults[group.layout.id] ??= {}
    categoryResults[group.layout.id][group.strategy] = Object.fromEntries(['investment','income','shock','obligation'].map(category => {
      // START salary/crossings reported separately; income here is course encounters.
      const values = rows.map(row => Object.entries(row.audit.types).reduce((sum,[type,item]) =>
        sum + (type !== 'start' && BOARD.find(tile => tile.type === type)!.category === category ? item.visits : 0),0))
      return [category,{ visits: distribution(values),neverRate: values.filter(n => n === 0).length / values.length }]
    }))
    if (group.strategy === 'cash-heavy') {
      const theory = result.layouts.find((layout: { id: string }) => layout.id === group.layout.id).theoreticalMovement
      assert.ok(Math.abs(summary.summary.metrics.rolls.mean-theory.expectedRolls)<0.3)
      for (const type of Object.keys(theory.neverRateByType)) {
        assert.ok(Math.abs(summary.byType[type].neverRate-theory.neverRateByType[type])<0.035,`Renewal never: ${group.layout.id}/${type}`)
        assert.ok(Math.abs(summary.byType[type].metrics.visits.mean-theory.expectedResolvedVisitsByType[type])<0.12,`Renewal visits: ${group.layout.id}/${type}`)
      }
    }
    console.log(`PASS raw summary: ${group.layout.id}/${group.strategy}`)
    rows = []; groupIndex++
    if (groupIndex % selected.length === 0) currentPaths = []
  }
}
assert.equal(rows.length,0); assert.equal(groupIndex,groups.length)
assert.equal(total,result.experimentGames)
assert.equal(result.verification.baselineReproduced,true)
assert.equal(result.verification.fourLapReproduced,true)
assert.equal(result.verification.runtimeRestored,true)
writeFileSync('docs/simulations/v2-board-category-audit.json',JSON.stringify({
  source: 'v2-board-balance-runs.jsonl.gz', sourceResultsSha256: hash(readFileSync('docs/simulations/v2-board-balance-results.json')),
  rawRowsVerified: total, definitions: { income: 'Resolved course encounters only; START salary is separate.',
    investment: 'bank+stocks+bonds+gold+business',shock: 'personal+macro',obligation: 'living+obligation' },
  results: categoryResults },null,2)+'\n')
console.log(`PASS: ${total} rows/${groups.length} groups; full summaries match; ${pathChecks} path checks; renewal expectations agree; ${result.verification.protectedFileCount} protected files unchanged.`)
