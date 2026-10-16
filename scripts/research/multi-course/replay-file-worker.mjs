import assert from 'node:assert/strict'
import {isDeepStrictEqual} from 'node:util'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {replay} from './replay.mjs'
import {play} from './policy.mjs'
import {policies} from './spec.mjs'
const data=JSON.parse(gunzipSync(readFileSync(process.argv[2])))
assert.equal(data.format,'b18-multi-course-research-v1')
for(const example of data.examples){
  replay(example.state,data.config)
  const p=policies.find(p=>p.id===example.row.policy),actual=play(example.row.seed,p,data.config)
  const expected={...example.row,allocationReserve:example.row.allocationReserve??p.reserve}
  assert.ok(isDeepStrictEqual(JSON.parse(JSON.stringify(actual)),expected),'All saved research metrics reproduce; only later explicit allocationReserve metadata supplied when absent')
}
console.log(JSON.stringify({file:process.argv[2],replays:data.examples.length,fullState:true,deterministicMetrics:true}))
