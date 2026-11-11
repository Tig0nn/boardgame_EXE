import {canChoose,decide} from '../../../src/game/engine.ts'
import type {LogEntry} from '../../../src/game/types.ts'
import {sameExternal} from './endgame-whatif-fairness.ts'
import {canonical,digest,commandIdentity,equalData} from './endgame-whatif-identity.ts'
import {requireEndgame} from './endgame-whatif-contract.ts'
import type {WorkBudget} from './endgame-whatif-contract.ts'
import {exactKeys} from './endgame-whatif-transcript.ts'
import type {GoldStopped} from './endgame-whatif-gold-reconcile.ts'
import type {GoldBlocker,GoldChoice} from './endgame-whatif-gold-contract.ts'
function eligible(step:GoldStopped,entry:LogEntry){
 const a=step.actual,b=step.alternative
 return step.reason==='illegal-recorded-action'&&step.boundary==='before-command'&&!!step.actualCandidate&&!!step.quote&&step.alternativeUnchanged
  &&entry.kind==='rebalancing'&&entry.action?.kind==='sell'&&entry.action.asset==='gold'&&entry.decisionId==='sell-gold-complete'
  &&entry.action.amount===a.portfolio.gold&&a.goldUnits>0&&entry.tileId===5&&a.position===5&&b.position===5
  &&a.phase==='event'&&b.phase==='event'&&a.eventId==='gold'&&b.eventId==='gold'&&!a.pendingPayment&&!b.pendingPayment&&sameExternal(a,b)
}
export function applyGoldSkip(step:GoldStopped,entry:LogEntry,choice:GoldChoice,work:WorkBudget){
 exactKeys(choice,['kind','optionId']);requireEndgame(choice.kind==='gold-skip'&&choice.optionId==='skip'&&eligible(step,entry)&&canChoose(step.alternative,'skip'),'illegal-gold-followup')
 work.step();const alternative=decide(structuredClone(step.alternative),'skip'),actual=step.actualCandidate!
 requireEndgame(alternative.log.length===step.alternative.log.length+1&&alternative.phase==='rolling'&&alternative.eventId===null&&!alternative.pendingPayment,'gold-followup-no-progress')
 requireEndgame(sameExternal(actual,alternative)&&equalData(actual.pendingPayment,alternative.pendingPayment),'gold-followup-external-mismatch')
 return{actual,alternative}
}
export async function inspectGoldBlocker(step:GoldStopped,entry:LogEntry,sourceCursor:number,work:WorkBudget):Promise<GoldBlocker>{
 const b=step.alternative,choices:GoldBlocker['choices']=[]
 if(eligible(step,entry)&&canChoose(b,'skip')){try{applyGoldSkip(step,entry,{kind:'gold-skip',optionId:'skip'},work);choices.push({action:{kind:'gold-skip',optionId:'skip'},label:'Bỏ qua giao dịch Gold trong nhánh giả định'})}catch(error){work.check();if(work.steps>work.maxSteps)throw error}}
 const facts={command:commandIdentity(entry),sourceCursor,boundary:step.boundary,commandApplied:step.boundary==='after-command',context:{phase:b.phase,event:b.eventId,lap:b.lap,turn:b.turn,tile:b.position},reason:step.reason,engineReason:step.engineReason,externalEqual:sameExternal(step.actual,b),actualGoldUnits:step.actual.goldUnits,alternativeGoldUnits:b.goldUnits,actualSaleLegal:!!step.actualCandidate,alternativeUnchanged:step.alternativeUnchanged,choices}
 const hash=await digest(canonical({...facts,alternativePrefix:await digest(canonical(b.log))}));work.check();return{hash,...facts}
}
