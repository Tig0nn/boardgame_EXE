import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { prepareCourseRequest } from './endgame-whatif-course-basic.ts'
import type { Source } from './endgame-whatif-contract.ts'
function createDivergenceFixture() { const text=gunzipSync(readFileSync('docs/playtests/whatif-endgame/2026-11-07/eg1b-01/scripted-attempt2-actual.json.gz')).toString('utf8');return {text,state:(JSON.parse(text) as Source).state} }
import { createContinuation } from './endgame-whatif-resume.ts'

test('critical fixture attempt is honestly nondivergent; it cannot certify interactive full-horizon acceptance', async () => {
  const fixture=createDivergenceFixture(),source=fixture.text
  assert.equal(fixture.state.termination,'completed')
  const sequence=fixture.state.log.find((e:{decisionId?:string})=>e.decisionId==='course-basic')!.sequence
  const branch=await createContinuation(await prepareCourseRequest(source,sequence))
  assert.equal(branch.result.status,'supported-final')
  if(branch.result.status==='supported-final')assert.equal(branch.result.attribution.followupCount,0)
  assert.equal(fixture.text,source)
  // Original required journey failed count>=1: preserved red-critical-journey.log. Gate remains NOT_PROVEN.
})
test('EG1A fixed archive and independent history remain full completed comparisons without follow-ups', async () => {
  for (const [name, delta] of [['browser-320-basic-first', -2_000_000], ['frozen-shortlist-novice', 2_000_000]] as const) {
    const source = gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/' + name + '.json.gz')).toString('utf8')
    const sequence = JSON.parse(source).entries.find((e: {decisionId?: string}) => e.decisionId === 'course-basic').sequence
    const branch = await createContinuation(await prepareCourseRequest(source, sequence))
    assert.equal(branch.result.status, 'supported-final')
    if (branch.result.status === 'supported-final') { assert.equal(branch.result.delta.cash, delta); assert.equal(branch.result.transcript.entries.length, 0) }
  }
})
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { decide, fundPayment } from '../../../src/game/engine.ts'
import { boardFor } from '../../../src/data/board.ts'
import type { GameState } from '../../../src/game/types.ts'
import { WorkBudget } from './endgame-whatif-contract.ts'
import { inspectBlocker, applyExplicitChoice } from './endgame-whatif-followup.ts'
import { reconcileStep } from './endgame-whatif-reconcile.ts'
function eventBoundary(id: string): GameState {
  const s = createMultiCourseGame('EG1B-BOUNDARY-v1', 0)
  return {...s,phase:'event',eventId:id,position:boardFor(s).findIndex(t=>t.type===(id==='medical'?'personal':id))}
}
test('synthetic engine boundary: explicit skip replaces first illegal course decision exactly once', async () => {
  const a=eventBoundary('course'),b=structuredClone(a);b.portfolio.cash=4_000_000
  const entry=decide(a,'course-advanced').log.findLast(e=>e.kind==='decision')!
  const step=reconcileStep(a,b,entry,new WorkBudget())
  assert.equal(step.ok,false);if(step.ok)return
  const pending=await inspectBlocker(step,entry,3,new WorkBudget())
  assert.ok(pending.choices.some(x=>x.action.kind==='event'&&x.action.optionId==='skip'))
  assert.throws(()=>applyExplicitChoice(step,entry,pending,{kind:'event',optionId:'course-advanced'},new WorkBudget()),/illegal-choice/)
  const applied=applyExplicitChoice(step,entry,pending,{kind:'event',optionId:'skip'},new WorkBudget())
  assert.equal(applied.actual.phase,'rolling');assert.equal(applied.alternative.phase,'rolling')
  assert.equal(applied.alternative.log.filter(e=>e.kind==='decision'&&e.decisionId==='skip').length,1)
  assert.deepEqual(applied.superseded,[entry.sequence])
  assert.throws(()=>applyExplicitChoice({...step,...applied},entry,pending,{kind:'event',optionId:'skip'},new WorkBudget()))
})
test('synthetic funding boundary: exact remaining debt is an explicit engine-verified contract', async () => {
  const x=eventBoundary('medical'),y=structuredClone(x);x.portfolio.cash=0;y.portfolio.cash=2_000_000
  const a=decide(x,'pay'),b=decide(y,'pay'),entry=fundPayment(a,'debt',a.pendingPayment!.remaining).log.findLast(e=>e.kind==='funding')!
  const step=reconcileStep(a,b,entry,new WorkBudget());assert.equal(step.ok,false);if(step.ok)return
  const pending=await inspectBlocker(step,entry,4,new WorkBudget())
  assert.equal(pending.reason,'illegal-recorded-funding')
  assert.deepEqual(pending.choices.map(x=>x.action),[{kind:'fund-debt',amount:3_000_000}])
  assert.throws(()=>applyExplicitChoice(step,entry,pending,{kind:'fund-debt',amount:5_000_000},new WorkBudget()),/illegal-choice/)
  const result=applyExplicitChoice(step,entry,pending,{kind:'fund-debt',amount:3_000_000},new WorkBudget())
  assert.equal(result.actual.portfolio.debt,5_000_000);assert.equal(result.alternative.portfolio.debt,3_000_000)
  assert.equal(result.alternative.pendingPayment,null)
})
import { emptyTranscript,appendRecord,verifyTranscriptChain,checkTranscript,assertSubmission,validateOptions } from './endgame-whatif-transcript.ts'
import { canonical,digest } from './endgame-whatif-identity.ts'
import { inspectBlocker as inspect } from './endgame-whatif-followup.ts'
import type { ContinuationResult,ResumeInput,FollowupAction } from './endgame-whatif-eg1b-contract.ts'
function archiveRequest() {
  const source=gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/browser-320-basic-first.json.gz')).toString('utf8')
  return prepareCourseRequest(source,8)
}
async function illegalCourseBoundary() {
  const a=eventBoundary('course'),b=structuredClone(a);b.portfolio.cash=4_000_000
  const entry=decide(a,'course-advanced').log.findLast(e=>e.kind==='decision')!,step=reconcileStep(a,b,entry,new WorkBudget())
  assert.equal(step.ok,false);if(step.ok)throw Error('Expected blocker')
  return {step,entry,blocker:await inspect(step,entry,3,new WorkBudget())}
}
for(const field of ['rng','market','credit','time','event','schedule'] as const)test('synthetic boundary F1 mismatch cannot offer follow-up: '+field,async()=>{
  const {step,entry}=await illegalCourseBoundary(),s=step.alternative
  if(field==='rng')s.rng++
  if(field==='market')s.market.gold.priceHistory[0].priceAfter++
  if(field==='credit')s.bondCredit!.rng++
  if(field==='time')s.turn++
  if(field==='event')s.eventId='gold'
  if(field==='schedule')s.summaries=[{lap:1} as GameState['summaries'][number]]
  const blocker=await inspect(step,entry,3,new WorkBudget())
  assert.equal(blocker.externalEqual,false);assert.equal(blocker.choices.length,0)
  assert.throws(()=>applyExplicitChoice(step,entry,blocker,{kind:'event',optionId:'skip'},new WorkBudget()))
})
for(const boundary of ['after-command','phase-advance'] as const)test('synthetic '+boundary+' never reapplies an already consumed source command',async()=>{
  const {step,entry}=await illegalCourseBoundary(),blocked={...step,boundary},facts=await inspect(blocked,entry,3,new WorkBudget())
  assert.equal(facts.commandApplied,boundary==='after-command');assert.equal(facts.phaseAdvanceOccurred,boundary==='phase-advance');assert.equal(facts.choices.length,0)
  assert.throws(()=>applyExplicitChoice(blocked,entry,{...facts,choices:[{action:{kind:'event',optionId:'skip'},label:'forged'}]},{kind:'event',optionId:'skip'},new WorkBudget()),/replacement-context/)
})
test('synthetic new or unnecessary funding remains limited; no fund0 or automatic skip',async()=>{
  const base=eventBoundary('medical'),empty=structuredClone(base);empty.portfolio.cash=0
  const pending=decide(empty,'pay'),resolved=decide(base,'pay'),entry=fundPayment(pending,'debt',pending.pendingPayment!.remaining).log.findLast(e=>e.kind==='funding')!
  for(const [a,b] of [[pending,resolved],[resolved,pending]]){
    const step=reconcileStep(a,b,entry,new WorkBudget());assert.equal(step.ok,false);if(step.ok)continue
    const facts=await inspect(step,entry,4,new WorkBudget());assert.equal(facts.choices.length,0)
    assert.ok(['funding-no-longer-needed','new-pending-funding'].includes(step.reason));assert.equal('delta' in facts,false)
  }
})
test('synthetic candidate changing funding state is refused despite engine legality',async()=>{
  const {step,entry,blocker}=await illegalCourseBoundary()
  step.alternative.portfolio.cash=0;step.alternative.eventId='medical';step.actual.eventId='medical'
  const forged={...blocker,choices:[{action:{kind:'event',optionId:'pay'} as FollowupAction,label:'pay'}]}
  assert.throws(()=>applyExplicitChoice(step,{...entry,eventId:'medical'},forged,{kind:'event',optionId:'pay'},new WorkBudget()))
})
test('synthetic wrong cursor/context, arbitrary lot and nonfinite amounts rejected',async()=>{
  const {step,entry,blocker}=await illegalCourseBoundary()
  assert.throws(()=>applyExplicitChoice(step,entry,{...blocker,context:{...blocker.context,turn:999}},{kind:'event',optionId:'skip'},new WorkBudget()),/blocker-context/)
  assert.throws(()=>applyExplicitChoice(step,entry,blocker,{kind:'event',optionId:'skip',lotId:'invented'} as FollowupAction,new WorkBudget()),/illegal-choice/)
  assert.throws(()=>applyExplicitChoice(step,entry,blocker,{kind:'fund-debt',amount:Infinity},new WorkBudget()),/illegal-choice/)
})
test('synthetic boundary permits multiple explicit replacements; no automatic option selected',async()=>{
  let {step,entry,blocker}=await illegalCourseBoundary(),count=0
  for(let i=0;i<2;i++){
    assert.ok(blocker.choices.length>0)
    const next=applyExplicitChoice(step,entry,blocker,{kind:'event',optionId:'skip'},new WorkBudget());count++
    assert.equal(next.superseded.length,1)
    if(i===1)break
    // This next encounter is a synthetic boundary, not a full-genesis interactive journey.
    const a={...next.actual,phase:'event' as const,eventId:'course',turn:next.actual.turn+1},b={...next.alternative,phase:'event' as const,eventId:'course',turn:next.alternative.turn+1}
    entry=decide(a,'course-basic').log.findLast(e=>e.kind==='decision')!
    const n=reconcileStep(a,b,entry,new WorkBudget());assert.equal(n.ok,false);if(n.ok)throw Error('Expected blocker')
    step=n;blocker=await inspect(step,entry,4+i,new WorkBudget())
  }
  assert.equal(count,2)
})
test('transcript chain binds source and ordered choices; tampering/reordering rejected',async()=>{
  const request=await archiveRequest(),t=await emptyTranscript(request),{blocker}=await illegalCourseBoundary()
  const r={blockerHash:blocker.hash,command:blocker.command,boundary:blocker.boundary,action:{kind:'event',optionId:'skip'} as FollowupAction,beforeHash:await digest('before'),afterHash:await digest('after'),superseded:[blocker.command.sequence]}
  const one=await appendRecord(t,r),two=await appendRecord(one,r)
  await verifyTranscriptChain(two,request)
  for(const mutate of [(x:typeof two)=>{x.entries[0].action={kind:'event',optionId:'course-basic'}},(x:typeof two)=>{x.entries.reverse()},(x:typeof two)=>{x.sourceHash='wrong'},(x:typeof two)=>{x.entries[0].ordinal=7},(x:typeof two)=>{x.entries.pop()}]){
    const bad=structuredClone(two);mutate(bad);await assert.rejects(verifyTranscriptChain(bad,request))
  }
})
test('transcript hard caps reject seventeenth choice, oversized/nonfinite/deep data',async()=>{
  const t=await emptyTranscript(await archiveRequest()),{blocker}=await illegalCourseBoundary()
  const r={blockerHash:blocker.hash,command:blocker.command,boundary:blocker.boundary,action:{kind:'event',optionId:'skip'} as FollowupAction,beforeHash:'a',afterHash:'b',superseded:[blocker.command.sequence]}
  let current=t;for(let i=0;i<16;i++)current=await appendRecord(current,r)
  await assert.rejects(appendRecord(current,r),/followup-budget/)
  assert.throws(()=>checkTranscript({...t,branchId:'x'.repeat(40_000)}))
  assert.throws(()=>checkTranscript({...t,entries:[{...r,ordinal:Infinity}]} as typeof t))
  const deep:Record<string,unknown>={};let p=deep;for(let i=0;i<70;i++){const n={};p.child=n;p=n}
  assert.throws(()=>checkTranscript({...t,extra:deep} as typeof t),/data-too-deep/)
})

