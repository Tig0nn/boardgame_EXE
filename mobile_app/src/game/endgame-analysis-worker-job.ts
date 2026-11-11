import {WorkBudget,EndgameRejected,requireEndgame} from './endgame-whatif-contract.ts'
import {canonical,equalData} from './endgame-whatif-identity.ts'
import {captureDataIntegrity} from './endgame-whatif-integrity.ts'
import {createGoldContinuation} from './endgame-whatif-gold-resume.ts'
import type {GoldContinuationHandle,GoldResumeInput,GoldSelection} from './endgame-whatif-gold-contract.ts'
import {prepareAnalysisSource,listGoldDecisions} from './endgame-analysis-source.ts'
import type {SourceInput,VerifiedSource} from './endgame-analysis-source.ts'
import {PROTOCOL,validateRequest,validateResponse,validateEnvelope,projectFinal} from './endgame-analysis-protocol.ts'
import type {Request,Response,Envelope,ResponseKind} from './endgame-analysis-protocol.ts'
const stableKeys=['controllerIncarnation','sessionIncarnation','sessionEpoch','captureId','captureRevision','engine','profile','schema','initialPolicy','continuationPolicy','fairness','analysisInstance','analysisId','workerGeneration'] as const
const stable=(e:Envelope)=>canonical(Object.fromEntries(stableKeys.map(k=>[k,e[k]])))
const now=()=>performance.timeOrigin+performance.now()
/** Worker-owned source and C1 closure. Never serializes a handle or imports caller checkpoints. */
export function createWorkerJob(emit:(response:Response)=>void){
 let source:VerifiedSource|undefined,catalog:GoldSelection[]|undefined,handle:GoldContinuationHandle|undefined,owner:string|undefined,busy=false,disposed=false,lastOrdinal=0,created=0
 let active:{jobId:string;abort:AbortController}|undefined
 const seen=new Set<string>()
 const dispose=()=>{disposed=true;active?.abort.abort();source=undefined;catalog=undefined;handle=undefined;owner=undefined}
 function reply(kind:ResponseKind,envelope:Envelope,body:Record<string,unknown>,receivedAt:number){const value:Response={version:PROTOCOL,kind,envelope:structuredClone(envelope),body:structuredClone(body),timing:{receivedAt,finishedAt:now(),elapsedMs:now()-receivedAt}};validateResponse(value);emit(value)}
 function trustedEnvelope(value:unknown){try{if(!value||typeof value!=='object')return;const descriptor=Object.getOwnPropertyDescriptor(value,'envelope');if(!descriptor||!('value'in descriptor))return;captureDataIntegrity(descriptor.value);validateEnvelope(descriptor.value);return structuredClone(descriptor.value)}catch{return}}
 return{dispose,debug:()=>({disposed,busy,sources:source?1:0,handles:handle?1:0,created,ordinal:lastOrdinal,activeJob:active?.jobId??null}),async receive(value:unknown):Promise<void>{
  const receivedAt=now();let request:Request|undefined,owns=false
  try{
   validateRequest(value);request=structuredClone(value);const {kind,envelope:e,body}=request
   requireEndgame(!disposed,'transport-disposed');requireEndgame(owner===undefined||stable(e)===owner,'transport-foreign-owner')
   requireEndgame(!seen.has(e.jobId),'transport-duplicate-job');requireEndgame(e.requestOrdinal>lastOrdinal,'transport-stale-ordinal');requireEndgame(seen.size<128,'transport-request-cap')
   if(kind==='DISPOSE_SESSION'||kind==='CANCEL_ANALYSIS'){
    if(kind==='CANCEL_ANALYSIS')requireEndgame(!active||body.targetJobId===active.jobId,'transport-wrong-cancel-target')
    const commit=handle?.result.status==='supported-final'?'committed':active?'unknown':'not-started';dispose();reply('CANCELLED',e,{reason:kind==='DISPOSE_SESSION'?'disposed':'cancelled',commit},receivedAt);return
   }
   requireEndgame(!busy,'transport-busy');busy=true;owns=true;owner??=stable(e);seen.add(e.jobId);lastOrdinal=e.requestOrdinal
   const abort=new AbortController();active={jobId:e.jobId,abort}
   const current=captureDataIntegrity(value)
   if(kind==='PREPARE_SOURCE'){
    requireEndgame(!source&&!handle&&e.branchId===null&&e.expectedRevision===null&&e.decision===null,'transport-source-already-owned')
    const result=await prepareAnalysisSource(body.source as SourceInput,new WorkBudget({signal:abort.signal}));requireEndgame(current(),'transport-request-mutated');if(disposed)return
    requireEndgame((e.sourceHash===null||e.sourceHash===result.identity.sourceHash)&&(e.configHash===null||e.configHash===result.identity.configHash),'transport-source-mismatch');source=result
    reply('SOURCE_VERIFIED',e,{identity:result.identity,timings:result.timings,capabilities:{worker:typeof self!=='undefined'&&typeof document==='undefined',crypto:!!crypto.subtle&&typeof crypto.randomUUID==='function',encoder:typeof TextEncoder==='function',clone:typeof structuredClone==='function',dom:typeof document!=='undefined'}},receivedAt)
   }else{
    requireEndgame(source&&e.sourceHash===source.identity.sourceHash&&e.configHash===source.identity.configHash,'transport-unverified-source')
    if(kind==='LIST_ELIGIBLE_DECISIONS'){
     requireEndgame(!handle&&e.branchId===null&&e.expectedRevision===null&&e.decision===null,'transport-catalog-phase');const list=await listGoldDecisions(source,new WorkBudget({signal:abort.signal}));requireEndgame(current(),'transport-request-mutated');if(disposed)return;catalog=list;reply('DECISIONS_READY',e,{decisions:list},receivedAt)
    }else{
     if(kind==='CREATE_ANALYSIS'){
      requireEndgame(!handle&&catalog&&catalog.some(x=>equalData(x,body.selection))&&equalData(e.decision,(body.selection as GoldSelection).decision)&&e.branchId===null&&e.expectedRevision===null,'transport-invalid-create')
      const result=await createGoldContinuation({source:source.text,selection:body.selection as GoldSelection},{signal:abort.signal});requireEndgame(current(),'transport-request-mutated');if(disposed)return;handle=result;created++
     }else{
      requireEndgame(kind==='FOLLOWUP_SELECTION'&&handle,'transport-no-handle');const prior=handle.result
      requireEndgame(prior.status==='needs-followup'&&e.branchId===prior.continuation.branchId&&e.expectedRevision===prior.continuation.revision&&equalData(e.decision,prior.selection.decision),'transport-stale-branch')
      const result=await handle.resume(body as GoldResumeInput,{signal:abort.signal});requireEndgame(current(),'transport-request-mutated');if(disposed)return
      // Invalid resume returns a failure DTO and does not replace C1's private head.
      if(result.status==='blocked'||result.status==='error'||result.status==='cancelled'){reply(result.status==='cancelled'?'CANCELLED':result.status==='error'?'ERROR':'BLOCKED',e,result.status==='cancelled'?{reason:result.reason,commit:'unknown'}:{reason:result.reason},receivedAt);return}
     }
     const result=handle!.result
     if(result.status==='needs-followup')reply('NEEDS_FOLLOWUP',e,{continuation:result.continuation,blocker:result.blocker,transcriptCount:result.transcript.entries.length},receivedAt)
     else if(result.status==='supported-final')reply('SUPPORTED_FINAL',e,projectFinal(result),receivedAt)
     else if(result.status==='cancelled')reply('CANCELLED',e,{reason:result.reason,commit:'unknown'},receivedAt)
     else reply(result.status==='limited'?'LIMITED':result.status==='error'?'ERROR':'BLOCKED',e,{reason:result.reason},receivedAt)
    }
   }
  }catch(error){
   if(disposed)return
   const e=request?.envelope??trustedEnvelope(value)
   if(e){const reason=error instanceof EndgameRejected?error.message.slice(0,200):'worker-verification-failed';try{reply(error instanceof EndgameRejected&&error.status==='limited'?'LIMITED':error instanceof EndgameRejected&&error.status==='cancelled'?'CANCELLED':'BLOCKED',e,error instanceof EndgameRejected&&error.status==='cancelled'?{reason,commit:'unknown'}:{reason},receivedAt)}catch{/* Uncorrelatable/invalid response is never published. Client deadline disposes. */}}
  }finally{if(owns&&request&&active?.jobId===request.envelope.jobId){active=undefined;busy=false}}
 }}
}