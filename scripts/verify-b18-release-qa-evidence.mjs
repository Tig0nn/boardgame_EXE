import assert from 'node:assert/strict'
import {readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const out='docs/playtests/b18-release-qa',target=`${out}/manifest.json`,base='927e53e2189bd6d901ed494791d9dc7e912358a6'
const json=p=>JSON.parse(readFileSync(p,'utf8')),text=p=>readFileSync(p,'utf8')
const files=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(`${d}/${e.name}`):[`${d}/${e.name}`])
const describe=(path,normalize=false)=>{const raw=readFileSync(path),b=normalize?Buffer.from(raw.toString('utf8').replaceAll('\r\n','\n')):raw;return {path,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')}}
assert.equal(execFileSync('git',['diff','--name-only',base,'--','src','mobile_app/src','package.json','package-lock.json','mobile_app/package.json','mobile_app/package-lock.json','scripts/research','docs/research'],{encoding:'utf8'}).trim(),'','QA must not modify product, engine, schemas, economics or research')
const historical=[]
for(const name of ['b18-language-cleanup','b18-terminology','b18-beginner-ux','core-mvp-b18-multi-course']){
 const path=`docs/playtests/${name}/manifest.json`,m=json(path)
 for(const a of m.artifacts)assert.deepEqual(describe(a.path),a,`Archived artifact ${a.path}`)
 if(name==='b18-language-cleanup')for(const s of m.sourceFiles)assert.deepEqual(describe(s.path,true),s,`Base source ${s.path}`)
 const gitBytes=execFileSync('git',['show',`${base}:${path}`]);assert.equal(describe(path).sha256,createHash('sha256').update(gitBytes).digest('hex'))
 historical.push({manifest:describe(path),artifacts:m.artifacts.length})
}
assert.equal(historical.reduce((n,h)=>n+h.artifacts,0),471)
const deployment=[]
for(const kind of ['mobile','desktop']){
 const d=json(`${out}/${kind}-deployment.json`),p=json(`${out}/${kind}-provenance.json`)
 assert.equal(d.readyState,'READY');assert.equal(d.target,'preview');assert.equal(p.sha,base);assert.equal(p.gitSource.sha,base);assert.equal(d.id,p.id)
 deployment.push({kind,id:d.id,url:d.url,readyState:d.readyState,sha:p.sha})
}
for(const [kind,count]of [['product',349],['ssr',46]]){
 const s=text(`${out}/${kind}-tests.txt`);assert.match(s,new RegExp(`# pass ${count}\\b`));assert.match(s,/# fail 0\b/)
}
for(const kind of ['desktop','mobile'])assert.match(text(`${out}/build-${kind}.txt`),/built in/)
assert.doesNotMatch(text(`${out}/lint.txt`),/\b[1-9]\d* problems?\b|\berror\b/i)
const old=json(`${out}/historical-replays.json`),previous=json('docs/playtests/b18-language-cleanup/after-replay-verification.json')
assert.equal(old.passed,81);assert.equal(old.failures,0);assert.equal(old.results.length,81)
for(const r of old.results){assert.equal(r.matched,true);assert.equal(r.sha256,previous.results.find(a=>a.path===r.path)?.sha256);assert.equal(r.sha256,describe(r.path).sha256)}
assert.match(text(`${out}/parity.txt`),/"matchedFrozenGames":13,"phases":3,"allEconomicSnapshotsEqual":true/)
assert.equal(json('docs/playtests/core-mvp-b18-multi-course/research-parity.json').results.reduce((n,r)=>n+r.checkedSnapshots,0),2306)
const probes=json(`${out}/browser-probe.json`)
assert.equal(probes.results.length,6)
for(const r of probes.results){assert.equal(r.http,200);assert.equal(r.appLoaded,true);assert.equal(r.protection,false);assert.deepEqual(r.errors,[]);assert.deepEqual(r.consoleErrors,[]);assert.deepEqual(r.failedRequests,[])}
const surfaces=json(`${out}/surfaces/results.json`),storage=json(`${out}/storage/results.json`),games=json(`${out}/new-game-verification.json`),stock=json(`${out}/stock-resale/results.json`)
assert.equal(surfaces.checks.length,268);assert.deepEqual(surfaces.issues,[]);assert.deepEqual(surfaces.errors,[])
assert.equal(storage.checks.length,16);assert.deepEqual(storage.errors,[]);assert.equal(storage.issues.length,1);assert.equal(storage.issues[0].id,'RQA-01');assert.equal(storage.issues[0].severity,'P0')
assert.equal(games.results.length,16);assert.equal(games.completeNaturalGames,13);assert.equal(games.allReplayed,true);assert.equal(games.allFinancialOutcomesExact,true)
assert.ok(games.results.every(r=>r.replayed&&r.goalAccountingExact));assert.equal(stock.passed,true);assert.deepEqual(stock.errors,[])
assert.ok(games.results.some(r=>r.counts['fund-bonds']===3));assert.ok(games.results.some(r=>r.counts['fund-savings']>0));assert.ok(games.results.some(r=>r.counts['fund-debt']>0))
assert.match(text('docs/B18_MVP_RELEASE_READINESS_REPORT.md'),/NO-GO/)
const sources=['docs/B18_MVP_RELEASE_READINESS_REPORT.md','tasks/b18-release-qa.md','scripts/verify-b18-release-qa-evidence.mjs',...['plan-release-funding.ts','release-qa-gameplay.mjs','release-qa-probe.mjs','release-qa-storage.mjs','release-qa-surfaces.mjs','release-stock-checkpoint.ts','release-stock-resale.mjs','verify-release-gameplay.ts','verify-release-replays.ts'].map(p=>`scripts/diagnostics/${p}`)]
if(process.argv.includes('--check')){
 const m=json(target);assert.equal(m.base,base);assert.equal(m.verdict,'NO-GO')
 for(const a of m.sourceFiles)assert.deepEqual(describe(a.path,true),a,a.path)
 for(const a of m.artifacts)assert.deepEqual(describe(a.path),a,a.path)
 assert.deepEqual(files(out).filter(p=>p!==target).sort(),m.artifacts.map(a=>a.path).sort())
 console.log(JSON.stringify({manifestVerified:true,sourceFiles:m.sourceFiles.length,artifacts:m.artifacts.length,unchangedHistoricalArtifacts:471,verdict:m.verdict,openP0:1}))
}else{
 const artifacts=files(out).filter(p=>p!==target).sort().map(p=>describe(p))
 writeFileSync(target,JSON.stringify({format:'b18-release-readiness-qa-v1',date:'2026-10-20',timezone:'Asia/Bangkok',branch:'codex/mvp-b18-release-qa',base,verdict:'NO-GO',openIssues:storage.issues,deployments:deployment,
 verified:{product:349,ssr:46,historicalReplays:81,researchGames:13,researchSnapshots:2306,newExportedLogs:16,naturalCompleteUiGames:13,surfaceChecks:268,storageChecks:16,probeCases:6,pageErrors:0,probeConsoleErrors:0,lint:true,desktopBuild:true,mobileBuild:true,historicalArtifacts:471},
 browsers:[...new Map(probes.results.map(r=>[r.browser,{browser:r.browser,version:r.version}])).values()],viewports:[320,390,768,1440],historical,
 limitations:['WebKit Windows is not native Safari/iOS. Physical devices unverified.','Viewport resize approximates rotation/virtual keyboard; CSS zoom is not native browser zoom.','Firefox/WebKit full games cover Mobile; Desktop there is covered through first transaction and viewport matrix.','Initial Desktop harness selector failures remain documented, then rerun successfully.','One bounded legal-engine seed planning pass is not UI evidence; selected seed was played independently. Stocks fixture is a replay prefix, not a complete new UI game.'],
 scope:{productSourceChanged:false,economicsChanged:false,engineChanged:false,schemaChanged:false,goldenChanged:false,researchStudy:false,humanPlaytest:false,merged:false,manualDeployment:false,productionPromoted:false,aliasChanged:false,ownerApprovalPending:true},
 hashing:'Source normalized UTF8 LF; raw-byte artifact SHA256. Manifest excludes itself. Archived source checks use the exact candidate manifest only.',sourceFiles:sources.sort().map(p=>describe(p,true)),artifacts},null,2)+'\n')
 console.log(JSON.stringify({manifestWritten:true,sourceFiles:sources.length,artifacts:artifacts.length,verdict:'NO-GO'}))
}
