import { isHistoricalExplanationLease } from './bank-historical-review.ts'
import type { createBinding } from './bank-historical-review.ts'
import { DEFAULT_PLAN } from '../../../src/what-if-explanation/contracts.ts'
import type { ExplanationFacts, ExplanationLease, ExplanationPlan } from '../../../src/what-if-explanation/contracts.ts'
import { semanticFacts, validateClaims } from '../../../src/what-if-explanation/claims.ts'
import type { OfflineProvider } from '../../../src/what-if-explanation/claims.ts'
import { renderExplanation } from '../../../src/what-if-explanation/catalog.ts'

type History = ReturnType<typeof createBinding>
type Status = 'default' | 'pending' | 'ready' | 'fallback'
type Ticket = { owner:History; generation:number; ordinal:number; lease:ExplanationLease; facts:ExplanationFacts;
  abort:AbortController; unsubscribe:()=>void; status:Status; plan:Readonly<ExplanationPlan> }
/** Exact small allowlist comparison, never serializes/replays/hashes live game state. */
function sameFacts(a:ExplanationFacts,b:ExplanationFacts){
 return a.scenario===b.scenario&&a.horizon===b.horizon&&a.liquidity===b.liquidity
  &&(Object.keys(a.decision) as (keyof typeof a.decision)[]).every(k=>a.decision[k]===b.decision[k])
  &&(Object.keys(a.checkpoint) as (keyof typeof a.checkpoint)[]).every(k=>a.checkpoint[k]===b.checkpoint[k])
  &&a.assumption.term===b.assumption.term&&a.assumption.budgetMeaning===b.assumption.budgetMeaning
  &&(Object.keys(a.result) as (keyof typeof a.result)[]).every(k=>a.result[k]===b.result[k])
}
/** Offline-only. Provider injection is asynchronous ID selection, never an HTTP/AI transport. */
export function createExplanationBinding(provider:OfflineProvider,{timeoutMs=2000}:{timeoutMs?:number}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>2000)throw Error('invalid-offline-deadline')
 let history:History|null=null,generation=0,ordinal=0,version=0,selected:Ticket|undefined
 const listeners=new Set<()=>void>()
 const notify=()=>{version++;listeners.forEach(fn=>{try{fn()}catch{/* Consumer cannot change correctness. */}})}
 const retire=()=>{const previous=selected;selected=undefined;ordinal++;if(previous){previous.unsubscribe();previous.abort.abort();previous.lease.release()}}
 const current=(t:Ticket)=>{
  if(selected!==t||history!==t.owner||generation!==t.generation||ordinal!==t.ordinal)return null
  const facts=t.lease.read();return facts&&sameFacts(facts,t.facts)?facts:null
 }
 const prepare=()=>{
  retire()
  if(!history)return null
  const lease=history.acquireExplanationLease()
  if(!isHistoricalExplanationLease(lease))return null
  const facts=lease.read();if(!facts){lease.release();return null}
  const ticket:Ticket={owner:history,generation,ordinal,lease,facts,abort:new AbortController(),unsubscribe:()=>{},status:'default',plan:DEFAULT_PLAN}
  selected=ticket
  ticket.unsubscribe=lease.onInvalidated(()=>{if(selected===ticket){retire();notify()}})
  return current(ticket)?ticket:null
 }
 return{
  subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn)}},
  getSnapshot:()=>version,
  activate(owner:History){retire();generation++;history=owner;notify()},
  showDefault(){const t=prepare();if(!t){notify();return false}t.status='default';notify();return true},
  async requestMock(explicitUserAction:boolean):Promise<'published'|'discarded'>{
   if(explicitUserAction!==true)return 'discarded'
   const t=prepare();if(!t){notify();return 'discarded'}
   t.status='pending';notify()
   let onAbort:()=>void=()=>{}
   const aborted=new Promise<never>((_resolve,reject)=>{onAbort=()=>reject(t.abort.signal.reason);t.abort.signal.addEventListener('abort',onAbort,{once:true});if(t.abort.signal.aborted)onAbort()})
   // A synchronous subscriber can close during pending notification, before the race attaches.
   void aborted.catch(()=>{})
   const timer=setTimeout(()=>t.abort.abort(new Error('offline-deadline')),timeoutMs)
   try{
    const facts=current(t);if(!facts)return 'discarded'
    const input=semanticFacts(facts)
    // No await between final current lease check and this purely offline provider call.
    const raw=await Promise.race([provider(input,t.abort.signal),aborted])
    const fresh=current(t);if(!fresh)return 'discarded'
    t.plan=validateClaims(raw,fresh);t.status='ready'
   }catch{
    if(!current(t))return 'discarded'
    t.plan=DEFAULT_PLAN;t.status='fallback'
   }finally{clearTimeout(timer);t.abort.signal.removeEventListener('abort',onAbort);t.abort.abort()}
   if(!current(t))return 'discarded'
   // All private publication is synchronous; every consuming read rechecks the same lease.
   notify();return 'published'
  },
  read(){
   const t=selected;if(!t)return null
   const facts=current(t);if(!facts)return null
   try{return Object.freeze({status:t.status,source:t.status==='ready'?'mock' as const:'game' as const,sections:renderExplanation(t.plan,facts)})}
   catch{return null}
  },
  dispose(){retire();history=null;generation++;notify()},
  debug(){return{generation,ordinal,pending:selected?.status==='pending',subscribers:listeners.size,hasLease:!!selected}},
 }
}
