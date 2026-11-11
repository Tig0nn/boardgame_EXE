import {PROTOCOL,newEnvelope,validateRequest,validateResponse} from './endgame-analysis-protocol.ts'
import type {Envelope,RequestKind,Request,Response} from './endgame-analysis-protocol.ts'
import type {GoldSelection,GoldContinuationIdentity} from './endgame-whatif-gold-contract.ts'
import type {SourceIdentity} from './endgame-analysis-source.ts'
import {captureDataIntegrity} from './endgame-whatif-integrity.ts'
import {equalData} from './endgame-whatif-identity.ts'
import {EndgameRejected,requireEndgame} from './endgame-whatif-contract.ts'
import {ENDGAME_ANALYSIS_DEV,endgameAnalysisEnabled} from './endgame-analysis-feature.ts'
export type AnalysisPort={postMessage(value:unknown):void;terminate():void;onmessage:((event:MessageEvent<unknown>)=>void)|null;onerror:((event:ErrorEvent)=>void)|null;onmessageerror:((event:MessageEvent<unknown>)=>void)|null}
export type ClientOptions={enabled?:boolean;factory?:()=>AnalysisPort;deadlineMs?:number;graceMs?:number}
export type AnalysisClient={request(kind:RequestKind,body:Record<string,unknown>):Promise<Response>;read():Response|null;cancel():void;dispose():void;debug():Record<string,unknown>}
let workerOwner:object|null=null
const stamp=()=>performance.timeOrigin+performance.now()
export function failureResponse(e:Envelope,reason:string,kind:'BLOCKED'|'CANCELLED'='BLOCKED'):Response{return{version:PROTOCOL,kind,envelope:structuredClone(e),body:kind==='CANCELLED'?{reason,commit:'unknown'}:{reason},timing:{receivedAt:stamp(),finishedAt:stamp(),elapsedMs:0}}}
/** One managed generation. No import-time Worker. A revoked/lost-ACK generation can never be retried. */
export function createAnalysisClient(initial:Envelope=newEnvelope(),options:ClientOptions={}):AnalysisClient{
 captureDataIntegrity(initial)
 let phase='empty',envelope=structuredClone(initial),port:AnalysisPort|undefined,disposed=false,ordinal=0,published:Response|null=null,grace:ReturnType<typeof setTimeout>|undefined
 let pending:{request:Request;resolve:(r:Response)=>void;timer:ReturnType<typeof setTimeout>;current:()=>boolean}|undefined
 const owner={},deadline=options.deadlineMs??35_000,graceMs=options.graceMs??250
 requireEndgame(Number.isSafeInteger(deadline)&&deadline>0&&deadline<=35_000&&Number.isSafeInteger(graceMs)&&graceMs>=0&&graceMs<=1000,'transport-deadline')
 const observations:Record<string,unknown>={spawns:0,terminations:0,postMs:[],postAt:[],arrivalAt:[],discarded:0,lastCancelAck:null}
 function terminate(){if(grace)clearTimeout(grace);grace=undefined;if(port){port.onmessage=null;port.onerror=null;port.onmessageerror=null;port.terminate();port=undefined;observations.terminations=Number(observations.terminations)+1}if(workerOwner===owner)workerOwner=null}
 function revoke(reason:string,cooperative:boolean){if(disposed)return;disposed=true;published=null;const old=pending;pending=undefined;if(old){clearTimeout(old.timer);old.resolve(failureResponse(old.request.envelope,reason,'CANCELLED'))}
  if(cooperative&&port){const control:Request={version:PROTOCOL,kind:'CANCEL_ANALYSIS',envelope:{...envelope,jobId:crypto.randomUUID(),requestOrdinal:++ordinal,cancelId:crypto.randomUUID()},body:{targetJobId:old?.request.envelope.jobId??envelope.jobId}}
   port.onmessage=event=>{try{validateResponse(event.data);if(event.data.kind==='CANCELLED'&&equalData(event.data.envelope,control.envelope)){observations.lastCancelAck=structuredClone(event.data);terminate()}}catch{/* No malformed ACK can restore publication. */}}
   grace=setTimeout(terminate,graceMs);try{port.postMessage(control)}catch{terminate()}
  }else terminate()
 }
 function spawn(){if(port)return;requireEndgame(workerOwner===null,'transport-worker-cap');requireEndgame(options.factory||endgameAnalysisEnabled(ENDGAME_ANALYSIS_DEV,options.enabled===true),'transport-feature-disabled');const next:AnalysisPort=options.factory?options.factory():new Worker(new URL('./endgame-analysis.worker.ts',import.meta.url),{type:'module',name:'endgame-gold-analysis'})
  port=next;workerOwner=owner;observations.spawns=Number(observations.spawns)+1
  next.onerror=()=>revoke('transport-worker-error-unknown-commit',false);next.onmessageerror=()=>revoke('transport-message-error-unknown-commit',false)
  next.onmessage=event=>{
   if(disposed||!pending){observations.discarded=Number(observations.discarded)+1;return}
   const job=pending
   try{
    validateResponse(event.data);const response=event.data;(observations.arrivalAt as number[]).push(stamp())
    if(!equalData(response.envelope,job.request.envelope)){observations.discarded=Number(observations.discarded)+1;return}
    requireEndgame(job.current(),'transport-caller-input-mutated')
    const expectedKind={PREPARE_SOURCE:'SOURCE_VERIFIED',LIST_ELIGIBLE_DECISIONS:'DECISIONS_READY',CREATE_ANALYSIS:['NEEDS_FOLLOWUP','SUPPORTED_FINAL'],FOLLOWUP_SELECTION:['NEEDS_FOLLOWUP','SUPPORTED_FINAL'],CANCEL_ANALYSIS:'CANCELLED',DISPOSE_SESSION:'CANCELLED'}[job.request.kind]
    requireEndgame(['LIMITED','BLOCKED','CANCELLED','ERROR'].includes(response.kind)||(Array.isArray(expectedKind)?expectedKind.includes(response.kind):expectedKind===response.kind),'transport-response-phase')
    if(response.kind==='SOURCE_VERIFIED'){requireEndgame(job.request.kind==='PREPARE_SOURCE','transport-response-phase');const i=response.body.identity as SourceIdentity;requireEndgame((envelope.sourceHash===null||envelope.sourceHash===i.sourceHash)&&(envelope.configHash===null||envelope.configHash===i.configHash),'transport-source-mismatch');envelope.sourceHash=i.sourceHash;envelope.configHash=i.configHash}
    if(response.kind==='NEEDS_FOLLOWUP'||response.kind==='SUPPORTED_FINAL'){
     const c=response.body.continuation as GoldContinuationIdentity
     requireEndgame(equalData(c.selection.decision,job.request.envelope.decision)&&c.selection.sourceHash===envelope.sourceHash&&c.selection.configHash===envelope.configHash,'transport-response-selection')
     const expected=job.request.kind==='CREATE_ANALYSIS'?0:Number(job.request.envelope.expectedRevision)+1
     requireEndgame((job.request.kind==='CREATE_ANALYSIS'||job.request.kind==='FOLLOWUP_SELECTION')&&c.revision===expected&&(job.request.envelope.branchId===null||job.request.envelope.branchId===c.branchId),'transport-response-revision')
     envelope.branchId=c.branchId;envelope.expectedRevision=c.revision
    }
    if(response.kind==='SOURCE_VERIFIED')phase='source';else if(response.kind==='DECISIONS_READY')phase='catalog';else if(response.kind==='NEEDS_FOLLOWUP')phase='pending';else if(response.kind==='SUPPORTED_FINAL')phase='final';else if(response.kind==='LIMITED')phase='limited'
    clearTimeout(job.timer);pending=undefined;published=structuredClone(response);job.resolve(structuredClone(response))
   }catch{revoke('transport-invalid-response-unknown-commit',false)}
  }
 }
 return{async request(kind,body){
  if(disposed)return failureResponse(envelope,'transport-disposed','CANCELLED')
  if(pending)return failureResponse(envelope,'transport-client-busy')
  try{
   requireEndgame(kind==='PREPARE_SOURCE'&&phase==='empty'||kind==='LIST_ELIGIBLE_DECISIONS'&&phase==='source'||kind==='CREATE_ANALYSIS'&&phase==='catalog'||kind==='FOLLOWUP_SELECTION'&&phase==='pending','transport-client-phase')
   const current=captureDataIntegrity(body),e={...envelope,jobId:crypto.randomUUID(),requestOrdinal:ordinal+1,cancelId:null}
   if(kind==='CREATE_ANALYSIS')e.decision=(body.selection as GoldSelection)?.decision??null
   const request:Request={version:PROTOCOL,kind,envelope:e,body};validateRequest(request);spawn();envelope=structuredClone(e);ordinal=e.requestOrdinal;published=null
   return await new Promise<Response>(resolve=>{const timer=setTimeout(()=>revoke('transport-timeout-unknown-commit',false),deadline);pending={request:structuredClone({...request,body:{}}),resolve,timer,current};const started=performance.now();try{(observations.postAt as number[]).push(stamp());port!.postMessage(request);(observations.postMs as number[]).push(performance.now()-started)}catch{revoke('transport-post-failed-unknown-commit',false)}})
  }catch(error){return failureResponse(envelope,error instanceof EndgameRejected?error.message:'transport-request-invalid')}
 },read(){return disposed?null:published?structuredClone(published):null},cancel(){revoke('transport-cancelled',true)},dispose(){revoke('transport-disposed',false)},debug(){return structuredClone({...observations,disposed,phase,activeWorker:!!port,activeJob:!!pending,envelope})}}
}