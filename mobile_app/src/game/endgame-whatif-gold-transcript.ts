import {canonical,digest,equalData} from './endgame-whatif-identity.ts'
import {captureDataIntegrity} from './endgame-whatif-integrity.ts'
import {requireEndgame} from './endgame-whatif-contract.ts'
import {exactKeys} from './endgame-whatif-transcript.ts'
import {GOLD_LIMITS} from './endgame-whatif-gold-contract.ts'
import type {GoldSelection,GoldTranscript,GoldRecord,GoldResumeInput,GoldResult} from './endgame-whatif-gold-contract.ts'
const rootHash=(t:GoldTranscript)=>digest(canonical({branchId:t.branchId,selection:t.selection,initial:t.initial}))
export async function newGoldTranscript(selection:GoldSelection):Promise<GoldTranscript>{const t:GoldTranscript={branchId:crypto.randomUUID(),selection:structuredClone(selection),initial:'skip',entries:[],hash:''};t.hash=await rootHash(t);return t}
export async function verifyGoldTranscript(t:GoldTranscript,selection:GoldSelection){
 captureDataIntegrity(t);exactKeys(t,['branchId','selection','initial','entries','hash'])
 requireEndgame(typeof t.branchId==='string'&&/^[a-f0-9-]{36}$/.test(t.branchId)&&t.initial==='skip'&&equalData(t.selection,selection),'gold-transcript-identity')
 requireEndgame(Array.isArray(t.entries)&&t.entries.length<=GOLD_LIMITS.followups&&canonical(t).length<=GOLD_LIMITS.transcriptCharacters,'gold-transcript-budget')
 let previous=await rootHash(t),priorCursor=-1,priorSequence=selection.decision.sequence
 for(let i=0;i<t.entries.length;i++){
  const row=t.entries[i];exactKeys(row,['ordinal','sourceCursor','command','blockerHash','choice','preStateHash','postStateHash','actualAction','alternativeAction','nextSourceCursor','previousHash','hash'])
  requireEndgame(Number.isSafeInteger(row.sourceCursor)&&row.sourceCursor>priorCursor&&row.command.sequence>priorSequence,'gold-transcript-order')
  exactKeys(row.choice,['kind','optionId'])
  requireEndgame(row.choice.kind==='gold-skip'&&row.choice.optionId==='skip'&&equalData(row.actualAction,row.command)
   &&row.alternativeAction.kind==='decision'&&row.alternativeAction.eventId==='gold'&&row.alternativeAction.decisionId==='skip'
   &&row.alternativeAction.turn===row.command.turn&&row.alternativeAction.lap===row.command.lap&&row.alternativeAction.tileId===row.command.tileId,'gold-transcript-action')
  const {hash,...body}=row
  requireEndgame(row.ordinal===i+1&&row.sourceCursor>=0&&row.nextSourceCursor===row.sourceCursor+1&&row.previousHash===previous&&hash===await digest(canonical(body)),'gold-transcript-chain')
  previous=hash;priorCursor=row.sourceCursor;priorSequence=row.command.sequence
 }
 requireEndgame(t.hash===previous,'gold-transcript-chain')
}
export async function appendGoldRecord(t:GoldTranscript,record:Omit<GoldRecord,'ordinal'|'previousHash'|'hash'>){
 requireEndgame(t.entries.length<GOLD_LIMITS.followups,'gold-followup-budget')
 const body={...record,ordinal:t.entries.length+1,previousHash:t.hash},hash=await digest(canonical(body)),next={...t,entries:[...t.entries,{...body,hash}],hash}
 requireEndgame(canonical(next).length<=GOLD_LIMITS.transcriptCharacters,'gold-transcript-budget');return next
}
export function assertGoldSubmission(head:GoldResult,input:GoldResumeInput){
 captureDataIntegrity(input);exactKeys(input,['continuation','blocker','choice'])
 requireEndgame(head.status==='needs-followup','gold-no-pending-blocker')
 requireEndgame(equalData(input.continuation,head.continuation)&&equalData(input.blocker,head.blocker),'gold-stale-blocker')
 requireEndgame(head.blocker.choices.some(x=>equalData(x.action,input.choice)),'illegal-gold-choice')
}
