import {ENDGAME_ENGINE,ENDGAME_PROFILE,requireEndgame} from './endgame-whatif-contract.ts'
import type {WorkBudget,WorkOptions,Source} from './endgame-whatif-contract.ts'
import {parseHistory,sourceConfig,canonical,digest,commandIdentity,equalData} from './endgame-whatif-identity.ts'
import {captureDataIntegrity} from './endgame-whatif-integrity.ts'
import {validateOptions,exactKeys} from './endgame-whatif-transcript.ts'
import {commandsOf} from './endgame-whatif-replay.ts'
import {GOLD_POLICY,GOLD_CONTINUATION,GOLD_FAIRNESS,GOLD_LIMITS} from './endgame-whatif-gold-contract.ts'
import type {GoldRequest,GoldSelection} from './endgame-whatif-gold-contract.ts'
export async function identifyGoldWithSource(sourceText:string,sequence:number,work:WorkBudget){
 work.check();const source=parseHistory(sourceText),entry=source.entries[sequence-1]
 requireEndgame(Number.isSafeInteger(sequence)&&sequence>1&&entry?.kind==='rebalancing'&&entry.tileId===5&&entry.action?.kind==='buy'&&entry.action.asset==='gold'
  &&entry.action.completeEncounter===true&&entry.decisionId==='buy-gold-complete','explicit-approved-gold-buy-required')
 const decision=commandIdentity(entry)
 requireEndgame(equalData(entry.action,decision.action),'gold-action-metadata-unsupported')
 requireEndgame(commandsOf(source).length<=GOLD_LIMITS.commands,'gold-command-budget')
 const sourceHash=await digest(sourceText),configHash=await digest(canonical(sourceConfig(source)));work.check()
 const selection:GoldSelection={sourceHash,configHash,engine:ENDGAME_ENGINE,profile:ENDGAME_PROFILE,schema:7,initialPolicy:GOLD_POLICY,continuationPolicy:GOLD_CONTINUATION,fairness:GOLD_FAIRNESS,decision,eventContext:'gold'}
 return{source,selection}
}
export async function identifyGold(sourceText:string,sequence:number,work:WorkBudget):Promise<GoldRequest>{
 const {selection}=await identifyGoldWithSource(sourceText,sequence,work)
 return{source:sourceText,selection}
}
/** Caller explicitly selects a recorded buy; no payoff-based selection or background execution. */
export function prepareGoldRequest(source:string,sequence:number,options:WorkOptions={}){return identifyGold(source,sequence,validateOptions(options))}
export function validateGoldRequest(request:GoldRequest){
 captureDataIntegrity(request);exactKeys(request,['source','selection'])
 requireEndgame(typeof request.source==='string'&&request.selection&&Number.isSafeInteger(request.selection.decision?.sequence),'gold-request-shape')
}
export const goldSource=(request:GoldRequest):Source=>parseHistory(request.source)
