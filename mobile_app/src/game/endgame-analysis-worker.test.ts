import test from 'node:test'
import assert from 'node:assert/strict'
import {validateRequest,validateResponse,newEnvelope,PROTOCOL} from './endgame-analysis-protocol.ts'
import {createWorkerJob} from './endgame-analysis-worker-job.ts'
const env=()=>newEnvelope()
test('runtime protocol refuses unknown versions, policy, graph and extra data',()=>{
 const valid={version:PROTOCOL,kind:'LIST_ELIGIBLE_DECISIONS',envelope:env(),body:{}};validateRequest(valid)
 for(const value of [{...valid,version:'bad'},{...valid,kind:'BAD'},{...valid,body:{state:{cash:99}}},{...valid,envelope:{...valid.envelope,schema:6}},{...valid,envelope:{...valid.envelope,sessionEpoch:NaN}}])assert.throws(()=>validateRequest(value))
 const getter=Object.defineProperty({},'body',{enumerable:true,get(){throw Error('getter-called')}});assert.throws(()=>validateRequest(getter),e=>e instanceof Error&&e.message!=='getter-called')
 assert.throws(()=>validateResponse({...valid,kind:'SUPPORTED_FINAL',body:{cash:123}}))
})
test('worker rejects unprepared create and does not run an implicit analysis',async()=>{
 const out:unknown[]=[],job=createWorkerJob(x=>out.push(x));await job.receive({version:PROTOCOL,kind:'CREATE_ANALYSIS',envelope:env(),body:{}})
 assert.equal((out[0] as {kind:string}).kind,'BLOCKED');assert.equal(job.debug().handles,0);job.dispose();assert.equal(job.debug().sources,0)
})

import {gunzipSync} from 'node:zlib'
import {readFileSync} from 'node:fs'
test('duplicate in-flight request cannot release the original worker computation lock',async()=>{
 const emitted:unknown[]=[],job=createWorkerJob(x=>emitted.push(x)),e=env(),text=gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz')).toString('utf8')
 const input={version:PROTOCOL,kind:'PREPARE_SOURCE',envelope:e,body:{source:{kind:'text',text}}}
 const running=job.receive(input);assert.equal(job.debug().busy,true);await job.receive(input);assert.equal(job.debug().busy,true)
 await running;assert.equal(job.debug().busy,false);assert.equal(job.debug().sources,1);assert.equal(emitted.length,2);job.dispose()
})

test('real unchanged C1 runs create/pending/resume on the one resident job handle',async()=>{
 const out:import('./endgame-analysis-protocol.ts').Response[]=[],job=createWorkerJob(x=>out.push(x)),e=env();let ordinal=0
 async function call(kind:import('./endgame-analysis-protocol.ts').RequestKind,body:Record<string,unknown>){await job.receive({version:PROTOCOL,kind,envelope:{...e,jobId:crypto.randomUUID(),requestOrdinal:++ordinal},body});return out.at(-1)!}
 const text=gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz')).toString('utf8')
 const source=await call('PREPARE_SOURCE',{source:{kind:'text',text}});assert.equal(source.kind,'SOURCE_VERIFIED');const id=source.body.identity as {sourceHash:string;configHash:string};e.sourceHash=id.sourceHash;e.configHash=id.configHash
 const list=await call('LIST_ELIGIBLE_DECISIONS',{});assert.equal(list.kind,'DECISIONS_READY');const selection=(list.body.decisions as import('./endgame-whatif-gold-contract.ts').GoldSelection[])[0];e.decision=selection.decision
 const p=await call('CREATE_ANALYSIS',{selection,alternative:'skip'});assert.equal(p.kind,'NEEDS_FOLLOWUP');const c=p.body.continuation as import('./endgame-whatif-gold-contract.ts').GoldContinuationIdentity;e.branchId=c.branchId;e.expectedRevision=c.revision
 const before=structuredClone(p.body),f=await call('FOLLOWUP_SELECTION',{continuation:p.body.continuation,blocker:p.body.blocker,choice:{kind:'gold-skip',optionId:'skip'}});assert.equal(f.kind,'SUPPORTED_FINAL')
 assert.equal((f.body.delta as {cash:number}).cash,104006);assert.equal((f.body.execution as {transcriptCount:number}).transcriptCount,1);assert.equal(job.debug().created,1)
 assert.equal((f.body.continuation as {branchId:string}).branchId,c.branchId)
 const duplicate=await call('FOLLOWUP_SELECTION',{continuation:before.continuation,blocker:before.blocker,choice:{kind:'gold-skip',optionId:'skip'}});assert.equal(duplicate.kind,'BLOCKED');assert.equal('delta'in duplicate.body,false);job.dispose();assert.equal(job.debug().handles,0)
})