async function submissionBoundary() {
  const request=await archiveRequest(),t=await emptyTranscript(request),{blocker}=await illegalCourseBoundary()
  const continuation={branchId:t.branchId,sourceHash:t.sourceHash,configHash:t.configHash,engine:t.engine,profile:'core-mvp-b18-multi-course-v1',schema:7 as const,selected:t.selected,initial:'skip' as const,fairness:t.fairness,policy:t.policy,revision:0,transcriptHash:t.hash,cursor:blocker.cursor,alternativePrefixHash:'verified-boundary-hash'}
  const head:ContinuationResult={status:'needs-followup',continuation,blocker,transcript:t},input:ResumeInput={continuation:structuredClone(continuation),blocker:structuredClone(blocker),choice:{kind:'event',optionId:'skip'}}
  return {head,input}
}
for(const field of ['source','selected','branch','policy','revision','cursor','blocker','phase','engine','config','event'] as const)test('negative submission guard rejects wrong '+field+' (derived synthetic blocker, no execution claim)',async()=>{
  const {head,input}=await submissionBoundary()
  assertSubmission(head,input)
  if(field==='source')input.continuation.sourceHash='wrong'
  if(field==='selected')input.continuation.selected.sequence++
  if(field==='branch')input.continuation.branchId='foreign'
  if(field==='policy')input.continuation.policy='foreign' as typeof input.continuation.policy
  if(field==='revision')input.continuation.revision++
  if(field==='cursor')input.continuation.cursor++
  if(field==='blocker')input.blocker.hash='wrong'
  if(field==='phase')input.blocker.context.phase='summary'
  if(field==='engine')input.continuation.engine='wrong'
  if(field==='config')input.continuation.configHash='wrong'
  if(field==='event')input.blocker.context.event='wrong'
  assert.throws(()=>assertSubmission(head,input),/stale-blocker/)
})
test('negative guard rejects duplicate/old revision after a tail advances, not a full public resume proof',async()=>{
  const {head,input}=await submissionBoundary();if(head.status!=='needs-followup')throw Error()
  head.continuation.revision++;head.continuation.transcriptHash='next';head.blocker.hash='next-blocker'
  assert.throws(()=>assertSubmission(head,input),/stale-blocker/)
})
test('public API rejects forged Alternative state and imported transcript; never accepts a raw cursor/state',async()=>{
  const request=await archiveRequest()
  const bad=await createContinuation({...request,alternativeState:{cash:999,rng:1}} as typeof request)
  assert.equal(bad.result.status,'blocked')
  const imported=await createContinuation(request,{transcript:await emptyTranscript(request)} as Parameters<typeof createContinuation>[1])
  assert.equal(imported.result.status,'blocked')
  const {head,input}=await submissionBoundary()
  assert.throws(()=>assertSubmission(head,{...input,state:eventBoundary('course')} as ResumeInput),/unexpected-fields/)
})
for(const field of ['sourceHash','configHash','engine','branch','policy'] as const)test('public source identity mismatch '+field+' is blocked before financial publication',async()=>{
  const request=await archiveRequest();request.identity[field]='wrong'
  const branch=await createContinuation(request)
  assert.equal(branch.result.status,'blocked');assert.equal('delta' in branch.result,false)
})
test('public API source mutation during verification is rejected; graph getters are not invoked',async()=>{
  const request=await archiveRequest(),pending=createContinuation(request);request.identity.branch='changed-after-call'
  const branch=await pending;assert.equal(branch.result.status,'blocked')
  let calls=0;const bad=Object.defineProperty({},'source',{get(){calls++;return request.source}})
  const refused=await createContinuation(bad as typeof request);assert.equal(refused.result.status,'blocked');assert.equal(calls,0)
})
test('public work step/deadline/cancellation and option hard caps fail closed',async()=>{
  const request=await archiveRequest()
  const step=await createContinuation(request,{maxSteps:1});assert.equal(step.result.status,'limited');assert.equal('delta' in step.result,false)
  const deadline=await createContinuation(request,{maxMilliseconds:1});assert.equal(deadline.result.status,'limited')
  const before=new AbortController();before.abort();assert.equal((await createContinuation(request,{signal:before.signal})).result.status,'cancelled')
  const during=new AbortController(),pending=createContinuation(request,{signal:during.signal});setTimeout(()=>during.abort(),0)
  const cancelled=await pending;assert.equal(cancelled.result.status,'cancelled');assert.equal('delta' in cancelled.result,false)
  for(const limits of [{maxSteps:20_001},{maxSteps:Infinity},{maxMilliseconds:30_001},{maxMilliseconds:0}])assert.throws(()=>validateOptions(limits),/invalid-work-budget/)
})
import { createMobileSession } from './session.ts'
import { restoreSavedGame } from '../../../src/game/saved-game.ts'
import { serializeLog } from '../../../src/game/log.ts'
test('public core deterministic facts, no live dispatch/storage/network and no mutable result alias',async()=>{
  const request=await archiveRequest(),inputBefore=canonical(request),session=createMobileSession(restoreSavedGame(request.source)),before=serializeLog(session.getSnapshot())
  let writes=0,dispatches=0,network=0
  session.dispatch=()=>{dispatches++;throw Error('Forbidden dispatch')}
  const storage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),fetchBefore=globalThis.fetch
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{setItem(){writes++;throw Error('Forbidden storage')}}})
  globalThis.fetch=()=>{network++;throw Error('Forbidden network')}
  try{
    const a=await createContinuation(request),b=await createContinuation(request)
    const one=a.result,two=b.result;assert.equal(one.status,'supported-final');assert.equal(two.status,'supported-final')
    if(one.status==='supported-final'&&two.status==='supported-final'){
      assert.deepEqual(one.actual,two.actual);assert.deepEqual(one.alternative,two.alternative);assert.deepEqual(one.delta,two.delta);assert.equal(one.proof.alternativeTranscriptHash,two.proof.alternativeTranscriptHash)
      one.actual.cash=0;assert.notEqual((a.result as typeof one).actual.cash,0)
      const fake=(await submissionBoundary()).input
      assert.equal((await a.resume(fake)).status,'blocked');assert.equal(a.result.status,'supported-final')
    }
    assert.equal(canonical(request),inputBefore);assert.equal(serializeLog(session.getSnapshot()),before)
    assert.equal(writes+dispatches+network,0)
  }finally{globalThis.fetch=fetchBefore;if(storage)Object.defineProperty(globalThis,'localStorage',storage);else Reflect.deleteProperty(globalThis,'localStorage')}
})

