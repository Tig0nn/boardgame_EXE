import {readFileSync,writeFileSync} from 'node:fs'
import {gzipSync} from 'node:zlib'
import {play} from './policy.mjs'
import {policies,seeds} from './spec.mjs'
import {replay} from './replay.mjs'
import {summarize} from './stats.mjs'
const [configPath,jobPath,target]=process.argv.slice(2),c=JSON.parse(readFileSync(configPath)),job=JSON.parse(readFileSync(jobPath)),rows=[],examples=[]
const started=performance.now()
for(const id of job.policies){
  const p=policies.find(p=>p.id===id)
  for(const seed of seeds(job.phase,job.seeds))rows.push(play(seed,p,c))
  if(job.examplePolicies?.includes(id)){const example=play(seeds(job.phase,job.seeds)[0],p,c,{trace:true});replay(example.state,c);examples.push(example)}
}
writeFileSync(`${target}.rows.json.gz`,gzipSync(JSON.stringify(rows)))
if(examples.length)writeFileSync(`${target}.replays.json.gz`,gzipSync(JSON.stringify({format:'b18-multi-course-research-v1',config:c,examples})))
writeFileSync(`${target}.summary.json`,JSON.stringify({id:c.id,n:rows.length,policies:Object.fromEntries(job.policies.map(p=>[p,summarize(rows.filter(r=>r.policy===p))]))},null,2)+'\n')
console.log(JSON.stringify({id:c.id,n:rows.length,seconds:(performance.now()-started)/1000}))
