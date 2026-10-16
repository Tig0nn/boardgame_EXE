import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs'
import { join, resolve, dirname, sep } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import { out, load, save, sources, verifyProtected } from './research/risk-allocation/run.mjs'
import { createStudyAdapter } from './research/risk-allocation/adapter.mjs'
import { hash, cleanupAdapter } from './research/core-mvp/adapter.mjs'
import { summarize } from './research/risk-allocation/stats.mjs'
import { replayGameLog } from './diagnostics/replay-game-log.ts'
import { raw, clusteredDelta, purposeful } from './analyze-core-mvp-risk-allocation.mjs'

if(process.argv.includes('--seal-only')){await import('./seal-core-mvp-risk-allocation.mjs');process.exit(0)}

const phases=['audit','screen','reserve','course-control','reserve-variant','holdout']
let rowsVerified=0,replays=0,games=0;const phaseSeeds={},frozen=load('holdout-freeze.json')
for(const [p,h]of Object.entries(frozen.sourceHashes))assert.equal(sources()[p],h,`No simulator tuning after freeze: ${p}`)
const correction=load('analysis-correction.json')
assert.equal(correction.previousHash,frozen.analysisSourceHashes[correction.path])
assert.equal(correction.correctedHash,hash(readFileSync(correction.path,'utf8').replace(/\r\n/g,'\n')))
assert.equal(correction.holdoutResultsRead,false)
for(const phase of phases){
  const manifest=load(`${phase}-manifest.json`),result=load(`${phase}-results.json`),bundle=JSON.parse(gunzipSync(readFileSync(join(out,`${phase}-source.json.gz`))))
  for(const [p,h]of Object.entries(manifest.sourceHashes))assert.equal(hash(bundle.files[p]),h,`Frozen source ${phase}/${p}`)
  phaseSeeds[phase]=new Set(manifest.seeds);games+=result.games
  assert.equal(result.games,manifest.jobs.reduce((n,j)=>n+j.strategies.length*manifest.count,0))
  for(const job of manifest.jobs){
    const c=job.config,rows=raw(phase,job.id),summary=load(`${phase}/${job.id}.summary.json`)
    assert.equal(hash(JSON.stringify(c)),manifest.configHashes[job.id]);assert.deepEqual(load(`${phase}/${job.id}.config.json`),c)
    assert.equal(new Set(c.board.tiles).size,9);assert.deepEqual(c.economy.personalWeights,[1,1,1]);assert.equal(c.economy.personalActivation,1)
    assert.equal(rows.length,job.strategies.length*manifest.count)
    for(const p of job.strategies){const rs=rows.filter(r=>r.policy===p);assert.equal(rs.length,manifest.count);assert.equal(new Set(rs.map(r=>r.seed)).size,manifest.count);assert.ok(rs.every(r=>phaseSeeds[phase].has(r.seed)));assert.deepEqual(summarize(rs),summary.policies[p]);assert.ok(rs.every(r=>r.personal0+r.personal1+r.personal2plus===1&&r.livingAdjustedDrawdown<=r.rawDrawdown+1))}
    rowsVerified+=rows.length
    const evidence=JSON.parse(gunzipSync(readFileSync(join(out,phase,`${job.id}.examples.json.gz`))))
    assert.equal(evidence.format,'risk-allocation-research-v1');assert.deepEqual(evidence.config,c);assert.equal(evidence.mode,job.mode)
    const dir=createStudyAdapter(c)
    try{
      // Engine inputs/adapters are unchanged; overlay the exact phase policy and
      // metrics instead of assuming today's uncommitted source describes a run.
      for(const p of ['scripts/research/core-mvp/adapter.mjs','scripts/research/trading-ab/adapter.mjs','scripts/research/risk-allocation/adapter.mjs',...Object.keys(manifest.sourceHashes).filter(p=>p.startsWith('src/'))])assert.equal(hash(readFileSync(p,'utf8').replace(/\r\n/g,'\n')),manifest.sourceHashes[p],`Adapter/engine input unchanged: ${p}`)
      for(const [p,text]of Object.entries(bundle.files).filter(([p])=>p.startsWith('scripts/research/'))){const target=resolve(dir,p);assert.ok(target.startsWith(resolve(dir)+sep));mkdirSync(dirname(target),{recursive:true});writeFileSync(target,text)}
      const {replayResearch}=await import(pathToFileURL(join(dir,'scripts/research/core-mvp/replay.mjs'))),{playStudy}=await import(pathToFileURL(join(dir,'scripts/research/risk-allocation/policy.mjs')))
      for(const e of evidence.examples){replayResearch(e.state,c);assert.deepEqual(playStudy(e.row.seed,e.row.policy,c,job.mode),e.row);assert.deepEqual(rows.find(r=>r.policy===e.row.policy&&r.seed===e.row.seed),e.row);replays++}
    }finally{cleanupAdapter(dir)}
  }
  if(phase!=='audit'){
    const analysis=load(`${phase}-analysis.json`)
    for(const job of manifest.jobs){const rows=raw(phase,job.id);for(const p of job.strategies)assert.deepEqual(summarize(rows.filter(r=>r.policy===p)),analysis.groups[job.id].policies[p])}
    for(const pair of analysis.pairs.filter(p=>p.clustered)){
      const a=raw(phase,pair.a),b=raw(pair.oldPhase,pair.b),ps=Object.keys(pair.policies).filter(p=>purposeful.includes(p))
      for(const [k,d]of Object.entries(pair.clustered))assert.deepEqual(clusteredDelta(a,b,k,ps),d)
    }
  }
}
assert.equal(rowsVerified,games)
assert.ok([...phaseSeeds.audit].every(s=>!phaseSeeds.screen.has(s)&&!phaseSeeds.holdout.has(s)))
assert.ok([...phaseSeeds.screen].every(s=>!phaseSeeds.holdout.has(s)))
for(const p of ['reserve','reserve-variant','course-control'])assert.deepEqual([...phaseSeeds[p]],[...phaseSeeds.screen])
assert.deepEqual([...phaseSeeds.holdout],frozen.seeds)
const hm=load('holdout-manifest.json');assert.deepEqual(hm.sourceHashes,frozen.sourceHashes)
assert.deepEqual(hm.jobs.filter(j=>frozen.candidates.includes(j.id)).map(j=>j.id),frozen.candidates)
for(const j of hm.jobs)assert.deepEqual(j.config,frozen.configs[j.id]??frozen.reserveJobs.find(x=>x.id===j.id).config)
const historical=[]
for(const p of ['docs/playtests/atomic-investments-v24/historical-multi-purchase.json.gz','docs/playtests/business-v2_3/browser-game-log.json.gz','docs/playtests/bond-credit-v25/simulation-victory.json.gz']){const b=readFileSync(p),s=replayGameLog(JSON.parse(gunzipSync(b)));historical.push({path:p,sha256:hash(b),seed:s.seed,entries:s.log.length})}
const verification={verifiedAt:new Date().toISOString(),rowsVerified,games,recordedActionReplays:replays,workerRecordedActionReplays:replays,exactPhaseSourceOverlays:true,seedHoldoutDisjoint:true,reserveAndCourseControlsPaired:true,frozenSimulatorUnchanged:true,analysisCorrection:correction,historical,protected:verifyProtected(),researchTestsOnly:true,finalQA:false}
save('verification.json',verification)
const files=['scripts/analyze-core-mvp-risk-allocation.mjs','scripts/freeze-core-mvp-risk-allocation.mjs','scripts/report-core-mvp-risk-allocation.mjs','scripts/verify-core-mvp-risk-allocation.mjs','scripts/seal-core-mvp-risk-allocation.mjs','scripts/risk-allocation-analysis.test.mjs','scripts/trading-ab-inference.mjs']
const source=Object.fromEntries(files.map(p=>[p,readFileSync(p,'utf8').replace(/\r\n/g,'\n')]))
writeFileSync(join(out,'analysis-source.json.gz'),gzipSync(JSON.stringify({files:source,hashes:Object.fromEntries(Object.entries(source).map(([p,t])=>[p,hash(t)]))})))
const artifacts=[]
function walk(dir){for(const n of readdirSync(dir)){const p=join(dir,n);if(statSync(p).isDirectory())walk(p);else if(n!=='artifact-manifest.json'){const b=readFileSync(p),text=/\.(json|md|csv|svg)$/.test(n);artifacts.push({path:p.slice(out.length+1).replaceAll('\\','/'),sha256:hash(text?b.toString('utf8').replace(/\r\n/g,'\n'):b),normalization:text?'UTF-8 LF':'binary'})}}}
walk(out)
const external=['docs/CORE_MVP_RISK_ALLOCATION_RESEARCH.md','tasks/core-mvp-risk-allocation.md']
save('artifact-manifest.json',{generatedAt:new Date().toISOString(),files:artifacts,external:external.map(p=>({path:p,sha256:hash(readFileSync(p,'utf8').replace(/\r\n/g,'\n')),normalization:'UTF-8 LF'}))})
console.log(JSON.stringify({games,replays,historical:historical.length,old:verification.protected,artifacts:artifacts.length}))
