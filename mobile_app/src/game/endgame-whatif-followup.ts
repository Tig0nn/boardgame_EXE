import { canChoose, decide, fundPayment, fundingSources } from '../../../src/game/engine.ts'
import { eventsForGame } from '../../../src/data/events.ts'
import type { GameState, LogEntry } from '../../../src/game/types.ts'
import { requireEndgame } from './endgame-whatif-contract.ts'
import type { WorkBudget } from './endgame-whatif-contract.ts'
import { canonical, digest, commandIdentity, equalData } from './endgame-whatif-identity.ts'
import { sameExternal } from './endgame-whatif-fairness.ts'
import { applyRecorded } from './endgame-whatif-replay.ts'
import { fundingContext } from './endgame-whatif-reconcile.ts'
import type { BlockedStep } from './endgame-whatif-reconcile.ts'
import { EG1B_LIMITS } from './endgame-whatif-eg1b-contract.ts'
import type { PendingBlocker, FollowupAction } from './endgame-whatif-eg1b-contract.ts'
import { exactKeys } from './endgame-whatif-transcript.ts'
export function applyCandidate(state:GameState,action:FollowupAction,work:WorkBudget) {
  work.step()
  if(action.kind==='event'){
    exactKeys(action,['kind','optionId'])
    requireEndgame(typeof action.optionId==='string'&&action.optionId.length<=64&&state.phase==='event'&&canChoose(state,action.optionId),'illegal-choice')
    const next=decide(structuredClone(state),action.optionId)
    requireEndgame(next!==state&&next.log.length>state.log.length,'candidate-no-progress')
    return next
  }
  exactKeys(action,['kind','amount'])
  requireEndgame(action.kind==='fund-debt'&&state.phase==='funding'&&state.pendingPayment&&fundingSources(state).includes('debt')
    &&Number.isSafeInteger(action.amount)&&action.amount>0&&action.amount===state.pendingPayment.remaining
    &&action.amount<=state.borrowingLimit-state.portfolio.debt,'illegal-choice')
  const next=fundPayment(structuredClone(state),'debt',action.amount)
  requireEndgame(next.log.length>state.log.length&&!next.pendingPayment&&!next.termination,'candidate-funding-unresolved')
  return next
}
export function verifyReplacement(step:BlockedStep,entry:LogEntry,action:FollowupAction,work:WorkBudget) {
  requireEndgame(step.boundary==='before-command'&&sameExternal(step.actual,step.alternative),'replacement-context')
  requireEndgame(step.actual.turn===entry.before.turn&&step.actual.lap===entry.before.lap&&step.actual.position===entry.before.position
    &&step.actual.phase===entry.before.phase,'recorded-context-mismatch')
  if(action.kind==='event')requireEndgame(step.reason==='illegal-recorded-action'&&entry.kind==='decision'&&entry.eventId===step.alternative.eventId,'replacement-context')
  else requireEndgame(entry.kind==='funding'&&fundingContext(step.actual,step.alternative),'replacement-funding-context')
  const actual=applyRecorded(structuredClone(step.actual),entry,work),alternative=applyCandidate(step.alternative,action,work)
  requireEndgame(sameExternal(actual,alternative),'followup-external-mismatch')
  requireEndgame(equalData(actual.pendingPayment,alternative.pendingPayment),'followup-payment-mismatch')
  return {actual,alternative,superseded:[entry.sequence]}
}
export async function inspectBlocker(step:BlockedStep,entry:LogEntry,cursor:number,work:WorkBudget):Promise<PendingBlocker> {
  const s=step.alternative,choices:PendingBlocker['choices']=[]
  if(step.boundary==='before-command'&&sameExternal(step.actual,s)){
    const candidates:PendingBlocker['choices']=[]
    if(step.reason==='illegal-recorded-action'&&entry.kind==='decision'&&s.phase==='event'){
      const options=eventsForGame(s).find(e=>e.id===s.eventId)?.options??[]
      requireEndgame(options.length<=EG1B_LIMITS.choices,'option-budget')
      for(const option of options)if(canChoose(s,option.id))candidates.push({action:{kind:'event',optionId:option.id},label:option.label})
    }else if(entry.kind==='funding'&&fundingContext(step.actual,s)&&s.pendingPayment)candidates.push({action:{kind:'fund-debt',amount:s.pendingPayment.remaining},label:'Vay đúng khoản còn thiếu; nghĩa vụ gốc/lãi theo engine'})
    for(const candidate of candidates){
      work.check()
      try{verifyReplacement(step,entry,candidate.action,work);choices.push(candidate)}catch(error){work.check();if(work.steps>work.maxSteps)throw error}
    }
  }
  const facts={command:commandIdentity(entry),reason:step.reason,boundary:step.boundary,commandApplied:step.boundary==='after-command',phaseAdvanceOccurred:step.boundary==='phase-advance'||!!step.phaseAdvanceOccurred,cursor,
    context:{phase:s.phase,turn:s.turn,lap:s.lap,tile:s.position,event:s.eventId},payment:s.pendingPayment?{origin:s.pendingPayment.origin,remaining:s.pendingPayment.remaining,total:s.pendingPayment.total}:null,externalEqual:sameExternal(step.actual,s),choices,
    alternativePrefixHash:await digest(canonical(s.log))}
  const hash=await digest(canonical(facts))
  return {hash,command:facts.command,reason:facts.reason,boundary:facts.boundary,commandApplied:facts.commandApplied,phaseAdvanceOccurred:facts.phaseAdvanceOccurred,cursor:facts.cursor,context:facts.context,payment:facts.payment,externalEqual:facts.externalEqual,choices:facts.choices}
}
export function applyExplicitChoice(step:BlockedStep,entry:LogEntry,blocker:PendingBlocker,choice:FollowupAction,work:WorkBudget){
  requireEndgame(blocker.boundary===step.boundary&&blocker.cursor>=0&&equalData(blocker.command,commandIdentity(entry))
    &&equalData(blocker.context,{phase:step.alternative.phase,turn:step.alternative.turn,lap:step.alternative.lap,tile:step.alternative.position,event:step.alternative.eventId}),'blocker-context')
  requireEndgame(blocker.choices.some(x=>equalData(x.action,choice)),'illegal-choice')
  return verifyReplacement(step,entry,choice,work)
}