test('public malformed inputs are blocked rather than reported as internal verification errors',async()=>{
  for(const value of [null,{}, {source:'{}'}, {source:'{}',identity:null}]){
    const branch=await createContinuation(value as unknown as Parameters<typeof createContinuation>[0])
    assert.equal(branch.result.status,'blocked')
  }
})
import { verifyReplacement,applyCandidate } from './endgame-whatif-followup.ts'
test('synthetic real event candidate with changed funding path fails paired rejoin',()=>{
  const a=eventBoundary('medical'),b=structuredClone(a);b.portfolio.cash=0
  const entry=decide(a,'defer').log.findLast(e=>e.kind==='decision')!
  assert.equal(applyCandidate(b,{kind:'event',optionId:'pay'},new WorkBudget()).phase,'funding')
  const step={ok:false as const,reason:'illegal-recorded-action',boundary:'before-command' as const,actual:a,alternative:b}
  assert.throws(()=>verifyReplacement(step,entry,{kind:'event',optionId:'pay'},new WorkBudget()),/followup-external-mismatch/)
})
test('synthetic no-progress/context/early-insolvent cannot be advanced or offered a choice',async()=>{
  const a=eventBoundary('course'),entry=decide(a,'skip').log.findLast(e=>e.kind==='decision')!
  const stalled=reconcileStep(a,structuredClone(a),{...entry,before:{...entry.before,phase:'summary'}},new WorkBudget())
  assert.equal(stalled.ok,false);if(!stalled.ok)assert.equal(stalled.reason,'engine-no-progress')
  const poor=eventBoundary('medical');poor.portfolio.cash=0;poor.portfolio.debt=poor.borrowingLimit
  const insolvent=decide(poor,'pay');assert.equal(insolvent.termination,'insolvent')
  const step=reconcileStep(a,insolvent,entry,new WorkBudget());assert.equal(step.ok,false)
  if(!step.ok){assert.equal(step.reason,'early-insolvency');assert.equal((await inspect(step,entry,4,new WorkBudget())).choices.length,0)}
})
test('work-option accessors and inherited getters are rejected without invocation',()=>{
  let calls=0
  const own=Object.defineProperty({},'signal',{enumerable:true,get(){calls++;return undefined}})
  const inherited=Object.create({get signal(){calls++;return undefined}})
  assert.throws(()=>validateOptions(own),/work-options/)
  assert.throws(()=>validateOptions(inherited),/work-options/)
  assert.equal(calls,0)
})