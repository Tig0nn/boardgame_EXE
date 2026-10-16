import {createAdapter,cleanup} from './adapter.mjs'
import {config} from './spec.mjs'
import {execFileSync} from 'node:child_process'
import {join,resolve} from 'node:path'
const results=[]
for(const [system,layout]of [['A-baseline','L4-original'],['S2-extension','L3-bank'],['I3-choice','L2-spaced'],['S4-decay','L3-personal']]){
  const dir=createAdapter(config(system,layout))
  try{const result=execFileSync(process.execPath,['--experimental-strip-types',join(dir,'scripts/research/multi-course/integration-worker.mjs'),resolve('.')],{encoding:'utf8',maxBuffer:1e6});results.push(JSON.parse(result));console.log(result.trim())}finally{cleanup(dir)}
}
console.log(JSON.stringify({researchReplays:results.reduce((n,r)=>n+r.replayed,0),productionBaselineReplays:12}))
