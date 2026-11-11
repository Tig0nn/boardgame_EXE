import {serializeLog} from '../../../src/game/log.ts'
import type {GameState} from '../../../src/game/types.ts'
import {EndgameRejected,requireEndgame} from './endgame-whatif-contract.ts'
import type {WorkBudget} from './endgame-whatif-contract.ts'
import {canonical,digest,commandIdentity,equalData,parseHistory} from './endgame-whatif-identity.ts'
import {captureDataIntegrity,captureEnvironment} from './endgame-whatif-integrity.ts'
import {replayHistory,isCommand} from './endgame-whatif-replay.ts'
import {completedFour} from './endgame-whatif-comparison.ts'
import {validateOptions} from './endgame-whatif-transcript.ts'
import {identifyGoldWithSource,validateGoldRequest} from './endgame-whatif-gold-identity.ts'
import {forkGold} from './endgame-whatif-gold-fork.ts'
import {stepGoldPair,finishGoldPair} from './endgame-whatif-gold-reconcile.ts'
import {inspectGoldBlocker,applyGoldSkip} from './endgame-whatif-gold-followup.ts'
import {newGoldTranscript,verifyGoldTranscript,appendGoldRecord,assertGoldSubmission} from './endgame-whatif-gold-transcript.ts'
import {goldMetrics,goldCosts,comparableEndings,signedMetrics,endingFacts} from './endgame-whatif-gold-comparison.ts'
import {GOLD_LIMITS} from './endgame-whatif-gold-contract.ts'
import type {GoldRequest,GoldTranscript,GoldResumeInput,GoldResult,GoldContinuationHandle,GoldContinuationIdentity,GoldLedgerEntry,WorkOptions} from './endgame-whatif-gold-contract.ts'
export {prepareGoldRequest} from './endgame-whatif-gold-identity.ts'
function failure(error:unknown):GoldResult{return error instanceof EndgameRejected?{status:error.status,reason:error.message}:{status:'error',reason:'gold-verification-failed'}}
function appliedCommand(state:GameState,oldLength:number){const command=state.log.slice(oldLength).find(isCommand);requireEndgame(command,'gold-command-no-progress');return commandIdentity(command)}
async function reconstruct(request:GoldRequest,transcript:GoldTranscript,work:WorkBudget,submission?:GoldResumeInput):Promise<GoldResult>{
 const inputCurrent=captureDataIntegrity({request,transcript}),environmentCurrent=captureEnvironment(),current=()=>{work.check();requireEndgame(inputCurrent()&&environmentCurrent(),'gold-input-or-engine-changed')}
 current();validateGoldRequest(request)
 const expected=await identifyGoldWithSource(request.source,request.selection.decision.sequence,work)
 requireEndgame(equalData(request.selection,expected.selection),'gold-request-identity-mismatch');await verifyGoldTranscript(transcript,expected.selection)
 const source=expected.source
 let verified:Awaited<ReturnType<typeof replayHistory>>
 try{verified=await replayHistory(source,work,request.selection.decision.sequence)}catch(error){if(error instanceof EndgameRejected)throw error;throw new EndgameRejected('gold-source-replay-failed')}
 current()
 if(!completedFour(verified.final))return{status:'limited',reason:'gold-actual-ending-not-completed4',endings:{actual:endingFacts(verified.final)}}
 requireEndgame(verified.before,'gold-decision-missing')
 const start=verified.commands.findIndex(e=>e.sequence===request.selection.decision.sequence),entry=verified.commands[start]
 requireEndgame(entry,'gold-decision-missing')
 const fork=forkGold(verified.before,entry,request.selection,work)
 let a=fork.actual,b=fork.alternative,output=structuredClone(transcript),consumed=0,newApplied=false
 const stats={externalCheckpoints:1,advances:0},ledger:GoldLedgerEntry[]=[]
 function record(index:number,mode:GoldLedgerEntry['mode'],beforeA:GameState,beforeB:GameState,afterA:GameState,afterB:GameState,saleCosts:GoldLedgerEntry['saleCosts']){
  requireEndgame(index===start+ledger.length&&!ledger.some(x=>x.sourceCommand.sequence===verified.commands[index].sequence),'gold-source-cursor-drift')
  ledger.push({sourceCursor:index,sourceCommand:commandIdentity(verified.commands[index]),mode,actualCommand:appliedCommand(afterA,beforeA.log.length),alternativeCommand:appliedCommand(afterB,beforeB.log.length),actualApplications:1,alternativeApplications:1,saleCosts})
 }
 const identityAt=async(sourceCursor:number):Promise<GoldContinuationIdentity>=>({branchId:output.branchId,selection:structuredClone(request.selection),initial:'skip',revision:output.entries.length,transcriptHash:output.hash,sourceCursor,alternativePrefixHash:await digest(canonical(b.log))})
 record(start,'initial-fork',verified.before,verified.before,a,b,null)
 for(let i=start+1;i<verified.commands.length;i++){
  const command=verified.commands[i],beforeA=a,beforeB=b,step=stepGoldPair(a,b,command,source.entries,work,stats);a=step.actual;b=step.alternative
  if(!step.ok){
   const blocker=await inspectGoldBlocker(step,command,i,work),continuation=await identityAt(i);current()
   const allPrior=consumed===transcript.entries.length+(newApplied?1:0),requestUsed=!submission||newApplied
   if(!blocker.choices.length){requireEndgame(allPrior&&requestUsed,'gold-transcript-unreached');return{status:'limited',reason:step.reason,blocker,transcript:output,ledger,endings:{actual:endingFacts(verified.final),alternative:endingFacts(b)}}}
   if(consumed>=GOLD_LIMITS.followups)return{status:'limited',reason:'gold-followup-budget',blocker,transcript:output,ledger}
   if(consumed>=transcript.entries.length&&requestUsed)return{status:'needs-followup',waitingForChoice:true,selection:structuredClone(request.selection),continuation,blocker,transcript:output}
   const prior=transcript.entries[consumed]
   if(!prior)requireEndgame(submission&&!newApplied&&equalData(submission.continuation,continuation)&&equalData(submission.blocker,blocker),'gold-stale-reconstructed-blocker')
   const choice=prior?.choice??submission!.choice
   requireEndgame(blocker.choices.some(x=>equalData(x.action,choice)),'illegal-gold-choice')
   const preStateHash=await digest(canonical(b)),replacement=applyGoldSkip(step,command,choice,work);a=replacement.actual;b=replacement.alternative
   record(i,'explicit-followup',step.actual,step.alternative,a,b,step.quote?{actual:step.quote,alternative:null}:null)
   const facts={sourceCursor:i,command:blocker.command,blockerHash:blocker.hash,choice,preStateHash,postStateHash:await digest(canonical(b)),actualAction:ledger.at(-1)!.actualCommand,alternativeAction:ledger.at(-1)!.alternativeCommand,nextSourceCursor:i+1}
   if(prior){const rebuilt=await appendGoldRecord({...output,entries:output.entries.slice(0,consumed),hash:prior.previousHash},facts);requireEndgame(equalData(rebuilt.entries[consumed],prior),'gold-prior-followup-mismatch')}
   else{output=await appendGoldRecord(output,facts);newApplied=true}
   consumed++;stats.externalCheckpoints++;current()
  }else record(i,'retained',beforeA,beforeB,a,b,step.quote?{actual:step.quote,alternative:step.alternativeQuote}:null)
  if(i%8===0){await work.yield();current()}
 }
 requireEndgame(consumed===transcript.entries.length+(newApplied?1:0)&&(!submission||newApplied),'gold-transcript-unreached')
 const end=finishGoldPair(a,b,work,stats)
 if(!end.ok){current();return{status:'limited',reason:end.reason,transcript:output,ledger,endings:{actual:endingFacts(verified.final),alternative:endingFacts(end.alternative)}}}
 a=end.actual;b=end.alternative;requireEndgame(equalData(a,verified.final),'gold-actual-continuation-mismatch')
 if(!comparableEndings(a,b)){current();return{status:'limited',reason:'gold-incomparable-ending',transcript:output,ledger,endings:{actual:endingFacts(a),alternative:endingFacts(b)}}}
 const exportText=serializeLog(b),independent=await replayHistory(parseHistory(exportText),work)
 requireEndgame(equalData(independent.final,b),'gold-alternative-replay-mismatch')
 const alternativeExportHash=await digest(exportText),continuation=await identityAt(verified.commands.length)
 requireEndgame(await digest(request.source)===request.selection.sourceHash,'gold-source-changed');current()
 const actual=goldMetrics(a),alternative=goldMetrics(b)
 return{status:'supported-final',selection:structuredClone(request.selection),continuation,transcript:output,ledger,comparability:'same-completed-horizon',actual,alternative,delta:signedMetrics(actual,alternative),endings:{actual:endingFacts(a),alternative:endingFacts(b)},costs:goldCosts(ledger),attribution:{initialFork:request.selection.initialPolicy,initialCommand:request.selection.decision,followupCount:output.entries.length,followups:output.entries.map(x=>({ordinal:x.ordinal,command:x.command,choice:x.choice})),combinedConsequences:output.entries.length>0},proof:{actualReplay:true,alternativeReplay:true,alternativeExportHash,externalCheckpoints:stats.externalCheckpoints,phaseAdvances:stats.advances,steps:work.steps,sourceUnchanged:true,reconstruction:{actual:1,coupled:1,independentAlternative:1}}}
}
/** Isolated in-memory Gold core. No live session, storage, DOM, Worker, network or imported checkpoint. */
export async function createGoldContinuation(request:GoldRequest,options:WorkOptions={}):Promise<GoldContinuationHandle>{
 let head:GoldResult,owned:GoldRequest,busy=false
 try{const witness=captureDataIntegrity(request),work=validateOptions(options);validateGoldRequest(request);owned=structuredClone(request);const transcript=await newGoldTranscript(owned.selection);head=await reconstruct(owned,transcript,work);work.check();requireEndgame(witness(),'gold-caller-input-changed')}catch(error){head=failure(error)}
 return{get result(){return structuredClone(head)},async resume(input:GoldResumeInput,workOptions:WorkOptions={}){
  if(busy)return{status:'blocked',reason:'gold-submission-in-flight'}
  busy=true
  try{
   const witness=captureDataIntegrity(input),work=validateOptions(workOptions);work.check();assertGoldSubmission(head,input)
   requireEndgame(head.status==='needs-followup','gold-no-pending-blocker')
   const next=await reconstruct(owned!,structuredClone(head.transcript),work,structuredClone(input))
   work.check();requireEndgame(witness(),'gold-caller-input-changed')
   // The private revision changes once, synchronously. No await/cancel boundary exists after commit.
   if(next.status==='supported-final'||next.status==='needs-followup'||next.status==='limited')head=next
   return structuredClone(next)
  }catch(error){return failure(error)}finally{busy=false}
 }}
}
