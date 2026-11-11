import { serializeLog } from '../../../src/game/log.ts'
import { COURSE_POLICY, ENDGAME_PROFILE, EndgameRejected, requireEndgame } from './endgame-whatif-contract.ts'
import { identifyCourse, parseHistory, equalData, canonical, digest } from './endgame-whatif-identity.ts'
import { captureDataIntegrity, captureEnvironment } from './endgame-whatif-integrity.ts'
import { replayHistory } from './endgame-whatif-replay.ts'
import { forkCourseBasic } from './endgame-whatif-course-basic.ts'
import { finalAdvancePair } from './endgame-whatif-continuation.ts'
import { completedFour, comparableEndings, endingMetrics, signedMetrics, endingFacts } from './endgame-whatif-comparison.ts'
import { exactKeys, checkTranscript, emptyTranscript, verifyTranscriptChain, appendRecord, validateOptions, assertSubmission } from './endgame-whatif-transcript.ts'
import { reconcileStep, mayInspectNextFunding } from './endgame-whatif-reconcile.ts'
import { inspectBlocker, applyExplicitChoice } from './endgame-whatif-followup.ts'
import { EG1B_LIMITS } from './endgame-whatif-eg1b-contract.ts'
import type { CourseRequest, ContinuationResult, ContinuationHandle, ResumeInput, StartOptions, Transcript, ContinuationIdentity, WorkOptions } from './endgame-whatif-eg1b-contract.ts'

