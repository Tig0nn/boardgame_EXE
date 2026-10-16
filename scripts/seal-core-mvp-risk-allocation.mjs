import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { out, load, save, sources, verifyProtected } from './research/risk-allocation/run.mjs'
import { hash } from './research/core-mvp/adapter.mjs'

// Refresh documentation/source packaging after an already successful full
// verification; refuse if any previously sealed experimental data changed.
const verified=load('verification.json'),frozen=load('holdout-freeze.json')
assert.equal(verified.rowsVerified,27800);assert.equal(verified.recordedActionReplays,150)
for(const [p,h]of Object.entries(frozen.sourceHashes))assert.equal(sources()[p],h,`Frozen simulator changed: ${p}`)
verifyProtected()
if(existsSync(join(out,'artifact-manifest.json')))for(const f of load('artifact-manifest.json').files){
  if(f.path.endsWith('.md')||f.path==='analysis-source.json.gz')continue
  const b=readFileSync(join(out,f.path)),actual=hash(f.normalization==='UTF-8 LF'?b.toString('utf8').replace(/\r\n/g,'\n'):b)
  if(actual!==f.sha256&&f.path.endsWith('.tap'))assert.equal(hash(b.toString('utf8').replace(/\r?\n/g,'\r\n')),f.sha256,'Only CRLF-to-LF normalization is allowed for the captured test log')
  else assert.equal(actual,f.sha256,`Verified data changed: ${f.path}`)
}
const paths=['scripts/analyze-core-mvp-risk-allocation.mjs','scripts/freeze-core-mvp-risk-allocation.mjs','scripts/report-core-mvp-risk-allocation.mjs','scripts/verify-core-mvp-risk-allocation.mjs','scripts/seal-core-mvp-risk-allocation.mjs','scripts/risk-allocation-analysis.test.mjs','scripts/trading-ab-inference.mjs']
const source=Object.fromEntries(paths.map(p=>[p,readFileSync(p,'utf8').replace(/\r\n/g,'\n')]))
writeFileSync(join(out,'analysis-source.json.gz'),gzipSync(JSON.stringify({files:source,hashes:Object.fromEntries(Object.entries(source).map(([p,t])=>[p,hash(t)]))})))
const files=[]
function walk(dir){for(const n of readdirSync(dir)){const p=join(dir,n);if(statSync(p).isDirectory())walk(p);else if(n!=='artifact-manifest.json'){const b=readFileSync(p),text=/\.(json|md|csv|svg|tap)$/.test(n);files.push({path:p.slice(out.length+1).replaceAll('\\','/'),sha256:hash(text?b.toString('utf8').replace(/\r\n/g,'\n'):b),normalization:text?'UTF-8 LF':'binary'})}}}
walk(out)
save('artifact-manifest.json',{generatedAt:new Date().toISOString(),files,external:['docs/CORE_MVP_RISK_ALLOCATION_RESEARCH.md','tasks/core-mvp-risk-allocation.md'].map(path=>({path,sha256:hash(readFileSync(path,'utf8').replace(/\r\n/g,'\n')),normalization:'UTF-8 LF'})),sealOnly:true,experimentalDataUnchangedSinceFullVerification:true})
console.log(JSON.stringify({sealedFiles:files.length,dataUnchanged:true,fullVerificationRows:verified.rowsVerified}))
