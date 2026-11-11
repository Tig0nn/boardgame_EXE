import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {spawnSync} from 'node:child_process'
import {prepareGoldRequest,createGoldContinuation} from './endgame-whatif-gold-resume.ts'
import type {GoldRequest,GoldResult,GoldRecord} from './endgame-whatif-gold-contract.ts'
import {newGoldTranscript,appendGoldRecord,verifyGoldTranscript} from './endgame-whatif-gold-transcript.ts'
const raw=()=>gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz')).toString('utf8')
let prepared:Promise<GoldRequest>|undefined
async function request(){prepared??=prepareGoldRequest(raw(),4);return structuredClone(await prepared)}
let completed:Promise<Extract<GoldResult,{status:'supported-final'}>>|undefined
async function finalFixture(){completed??=(async()=>{const h=await createGoldContinuation(await request()),p=h.result;assert.equal(p.status,'needs-followup');if(p.status!=='needs-followup')throw Error('Expected actual pending');const f=await h.resume({continuation:p.continuation,blocker:p.blocker,choice:{kind:'gold-skip',optionId:'skip'}});assert.equal(f.status,'supported-final');if(f.status!=='supported-final')throw Error('Expected actual final');return f})();return structuredClone(await completed)}

for(const field of ['sourceHash','configHash','engine','profile','initialPolicy','continuationPolicy','fairness','eventContext','decision','schema'] as const)test('public identity rejects altered '+field,async()=>{
 const r=await request()
 if(field==='decision')r.selection.decision.action!.amount++
 else if(field==='schema')r.selection.schema=6 as 7
 else Object.assign(r.selection,{[field]:'wrong'})
 const h=await createGoldContinuation(r);assert.equal(h.result.status,'blocked');assert.equal('delta' in h.result,false)
})
test('exact recorded term/symbol fields cannot be changed in the selected identity',async()=>{
 const r=await request();r.selection.decision.action!.term=2
 assert.equal((await createGoldContinuation(r)).result.status,'blocked')
})
test('other Gold tile60 and non-Gold initial choices are outside approved identity scope',async()=>{
 await assert.rejects(prepareGoldRequest(raw(),60),/explicit-approved-gold-buy-required/)
 await assert.rejects(prepareGoldRequest(raw(),37),/explicit-approved-gold-buy-required/)
})
for(const variant of ['schema','profile','config','snapshot','buy-form','action-extra'] as const)test('public source verification refuses corrupted/unsupported '+variant,async()=>{
 const source=JSON.parse(raw())
 if(variant==='schema')source.schemaVersion=6
 if(variant==='profile')source.state.gameplayProfile='foreign-profile'
 if(variant==='config')source.financialConfig.ECONOMY.goldSpread=0.99
 if(variant==='snapshot')source.entries[6].before.portfolio.cash++
 if(variant==='buy-form')source.entries[3].action.completeEncounter=false
 if(variant==='action-extra')source.entries[3].action.arbitraryPayload={cash:999}
 source.state.log=structuredClone(source.entries)
 const text=JSON.stringify(source)
 if(['schema','profile','buy-form','action-extra'].includes(variant))await assert.rejects(prepareGoldRequest(text,4))
 else{const h=await createGoldContinuation(await prepareGoldRequest(text,4));assert.equal(h.result.status,'blocked');assert.equal('delta' in h.result,false)}
})
test('public input rejects raw Alternative state, imported transcript and extra mutable source of truth',async()=>{
 const r=await request(),bad={...r,state:{cash:999,rng:1}}
 assert.equal((await createGoldContinuation(bad as GoldRequest)).result.status,'blocked')
 assert.equal((await createGoldContinuation(r,{transcript:{}} as Parameters<typeof createGoldContinuation>[1])).result.status,'blocked')
 const h=await createGoldContinuation(r),p=h.result;assert.equal(p.status,'needs-followup');if(p.status!=='needs-followup')return
 const i={continuation:p.continuation,blocker:p.blocker,choice:{kind:'gold-skip' as const,optionId:'skip' as const},transcript:{entries:[]}}
 assert.equal((await h.resume(i)).status,'blocked');assert.deepEqual(h.result,p)
})
test('malformed/getter/prototype/cyclic/nonfinite request data never enters reconstruction',async()=>{
 for(const v of [null,{}, {source:'{}'}, {source:'{}',selection:null}])assert.equal((await createGoldContinuation(v as unknown as GoldRequest)).result.status,'blocked')
 let calls=0;const getter=Object.defineProperty({},'source',{enumerable:true,get(){calls++;return raw()}})
 assert.equal((await createGoldContinuation(getter as GoldRequest)).result.status,'blocked');assert.equal(calls,0)
 const r=await request(),cyclic={...r} as GoldRequest&{self?:unknown};cyclic.self=cyclic
 assert.equal((await createGoldContinuation(cyclic)).result.status,'blocked')
 assert.equal((await createGoldContinuation(Object.assign(Object.create({foreign:true}),r))).result.status,'blocked')
 r.selection.decision.action!.amount=Infinity;assert.equal((await createGoldContinuation(r)).result.status,'blocked')
})
test('source/graph/step/time budgets fail closed without final numbers',async()=>{
 await assert.rejects(prepareGoldRequest('x'.repeat(20_000_001),4),/source-size/)
 const r=await request()
 const deep:Record<string,unknown>={};let next=deep;for(let i=0;i<70;i++){const child={};next.child=child;next=child}
 const over={...r,extra:deep};assert.equal((await createGoldContinuation(over)).result.status,'blocked')
 for(const options of [{maxSteps:1},{maxMilliseconds:1}]){const h=await createGoldContinuation(r,options);assert.equal(h.result.status,'limited');assert.equal('delta' in h.result,false)}
 for(const options of [{maxSteps:20_001},{maxMilliseconds:30_001},{maxSteps:NaN}])assert.equal((await createGoldContinuation(r,options)).result.status,'blocked')
})
test('source mutation across public create is rejected; caller source changes after capture cannot rewrite a handle',async()=>{
 const r=await request(),pending=createGoldContinuation(r);r.selection.decision.action!.amount++
 assert.equal((await pending).result.status,'blocked')
 const stable=await request(),h=await createGoldContinuation(stable),p=h.result;assert.equal(p.status,'needs-followup');if(p.status!=='needs-followup')return
 stable.source='changed after successful capture'
 const f=await h.resume({continuation:p.continuation,blocker:p.blocker,choice:{kind:'gold-skip',optionId:'skip'}});assert.equal(f.status,'supported-final')
})
test('private transcript rejects changed/reordered native follow-up records and wrong binding',async()=>{
 const f=await finalFixture();await verifyGoldTranscript(f.transcript,f.selection)
 const changed=structuredClone(f.transcript);changed.entries[0].choice.optionId='forged' as 'skip';await assert.rejects(verifyGoldTranscript(changed,f.selection))
 const foreign=structuredClone(f.selection);foreign.sourceHash='foreign';await assert.rejects(verifyGoldTranscript(f.transcript,foreign))
 const missing=structuredClone(f.transcript);missing.entries=[];await assert.rejects(verifyGoldTranscript(missing,f.selection))
})
test('even a rehashed duplicate source-cursor record is not a valid ordered Gold transcript',async()=>{
 const f=await finalFixture(),record=recordBody(f.transcript.entries[0])
 const t=await appendGoldRecord(f.transcript,record)
 await assert.rejects(verifyGoldTranscript(t,f.selection),/gold-transcript-order/)
})

