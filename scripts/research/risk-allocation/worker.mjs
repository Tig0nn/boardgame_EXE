import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { playStudy } from './policy.mjs'
import { summarize } from './stats.mjs'
import { replayResearch } from '../core-mvp/replay.mjs'
const [configPath,jobPath,target]=process.argv.slice(2),c=JSON.parse(readFileSync(configPath,'utf8')),job=JSON.parse(readFileSync(jobPath,'utf8')),started=performance.now(),rows=[]
for(const p of job.strategies)for(const seed of job.seeds)rows.push(playStudy(seed,p,c,job.mode))
const examples=job.strategies.map(p=>playStudy(job.seeds[0],p,c,job.mode,{trace:true}))
for(const e of examples){replayResearch(e.state,c);if(JSON.stringify(playStudy(e.row.seed,e.row.policy,c,job.mode))!==JSON.stringify(e.row))throw Error('Non-deterministic study')}
writeFileSync(`${target}.rows.json.gz`,gzipSync(JSON.stringify(rows)))
writeFileSync(`${target}.examples.json.gz`,gzipSync(JSON.stringify({format:'risk-allocation-research-v1',config:c,mode:job.mode,examples})))
writeFileSync(`${target}.summary.json`,JSON.stringify({id:job.id,n:rows.length,elapsedSeconds:(performance.now()-started)/1000,policies:Object.fromEntries(job.strategies.map(p=>[p,summarize(rows.filter(r=>r.policy===p))]))},null,2)+'\n')
console.log(JSON.stringify({id:job.id,n:rows.length,seconds:(performance.now()-started)/1000}))
