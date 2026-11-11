import {serializeLog} from '../../../src/game/log.ts'
import type {GameState} from '../../../src/game/types.ts'
import {EndgameRejected,ENDGAME_ENGINE,ENDGAME_PROFILE,requireEndgame} from './endgame-whatif-contract.ts'
import type {WorkBudget} from './endgame-whatif-contract.ts'
import {parseHistory,canonical,digest,sourceConfig} from './endgame-whatif-identity.ts'
import {captureDataIntegrity} from './endgame-whatif-integrity.ts'
import {replayHistory,commandsOf} from './endgame-whatif-replay.ts'
import {completedFour,endingFacts} from './endgame-whatif-comparison.ts'
import {identifyGold} from './endgame-whatif-gold-identity.ts'
import {forkGold} from './endgame-whatif-gold-fork.ts'
import type {GoldSelection} from './endgame-whatif-gold-contract.ts'
export type SourceInput={kind:'text';text:string}|{kind:'snapshot';snapshot:GameState}
export type SourceIdentity={sourceHash:string;configHash:string;engine:string;profile:string;schema:7;entries:number;commands:number;characters:number;utf8Bytes:number;semanticHash:string;origin:'text'|'snapshot';ending:ReturnType<typeof endingFacts>}
export type VerifiedSource={text:string;identity:SourceIdentity;timings:{serializeMs:number;parseMs:number;actualReplayMs:number;hashMs:number}}
export async function prepareAnalysisSource(input:SourceInput,work:WorkBudget):Promise<VerifiedSource>{
 const current=captureDataIntegrity(input);requireEndgame(input&&typeof input==='object','source-input')
 requireEndgame(Object.keys(input).sort().join(',')===(input.kind==='text'?'kind,text':'kind,snapshot'),'source-input')
 const started=performance.now();let text:string
 if(input.kind==='text'){requireEndgame(typeof input.text==='string','source-input');text=input.text}
 else{requireEndgame(input.kind==='snapshot'&&input.snapshot,'source-input');text=serializeLog(input.snapshot)}
 const serializeMs=performance.now()-started;work.check()
 requireEndgame(text.length<=20_000_000,'source-size');const utf8Bytes=new TextEncoder().encode(text).length
 requireEndgame(utf8Bytes<=20*1024*1024,'transport-source-wire-cap')
 let t=performance.now();const parsed=parseHistory(text),parseMs=performance.now()-t
 requireEndgame(commandsOf(parsed).length<=200,'transport-command-cap');requireEndgame(completedFour(parsed.state),'source-not-completed4')
 t=performance.now();const actual=await replayHistory(parsed,work),actualReplayMs=performance.now()-t;requireEndgame(completedFour(actual.final),'source-not-completed4')
 t=performance.now();const sourceHash=await digest(text),configHash=await digest(canonical(sourceConfig(parsed))),semanticHash=await digest(canonical(actual.final)),hashMs=performance.now()-t
 work.check();requireEndgame(current(),'source-input-mutated')
 return{text,identity:{sourceHash,configHash,semanticHash,engine:ENDGAME_ENGINE,profile:ENDGAME_PROFILE,schema:7,entries:parsed.entries.length,commands:actual.commands.length,characters:text.length,utf8Bytes,origin:input.kind,ending:endingFacts(actual.final)},timings:{serializeMs,parseMs,actualReplayMs,hashMs}}
}
/** Native initial-action probes only. No Alternative continuation/outcome search in source/catalog stages. */
export async function listGoldDecisions(source:VerifiedSource,work:WorkBudget):Promise<GoldSelection[]>{
 const parsed=parseHistory(source.text);requireEndgame(await digest(source.text)===source.identity.sourceHash,'source-text-changed')
 const buys=parsed.entries.filter(e=>e.kind==='rebalancing'&&e.action?.kind==='buy'&&e.action.asset==='gold');requireEndgame(buys.length<=16,'transport-catalog-cap')
 const result:GoldSelection[]=[]
 for(const entry of buys){
  if(entry.tileId!==5||entry.action?.completeEncounter!==true||entry.decisionId!=='buy-gold-complete')continue
  try{const request=await identifyGold(source.text,entry.sequence,work),actual=await replayHistory(parsed,work,entry.sequence);requireEndgame(actual.before,'source-decision-missing');forkGold(actual.before,entry,request.selection,work);result.push(request.selection)}catch(error){
   if(error instanceof EndgameRejected&&!['cancelled','step-budget','time-budget'].includes(error.message))continue
   throw error
  }
 }
 work.check();return result
}