function recordBody(r:GoldRecord){return {sourceCursor:r.sourceCursor,command:r.command,blockerHash:r.blockerHash,choice:r.choice,preStateHash:r.preStateHash,postStateHash:r.postStateHash,actualAction:r.actualAction,alternativeAction:r.alternativeAction,nextSourceCursor:r.nextSourceCursor}}

import {WorkBudget,COURSE_POLICY} from './endgame-whatif-contract.ts'
import {parseHistory,canonical,commandIdentity,digest} from './endgame-whatif-identity.ts'
import {replayHistory} from './endgame-whatif-replay.ts'
import {forkGold} from './endgame-whatif-gold-fork.ts'
import {stepGoldPair,goldPairReason,finishGoldPair} from './endgame-whatif-gold-reconcile.ts'
import type {GoldStopped} from './endgame-whatif-gold-reconcile.ts'
import {inspectGoldBlocker,applyGoldSkip} from './endgame-whatif-gold-followup.ts'
import {comparableEndings} from './endgame-whatif-comparison.ts'
let boundary:Promise<{step:GoldStopped;source:ReturnType<typeof parseHistory>;entry:ReturnType<typeof parseHistory>['entries'][number];cursor:number;pre:Awaited<ReturnType<typeof replayHistory>>['before']}>|undefined
async function blockerFixture(){boundary??=(async()=>{
 const r=await request(),source=parseHistory(r.source),work=new WorkBudget(),v=await replayHistory(source,work,4)
 assert(v.before);let pair=forkGold(v.before,source.entries[3],r.selection,work)
 const stats={externalCheckpoints:1,advances:0}
 for(let i=v.commands.findIndex(x=>x.sequence===4)+1;i<v.commands.length;i++){
  const step=stepGoldPair(pair.actual,pair.alternative,v.commands[i],source.entries,work,stats)
  if(!step.ok){assert.equal(v.commands[i].sequence,25);return{step,source,entry:v.commands[i],cursor:i,pre:v.before}}
  pair=step
 }
 throw Error('Pinned blocker missing')
})();return structuredClone(await boundary)}

