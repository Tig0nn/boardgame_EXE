import {readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {hash} from './adapter.mjs'
import {BASE_SHA,UPSTREAM_SHA} from './spec.mjs'
const root='docs/research/multi-course',git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:20e6}).trim()
assert.equal(git('diff',BASE_SHA,'--','src','mobile_app','public','package.json','package-lock.json'),'','Production changed')
const refs={
  'codex/mvp-b18-implementation':BASE_SHA,
  'codex/core-mvp-balance-lab':'45b0c4dd03ce2b8fa198891968f4016f4982298a',
  'codex/core-mvp-trading-ab':'33de1229e36fb5fb8a0df63cf4cf6899720cd3f4',
  'codex/core-mvp-risk-allocation':UPSTREAM_SHA,
}
for(const [ref,sha]of Object.entries(refs))assert.equal(git('rev-parse',ref),sha)
assert.equal(git('rev-parse','origin/codex/mvp-b18-implementation'),BASE_SHA)
const verification=JSON.parse(readFileSync(join(root,'verification.json')))
assert.equal(verification.games,167972);assert.equal(verification.savedFullStateReplays,245)
const frozen=JSON.parse(readFileSync(join(root,'frozen-reproduction.json')))
assert.ok(frozen.byteIdenticalCompressedRows&&frozen.byteIdenticalResearchReplay)
function* files(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())yield*files(path);else yield path.replaceAll('\\','/')}}
const paths=[...files(root).filter(p=>!p.endsWith('/artifact-manifest.json')),...files('scripts/research/multi-course'),'docs/CORE_MVP_MULTI_COURSE_RESEARCH.md','tasks/mvp-b18-course-balance-lab.md']
const artifacts=paths.sort().map(path=>{const bytes=readFileSync(path);return {path,bytes:bytes.length,sha256:hash(bytes)}})
const result={format:'b18-multi-course-artifact-manifest-v1',protectedRefs:refs,baselinePushed:true,holdoutLockCommit:git('rev-parse','ce24f64'),holdoutLockSha256:verification.holdoutLockSha256,productionUnchanged:true,researchOnly:true,mainGames:verification.games,mainGamesExcludeVerificationReruns:true,frozenReproduction:frozen,artifacts}
writeFileSync(join(root,'artifact-manifest.json'),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({artifacts:artifacts.length,games:verification.games,productionUnchanged:true,protectedRefs:Object.keys(refs).length}))
