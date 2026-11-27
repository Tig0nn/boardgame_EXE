import { readdirSync,readFileSync,writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { replayGameLog } from './replay-game-log.ts'
function* files(dir:string):Generator<string>{
  for(const e of readdirSync(dir,{withFileTypes:true})){
    const p=join(dir,e.name)
    if(e.isDirectory())yield* files(p)
    else if(/\.json(\.gz)?$/.test(p))yield p
  }
}
const results=[],excluded=[]
for(const path of files('docs/playtests')){
  const bytes=readFileSync(path)
  let data
  try{data=JSON.parse((path.endsWith('.gz')?gunzipSync(bytes):bytes).toString())}catch{continue}
  if(![4,5,6].includes(data?.schemaVersion)||!data?.state||!data?.entries)continue
  // This archived DEV harness jumps directly to turn2/position13 without rolls.
  // scripts/playtest-harness.tsx explicitly labels it a synthetic fixture.
  if(path.replaceAll('\\','/')==='docs/playtests/fixture-locked-final-log.json'){
    excluded.push({path:path.replaceAll('\\','/'),sha256:createHash('sha256').update(bytes).digest('hex'),reason:'Synthetic injected locked-final fixture; not a replayable natural game.'});continue
  }
  try{
    replayGameLog(data)
    results.push({path:path.replaceAll('\\','/'),schemaVersion:data.schemaVersion,sha256:createHash('sha256').update(bytes).digest('hex'),matched:true})
  }catch(error){results.push({path:path.replaceAll('\\','/'),schemaVersion:data.schemaVersion,matched:false,error:String(error)})}
}
const failures=results.filter(r=>!r.matched)
writeFileSync('docs/playtests/core-mvp-b18/replay-verification.json',JSON.stringify({scope:'All standalone schema4/5/6 natural gameplay logs under docs/playtests; every action and complete final state compared. Other diagnostic formats are not gameplay replays.',logs:results.length,passed:results.length-failures.length,failures:failures.length,excluded,results},null,2)+'\n')
console.log(JSON.stringify({logs:results.length,failures}))
if(failures.length)process.exitCode=1
