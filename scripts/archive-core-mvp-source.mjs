import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'
import { hash } from './research/core-mvp/adapter.mjs'
const out=resolve(process.env.CORE_MVP_LAB_OUT??'docs/research/core-mvp')
for(const phase of ['benchmark','broad','shortlist','holdout']){
  const path=join(out,`${phase}-manifest.json`)
  if(!existsSync(path))continue
  const manifest=JSON.parse(readFileSync(path,'utf8')),files={}
  for(const [p,expected]of Object.entries(manifest.sourceHashes)){
    const normalize=s=>s.replace(/\r\n/g,'\n')
    let content=normalize(readFileSync(p,'utf8'))
    if(hash(content)!==expected){
      const commits=execFileSync('git',['log','--format=%H','--',p],{encoding:'utf8'}).trim().split(/\r?\n/)
      content=null
      for(const commit of commits){let candidate;try{candidate=normalize(execFileSync('git',['show',`${commit}:${p}`],{encoding:'utf8',stdio:['ignore','pipe','ignore']}))}catch{continue}
        if(hash(candidate)===expected){content=candidate;break}
      }
    }
    assert.ok(content!==null,`Cannot reconstruct frozen source ${phase}/${p}`)
    assert.equal(hash(content),expected);files[p]=content
  }
  writeFileSync(join(out,`${phase}-source.json.gz`),gzipSync(JSON.stringify({sourceSha:manifest.sourceSha,hashNormalization:'UTF-8 LF',files})))
  console.log(`${phase}: archived ${Object.keys(files).length} exact source files`)
}
