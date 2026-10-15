import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { aggregate } from './research/core-mvp/stats.mjs'
import { createAdapter, hash, cleanupAdapter } from './research/core-mvp/adapter.mjs'
const out=resolve(process.env.CORE_MVP_LAB_OUT??'docs/research/core-mvp'),load=p=>JSON.parse(readFileSync(join(out,p),'utf8'))
const artifacts=load('artifact-manifest.json')
for(const f of artifacts.files){const bytes=readFileSync(join(out,f.path));assert.equal(hash(f.hashNormalization==='UTF-8 LF'?bytes.toString('utf8').replace(/\r\n/g,'\n'):bytes),f.sha256,f.path)}
if(process.argv.includes('--hashes-only')){console.log(JSON.stringify({artifactHashesVerified:artifacts.files.length}));process.exit(0)}
const frozen=load('frozen-configs.json'),holdout=load('holdout-manifest.json')
assert.ok(Date.parse(frozen.frozenAt)<Date.parse(holdout.started),'Must freeze before holdout')
const seedSets={},counts={};let examplesReplayed=0,rowsVerified=0
for(const phase of ['broad','shortlist','holdout']){
  const manifest=load(`${phase}-manifest.json`),results=load(`${phase}-results.json`)
  const source=JSON.parse(gunzipSync(readFileSync(join(out,`${phase}-source.json.gz`))))
  for(const [path,expected]of Object.entries(manifest.sourceHashes))assert.equal(hash(source.files[path]),expected,`${phase}: frozen source ${path}`)
  seedSets[phase]=new Set(manifest.job.seeds);counts[phase]=0
  for(const summary of results.summaries){
    const c=load(`${phase}/${summary.id}.config.json`)
    assert.equal(hash(JSON.stringify(c)),summary.configHash)
    const rows=JSON.parse(gunzipSync(readFileSync(join(out,phase,`${c.id}.rows.json.gz`))))
    assert.equal(rows.length,manifest.job.policies.length*manifest.job.seeds.length)
    for(const p of manifest.job.policies){const group=rows.filter(r=>r.policy===p)
      assert.equal(new Set(group.map(r=>r.seed)).size,manifest.job.seeds.length)
      assert.ok(group.every(r=>seedSets[phase].has(r.seed)))
      assert.deepEqual(aggregate(group),summary.policies[p],`${phase}/${c.id}/${p}`)
    }
    counts[phase]+=rows.length
  }
  assert.equal(counts[phase],results.games);rowsVerified+=counts[phase]
}
for(const a of Object.keys(seedSets))for(const b of Object.keys(seedSets))if(a!==b)assert.ok([...seedSets[a]].every(s=>!seedSets[b].has(s)),'Overlapping phase seeds')
// Replay frozen complete examples with recorded actions; recompute first-seed
// results with the frozen policy as a separate determinism check.
for(const c of frozen.configs){
  assert.equal(hash(JSON.stringify(c)),frozen.configHashes[c.id])
  const dir=createAdapter(c)
  try{
    const {replayResearch}=await import(pathToFileURL(join(dir,'scripts/research/core-mvp/replay.mjs')))
    const {play}=await import(pathToFileURL(join(dir,'scripts/research/core-mvp/policy.mjs')))
    const evidence=JSON.parse(gunzipSync(readFileSync(join(out,'holdout',`${c.id}.examples.json.gz`))))
    assert.equal(evidence.format,'research-only-core-mvp-v1');assert.deepEqual(evidence.config,c)
    for(const e of evidence.examples){replayResearch(e.state,c);assert.deepEqual(play(e.row.seed,e.row.policy,c),e.row);examplesReplayed++}
  }finally{cleanupAdapter(dir)}
}
// Normalized production and historical files must match the requested base.
const changed=execFileSync('git',['diff','4b0be454a8dd24bb65f00517f598f751ab333980','--name-only'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean)
assert.ok(changed.every(p=>p.startsWith('scripts/')||p.startsWith('docs/research/core-mvp/')||p==='docs/CORE_MVP_BALANCE_RESEARCH.md'||p==='tasks/core-mvp-balance-lab.md'),`Scope changed: ${changed}`)
const diceFiles=readdirSync(out).filter(p=>/^dice-n\d+-h\d+\.json\.gz$/.test(p)),frequencies=Array(6).fill(0)
for(const p of diceFiles){const n=Number(p.match(/n(\d+)/)[1]),h=Number(p.match(/h(\d+)/)[1]),paths=JSON.parse(gunzipSync(readFileSync(join(out,p))))
  for(const path of paths){let prior=0
    assert.equal(path.completedStarts,h)
    for(const x of path.landings){const d=(x.position-prior+n)%n;assert.ok(d>=1&&d<=6);frequencies[d-1]++;prior=x.position}
    assert.equal(path.landings.length,path.rolls-1)
  }
}
const sum=frequencies.reduce((a,b)=>a+b,0),expected=sum/6,chiSquare=frequencies.reduce((n,k)=>n+(k-expected)**2/expected,0)
// The omitted terminal D6 is conditioned on crossing START, so processed-only
// frequencies are not an iid D6 uniformity test; retain counts descriptively.
writeFileSync(join(out,'verification.json'),JSON.stringify({verifiedAt:new Date().toISOString(),artifactHashesVerified:artifacts.files.length,rowsVerified,counts,examplesReplayed,phaseSeedsDisjoint:true,frozenBeforeHoldout:true,productionUnchanged:true,
  diceProcessedFrequencies:frequencies,processedDiceChiSquareDescriptiveOnly:chiSquare,
  caveat:'Terminal roll omitted from stored landing paths, so processed-only D6 frequencies have stopping-time selection. Uniformity is tested separately on the PRNG, not these frequencies.'},null,2)+'\n')
console.log(JSON.stringify({rowsVerified,examplesReplayed,artifactHashesVerified:artifacts.files.length,productionUnchanged:true}))
