import {createAnalysisClient,failureResponse} from './endgame-analysis-worker-client.ts'
import type {AnalysisClient} from './endgame-analysis-worker-client.ts'
import type {Envelope,RequestKind,Response} from './endgame-analysis-protocol.ts'
import {validateEnvelope} from './endgame-analysis-protocol.ts'
import {captureDataIntegrity} from './endgame-whatif-integrity.ts'
/** Isolated logical leases only; no App/MobileSession/React/storage listeners. */
export function createAnalysisBinding(factory:(e:Envelope)=>AnalysisClient=e=>createAnalysisClient(e,{enabled:true})){
 let client:AnalysisClient|undefined,lease:Envelope|undefined,current:(()=>boolean)|undefined,token=0,active=false,published:Response|null=null
 function revoke(cancel=false){token++;published=null;active=false;const old=client;client=undefined;lease=undefined;current=undefined;if(cancel)old?.cancel();else old?.dispose()}
 return{activate(input:Envelope){revoke();captureDataIntegrity(input);validateEnvelope(input);lease=input;current=captureDataIntegrity(input);client=factory(structuredClone(input))},async request(kind:RequestKind,body:Record<string,unknown>):Promise<Response|null>{
  if(!lease||!client||!current?.()){revoke();return null}
  if(active)return failureResponse(lease,'transport-binding-busy')
  active=true;const owned=client,revision=token,witness=current;published=null
  try{const result=await owned.request(kind,body);if(token!==revision||client!==owned||!witness()){if(token===revision)revoke();return null}published=result;return structuredClone(result)}finally{if(token===revision)active=false}
 },read(){if(!current?.()){revoke();return null}return published?structuredClone(published):null},cancel(){revoke(true)},dispose(){revoke()},debug(){return{token,active,hasLease:!!lease,hasResult:!!published,client:client?.debug()??null}}}
}