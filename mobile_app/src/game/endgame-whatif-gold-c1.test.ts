import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {prepareGoldRequest,createGoldContinuation} from './endgame-whatif-gold-resume.ts'
import type {GoldResult} from './endgame-whatif-gold-contract.ts'
function readHead(h:{readonly result:GoldResult}):GoldResult{return h.result}
const source=()=>gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz')).toString('utf8')

test('pinned full history: public Gold create pauses at sale25; explicit public resume completes with real replay',async()=>{
 const request=await prepareGoldRequest(source(),4),before=JSON.stringify(request),handle=await createGoldContinuation(request),pending=handle.result
 assert.equal(pending.status,'needs-followup')
 if(pending.status!=='needs-followup')return
 assert.equal(pending.waitingForChoice,true);assert.equal(pending.blocker.command.sequence,25)
 assert.equal(pending.blocker.command.kind,'rebalancing');assert.equal(pending.blocker.command.action?.amount,1_974_376)
 assert.equal(pending.blocker.context.phase,'event');assert.equal(pending.blocker.context.event,'gold')
 assert.deepEqual(pending.blocker.choices.map(x=>x.action),[{kind:'gold-skip',optionId:'skip'}])
 assert.equal('delta' in pending,false);assert.equal('state' in pending,false);assert.equal(pending.transcript.entries.length,0)
 const final=await handle.resume({continuation:pending.continuation,blocker:pending.blocker,choice:{kind:'gold-skip',optionId:'skip'}})
 assert.equal(final.status,'supported-final')
 if(final.status!=='supported-final')return
 assert.equal(final.actual.cash,80_424_780);assert.equal(final.alternative.cash,80_528_786)
 assert.equal(final.delta.cash,104_006);assert.equal(final.delta.totalWorth,104_006);assert.equal(final.delta.liquidatableFunds,104_006)
 assert.equal(final.endings.actual.turn,21);assert.equal(final.endings.alternative.turn,21)
 assert.equal(final.proof.actualReplay,true);assert.equal(final.proof.alternativeReplay,true)
 assert.equal(final.proof.alternativeExportHash,'a3dbfda4d88d11f3ef73a77c15e1afae95e5746c59eae94a48eb98cf19ceb73a')
 assert.equal(final.transcript.entries.length,1);assert.equal(final.continuation.revision,1)
 assert.equal(final.attribution.combinedConsequences,true);assert.equal(final.attribution.followupCount,1)
 assert.equal(final.ledger.filter(x=>x.mode==='explicit-followup').length,1)
 const replaced=final.ledger.find(x=>x.sourceCommand.sequence===25)!
 assert.equal(replaced.mode,'explicit-followup');assert.equal(replaced.actualCommand.kind,'rebalancing');assert.equal(replaced.alternativeCommand.decisionId,'skip')
 assert.equal(final.ledger.find(x=>x.sourceCommand.sequence===60)?.mode,'retained');assert.equal(final.ledger.find(x=>x.sourceCommand.sequence===84)?.mode,'retained')
 assert.equal(final.ledger.length,39);assert.equal(new Set(final.ledger.map(x=>x.sourceCommand.sequence)).size,39)
 assert.equal(JSON.stringify(request),before)
})

test('public pending rejects invalid inputs, preserves head, then valid retry commits once',async()=>{
 const handle=await createGoldContinuation(await prepareGoldRequest(source(),4)),pending=handle.result
 assert.equal(pending.status,'needs-followup');if(pending.status!=='needs-followup')return
 const input={continuation:pending.continuation,blocker:pending.blocker,choice:{kind:'gold-skip' as const,optionId:'skip' as const}}
 for(const change of [
  (x:typeof input)=>{x.choice.optionId='buy' as 'skip'},
  (x:typeof input)=>{x.blocker.hash='foreign'},
  (x:typeof input)=>{x.continuation.revision++},
  (x:typeof input)=>{x.continuation.sourceCursor++},
  (x:typeof input)=>{x.continuation.selection.initialPolicy='course-basic-to-skip-full-end.v1' as typeof x.continuation.selection.initialPolicy},
  (x:typeof input)=>{x.blocker.context.event='stocks'},
  (x:typeof input)=>{x.blocker.context.phase='rolling'},
 ]){
  const bad=structuredClone(input);change(bad);const result=await handle.resume(bad)
  assert.equal(result.status,'blocked');assert.deepEqual(handle.result,pending)
 }
 const exposed=handle.result;if(exposed.status!=='needs-followup')throw Error()
 exposed.blocker.choices.length=0;exposed.transcript.hash='tampered';exposed.continuation.revision=90
 assert.deepEqual(handle.result,pending)
 const final=await handle.resume(input);assert.equal(final.status,'supported-final','reason'in final?final.reason:'Expected verified Gold final')
 assert.equal((await handle.resume(input)).status,'blocked');assert.equal((await handle.resume(input)).status,'blocked')
 if(final.status==='supported-final'){
  assert.equal(final.transcript.entries.length,1);assert.equal(final.continuation.revision,1)
  final.actual.cash=0;final.transcript.entries[0].choice.optionId='forged' as 'skip'
  const current=readHead(handle);assert.equal(current.status,'supported-final');if(current.status==='supported-final'){assert.equal(current.actual.cash,80_424_780);assert.equal(current.transcript.entries[0].choice.optionId,'skip')}
 }
})

