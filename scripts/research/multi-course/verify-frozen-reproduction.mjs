import {readFileSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {gunzipSync} from 'node:zlib'
import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {createAdapter,cleanup,hash} from './adapter.mjs'
const root=resolve('docs/research/multi-course'),id='I2-choice__L3-bonds',c=JSON.parse(readFileSync(join(root,'screen',`${id}.config.json`))),bundle=JSON.parse(gunzipSync(readFileSync(join(root,'screen-source.json.gz')))),m=JSON.parse(readFileSync(join(root,'screen-manifest.json'))),dir=createAdapter(c,bundle)
try{
  writeFileSync(join(dir,'job.json'),JSON.stringify({phase:'screen',seeds:m.seedsPerPolicy,policies:m.policies,examplePolicies:['cash-roi']}))
  execFileSync(process.execPath,['--experimental-strip-types',join(dir,'scripts/research/multi-course/worker.mjs'),join(dir,'config.json'),join(dir,'job.json'),join(dir,'reproduction')],{stdio:['ignore','pipe','pipe']})
  const rowsHash=hash(readFileSync(join(dir,'reproduction.rows.json.gz'))),replayHash=hash(readFileSync(join(dir,'reproduction.replays.json.gz')))
  assert.equal(rowsHash,hash(readFileSync(join(root,'screen',`${id}.rows.json.gz`))))
  assert.equal(replayHash,hash(readFileSync(join(root,'screen',`${id}.replays.json.gz`))))
  const result={config:id,games:m.seedsPerPolicy*m.policies.length,originalPhaseSource:true,byteIdenticalCompressedRows:true,byteIdenticalResearchReplay:true,rowsHash,replayHash}
  writeFileSync(join(root,'frozen-reproduction.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
}finally{cleanup(dir)}
