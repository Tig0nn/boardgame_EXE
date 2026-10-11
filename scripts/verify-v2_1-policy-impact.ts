// Reproduce historical financial outcomes without overwriting their source manifests/results.
import assert from 'node:assert/strict'
import { createReadStream, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createGunzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import { layouts, playBoard } from './diagnostics/board-balance-model.ts'
import { playDiagnostic, strategies } from './diagnostics/game-length-model.ts'
import { aggregate } from './diagnostics/game-length-statistics.ts'
import { RULES, ECONOMY } from '../src/data/config.ts'

const hash = (file:string) => createHash('sha256').update(readFileSync(file)).digest('hex')
const historic = JSON.parse(readFileSync('docs/simulations/v2-game-length-results.json','utf8'))
const historicBoard = JSON.parse(readFileSync('docs/simulations/v2-board-balance-results.json','utf8'))
const financialHashes=Object.fromEntries(['src/data/config.ts','src/data/events.ts','src/game/market.ts','src/game/random.ts','src/game/selectors.ts'].map(file=>[file,hash(file)]))
for(const [file,digest] of Object.entries(financialHashes)) assert.equal(digest,historicBoard.protectedFiles[file],`Financial source changed: ${file}`)
assert.deepEqual({RULES,ECONOMY},{RULES:historic.productionConfig.RULES,ECONOMY:historic.productionConfig.ECONOMY})
const groups: Record<string,number> = {}
const expectedBoardGroups=['A20','C20'].flatMap(layout=>[...strategies,'business-exit-window'].map(strategy=>`${layout}/${strategy}`))
const lines = createInterface({input:createReadStream('docs/simulations/v2-board-balance-runs.jsonl.gz').pipe(createGunzip()),crlfDelay:Infinity})
for await (const line of lines) {
  const old = JSON.parse(line)
  if (!['A20','C20'].includes(old.layout)) continue
  const group=`${old.layout}/${old.run.strategy}`
  assert.ok(expectedBoardGroups.includes(group),`Unexpected group: ${group}`)
  assert.equal(old.run.horizon,4)
  assert.equal(old.run.seed,`XVTL-V2-${groups[group]??0}`,`Missing/duplicate/out-of-order seed: ${group}`)
  assert.ok((groups[group]??0)<5000,`Too many seeds: ${group}`)
  const current = playBoard(old.run.seed,old.run.strategy,layouts.find(layout=>layout.id===old.layout)!)
  const {path,checkpoints,...run} = current.run
  void checkpoints
  assert.deepEqual(JSON.parse(JSON.stringify(run)),old.run,`${old.layout}/${old.run.strategy}/${old.run.seed}`)
  assert.deepEqual(JSON.parse(JSON.stringify(current.audit)),old.audit)
  assert.equal(createHash('sha256').update(path.join('|')).digest('hex'),old.pathSha256)
  groups[group]=(groups[group]??0)+1
  if(groups[group]===5000) console.log(`PASS ${group}: 5000 identical games`)
}
assert.equal(Object.keys(groups).length,expectedBoardGroups.length)
for(const group of expectedBoardGroups) assert.equal(groups[group],5000,`Incomplete group: ${group}`)
for (const strategy of strategies) {
  const runs=Array.from({length:5000},(_,i)=>playDiagnostic(`XVTL-V2-${i}`,strategy,3).run)
  assert.deepEqual(JSON.parse(JSON.stringify(aggregate(runs))),historic.results['3'][strategy])
  groups[`Original3/${strategy}`]=runs.length
  console.log(`PASS Original3/${strategy}: 5000 identical outcomes`)
}
assert.equal(Object.values(groups).reduce((a,b)=>a+b,0),85000)
writeFileSync('docs/simulations/v2_1-policy-impact.json',JSON.stringify({version:'v2.1',seedRange:'XVTL-V2-0..4999',groups,
  totalGames:Object.values(groups).reduce((a,b)=>a+b,0),financialConfigurationUnchanged:true,
  historicalOutcomesIdentical:true,financialHashes,
  assumptions:'Historical business policies execute at most one action per encounter. Initial purchase and upgrade were never combined. No historical outputs/manifests were overwritten.',
  historicalResultsHashes:Object.fromEntries(['docs/simulations/v2-game-length-results.json','docs/simulations/v2-board-balance-results.json','docs/simulations/v2-board-balance-runs.jsonl.gz'].map(file=>[file,hash(file)]))},null,2)+'\n')
