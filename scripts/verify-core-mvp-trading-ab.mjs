import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import { hash, cleanupAdapter } from './research/core-mvp/adapter.mjs'
import { createTradingAdapter } from './research/trading-ab/adapter.mjs'
import { summarize, compare } from './research/trading-ab/stats.mjs'
import { verifyProtected } from './research/trading-ab/run.mjs'
import { replayGameLog } from './diagnostics/replay-game-log.ts'
import { matchedWinInterval } from './trading-ab-inference.mjs'

const out=resolve(process.env.TRADING_AB_OUT??'docs/research/trading-ab'),load=p=>JSON.parse(readFileSync(join(out,p),'utf8'))
let rowsVerified=0,replays=0;const phaseSeeds=[]
for(const phase of ['control','main']){
  const manifest=load(`${phase}-manifest.json`),results=load(`${phase}-results.json`),source=JSON.parse(gunzipSync(readFileSync(join(out,`${phase}-source.json.gz`))))
  for(const [p,expected]of Object.entries(manifest.sourceHashes))assert.equal(hash(source.files[p]),expected,`Frozen source ${p}`)
  phaseSeeds.push(new Set(manifest.seeds))
  assert.equal(results.games,manifest.count*manifest.configs.length*manifest.strategies.length*2)
  for(const c of manifest.configs){
    assert.equal(hash(JSON.stringify(c)),manifest.configHashes[c.id])
    assert.equal(c.economy.personalActivation,1);assert.deepEqual(c.economy.personalWeights,[1,1,1])
    const rows={}
    for(const arm of ['old','new']){
      assert.deepEqual(load(`${phase}/${c.id}.${arm}.config.json`),c)
      rows[arm]=JSON.parse(gunzipSync(readFileSync(join(out,phase,`${c.id}.${arm}.rows.json.gz`))))
      assert.equal(rows[arm].length,manifest.count*manifest.strategies.length)
      const summary=results.summaries.find(s=>s.id===c.id&&s.arm===arm)
      for(const p of manifest.strategies){const group=rows[arm].filter(r=>r.policy===p);assert.equal(new Set(group.map(r=>r.seed)).size,manifest.count);assert.ok(group.every(r=>manifest.seeds.includes(r.seed)));assert.deepEqual(summarize(group),summary.policies[p])}
      rowsVerified+=rows[arm].length
      if(phase==='main'){
        const dir=createTradingAdapter(c,arm)
        try{
          const {replayResearch}=await import(pathToFileURL(join(dir,'scripts/research/core-mvp/replay.mjs'))),{playTrading}=await import(pathToFileURL(join(dir,'scripts/research/trading-ab/policy.mjs')))
          const evidence=JSON.parse(gunzipSync(readFileSync(join(out,phase,`${c.id}.${arm}.examples.json.gz`))))
          assert.equal(evidence.format,'research-only-trading-ab-v1');assert.deepEqual(evidence.config,c);assert.equal(evidence.arm,arm)
          for(const e of evidence.examples){replayResearch(e.state,c);assert.deepEqual(playTrading(e.row.seed,e.row.policy,c,arm,manifest.heuristic),e.row);replays++}
        }finally{cleanupAdapter(dir)}
      }
    }
    if(phase==='control')for(let i=0;i<rows.old.length;i++){const {arm:a,...old}=rows.old[i],{arm:b,...fresh}=rows.new[i];assert.deepEqual(fresh,old)}
    for(const p of manifest.strategies){const pair=compare(rows.new.filter(r=>r.policy===p),rows.old.filter(r=>r.policy===p));assert.deepEqual(pair,results.pairs.find(x=>x.id===c.id).strategies[p]);assert.equal(pair.sameMarketRate,1);assert.equal(pair.sameCreditMarketRate,1);assert.equal(pair.delta.proceeds.sameDiceRate,1);assert.equal(pair.delta.proceeds.sameEncounterRate,1)
      if(phase==='main')assert.deepEqual(matchedWinInterval(rows.new.filter(r=>r.policy===p),rows.old.filter(r=>r.policy===p)),load('comparison.json').candidates.find(x=>x.id===c.id).strategies[p].delta.won.discordance)
    }
  }
}
assert.ok([...phaseSeeds[0]].every(s=>!phaseSeeds[1].has(s)))
const historical=[]
for(const file of ['docs/playtests/atomic-investments-v24/historical-multi-purchase.json.gz','docs/playtests/business-v2_3/browser-game-log.json.gz','docs/playtests/bond-credit-v25/simulation-victory.json.gz']){const bytes=readFileSync(file),s=replayGameLog(JSON.parse(gunzipSync(bytes)));historical.push({file,seed:s.seed,sha256:hash(bytes),entries:s.log.length})}
const verification={verifiedAt:new Date().toISOString(),rowsVerified,mainRecordedActionReplays:replays,workerActionReplays:120,allOldArtifacts:verifyProtected(),historical,phaseSeedsDisjoint:true,pairedPathsAndMarketsMatch:true,negativeControlIdentical:true,finalQA:false}
writeFileSync(join(out,'verification.json'),JSON.stringify(verification,null,2)+'\n')
const analysisFiles=['scripts/report-core-mvp-trading-ab.mjs','scripts/trading-ab-inference.mjs','scripts/verify-core-mvp-trading-ab.mjs']
const analysisSource=Object.fromEntries(analysisFiles.map(p=>[p,readFileSync(p,'utf8').replace(/\r\n/g,'\n')]))
writeFileSync(join(out,'analysis-source.json.gz'),gzipSync(JSON.stringify({files:analysisSource,hashes:Object.fromEntries(Object.entries(analysisSource).map(([p,text])=>[p,hash(text)]))})))
const files=[]
function walk(dir){for(const n of readdirSync(dir)){const path=join(dir,n);if(statSync(path).isDirectory())walk(path);else if(n!=='artifact-manifest.json'){const b=readFileSync(path),text=/\.(json|md|csv)$/.test(n);files.push({path:path.slice(out.length+1).replaceAll('\\','/'),sha256:hash(text?b.toString('utf8').replace(/\r\n/g,'\n'):b),normalization:text?'UTF-8 LF':'binary'})}}}
walk(out);writeFileSync(join(out,'artifact-manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),files},null,2)+'\n')
console.log(JSON.stringify({rowsVerified,replays,historical:historical.length,oldArtifactsVerified:verification.allOldArtifacts.oldArtifactsVerified,files:files.length}))
