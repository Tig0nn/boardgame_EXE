import type { GameState, LogEntry } from '../../../src/game/types.ts'
import { continueRecorded } from './endgame-whatif-continuation.ts'
import { applyRecorded } from './endgame-whatif-replay.ts'
import { sameExternal } from './endgame-whatif-fairness.ts'
import { equalData } from './endgame-whatif-identity.ts'
import { EndgameRejected } from './endgame-whatif-contract.ts'
import type { WorkBudget } from './endgame-whatif-contract.ts'
export type Pair = { actual:GameState; alternative:GameState }
export type BlockedStep = Pair & {ok:false;reason:string;boundary:'before-command'|'after-command'|'phase-advance';phaseAdvanceOccurred?:boolean}
export type ReconciledStep = BlockedStep | (Pair & {ok:true;boundaries:number;advances:number})
/** Only remaining amount may differ within the same pending payment. No remapping or fund0. */
export function fundingContext(a:GameState,b:GameState) {
  if(a.phase!=='funding'||b.phase!=='funding'||!a.pendingPayment||!b.pendingPayment||!sameExternal(a,b))return false
  const {remaining:ar,...ap}=a.pendingPayment,{remaining:br,...bp}=b.pendingPayment
  return ar>0&&br>0&&equalData(ap,bp)
}
export function reconcileStep(a:GameState,b:GameState,entry:LogEntry,work:WorkBudget):ReconciledStep {
  if(entry.kind==='funding'&&fundingContext(a,b)&&!equalData(a.pendingPayment,b.pendingPayment)) {
    // Verify whether the exact recorded command actually fails; never apply it merely to probe.
    let reason='funding-requirements-mismatch'
    try { applyRecorded(structuredClone(b),entry,work) } catch(error) {
      if(error instanceof EndgameRejected&&['cancelled','step-budget','time-budget'].includes(error.message))throw error
      reason='illegal-recorded-funding'
    }
    return {ok:false,reason,boundary:'before-command',actual:a,alternative:b}
  }
  const step=continueRecorded(a,b,entry,work)
  if(step.ok)return step
  const aligned=(a.phase!==entry.before.phase||a.lap!==entry.before.lap)&&step.actual!==a
  return {...step,phaseAdvanceOccurred:step.boundary==='phase-advance'||aligned}
}
/** A successfully executed command can lead to different endogenous shortfalls. Move to the real funding command; do not replay the previous action. */
export function mayInspectNextFunding(step:BlockedStep,next:LogEntry|undefined) {
  return step.boundary==='after-command'&&step.reason==='funding-requirements-mismatch'&&next?.kind==='funding'&&fundingContext(step.actual,step.alternative)
}