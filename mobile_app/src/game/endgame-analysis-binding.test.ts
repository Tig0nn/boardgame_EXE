import test from 'node:test'
import assert from 'node:assert/strict'
import {createAnalysisBinding} from './endgame-analysis-binding.ts'
import {newEnvelope,PROTOCOL} from './endgame-analysis-protocol.ts'
import type {Response} from './endgame-analysis-protocol.ts'
test('logical lease revocation blocks old read and delayed A publication on B',async()=>{
 const callbacks:((r:Response)=>void)[]=[],env=newEnvelope()
 const binding=createAnalysisBinding(()=>({request:()=>new Promise<Response>(resolve=>callbacks.push(resolve)),dispose(){},cancel(){},read:()=>null,debug:()=>({})}))
 binding.activate(env);const run=binding.request('LIST_ELIGIBLE_DECISIONS',{})
 binding.activate({...newEnvelope(),sessionEpoch:8});callbacks[0]({version:PROTOCOL,kind:'DECISIONS_READY',envelope:env,body:{decisions:[]},timing:{receivedAt:1,finishedAt:2,elapsedMs:1}})
 await run;assert.equal(binding.read(),null);binding.dispose();assert.equal(binding.read(),null)
})

import {readFileSync} from 'node:fs'
import {projectFinal} from './endgame-analysis-protocol.ts'
import type {AnalysisClient} from './endgame-analysis-worker-client.ts'
function logicalClient(e:ReturnType<typeof newEnvelope>):AnalysisClient{
 let value:Response|null=null
 return{async request(){value={version:PROTOCOL,kind:'SUPPORTED_FINAL',envelope:structuredClone(e),body:projectFinal(JSON.parse(readFileSync('docs/playtests/whatif-endgame/2026-11-07/eg1b-c1-01/public-resume-proof.json','utf8')).result),timing:{receivedAt:1,finishedAt:2,elapsedMs:1}};return structuredClone(value)},read:()=>value,dispose(){value=null},cancel(){value=null},debug:()=>({mock:true})}
}
test('isolated logical final read is detached and revoked on epoch mutation/close/reopen',async()=>{
 const binding=createAnalysisBinding(logicalClient),e=newEnvelope();binding.activate(e);await binding.request('CREATE_ANALYSIS',{})
 const first=binding.read();assert.equal(first?.kind,'SUPPORTED_FINAL');if(first)first.body.delta={cash:999};assert.notDeepEqual(binding.read(),first)
 e.sessionEpoch++;assert.equal(binding.read(),null);binding.activate(newEnvelope());assert.equal(binding.read(),null);binding.dispose();binding.dispose();assert.equal(binding.read(),null)
})
for(const field of ['controllerIncarnation','sessionIncarnation','sessionEpoch','captureId','captureRevision','workerGeneration','analysisInstance','analysisId','sourceHash','decision','initialPolicy'] as const)test('logical lease mutation invalidates current read '+field,async()=>{
 const e=newEnvelope(),binding=createAnalysisBinding(logicalClient);binding.activate(e);await binding.request('CREATE_ANALYSIS',{})
 if(field==='sessionEpoch'||field==='captureRevision')e[field]++
 else if(field==='decision')e.decision={sequence:4} as never
 else Object.assign(e,{[field]:'changed'})
 assert.equal(binding.read(),null);binding.dispose()
})
test('binding does not queue concurrent operations or publish after cancel',async()=>{
 const callbacks:((r:Response)=>void)[]=[],e=newEnvelope(),binding=createAnalysisBinding(()=>({request:()=>new Promise<Response>(resolve=>callbacks.push(resolve)),read:()=>null,cancel(){},dispose(){},debug:()=>({})}))
 binding.activate(e);const first=binding.request('CREATE_ANALYSIS',{});assert.equal((await binding.request('CREATE_ANALYSIS',{}))?.kind,'BLOCKED');binding.cancel()
 callbacks[0]({version:PROTOCOL,kind:'BLOCKED',envelope:e,body:{reason:'cancelled test'},timing:{receivedAt:1,finishedAt:2,elapsedMs:1}});assert.equal(await first,null);assert.equal(binding.read(),null)
})
test('binding activation rejects accessors and prototypes before invoking factory',()=>{
 let calls=0;const binding=createAnalysisBinding(e=>{calls++;return logicalClient(e)}),getter=Object.defineProperty({},'sessionEpoch',{enumerable:true,get(){throw Error('getter-called')}})
 assert.throws(()=>binding.activate(getter as never),e=>e instanceof Error&&e.message!=='getter-called');assert.equal(calls,0)
 assert.throws(()=>binding.activate(Object.assign(Object.create({foreign:true}),newEnvelope())));assert.equal(calls,0)
})