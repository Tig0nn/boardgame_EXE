import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { LIVING_STRATEGIES, playLivingGame, livingGameMetrics } from '../../diagnostics/periodic-living-model.ts'
import { replayGameLog } from '../../diagnostics/replay-game-log.ts'
import { hash, sourceManifest } from './adapter.mjs'

const out='docs/research/core-mvp';mkdirSync(out,{recursive:true})
const prior='docs/playtests/periodic-living-v26'
const results=JSON.parse(readFileSync(`${prior}/balance-results.json`,'utf8'))
for(const [path,expected]of Object.entries(results.normalizedSourceHashes))assert.equal(hash(readFileSync(path,'utf8').replace(/\r\n/g,'\n')),expected,`Historical source: ${path}`)
const saved=JSON.parse(gunzipSync(readFileSync(`${prior}/balance-7m-a.json.gz`)))
let verified=0
for(const policy of LIVING_STRATEGIES)for(const i of [0,1,2,37,499]){
  const seed=`PERIODIC-V26-${i}`,row=livingGameMetrics(playLivingGame(seed,policy,'v2.6-periodic-start'),policy)
  assert.deepEqual(row,saved.find(r=>r.seed===seed&&r.strategy===policy));verified++
}
const files=['docs/playtests/atomic-investments-v24/historical-multi-purchase.json.gz','docs/playtests/business-v2_3/browser-game-log.json.gz','docs/playtests/business-preference-ux-final/browser-game-log.json.gz','docs/playtests/bond-credit-v25/simulation-victory.json.gz']
const replays=[]
for(const file of files){let data;try{data=JSON.parse(gunzipSync(readFileSync(file)))}catch(e){if(e.code==='ENOENT')continue;throw e}const state=replayGameLog(data);replays.push({file,sha256:hash(readFileSync(file)),seed:state.seed,entries:state.log.length})}
assert.ok(replays.length>=2,'Need historical replay fixtures')
writeFileSync(`${out}/baseline-audit.json`,JSON.stringify({sourceManifest:sourceManifest(),oldRowsReproduced:verified,historicalReplay:replays,
  baseline:'7m-a, original 20 tile periodic C20 including obligation, 4 START, 20M savings/term3; not new nine-type board',
  priorAggregate:results.configs.find(c=>c.id==='7m-a').aggregate,
  caveats:['Old board/length/bond studies use other rules or initial allocations; never pooled as new-MVP A/B.', 'Research states must replay with their config and engine source manifest; never passed to production historical replay.']},null,2)+'\n')
console.log(JSON.stringify({oldRowsReproduced:verified,historicalReplays:replays.length}))
