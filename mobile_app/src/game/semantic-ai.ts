import type {GameState} from '../../../src/game/types.ts'
import type {QuestionFeature} from '../../../src/ai/companion/question-feature.ts'
import {runQuestionFeature} from '../../../src/ai/companion/question-feature.ts'
import {projectDraftContext} from '../../../src/ai/companion/draft-index.ts'
import {projectGameplayContext} from '../../../src/ai/companion/universal-index.ts'
import {createSemanticRequest,answerSemantic,validateSemanticResponse} from '../../../src/ai/companion/semantic-index.ts'
import type {SemanticContext,SemanticRequest,SemanticResponse} from '../../../src/ai/companion/semantic-index.ts'
import type {GameplaySession} from './universal-ai.ts'
import type {DraftStore} from './draft-store.ts'
export const semanticAiOptIn=(development:boolean,search:string)=>development===true&&new URLSearchParams(search).get('universalAi')==='1'&&new URLSearchParams(search).get('semanticAi')==='1'
export type SemanticTransport=(r:SemanticRequest,signal:AbortSignal)=>Promise<unknown>
export interface SemanticView {context:SemanticContext|null;status:'idle'|'loading'|'answered'|'fallback'|'limited'|'clarify'|'error'|'disabled';response:SemanticResponse|null;isCurrent:()=>boolean}
function freeze<T>(v:T):T {if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze)}return v}
/** No listeners or work until commit-time subscription; all delivery checks include the draft frame. */
export function createSemanticBinding(session:GameplaySession,feature:QuestionFeature,store:DraftStore|null,invalidateActual:()=>void,transport:SemanticTransport=async(r,s)=>{s.throwIfAborted();return answerSemantic(r)}){
 const listeners=new Set<()=>void>()
 let generation=0,revision=0,epoch='',started=false,previous:GameState|undefined,pending:AbortController|undefined
 let stopSession=()=>{},stopFeature=()=>{},stopStore=()=>{}
 let view:SemanticView=freeze({context:null,status:'idle',response:null,isCurrent:()=>false})
 const emit=()=>[...listeners].forEach(fn=>{try{fn()}catch{/* Cancellation remains effective if a host listener fails. */}})
 function context(){const frame=store?.getSnapshot()??null;try{const actual=projectGameplayContext(session.getSnapshot(),{sessionEpoch:epoch,revision}),draft=frame?.basis===session.getSnapshot()?projectDraftContext(session.getSnapshot(),{sessionEpoch:epoch,revision,draftId:frame.owner,draftRevision:frame.revision},frame.input):null;return {actual,draft}}catch{return null}}
 function cancel(){generation++;const old=pending;pending=undefined;view=freeze({context:started?context():null,status:feature.isEnabled()?'idle':'disabled',response:null,isCurrent:()=>false});old?.abort();emit()}
 function start(){if(started)return;started=true;epoch=crypto.randomUUID();previous=session.getSnapshot();revision=0
  stopStore=store?.subscribe(()=>{cancel();invalidateActual()})??(()=>{})
  stopSession=session.subscribe(()=>{if(session.getSnapshot()!==previous){previous=session.getSnapshot();revision++;store?.clear();cancel()}})
  stopFeature=feature.subscribe(()=>{cancel();invalidateActual()});cancel()
 }
 return {
  getSnapshot:()=>view,
  subscribe(fn:()=>void){listeners.add(fn);start();return()=>{listeners.delete(fn);if(!listeners.size){started=false;stopSession();stopStore();stopFeature();cancel()}}},
  cancel,
  async ask(question:string):Promise<SemanticResponse|null>{
   if(!started||!feature.isEnabled()||!question.trim())return null
   cancel();const captured=view.context;if(!captured)return null
   const mine=generation,frame=store?.getSnapshot()??null,snapshot=session.getSnapshot(),abort=new AbortController();pending=abort
   const current=()=>started&&feature.isEnabled()&&mine===generation&&!abort.signal.aborted&&snapshot===session.getSnapshot()&&frame===(store?.getSnapshot()??null)
   view=freeze({context:captured,status:'loading',response:null,isCurrent:current});emit()
   try{
    const response=await runQuestionFeature(feature,abort.signal,async signal=>{
     const request=freeze(await createSemanticRequest(captured,question,crypto.randomUUID()));signal.throwIfAborted();if(!current())throw Error('stale')
     const raw=await transport(request,signal);signal.throwIfAborted();const result=await validateSemanticResponse(raw,request);signal.throwIfAborted();return freeze(result)
    })
    if(!current())return null
    view=freeze({context:captured,status:response.status,response,isCurrent:current});emit();return current()?response:null
   }catch{if(current()){view=freeze({context:captured,status:'error',response:null,isCurrent:current});emit()}return null}
  },
 }
}