for(const field of ['rng','market','credit','time','event'] as const)test('detached native boundary fails closed on '+field+' divergence',async()=>{
 const {step}=await blockerFixture(),b=step.alternative
 if(field==='rng')b.rng++
 if(field==='market')b.market=Object.assign({},b.market,{unmatchedHistory:true})
 if(field==='credit')b.bondCredit=Object.assign({},b.bondCredit,{unmatchedCredit:true})
 if(field==='time')b.turn++
 if(field==='event')b.eventId='bank'
 assert.equal(goldPairReason(step.actual,b),'exogenous-or-context-mismatch')
 const end=finishGoldPair(step.actual,b,new WorkBudget(),{externalCheckpoints:0,advances:0});assert.equal(end.ok,false);assert.equal('delta' in end,false)
})
test('detached native boundary refuses funding, early insolvency and incomparable endings',async()=>{
 const {step,source}=await blockerFixture()
 for(const side of ['actual','alternative'] as const){const pair=structuredClone(step);pair[side].phase='funding';assert.equal(goldPairReason(pair.actual,pair.alternative),'unsupported-funding-context')}
 const b=structuredClone(step.alternative);b.phase='finished';b.termination='insolvent';assert.equal(goldPairReason(step.actual,b),'early-insolvency')
 b.termination='completed';assert.equal(goldPairReason(step.actual,b),'early-terminal');assert.equal(comparableEndings(source.state,b),false)
})
test('detached native blockers outside approved sale form/tile/context offer no replacement',async()=>{
 const f=await blockerFixture()
 for(const variant of ['partial','tile','phase','event','funding','after','candidate','unchanged'] as const){
  const {step,entry,cursor}=structuredClone(f)
  if(variant==='partial')entry.action!.amount--
  if(variant==='tile')entry.tileId=16
  if(variant==='phase')step.alternative.phase='rolling'
  if(variant==='event')step.alternative.eventId='bank'
  if(variant==='funding')step.alternative.phase='funding'
  if(variant==='after')step.boundary='after-command'
  if(variant==='candidate')step.actualCandidate=undefined
  if(variant==='unchanged')step.alternativeUnchanged=false
  const before=canonical(step),b=await inspectGoldBlocker(step,entry,cursor,new WorkBudget());assert.equal(b.choices.length,0,variant);assert.equal('delta' in b,false)
  assert.throws(()=>applyGoldSkip(step,entry,{kind:'gold-skip',optionId:'skip'},new WorkBudget()),/illegal-gold-followup/);assert.equal(canonical(step),before)
 }
})
test('detached native boundary refuses partial sale before executing either branch',async()=>{
 const {step,entry,source}=await blockerFixture();entry.action!.amount--
 const result=stepGoldPair(step.actual,step.alternative,entry,source.entries,new WorkBudget(),{externalCheckpoints:0,advances:0})
 assert.equal(result.ok,false);if(!result.ok)assert.equal(result.reason,'partial-gold-sale-unsupported')
 assert.equal('delta' in result,false)
})
test('internal initial-fork guard refuses illegal native Skip contexts without mutation',async()=>{
 const f=await blockerFixture(),r=await request();assert(f.pre)
 for(const variant of ['phase','event','funding','holding','tile'] as const){
  const pre:import('../../../src/game/types.ts').GameState=structuredClone(f.pre)
  if(variant==='phase')pre.phase='rolling'
  if(variant==='event')pre.eventId='bank'
  if(variant==='funding')pre.phase='funding'
  if(variant==='holding')pre.goldUnits=1
  if(variant==='tile')pre.position=16
  const before=canonical(pre);assert.throws(()=>forkGold(pre,f.source.entries[3],r.selection,new WorkBudget()),/gold-fork-not-legal/);assert.equal(canonical(pre),before)
 }
})
test('transcript follow-up count, text length and action identity are bounded',async()=>{
 const f=await finalFixture(),body=recordBody(f.transcript.entries[0]);let t=await newGoldTranscript(f.selection)
 for(let i=0;i<8;i++){const command={...body.command,sequence:25+i};t=await appendGoldRecord(t,{...body,sourceCursor:body.sourceCursor+i,nextSourceCursor:body.sourceCursor+i+1,command,actualAction:command})}
 await verifyGoldTranscript(t,f.selection)
 await assert.rejects(appendGoldRecord(t,body),/gold-followup-budget/)
 await assert.rejects(appendGoldRecord(await newGoldTranscript(f.selection),{...body,blockerHash:'x'.repeat(32768)}),/gold-transcript-budget/)
 const wrong={...body,alternativeAction:{...body.alternativeAction,eventId:'bank'}}
 await assert.rejects(verifyGoldTranscript(await appendGoldRecord(await newGoldTranscript(f.selection),wrong),f.selection),/gold-transcript-action/)
 assert.equal(COURSE_POLICY,'course-basic-to-skip-full-end.v1');assert.equal(commandIdentity(parseHistory(raw()).entries[3]).sequence,4)
 assert.equal(await digest(raw()),f.selection.sourceHash)
})
test('fresh import and genuine public run have no storage/network/session/Basic mutation',()=>{
 const script=`
 import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{gunzipSync}from'node:zlib';
 const counts={network:0,storage:0,worker:0,uuid:0};
 const fail=k=>()=>{counts[k]++;throw Error('forbidden '+k)};
 globalThis.fetch=fail('network');globalThis.localStorage={setItem:fail('storage'),getItem:fail('storage')};globalThis.sessionStorage=globalThis.localStorage;globalThis.Worker=fail('worker');
 const real=crypto.randomUUID.bind(crypto);crypto.randomUUID=()=>{counts.uuid++;return real()};
 const m=await import('./mobile_app/src/game/endgame-whatif-gold-resume.ts');assert.equal(counts.uuid,0);
 const basic=await import('./mobile_app/src/game/endgame-whatif-contract.ts');const policy=basic.COURSE_POLICY;
 const source=gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz')).toString('utf8');
 const handle=await m.createGoldContinuation(await m.prepareGoldRequest(source,4));const p=handle.result;assert.equal(p.status,'needs-followup');
 assert.equal((await handle.resume({continuation:p.continuation,blocker:p.blocker,choice:{kind:'gold-skip',optionId:'skip'}})).status,'supported-final');
 assert.equal(basic.COURSE_POLICY,policy);assert.deepEqual(counts,{network:0,storage:0,worker:0,uuid:1});console.log(JSON.stringify(counts));`
 const result=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',script],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024})
 assert.equal(result.status,0,result.stderr+result.stdout)
})
test('public options reject accessors without reading them',async()=>{
 const r=await request();let calls=0;const options=Object.defineProperty({},'maxSteps',{enumerable:true,get(){calls++;return 100}})
 assert.equal((await createGoldContinuation(r,options)).result.status,'blocked');assert.equal(calls,0)
})