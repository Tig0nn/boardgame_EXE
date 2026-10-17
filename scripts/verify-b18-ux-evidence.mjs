import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {readFileSync,readdirSync,writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const out='docs/playtests/b18-beginner-ux',target=`${out}/manifest.json`
const base='ba1c8115aa241143053085089132807c48f0bc10',implementation='0dc4c40d095f79034e78fcb86ad81c3d209bc80f'
const sha=b=>createHash('sha256').update(b).digest('hex')
const describe=(path,normalize=false)=>{const raw=readFileSync(path),b=normalize?Buffer.from(raw.toString('utf8').replaceAll('\r\n','\n')):raw;return {path,bytes:b.length,sha256:sha(b)}}
const files=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(`${d}/${e.name}`):[`${d}/${e.name}`])
const json=p=>JSON.parse(readFileSync(p,'utf8'))
function preserved(){
  const previous=json('docs/playtests/core-mvp-b18-multi-course/manifest.json')
  for(const a of previous.artifacts)assert.deepEqual(describe(a.path),a,`Previous evidence changed: ${a.path}`)
  const changed=execFileSync('git',['diff','--name-only',base,'--','src/game','src/data','scripts/research','docs/research'],{encoding:'utf8'}).trim()
  assert.equal(changed,'','Frozen engine/economics/research must be unchanged')
  return previous.artifacts.length
}
const oldArtifacts=preserved()
if(process.argv.includes('--check')){
  const m=json(target)
  for(const a of m.sourceFiles)assert.deepEqual(describe(a.path,true),a,a.path)
  for(const a of m.artifacts)assert.deepEqual(describe(a.path),a,a.path)
  assert.deepEqual(files(out).filter(p=>p!==target).sort(),m.artifacts.map(a=>a.path).sort())
  console.log(JSON.stringify({manifestVerified:true,sourceFiles:m.sourceFiles.length,artifacts:m.artifacts.length,previousArtifactsUnchanged:oldArtifacts}));process.exit(0)
}
for(const [stage,tests,ui]of [['baseline',334,2],['after',339,3]]){
  for(const [kind,count]of [['tests',tests],['ui',ui]]){const text=readFileSync(`${out}/${stage}-${kind}.txt`,'utf8');assert.match(text,new RegExp(`# pass ${count}\\b`));assert.match(text,/# fail 0\b/)}
  for(const platform of ['desktop','mobile'])assert.match(readFileSync(`${out}/${stage}-${platform}-build.txt`,'utf8'),/built in/)
  assert.doesNotMatch(readFileSync(`${out}/${stage}-lint.txt`,'utf8'),/\b[1-9]\d* problems?\b/)
}
assert.match(readFileSync(`${out}/after-parity.txt`,'utf8'),/"matchedFrozenGames":13/)
const before=json(`${out}/baseline-replay-verification.json`),after=json(`${out}/after-replay-verification.json`)
assert.equal(before.passed,68);assert.equal(after.passed,77);assert.equal(after.failures,0)
for(const old of before.results){const current=after.results.find(x=>x.path===old.path);assert.ok(current);assert.equal(current.sha256,old.sha256);assert.equal(current.matched,true)}
const screensBefore=json(`${out}/before/screens-verification.json`),screens=json(`${out}/after/screens-verification.json`)
assert.equal(screensBefore.checks.filter(x=>x.name.includes('stale-save')&&!x.correct).length,2)
assert.equal(screens.checks.filter(x=>x.name.includes('stale-save')&&x.correct).length,2)
const mobile=json(`${out}/after/browser-verification.json`),desktop=json(`${out}/after/desktop-browser-verification.json`),board=json(`${out}/after/desktop-board-verification.json`),compat=json(`${out}/after/compat-funding-verification.json`),rules=json(`${out}/after/rulebook-browser-verification.json`)
for(const d of [screensBefore,screens,mobile,desktop,board,compat,rules])assert.deepEqual(d.errors,[])
assert.equal(compat.results.find(x=>x.source==='savings').lostInterest,9e6)
const sources=execFileSync('git',['diff','--name-only',base,implementation],{encoding:'utf8'}).trim().split(/\r?\n/)
sources.push('scripts/diagnostics/b18-ux-screens.mjs','scripts/diagnostics/b18-ux-games.mjs','scripts/diagnostics/b18-ux-desktop.mjs','scripts/diagnostics/b18-ux-desktop-board.mjs','scripts/diagnostics/b18-ux-compat-funding.mjs','scripts/diagnostics/verify-ux-replays.ts','scripts/verify-b18-ux-evidence.mjs','docs/B18_MVP_BEGINNER_UX_QA_REPORT.md','tasks/b18-beginner-ux.md')
const paths=files(out).filter(p=>p!==target).sort()
writeFileSync(target,JSON.stringify({format:'b18-beginner-ux-technical-qa-v1',date:'2026-10-17',branch:'codex/mvp-b18-ux-polish',base,implementation,
  baseline:{productTests:334,ssrTests:2,replays:68,researchGames:13,researchSnapshots:2306,lint:true,desktopBuild:true,mobileBuild:true},
  verified:{productTests:339,ssrTests:3,replays:77,newUiReplays:9,researchGames:13,researchSnapshots:2306,researchActions:492,lint:true,desktopBuild:true,mobileBuild:true,fullUiGames:5,sameSessionSaveRegressions:2,oldProfilesImported:['C20/schema5','B18 single/schema6','B18 multi/schema7'],quotaFailureTest:true,previousArtifactsUnchanged:oldArtifacts,existingReplayHashesUnchanged:68,jsErrors:0,screenshots:paths.filter(p=>p.endsWith('.png')).length,layoutChecks:screens.checks.filter(x=>x.w).length+mobile.layout.length+desktop.layout.length+board.checks.length+compat.layout.length+rules.layout.length},
  scope:{engineChanged:false,economicsChanged:false,historicalSchemasChanged:false,technicalQA:true,humanPlaytest:false,balanceResearchRerun:false,merged:false,deployed:false,previewReleased:false,ownerApprovalPending:true},
  hashing:'Source UTF8 normalized to LF; artifacts hashed as original bytes, protected by scoped -text attributes',sourceFiles:[...new Set(sources)].sort().map(p=>describe(p,true)),artifacts:paths.map(p=>describe(p))},null,2)+'\n')
console.log(JSON.stringify({manifestWritten:true,artifacts:paths.length,previousArtifactsUnchanged:oldArtifacts}))
