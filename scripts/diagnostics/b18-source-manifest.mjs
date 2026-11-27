import {execFileSync} from 'node:child_process'
import {writeFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:20e6}).trim()
const sources=[
  ['codex/core-mvp-balance-lab','45b0c4dd03ce2b8fa198891968f4016f4982298a'],
  ['codex/core-mvp-trading-ab','33de1229e36fb5fb8a0df63cf4cf6899720cd3f4'],
  ['codex/core-mvp-risk-allocation','d04b8adf8f5173a3a0c21fa0106afba7f6bd3f53'],
].map(([branch,sha])=>{
  assert.equal(git('rev-parse',branch),sha)
  assert.equal(git('rev-parse',`origin/${branch}`),sha)
  const artifacts=git('ls-tree','-r',branch,'--','docs/research').split('\n').filter(Boolean).map(line=>{
    const [meta,path]=line.split('\t'),[mode,type,object]=meta.split(' ')
    return {path,mode,type,gitObject:object}
  })
  return {branch,sha,remoteTrackingSha:sha,artifacts}
})
writeFileSync('docs/playtests/core-mvp-b18/source-manifest.json',JSON.stringify({sources,gameplayBase:'4b0be454a8dd24bb65f00517f598f751ab333980',candidateBranch:git('branch','--show-current'),researchFilesChanged:false,representation:'Git blob object IDs preserve exact tracked artifact bytes on protected research commits.'},null,2)+'\n')
console.log(JSON.stringify(sources.map(s=>({branch:s.branch,sha:s.sha,artifacts:s.artifacts.length}))))
