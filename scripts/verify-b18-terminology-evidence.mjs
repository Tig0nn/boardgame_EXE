import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {readFileSync,readdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const out='docs/playtests/b18-terminology',target=`${out}/manifest.json`,base='17f2aa1dc4958306db90673620566a90b3b02fac'
const implementation='670bee4c6fa74e476482800029ab6249de95a383'
const json=p=>JSON.parse(readFileSync(p,'utf8'))
const files=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(`${d}/${e.name}`):[`${d}/${e.name}`])
const describe=(path,normalize=false)=>{const raw=readFileSync(path),b=normalize?Buffer.from(raw.toString('utf8').replaceAll('\r\n','\n')):raw;return {path,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')}}
const historical=[]
for(const path of ['docs/playtests/b18-beginner-ux/manifest.json','docs/playtests/core-mvp-b18-multi-course/manifest.json']){
 const previous=json(path)
 for(const a of previous.artifacts)assert.deepEqual(describe(a.path),a,`Historical artifact changed: ${a.path}`)
 historical.push({manifest:path,artifacts:previous.artifacts.length})
}
assert.equal(execFileSync('git',['diff','--name-only',base,'--','src/game','src/data','scripts/research','docs/research'],{encoding:'utf8'}).trim(),'','Engine/economics/RNG/schemas/research must be unchanged')
if(process.argv.includes('--check')){
 const m=json(target)
 for(const a of m.sourceFiles)assert.deepEqual(describe(a.path,true),a,a.path)
 for(const a of m.artifacts)assert.deepEqual(describe(a.path),a,a.path)
 assert.deepEqual(files(out).filter(p=>p!==target).sort(),m.artifacts.map(a=>a.path).sort())
 console.log(JSON.stringify({manifestVerified:true,sourceFiles:m.sourceFiles.length,artifacts:m.artifacts.length,historical}));process.exit(0)
}
for(const [stage,tests,ui]of [['baseline',339,3],['after',343,4]]){
 for(const [kind,count]of [['tests',tests],['ui',ui]]){const s=readFileSync(`${out}/${stage}-${kind}.txt`,'utf8');assert.match(s,new RegExp(`# pass ${count}\\b`));assert.match(s,/# fail 0\b/)}
 for(const platform of ['desktop','mobile'])assert.match(readFileSync(`${out}/${stage}-${platform}-build.txt`,'utf8'),/built in/)
 assert.doesNotMatch(readFileSync(`${out}/${stage}-lint.txt`,'utf8'),/\b[1-9]\d* problems?\b|\berror\b/)
 assert.match(readFileSync(`${out}/${stage}-parity.txt`,'utf8'),/"matchedFrozenGames":13/)
}
const before=json(`${out}/baseline-replay-verification.json`),after=json(`${out}/after-replay-verification.json`)
assert.equal(before.passed,77);assert.equal(after.passed,81);assert.equal(after.failures,0)
for(const old of before.results){const current=after.results.find(a=>a.path===old.path);assert.ok(current);assert.equal(current.sha256,old.sha256);assert.equal(current.matched,true)}
const screensBefore=json(`${out}/before/screens.json`),screens=json(`${out}/after/screens.json`),browser=json(`${out}/after/browser-checks.json`),desktop=json(`${out}/after/desktop-browser-verification.json`),board=json(`${out}/after/desktop-board-verification.json`),audit=json(`${out}/language-audit.json`)
for(const result of [screensBefore,screens,browser,desktop,board])assert.deepEqual(result.errors,[])
assert.equal(browser.financialStateUnchanged,true);assert.equal(browser.checks.length,40)
assert.equal(browser.checks.filter(c=>c.types?.length===9).length,2)
assert.ok(browser.checks.filter(c=>c.tip).every(c=>c.overlaps===0&&c.tip.font==='14px'))
assert.equal(board.readOnlyInspection,true);assert.equal(board.keyboardFocusReturned,true);assert.equal(board.result.won,false)
assert.equal(desktop.results.find(r=>r.fullGame).result.won,true)
assert.deepEqual(audit.findings,[])
const paths=files(out).filter(p=>p!==target).sort()
const sources=execFileSync('git',['diff','--name-only',base],{encoding:'utf8'}).trim().split(/\r?\n/).filter(p=>p&&!p.startsWith(`${out}/`))
sources.push('src/components/glossary.ts','src/components/FinancialTerm.tsx','src/components/FinancialTerm.css','tests/glossary.test.ts','scripts/diagnostics/terminology-ui.test.ts','scripts/diagnostics/audit-terminology.mjs','scripts/diagnostics/terminology-browser.mjs','scripts/diagnostics/terminology-checkpoints.ts','scripts/diagnostics/terminology-desktop.mjs','scripts/diagnostics/terminology-desktop-board.mjs','scripts/diagnostics/terminology-screens.mjs','scripts/diagnostics/verify-terminology-replays.ts','scripts/verify-b18-terminology-evidence.mjs','tasks/b18-terminology.md','docs/B18_MVP_TERMINOLOGY_UX_REPORT.md')
writeFileSync(target,JSON.stringify({format:'b18-terminology-ux-v1',date:'2026-10-19',branch:'codex/mvp-b18-terminology-ux',base,
 implementation,baseline:{productTests:339,ssrTests:3,replays:77,researchGames:13,researchSnapshots:2306},
 verified:{productTests:343,ssrTests:4,replays:81,oldReplayHashesUnchanged:77,newNaturalCheckpoints:2,newDesktopFullGames:2,researchGames:13,researchSnapshots:2306,lint:true,desktopBuild:true,mobileBuild:true,browserChecks:40,desktopNineTileTypes:true,mobileNineTileTypes:[320,390],keyboardFocusReturned:true,financialStateUnchanged:true,jsErrors:0,englishFindings:0,intentionalEnglish:audit.intentional,reviewedExceptions:audit.exceptions,historicalArtifacts:historical,screenshots:paths.filter(p=>p.endsWith('.png')).length},
 scope:{uiOnly:true,engineChanged:false,economicsChanged:false,rngChanged:false,saveReplaySchemasChanged:false,archivedLogTextChanged:false,researchRerun:false,humanPlaytest:false,merged:false,manuallyDeployed:false,productionAliasChanged:false,ownerReviewPending:true},
 screenshotSources:{pairedSeed:'TERMS-1',mobileResult:'docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz',desktopResultBefore:'docs/playtests/b18-beginner-ux/after/desktop-result.png',desktopResultAfter:'Actual Desktop UI full game TRADING-AB-MAIN-0',creditCheckpoints:'Exact replay of BOND-V25-0 and BOND-V25-59 to first matching START summary; no injected status'},
 hashing:'Source UTF8 normalized to LF. Evidence is raw-byte SHA256, protected by scoped -text attributes.',sourceFiles:[...new Set(sources)].sort().map(p=>describe(p,true)),artifacts:paths.map(p=>describe(p))},null,2)+'\n')
console.log(JSON.stringify({manifestWritten:true,artifacts:paths.length,sources:new Set(sources).size,historical}))
