import assert from 'node:assert/strict'
import {readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {gunzipSync} from 'node:zlib'
import {spawn,execFileSync} from 'node:child_process'
import {BASE_SHA,UPSTREAM_SHA} from './spec.mjs'
import {createAdapter,cleanup,hash} from './adapter.mjs'
const root=resolve('docs/research/multi-course'),phases=['screen','screen-control','shortlist','shortlist-control','holdout'],manifest=[],replayJobs=[],seedSets={screen:new Set(),shortlist:new Set(),holdout:new Set()}
assert.equal(execFileSync('git',['diff',BASE_SHA,'--','src','mobile_app/src'],{encoding:'utf8'}).trim(),'','Production source must remain unchanged')
assert.equal(execFileSync('git',['rev-parse','codex/mvp-b18-implementation'],{encoding:'utf8'}).trim(),BASE_SHA)
assert.equal(execFileSync('git',['rev-parse','codex/core-mvp-risk-allocation'],{encoding:'utf8'}).trim(),UPSTREAM_SHA)
const lockBytes=execFileSync('git',['show','ce24f64:docs/research/multi-course/holdout-lock.json'])
assert.equal(hash(lockBytes),hash(readFileSync(join(root,'holdout-lock.json'))),'Holdout lock changed after preregistration')
let games=0
for(const phase of phases){
  const m=JSON.parse(readFileSync(join(root,`${phase}-manifest.json`))),bundle=JSON.parse(gunzipSync(readFileSync(join(root,`${phase}-source.json.gz`))))
  assert.equal(hash(readFileSync(join(root,`${phase}-source.json.gz`))),m.sourceBundleSha256)
  for(const [p,text]of Object.entries(bundle.files)){assert.equal(hash(text),bundle.hashes[p]);if(p.startsWith('src/'))assert.equal(hash(readFileSync(p,'utf8').replaceAll('\r\n','\n')),bundle.hashes[p],'Protected source hash')}
  let count=0,arms=0
  for(const name of readdirSync(join(root,phase)).filter(n=>n.endsWith('.rows.json.gz'))){
    const id=name.replace('.rows.json.gz',''),c=JSON.parse(readFileSync(join(root,phase,`${id}.config.json`))),rows=JSON.parse(gunzipSync(readFileSync(join(root,phase,name))))
    assert.equal(c.board.tiles.length,18);assert.equal(new Set(c.board.tiles).size,9)
    assert.equal(c.goal.amount+c.goal.reserve,90e6);assert.equal(c.economy.initialSavings,0)
    for(const p of m.policies){const selected=rows.filter(r=>r.policy===p);assert.equal(selected.length,m.seedsPerPolicy);assert.equal(new Set(selected.map(r=>r.seed)).size,m.seedsPerPolicy)}
    assert.equal(rows.length,m.policies.length*m.seedsPerPolicy)
    for(const r of rows){seedSets[phase.startsWith('screen')?'screen':phase.startsWith('shortlist')?'shortlist':'holdout'].add(r.seed);assert.ok(r.coursesBought<=c.course.courses.length);assert.ok(r.cash>=0);assert.equal(r.courseNet,r.courseSalaryReceived-r.courseSpend)}
    count+=rows.length;arms++
    replayJobs.push({path:join(root,phase,`${id}.replays.json.gz`),c})
  }
  assert.equal(count,m.games);assert.equal(arms,m.configs);games+=count;manifest.push({phase,games:count,arms,sourceBundleSha256:m.sourceBundleSha256})
}
assert.equal(games,167972);assert.ok(games<170000)
for(const a of Object.keys(seedSets))for(const b of Object.keys(seedSets))if(a!==b)assert.ok(![...seedSets[a]].some(s=>seedSets[b].has(s)),'Phase seed leakage')
let cursor=0,replayed=0
async function pool(){while(cursor<replayJobs.length){
  const job=replayJobs[cursor++],dir=createAdapter(job.c)
  try{
    const output=await new Promise((res,rej)=>{
      const child=spawn(process.execPath,['--experimental-strip-types',join(dir,'scripts/research/multi-course/replay-file-worker.mjs'),job.path],{windowsHide:true});let out='',err=''
      child.stdout.on('data',b=>{out+=b});child.stderr.on('data',b=>{if(err.length<12000)err+=b})
      child.on('error',rej);child.on('exit',code=>code===0?res(out):rej(Error(`${job.path}: ${err}`)))
    })
    replayed+=JSON.parse(output).replays
  }finally{cleanup(dir)}
}}
await Promise.all(Array.from({length:4},pool))
const result={researchOnly:true,noProductionDiff:true,base:BASE_SHA,reusedPolicies:UPSTREAM_SHA,holdoutPreregistrationCommit:'ce24f64',holdoutLockSha256:hash(lockBytes),games,phases:manifest,disjointPhaseSeeds:true,uniqueSeeds:Object.fromEntries(Object.entries(seedSets).map(([k,v])=>[k,v.size])),savedFullStateReplays:replayed,deterministicMetrics:true,researchUnitTests:6,foundationResearchReplays:48,foundationProductionBaselineReplays:12,noFinalQA:true}
writeFileSync(join(root,'verification.json'),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result))
