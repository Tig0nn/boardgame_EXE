import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const out='docs/playtests/core-mvp-b18-multi-course'
const manifestPath=`${out}/manifest.json`
const base='00e77a19691c109e8cb7079b83591463c3eb6136'
const implementation='db33c9cc8fafd911156aa51a2a66ec41c378cd21'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const describe=(path,normalize=false)=>{const raw=readFileSync(path),bytes=normalize?Buffer.from(raw.toString('utf8').replaceAll('\r\n','\n')):raw;return {path,bytes:bytes.length,sha256:sha(bytes)}}
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(`${dir}/${e.name}`):[`${dir}/${e.name}`])}
if(process.argv.includes('--check')){
  const data=JSON.parse(readFileSync(manifestPath,'utf8'))
  for(const expected of data.sourceFiles)assert.deepEqual(describe(expected.path,true),expected,expected.path)
  for(const expected of data.artifacts)assert.deepEqual(describe(expected.path),expected,expected.path)
  assert.deepEqual(files(out).filter(p=>p!==manifestPath).sort(),data.artifacts.map(a=>a.path).sort(),'No missing or unmanifested evidence')
  console.log(JSON.stringify({manifestVerified:true,sourceFiles:data.sourceFiles.length,artifacts:data.artifacts.length}));process.exit(0)
}
const json=name=>JSON.parse(readFileSync(`${out}/${name}.json`,'utf8'))
const rootTests=readFileSync(`${out}/tests-output.txt`,'utf8'),uiTests=readFileSync(`${out}/ui-tests-output.txt`,'utf8')
assert.match(rootTests,/# pass 334\b/);assert.match(rootTests,/# fail 0\b/)
assert.match(uiTests,/# pass 2\b/);assert.match(uiTests,/# fail 0\b/);assert.doesNotMatch(uiTests,/WebSocket server error/)
for(const name of ['desktop','mobile'])assert.match(readFileSync(`${out}/${name}-build-output.txt`,'utf8'),/built in/)
assert.doesNotMatch(readFileSync(`${out}/lint-output.txt`,'utf8'),/\b[1-9]\d* problems?\b/)
const parity=json('research-parity'),replay=json('replay-verification'),mobile=json('browser-verification'),desktop=json('desktop-browser-verification'),rules=json('rulebook-browser-verification')
assert.equal(parity.games,13);assert.equal(replay.passed,68);assert.equal(replay.failures,0)
for(const d of [mobile,desktop,rules])assert.deepEqual(d.errors,[])
const sourcePaths=execFileSync('git',['diff','--name-only',base,implementation],{encoding:'utf8'}).trim().split(/\r?\n/)
sourcePaths.push('scripts/verify-multi-course-parity.ts','scripts/diagnostics/verify-multi-course-replays.ts','scripts/diagnostics/multi-course-browser.mjs','scripts/diagnostics/multi-course-desktop-browser.mjs','scripts/manifest-multi-course.mjs','docs/CORE_MVP_B18_MULTI_COURSE_IMPLEMENTATION_REPORT.md')
const artifactPaths=files(out).filter(p=>p!==manifestPath).sort()
writeFileSync(manifestPath,JSON.stringify({format:'b18-multi-course-implementation-evidence-v1',date:'2026-10-16',branch:'codex/mvp-b18-multi-course',baseProduction:base,implementation,
  approvedResearch:'a44686e988540fdee04498d547b0703c221e7b24',runtime:{node:process.version,platform:process.platform,desktopVite:JSON.parse(readFileSync('node_modules/vite/package.json')).version,mobileVite:JSON.parse(readFileSync('mobile_app/node_modules/vite/package.json')).version,browser:'Chromium1228 via Playwright; headless'},
  verification:{rootTests:334,uiTests:2,lint:true,desktopBuild:true,mobileBuild:true,replays:68,legacyReplaysPreserved:49,frozenResearchGames:13,frozenSnapshots:parity.results.reduce((n,r)=>n+r.checkedSnapshots,0),frozenActions:parity.results.reduce((n,r)=>n+r.actions,0),fullUiGames:4,insufficientCashUiFlows:3,screenshots:artifactPaths.filter(p=>p.endsWith('.png')).length,layoutChecks:mobile.layout.length+desktop.layout.length+rules.layout.length,jsErrors:0},
  scope:{historicalDataModified:false,researchRerun:false,humanPlaytest:false,finalQA:false,merged:false,deployed:false},sourceHashing:'UTF8 normalized to LF; artifacts hashed as original bytes and kept -text by scoped .gitattributes',sourceFiles:[...new Set(sourcePaths)].sort().map(p=>describe(p,true)),artifacts:artifactPaths.map(p=>describe(p))},null,2)+'\n')
console.log(JSON.stringify({manifestWritten:true,sourceFiles:sourcePaths.length,artifacts:artifactPaths.length}))
