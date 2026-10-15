import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { play } from './policy.mjs'
import { aggregate, paired } from './stats.mjs'
import { replayResearch } from './replay.mjs'
const [configPath,jobPath,out]=process.argv.slice(2)
const config=JSON.parse(readFileSync(configPath,'utf8')),job=JSON.parse(readFileSync(jobPath,'utf8')),started=performance.now(),rows=[]
for(const policy of job.policies)for(const seed of job.seeds)rows.push(play(seed,policy,config))
const groups=Object.fromEntries(job.policies.map(p=>[p,rows.filter(r=>r.policy===p)]))
const result={id:config.id,version:config.version,configHash:createHash('sha256').update(JSON.stringify(config)).digest('hex'),job,elapsedSeconds:(performance.now()-started)/1000,games:rows.length,
  policies:Object.fromEntries(job.policies.map(p=>[p,aggregate(groups[p])])),pairedAgainstCash:Object.fromEntries(job.policies.filter(p=>p!=='cash').map(p=>[p,{proceeds:paired(groups[p],groups.cash,'proceeds'),won:paired(groups[p],groups.cash,'won')}]))}
writeFileSync(`${out}.rows.json.gz`,gzipSync(JSON.stringify(rows)))
// Preserve a complete research state for replay; private wrapper, not a game export.
const examples=job.policies.map(policy=>play(job.seeds[0],policy,config,{trace:true}))
for(const example of examples){const rerun=play(example.row.seed,example.row.policy,config,{trace:true});if(JSON.stringify(rerun)!==JSON.stringify(example))throw Error('Non-deterministic replay');replayResearch(example.state,config)}
writeFileSync(`${out}.examples.json.gz`,gzipSync(JSON.stringify({format:'research-only-core-mvp-v1',config,examples})))
writeFileSync(`${out}.summary.json`,JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({id:config.id,games:rows.length,elapsedSeconds:result.elapsedSeconds}))
