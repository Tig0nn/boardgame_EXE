import {readdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
const dir='docs/playtests/core-mvp-b18'
const artifacts=readdirSync(dir).filter(name=>name!=='artifact-manifest.json').sort().map(name=>{
  const bytes=readFileSync(join(dir,name))
  return {path:`${dir}/${name}`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}
})
writeFileSync(join(dir,'artifact-manifest.json'),JSON.stringify({artifacts},null,2)+'\n')
console.log(JSON.stringify({artifacts:artifacts.length}))