function failure(error: unknown): ContinuationResult {
  return error instanceof EndgameRejected ? {status:error.status,reason:error.message} : {status:'error',reason:'verification-failed'}
}
async function reconstruct(request: CourseRequest, transcript: Transcript, options: WorkOptions, submission?: ResumeInput): Promise<ContinuationResult> {
  const work = validateOptions(options), inputCurrent = captureDataIntegrity({request,transcript}), environmentCurrent = captureEnvironment()
  const current = () => { work.check(); requireEndgame(inputCurrent() && environmentCurrent(), 'input-or-engine-changed') }
  current(); exactKeys(request, ['source','identity']); checkTranscript(transcript)
  const expected = await identifyCourse(request.source, request.identity.decision.sequence, work)
  requireEndgame(equalData(request.identity,expected.identity), 'request-identity-mismatch')
  await verifyTranscriptChain(transcript,expected)
  const source = parseHistory(request.source)
  let verified: Awaited<ReturnType<typeof replayHistory>>
  try { verified = await replayHistory(source,work,request.identity.decision.sequence) } catch(e) { if(e instanceof EndgameRejected)throw e;throw new EndgameRejected('source-replay-failed') }
  current()
  if(!completedFour(verified.final))return {status:'limited',reason:'actual-ending-not-completed4',endings:{actual:endingFacts(verified.final)}}
  requireEndgame(verified.before,'decision-missing')
  const index=verified.commands.findIndex(e=>e.sequence===request.identity.decision.sequence)
  const fork=forkCourseBasic(verified.before,verified.commands[index],work)
  let a=fork.actual,b=fork.alternative,pairedBoundaries=1,consumed=0,appliedSubmission=false
  let output=structuredClone(transcript)
  const identityAt=async(cursor:number):Promise<ContinuationIdentity>=>({branchId:output.branchId,sourceHash:output.sourceHash,configHash:output.configHash,engine:output.engine,profile:ENDGAME_PROFILE,schema:7,selected:output.selected,initial:'skip',fairness:output.fairness,policy:output.policy,revision:output.entries.length,transcriptHash:output.hash,cursor,alternativePrefixHash:await digest(canonical(b.log))})
  for(let i=index+1;i<verified.commands.length;i++){
    const entry=verified.commands[i],step=reconcileStep(a,b,entry,work);a=step.actual;b=step.alternative
    if(!step.ok){
      if(mayInspectNextFunding(step,verified.commands[i+1])){pairedBoundaries++;continue}
      const blocker=await inspectBlocker(step,entry,i,work),continuation=await identityAt(i)
      current()
      if(!blocker.choices.length){requireEndgame(consumed===transcript.entries.length+(appliedSubmission?1:0)&&(!submission||appliedSubmission),'transcript-unreached');return {status:'limited',reason:step.reason,transcript:output,blocker,endings:{actual:endingFacts(verified.final),alternative:endingFacts(b)}}}
      if(consumed>=EG1B_LIMITS.followups)return {status:'limited',reason:'followup-budget',transcript:output,blocker}
      if(consumed>=transcript.entries.length&&(!submission||appliedSubmission))return {status:'needs-followup',continuation,blocker,transcript:output}
      const prior=transcript.entries[consumed]
      if(!prior){requireEndgame(submission&&!appliedSubmission&&equalData(submission.continuation,continuation)&&equalData(submission.blocker,blocker),'stale-blocker')}
      const choice=prior?.action??submission!.choice
      const beforeHash=await digest(canonical(b)),replacement=applyExplicitChoice(step,entry,blocker,choice,work)
      a=replacement.actual;b=replacement.alternative
      const facts={blockerHash:blocker.hash,command:blocker.command,boundary:blocker.boundary,action:choice,beforeHash,afterHash:await digest(canonical(b)),superseded:replacement.superseded}
      if(prior){const rebuilt=await appendRecord({...output,entries:output.entries.slice(0,consumed),hash:prior.previousHash},facts);requireEndgame(equalData(rebuilt.entries[consumed],prior),'prior-followup-mismatch')}
      else{output=await appendRecord(output,facts);appliedSubmission=true}
      consumed++;pairedBoundaries++;current()
    }else pairedBoundaries+=step.boundaries
    if(i%8===0){await work.yield();current()}
  }
  requireEndgame(consumed===transcript.entries.length+(appliedSubmission?1:0)&&(!submission||appliedSubmission),'transcript-unreached')
  const end=finalAdvancePair(a,b,work)
  if(!end.ok){current();return {status:'limited',reason:end.reason,transcript:output}}
  a=end.actual;b=end.alternative;requireEndgame(equalData(a,verified.final),'actual-continuation-mismatch')
  if(!comparableEndings(a,b)){current();return {status:'limited',reason:'incomparable-ending',transcript:output,endings:{actual:endingFacts(a),alternative:endingFacts(b)}}}
  const text=serializeLog(b),independent=await replayHistory(parseHistory(text),work)
  requireEndgame(equalData(independent.final,b),'alternative-replay-mismatch');const alternativeTranscriptHash=await digest(text)
  current();const actual=endingMetrics(a),alternative=endingMetrics(b)
  const continuation=await identityAt(verified.commands.length)
  current()
  return {status:'supported-final',policy:COURSE_POLICY,identity:request.identity,comparability:'same-completed-horizon',actual,alternative,delta:signedMetrics(actual,alternative),endings:{actual:endingFacts(a),alternative:endingFacts(b)},proof:{actualReplay:true,alternativeReplay:true,pairedBoundaries:pairedBoundaries+end.boundaries,finalAdvances:end.advances,alternativeTranscriptHash,steps:work.steps},transcript:output,continuation,attribution:{initialFork:COURSE_POLICY,followupCount:output.entries.length,choices:output.entries.map(r=>({ordinal:r.ordinal,action:r.action,superseded:r.superseded})),combinedConsequences:output.entries.length>0}}
}
export async function createContinuation(request: CourseRequest, options: StartOptions = {}): Promise<ContinuationHandle> {
  let head:ContinuationResult,busy=false,source:CourseRequest
  try {
    const current=captureDataIntegrity(request);validateOptions(options);exactKeys(request,['source','identity'])
    requireEndgame(typeof request.source==='string'&&request.identity&&request.identity.decision&&Number.isSafeInteger(request.identity.decision.sequence),'request-shape')
    source=structuredClone(request)
    const transcript=await emptyTranscript(source)
    head=await reconstruct(source,transcript,options)
    requireEndgame(current(),'input-or-engine-changed')
  }catch(e){head=failure(e)}
  return { get result(){return structuredClone(head)}, async resume(input:ResumeInput,workOptions:WorkOptions={}) {
    if(busy)return {status:'blocked',reason:'submission-in-flight'}
    busy=true
    try{
      const current=captureDataIntegrity(input);exactKeys(input,['continuation','blocker','choice']);validateOptions(workOptions)
      assertSubmission(head,input)
      requireEndgame(head.status==='needs-followup','no-pending-blocker')
      const old=head,submitted=structuredClone(input)
      const next=await reconstruct(source!,structuredClone(old.transcript),workOptions,submitted)
      requireEndgame(current(),'input-or-engine-changed')
      if(next.status==='supported-final'||next.status==='needs-followup'||next.status==='limited')head=next
      return structuredClone(next)
    }catch(e){return failure(e)}finally{busy=false}
  }}
}