import {createAnalysisClient} from './endgame-analysis-worker-client.ts'
import type {AnalysisPort} from './endgame-analysis-worker-client.ts'
import type {Request,Response} from './endgame-analysis-protocol.ts'
import {prepareAnalysisSource} from './endgame-analysis-source.ts'
import {WorkBudget} from './endgame-whatif-contract.ts'
let preparedSource:ReturnType<typeof prepareAnalysisSource>|undefined
async function sourceFixture(){preparedSource??=prepareAnalysisSource({kind:'text',text:gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz')).toString('utf8')},new WorkBudget());return preparedSource}
function mockFactory(mutate?:(r:Response)=>void){let p:AnalysisPort;let terminated=0
 return{factory:()=>p={onmessage:null,onerror:null,onmessageerror:null,terminate(){terminated++},postMessage(value){const r=value as Request;void sourceFixture().then(s=>{const response:Response={version:PROTOCOL,kind:'SOURCE_VERIFIED',envelope:structuredClone(r.envelope),body:{identity:s.identity,timings:s.timings,capabilities:{worker:false,crypto:true,encoder:true,clone:true,dom:false}},timing:{receivedAt:1,finishedAt:2,elapsedMs:1}};mutate?.(response);p.onmessage?.({data:response} as MessageEvent)})}},count:()=>terminated}
}
for(const key of ['controllerIncarnation','sessionIncarnation','sessionEpoch','captureId','captureRevision','sourceHash','workerGeneration','analysisInstance','analysisId','jobId','requestOrdinal','initialPolicy','branchId','expectedRevision','decision'] as const)test('client boundary refuses foreign/stale response '+key,async()=>{
 await sourceFixture();const m=mockFactory(r=>{if(['sessionEpoch','captureRevision','requestOrdinal','expectedRevision'].includes(key))Object.assign(r.envelope,{[key]:99});else if(key==='sourceHash')r.envelope.sourceHash='a'.repeat(64);else if(key==='initialPolicy')r.envelope.initialPolicy='foreign';else if(key==='decision')r.envelope.decision={sequence:4} as never;else Object.assign(r.envelope,{[key]:crypto.randomUUID()})})
 const client=createAnalysisClient(env(),{factory:m.factory,deadlineMs:20}),r=await client.request('PREPARE_SOURCE',{source:{kind:'text',text:'bounded test placeholder'}})
 assert.equal(r.kind,'CANCELLED');assert.equal(client.read(),null);assert.equal(m.count(),1);client.dispose()
})
test('client enforces phase, synchronous revoke, one module worker owner, duplicate disposal',async()=>{
 const m=mockFactory(),client=createAnalysisClient(env(),{factory:m.factory});assert.equal((await client.request('LIST_ELIGIBLE_DECISIONS',{})).kind,'BLOCKED')
 const prepare=client.request('PREPARE_SOURCE',{source:{kind:'text',text:'bounded test placeholder'}});const busy=await client.request('PREPARE_SOURCE',{source:{kind:'text',text:'second'}});assert.equal(busy.kind,'BLOCKED')
 assert.equal((await prepare).kind,'SOURCE_VERIFIED');const next=createAnalysisClient(env(),{factory:mockFactory().factory});assert.equal((await next.request('PREPARE_SOURCE',{source:{kind:'text',text:'third'}})).kind,'BLOCKED');next.dispose()
 client.cancel();assert.equal(client.read(),null);client.dispose();await new Promise(r=>setTimeout(r,270));assert.equal(m.count(),1)
})
const legacyFinal=()=>JSON.parse(readFileSync('docs/playtests/whatif-endgame/2026-11-07/eg1b-c1-01/public-resume-proof.json','utf8')).result
import {projectFinal} from './endgame-analysis-protocol.ts'
test('projection contains only bounded verified C1 facts; extra nested/private data rejected',()=>{
 const e=env(),r:Response={version:PROTOCOL,kind:'SUPPORTED_FINAL',envelope:e,body:projectFinal(legacyFinal()),timing:{receivedAt:1,finishedAt:2,elapsedMs:1}};validateResponse(r)
 assert.equal('ledger'in r.body,false);assert.equal('transcript'in r.body,false);assert.equal('state'in r.body,false)
 for(const where of ['top','metric','proof','delta'] as const){const changed=structuredClone(r);if(where==='top')changed.body.state={cash:999};if(where==='metric')(changed.body.actual as Record<string,unknown>).rng=123;if(where==='proof')(changed.body.proof as Record<string,unknown>).alternativeReplay=false;if(where==='delta')(changed.body.delta as Record<string,unknown>).cash=999;assert.throws(()=>validateResponse(changed))}
})
test('protocol rejects inherited/accessor/cyclic/nonfinite/oversized/unknown kinds and policy',()=>{
 const r={version:PROTOCOL,kind:'LIST_ELIGIBLE_DECISIONS',envelope:env(),body:{}}
 const cycle={...r} as Record<string,unknown>;cycle.self=cycle
 for(const bad of [Object.assign(Object.create({foreign:true}),r),cycle,{...r,body:{payload:'x'.repeat(9000)}},{...r,envelope:{...r.envelope,captureRevision:Infinity}},{...r,envelope:{...r.envelope,profile:'first-job'}},{...r,envelope:{...r.envelope,engine:'foreign'}},{...r,envelope:{...r.envelope,continuationPolicy:'wrong'}}])assert.throws(()=>validateRequest(bad))
})