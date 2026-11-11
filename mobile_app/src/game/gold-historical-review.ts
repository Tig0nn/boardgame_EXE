import type {GoldSession,GoldDTO,GoldContext,GoldReadDTO} from './gold-historical-contract.ts'
import {GOLD_ENGINE_VERSION,GOLD_POLICY,firstGoldSequence,goldEqual,publicGoldDTO,GoldRejected,requireGold} from './gold-historical-contract.ts'
import {captureGoldIntegrity} from './gold-historical-integrity.ts'
import {createGoldWorkerExecutor} from './gold-historical-worker.ts'
import type {GoldExecutor} from './gold-historical-worker-contract.ts'
type Ticket={session:GoldSession;snapshot:ReturnType<GoldSession['getSnapshot']>;epoch:number;revision:number;ordinal:number;sequence:number;witness:ReturnType<typeof captureGoldIntegrity>;abort:AbortController}
function validContext(c:GoldContext,t:Ticket){
 requireGold(c.feature==='gold-historical'&&c.policy===GOLD_POLICY&&c.engine===GOLD_ENGINE_VERSION&&[c.transcript,c.prefix,c.config].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v)),'context-mismatch')
 const e=t.snapshot.log[t.sequence-1],d=c.decision;requireGold(d.sequence===t.sequence&&d.eventId==='gold'&&d.decisionId==='skip'&&d.turn===e.turn&&d.lap===e.lap&&d.tileId===e.tileId,'decision-mismatch')
 const h=c.checkpoint
 if(h){const s=t.snapshot.log[h.sequence-1];requireGold(s?.kind==='settlement'&&h.phase==='rebalancing'&&h.sequence>t.sequence&&h.lap===d.lap&&h.turn===s.after.turn&&h.witnessSequence>=h.sequence,'horizon-mismatch')
  if(h.witnessKind==='recorded-current-state')requireGold(t.snapshot.phase==='rebalancing'&&t.snapshot.log.length===h.sequence&&t.snapshot.turn===h.turn&&t.snapshot.lap===h.lap&&h.witnessSequence===h.sequence,'horizon-mismatch')
  else requireGold(h.witnessKind==='later-recorded-command'&&h.witnessSequence>h.sequence&&['roll','decision','rebalancing','funding'].includes(t.snapshot.log[h.witnessSequence-1]?.kind),'horizon-mismatch')
 }
}
/** Not mounted by App. Request captures once; every publication/read checks exact current content. */
export function createGoldBinding(execute:GoldExecutor=createGoldWorkerExecutor()){
 let revoking=0;let lifecycle='initial';let active:GoldSession|null=null,epoch=0,revision=0,ordinal=0,latest:Ticket|undefined,unsubscribe:(()=>void)|undefined
 let published:{ticket:Ticket;context?:GoldContext;result:GoldDTO}|undefined
 const revoke=()=>{revoking++;try{const old=latest;latest=undefined;published=undefined;ordinal++;old?.abort.abort()}finally{revoking--}}
 const current=(t:Ticket)=>active===t.session&&epoch===t.epoch&&revision===t.revision&&ordinal===t.ordinal&&latest===t&&active.getSnapshot()===t.snapshot&&t.witness.valid()
 return{
  activate(session:GoldSession|null,reason:string){lifecycle=reason;unsubscribe?.();unsubscribe=undefined;revoke();epoch++;revision++;active=session;if(session)unsubscribe=session.subscribe(()=>{revision++;revoke()})},
  async request(selected?:number):Promise<'published'|'discarded'>{
   if(revoking)return'discarded';revoke();if(!active)return'discarded';const session=active,snapshot=session.getSnapshot();let witness:ReturnType<typeof captureGoldIntegrity>
   try{witness=captureGoldIntegrity(snapshot)}catch{return'discarded'}
   const sequence=firstGoldSequence(snapshot);if(sequence===null||selected!==undefined&&selected!==sequence)return'discarded'
   const t:Ticket={session,snapshot,epoch,revision,ordinal,sequence,witness,abort:new AbortController()};latest=t
   try{
    const captured=await execute(snapshot,sequence,t.abort.signal,witness.environment);if(!current(t)){if(latest===t)revoke();return'discarded'}
    // Executor is an application-owned trust seam, not an untrusted financial data source.
    validContext(captured.context,t);requireGold(goldEqual(captured.context,captured.envelope.context),'context-mismatch')
    const result=publicGoldDTO(captured.envelope.result)
    if(result.status==='supported')requireGold(captured.context.checkpoint&&goldEqual(captured.context.checkpoint,result.checkpoint),'horizon-mismatch')
    else if(result.status==='known')requireGold(!captured.context.checkpoint,'horizon-mismatch')
    // No await/callback between current validation and private detached publication.
    published={ticket:t,context:structuredClone(captured.context),result};return'published'
   }catch(error){if(!current(t)){if(latest===t)revoke();return'discarded'};published={ticket:t,result:{status:'blocked',reason:error instanceof GoldRejected?error.message:'verification-failed'}};return'published'}
  },
  read():GoldReadDTO|null{if(!published)return null;if(!current(published.ticket)){revoke();return null}return structuredClone(published.result)},
  dispose(){unsubscribe?.();unsubscribe=undefined;revoke();active=null;epoch++;revision++},
  debug(){return{epoch,revision,ordinal,lifecycle,active:!!active,hasResult:!!published,pending:!!latest&&!published}},
 }
}
