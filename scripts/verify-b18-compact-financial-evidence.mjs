import{readFileSync,writeFileSync,readdirSync}from'node:fs'
import{createHash}from'node:crypto'
import{execFileSync}from'node:child_process'
import assert from'node:assert/strict'
const root='docs/playtests/b18-compact-financial-ui',path=`${root}/manifest.json`,base='bd5925a9276eefb814cf04b78b67deb67fa36c95'
const hash=b=>createHash('sha256').update(b).digest('hex')
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim()
const sourceHash=p=>hash(readFileSync(p,'utf8').replaceAll('\r\n','\n'))
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(`${dir}/${e.name}`):[`${dir}/${e.name}`])}
if(process.argv.includes('--write')){
 const sources=git('diff','--name-only',base,'--','src','mobile_app/src','scripts','tests').split('\n').filter(Boolean).sort().map(path=>({path,sha256:sourceHash(path)}))
 const artifacts=files(root).filter(p=>p!==path).sort().map(path=>{const b=readFileSync(path);return{path,sha256:hash(b),bytes:b.length}})
 writeFileSync(path,JSON.stringify({base,branch:'codex/b18-compact-financial-ui',implementationCommit:git('rev-parse','HEAD'),sourceHash:'UTF-8 normalized LF',artifactHash:'raw bytes',sources,artifacts},null,2)+'\n')
}
const m=JSON.parse(readFileSync(path,'utf8'))
assert.equal(m.base,base)
assert.equal(git('diff','--name-only',base,'--','src/game','src/data','mobile_app/src/game'),'','Protected engine/data must remain unchanged')
for(const s of m.sources)assert.equal(sourceHash(s.path),s.sha256,s.path)
for(const a of m.artifacts){const b=readFileSync(a.path);assert.equal(hash(b),a.sha256,a.path);assert.equal(b.length,a.bytes,a.path)}
for(const f of ['product-tests','ssr-tests'])assert.match(readFileSync(`${root}/${f}.txt`,'utf8'),/# fail 0/)
for(const stage of ['before','after','after-payment-wrap']){
 const r=JSON.parse(readFileSync(`${root}/${stage}/results.json`,'utf8'));assert.deepEqual(r.errors,[])
 for(const e of r.consoleErrors)assert.ok(e.location.url.endsWith('/favicon.ico'),JSON.stringify(e))
 assert.ok(r.checks.length>0)
}
const compat=JSON.parse(readFileSync(`${root}/compatibility.json`,'utf8'));assert.equal(compat.historicalReplays,81);assert.equal(compat.protectedArtifacts,1846)
for(const old of compat.manifests){assert.equal(hash(readFileSync(old.path)),old.sha256,old.path);for(const a of JSON.parse(readFileSync(old.path,'utf8')).artifacts)assert.equal(hash(readFileSync(a.path)),a.sha256,a.path)}
console.log(JSON.stringify({passed:true,sources:m.sources.length,artifacts:m.artifacts.length,implementationCommit:m.implementationCommit,protectedHistoricalArtifacts:compat.protectedArtifacts}))
