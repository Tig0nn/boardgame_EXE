import type {GameState} from '../../../src/game/types.ts'
import type {QuestionFeature} from '../../../src/ai/companion/question-feature.ts'
import {runQuestionFeature} from '../../../src/ai/companion/question-feature.ts'
import {projectGameplayContext,gameplayContextReady,createGameplayRequest,answerGameplay,validateGameplayResponse} from '../../../src/ai/companion/universal-index.ts'
import type {GameplayContext,GameplayRequest,GameplayResponse} from '../../../src/ai/companion/universal-index.ts'
export interface GameplaySession {getSnapshot():GameState;subscribe(listener:()=>void):()=>void}
export type GameplayTransport=(request:GameplayRequest,signal:AbortSignal)=>Promise<unknown>
export interface GameplayView {
 context:GameplayContext|null;question:string;status:'idle'|'loading'|'answered'|'fallback'|'error'|'disabled'
 response:GameplayResponse|null;isCurrent:()=>boolean
}
export function universalAiOptIn(development:boolean,search:string):boolean{return development===true&&new URLSearchParams(search).get('universalAi')==='1'}
function freeze<T>(value:T):T {
 if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze)}return value
}
/** Construction is pure. StrictMode subscribe/cleanup creates no request and leaves no retained listener. */
export function createGameplayBinding(session:GameplaySession,feature:QuestionFeature,transport:GameplayTransport=async(r,signal)=>{signal.throwIfAborted();return answerGameplay(r)}) {
 const listeners=new Set<()=>void>()
 let epoch='',revision=0,generation=0,question='',previous:GameState|undefined,context:GameplayContext|null=null
 let pending:AbortController|undefined,stopSession=()=>{},stopFeature=()=>{},started=false,closing=false
 let view:GameplayView=freeze({context:null,question:'',status:feature.isEnabled()?'idle':'disabled',response:null,isCurrent:()=>false})
 function publish(status:GameplayView['status']='idle',response:GameplayResponse|null=null,isCurrent:()=>boolean=()=>false) {
  view=freeze({context,question,status:feature.isEnabled()?status:'disabled',response,isCurrent});[...listeners].forEach(fn=>{try{fn()}catch{/* Host callback cannot prevent cancellation. */}})
 }
 function cancel(notify=true){
  const token=++generation,old=pending;pending=undefined
  view=freeze({context,question,status:feature.isEnabled()?'idle':'disabled',response:null,isCurrent:()=>false})
  old?.abort()
  if(notify&&token===generation)publish()
  return token
 }
 function reproject(){
  try{const next=projectGameplayContext(session.getSnapshot(),{sessionEpoch:epoch,revision});context=gameplayContextReady(next)?freeze(next):null}catch{context=null}
 }
 function clear(){const prior=closing;closing=true;question='';reproject();try{cancel()}finally{closing=prior}}
 function start(){
  if(started)return;started=true;epoch=crypto.randomUUID();revision=0;previous=session.getSnapshot();reproject()
  stopSession=session.subscribe(()=>{const next=session.getSnapshot();if(next!==previous){previous=next;revision++;clear()}})
  stopFeature=feature.subscribe(()=>clear());publish()
 }
 return {
  getSnapshot:()=>view,
  subscribe(fn:()=>void){listeners.add(fn);start();return()=>{listeners.delete(fn);if(!listeners.size){started=false;stopSession();stopFeature();question='';context=null;cancel()}}},
  edit(value:string){if(closing)return;question=value;cancel()},
  close(){clear()},
  async ask():Promise<GameplayResponse|null>{
   // Feature gates the transport, hashing and delivery, including injected remote transports.
   if(!started||closing||!feature.isEnabled()||!context||!question.trim()||view.status==='loading')return null
   const mine=cancel(false);if(mine!==generation||!started||closing||!feature.isEnabled()||!context)return null;const snapshot=session.getSnapshot(),rawQuestion=question,capturedContext=context,abort=new AbortController();pending=abort
   const current=()=>started&&feature.isEnabled()&&!abort.signal.aborted&&mine===generation&&question===rawQuestion&&snapshot===session.getSnapshot()
   publish('loading')
   if(!current())return null
   try {
    const response=await runQuestionFeature(feature,abort.signal,async signal=>{
     const request=freeze(await createGameplayRequest(capturedContext,rawQuestion,crypto.randomUUID()))
     signal.throwIfAborted();if(!current())throw Error('stale')
     const raw=await transport(request,signal);signal.throwIfAborted()
     const result=await validateGameplayResponse(raw,request);signal.throwIfAborted();return freeze(result)
    })
    if(!current())return null
    publish(response.status,response,current);return current()?response:null
   }catch{
    if(!current())return null
    publish('error',null,current);return null
   }
  },
 }
}