test('genuine concurrent public resumes commit one financial timeline and reject duplicate/stale',async()=>{
 const handle=await createGoldContinuation(await prepareGoldRequest(source(),4)),pending=handle.result
 assert.equal(pending.status,'needs-followup');if(pending.status!=='needs-followup')return
 const input={continuation:pending.continuation,blocker:pending.blocker,choice:{kind:'gold-skip' as const,optionId:'skip' as const}}
 const first=handle.resume(input),second=handle.resume(structuredClone(input)),[one,two]=await Promise.all([first,second])
 assert.equal(one.status,'supported-final');assert.deepEqual(two,{status:'blocked',reason:'gold-submission-in-flight'})
 const after=handle.result;assert.equal(after.status,'supported-final')
 if(after.status==='supported-final'){assert.equal(after.transcript.entries.length,1);assert.equal(after.ledger.filter(x=>x.mode==='explicit-followup').length,1);assert.equal(after.delta.cash,104_006)}
 assert.equal((await handle.resume(input)).status,'blocked');assert.deepEqual(handle.result,after)
})

test('foreign genuine branch refused; repeated fresh full-history runs have deterministic engine facts',async()=>{
 const request=await prepareGoldRequest(source(),4),a=await createGoldContinuation(request),b=await createGoldContinuation(request),pa=a.result,pb=b.result
 assert.equal(pa.status,'needs-followup');assert.equal(pb.status,'needs-followup');if(pa.status!=='needs-followup'||pb.status!=='needs-followup')return
 assert.notEqual(pa.continuation.branchId,pb.continuation.branchId)
 const choice={kind:'gold-skip' as const,optionId:'skip' as const}
 assert.equal((await a.resume({continuation:pb.continuation,blocker:pb.blocker,choice})).status,'blocked');assert.deepEqual(a.result,pa)
 const fa=await a.resume({continuation:pa.continuation,blocker:pa.blocker,choice}),fb=await b.resume({continuation:pb.continuation,blocker:pb.blocker,choice})
 assert.equal(fa.status,'supported-final');assert.equal(fb.status,'supported-final')
 if(fa.status==='supported-final'&&fb.status==='supported-final'){
  assert.deepEqual(fa.actual,fb.actual);assert.deepEqual(fa.alternative,fb.alternative);assert.deepEqual(fa.delta,fb.delta);assert.deepEqual(fa.ledger,fb.ledger)
  assert.equal(fa.proof.alternativeExportHash,fb.proof.alternativeExportHash)
  assert.equal(fa.transcript.entries[0].preStateHash,fb.transcript.entries[0].preStateHash)
  assert.equal(fa.transcript.entries[0].postStateHash,fb.transcript.entries[0].postStateHash)
 }
})

test('public cancellation before/during commit preserves pending; abort after success does not roll back',async()=>{
 const request=await prepareGoldRequest(source(),4),pre=new AbortController();pre.abort()
 assert.equal((await createGoldContinuation(request,{signal:pre.signal})).result.status,'cancelled')
 const handle=await createGoldContinuation(request),pending=handle.result;assert.equal(pending.status,'needs-followup');if(pending.status!=='needs-followup')return
 const input={continuation:pending.continuation,blocker:pending.blocker,choice:{kind:'gold-skip' as const,optionId:'skip' as const}}
 assert.equal((await handle.resume(input,{signal:pre.signal})).status,'cancelled');assert.deepEqual(handle.result,pending)
 const during=new AbortController(),running=handle.resume(input,{signal:during.signal});setTimeout(()=>during.abort(),0)
 const cancelled=await running;assert.equal(cancelled.status,'cancelled');assert.equal('delta' in cancelled,false);assert.deepEqual(handle.result,pending)
 const after=new AbortController(),final=await handle.resume(input,{signal:after.signal});assert.equal(final.status,'supported-final');after.abort()
 assert.equal(handle.result.status,'supported-final');assert.equal((await handle.resume(input)).status,'blocked')
})

test('caller mutation during a public resume is rejected without consuming the private pending head',async()=>{
 const handle=await createGoldContinuation(await prepareGoldRequest(source(),4)),pending=handle.result;assert.equal(pending.status,'needs-followup');if(pending.status!=='needs-followup')return
 const input={continuation:structuredClone(pending.continuation),blocker:structuredClone(pending.blocker),choice:{kind:'gold-skip' as const,optionId:'skip' as const}}
 const running=handle.resume(input);input.continuation.revision++
 const rejected=await running;assert.equal(rejected.status,'blocked');assert.deepEqual(handle.result,pending)
 const final=await handle.resume({continuation:pending.continuation,blocker:pending.blocker,choice:{kind:'gold-skip',optionId:'skip'}})
 assert.equal(final.status,'supported-final')
})
