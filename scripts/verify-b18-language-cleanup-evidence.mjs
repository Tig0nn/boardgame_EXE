import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {readFileSync,readdirSync,writeFileSync} from 'node:fs'

const out='docs/playtests/b18-language-cleanup',target=`${out}/manifest.json`
const base='10cdaa984bcdeddc8337eab945a98c939b405fec'
const implementation='b9606a905b84465f6e648770916961e498d57bfd'
const json=p=>JSON.parse(readFileSync(p,'utf8'))
const text=p=>readFileSync(p,'utf8')
const files=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(`${d}/${e.name}`):[`${d}/${e.name}`])
const describe=(path,normalize=false)=>{
  const raw=readFileSync(path),bytes=normalize?Buffer.from(raw.toString('utf8').replaceAll('\r\n','\n')):raw
  return {path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}
}
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim()
assert.equal(git('rev-parse',`${implementation}^`),base,'Implementation must start at the exact Owner base')
assert.equal(git('diff','--name-only',base,'--','src/game','src/data','scripts/research','docs/research'),'','Engine/data/schemas/research must remain unchanged')

// Historical evidence uses raw bytes. Changed UI/test sourceFiles from those
// manifests are intentionally not treated as immutable evidence.
const historical=[]
for(const name of ['b18-terminology','b18-beginner-ux','core-mvp-b18-multi-course']){
  const path=`docs/playtests/${name}/manifest.json`,previous=json(path)
  for(const a of previous.artifacts)assert.deepEqual(describe(a.path),a,`Historical artifact changed: ${a.path}`)
  const original=execFileSync('git',['show',`${base}:${path}`])
  assert.equal(describe(path).sha256,createHash('sha256').update(original).digest('hex'))
  historical.push({manifest:describe(path),artifacts:previous.artifacts.length})
}
const beforeReplay=json('docs/playtests/b18-terminology/after-replay-verification.json'),replay=json(`${out}/after-replay-verification.json`)
assert.equal(beforeReplay.passed,81);assert.equal(replay.passed,81);assert.equal(replay.failures,0)
assert.equal(replay.results.length,81)
for(const old of beforeReplay.results){
  const current=replay.results.find(a=>a.path===old.path)
  assert.ok(current,old.path);assert.equal(current.sha256,old.sha256);assert.equal(current.matched,true)
  assert.equal(describe(old.path).sha256,old.sha256)
}
const parity=json('docs/playtests/core-mvp-b18-multi-course/research-parity.json')
assert.equal(parity.games,13)
assert.equal(parity.results.reduce((n,r)=>n+r.checkedSnapshots,0),2306)
assert.match(text(`${out}/after-parity.txt`),/"matchedFrozenGames":13,"phases":3,"allEconomicSnapshotsEqual":true/)
for(const [name,count]of [['product',349],['ssr',46]]){
  const log=text(`${out}/after-${name}-tests.txt`)
  assert.match(log,new RegExp(`# pass ${count}\\b`));assert.match(log,/# fail 0\b/)
}
for(const platform of ['desktop','mobile']){
  assert.match(text(`${out}/after-build-${platform}.txt`),/built in/)
  assert.doesNotMatch(text(`${out}/after-lint-${platform}.txt`),/\b[1-9]\d* problems?\b|\berror\b/i)
}
const before=json(`${out}/before/browser-checks.json`),after=json(`${out}/after/browser-checks.json`)
for(const result of [before,after]){
  assert.deepEqual(result.errors,[]);assert.equal(result.actualUi,true);assert.equal(result.seed,'LANG-0');assert.equal(result.screenshots,12)
  for(const c of result.checks.filter(c=>c.w)){
    assert.ok(c.scroll<=c.w+1,c.label)
    for(const d of c.dialogs)assert.ok(d.scroll<=d.client+1,c.label)
  }
}
assert.equal(before.checks.length,23);assert.equal(after.checks.length,61)
const pairedStates=[]
for(const width of [320,390]){
  const label=`${width}-save-reload-stable`,old=before.checks.find(c=>c.label===label),current=after.checks.find(c=>c.label===label)
  assert.ok(old&&current);assert.equal(old.stateUnchanged,true);assert.equal(current.stateUnchanged,true);assert.equal(current.stateHash,old.stateHash)
  pairedStates.push({width,stateHash:current.stateHash,unchangedFromBase:true})
  assert.equal(after.checks.filter(c=>c.label.startsWith(`${width}-tile-`)).length,9)
  assert.equal(after.checks.filter(c=>c.label.startsWith(`${width}-handbook-`)).length,6)
}
const screenNames=files(`${out}/before`).filter(p=>p.endsWith('.png')).map(p=>p.split('/').at(-1)).sort()
assert.equal(screenNames.length,12)
assert.deepEqual(files(`${out}/after`).filter(p=>p.endsWith('.png')).map(p=>p.split('/').at(-1)).sort(),screenNames)
const baselineAudit=json(`${out}/before-language-audit.json`),audit=json(`${out}/language-audit.json`),rendered=json(`${out}/rendered-language-audit.json`)
assert.equal(baselineAudit.findings.length,138);assert.deepEqual(audit.findings,[]);assert.equal(audit.files,59);assert.equal(audit.exceptions.length,2)
assert.equal(rendered.audit.length,15)
assert.ok(rendered.audit.every(a=>a.remainingStartOrLotIds===0&&a.stateUnchanged===true))

if(process.argv.includes('--check')){
  const m=json(target)
  assert.equal(m.base,base);assert.equal(m.implementation,implementation)
  for(const a of m.sourceFiles)assert.deepEqual(describe(a.path,true),a,a.path)
  for(const a of m.artifacts)assert.deepEqual(describe(a.path),a,a.path)
  assert.deepEqual(files(out).filter(p=>p!==target).sort(),m.artifacts.map(a=>a.path).sort())
  console.log(JSON.stringify({manifestVerified:true,sourceFiles:m.sourceFiles.length,artifacts:m.artifacts.length,historicalArtifacts:historical.reduce((n,h)=>n+h.artifacts,0),replays:81,snapshots:2306}))
}else{
  const sources=git('diff','--name-only',base,implementation).split(/\r?\n/)
  sources.push('scripts/verify-b18-language-cleanup-evidence.mjs','docs/B18_MVP_LANGUAGE_CLEANUP_REPORT.md','tasks/b18-language-cleanup.md')
  const artifacts=files(out).filter(p=>p!==target).sort().map(p=>describe(p))
  const manifest={
    format:'b18-language-cleanup-v1',date:'2026-10-20',branch:'codex/mvp-b18-language-cleanup',base,implementation,
    verified:{productTests:349,requiredB18SsrTests:5,allSsrTests:46,topLevelSsrTests:12,replays:81,oldReplayHashesUnchanged:81,researchGames:13,researchSnapshots:2306,lintDesktopAndMobile:true,buildDesktopAndMobile:true,browserChecks:61,jsErrors:0,screenshots:24,staticFilesAudited:59,baselineFindings:138,remainingFindings:0,renderedSurfaces:15,pairedStates,historical},
    intentionalExceptions:audit.intentional,reviewedExceptions:audit.exceptions,
    scope:{uiOnly:true,engineChanged:false,economicsChanged:false,rngChanged:false,saveReplaySchemasChanged:false,archivedLogsChanged:false,researchRerun:false,humanPlaytest:false,merged:false,manuallyDeployed:false,productionPromoted:false,ownerReviewPending:true},
    provenance:{before:'Exact Owner base; actual UI, LANG-0, initial 10M/term3 then bank 6M/term2.',after:'Same actual UI actions and viewport; no injected browser state. SSR fixtures are rendering-only.',viewports:['320x844','390x844','1440x1000'],browser:'Local Chromium headless via Playwright; physical devices/screen readers not evaluated.'},
    hashing:'Source UTF8 normalized to LF; artifacts raw-byte SHA256. Scoped -text attributes preserve evidence bytes.',
    sourceFiles:[...new Set(sources)].sort().map(p=>describe(p,true)),artifacts,
  }
  writeFileSync(target,JSON.stringify(manifest,null,2)+'\n')
  console.log(JSON.stringify({manifestWritten:true,sourceFiles:manifest.sourceFiles.length,artifacts:artifacts.length,historicalArtifacts:381}))
}
