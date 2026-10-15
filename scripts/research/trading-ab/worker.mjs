import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { playTrading } from './policy.mjs'
import { summarize } from './stats.mjs'
import { replayResearch } from '../core-mvp/replay.mjs'
const [configPath,jobPath,target]=process.argv.slice(2),c=JSON.parse(readFileSync(configPath,'utf8')),job=JSON.parse(readFileSync(jobPath,'utf8')),start=performance.now(),rows=[]
for(const strategy of job.strategies)for(const seed of job.seeds)rows.push(playTrading(seed,strategy,c,job.arm,job.heuristic))
writeFileSync(`${target}.rows.json.gz`,gzipSync(JSON.stringify(rows)))
const policies=Object.fromEntries(job.strategies.map(p=>[p,summarize(rows.filter(r=>r.policy===p))]))
const examples=job.strategies.map(p=>playTrading(job.seeds[0],p,c,job.arm,job.heuristic,{trace:true}))
for(const e of examples){replayResearch(e.state,c);const repeat=playTrading(e.row.seed,e.row.policy,c,job.arm,job.heuristic,{trace:true});if(JSON.stringify(e)!==JSON.stringify(repeat))throw Error('Non-deterministic trading replay')}
writeFileSync(`${target}.examples.json.gz`,gzipSync(JSON.stringify({format:'research-only-trading-ab-v1',config:c,arm:job.arm,heuristic:job.heuristic,examples})))
writeFileSync(`${target}.summary.json`,JSON.stringify({id:c.id,arm:job.arm,heuristic:job.heuristic,games:rows.length,elapsedSeconds:(performance.now()-start)/1000,policies},null,2)+'\n')
console.log(JSON.stringify({id:c.id,arm:job.arm,heuristic:job.heuristic,games:rows.length,seconds:(performance.now()-start)/1000}))
