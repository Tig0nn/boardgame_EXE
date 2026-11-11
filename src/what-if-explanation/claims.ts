import { ExplanationRejected, SCENARIO, parsePlan } from './contracts.ts'
import type { ExplanationFacts, ExplanationPlan } from './contracts.ts'
/** Consistency predicates only. They never replay, calculate returns, or authenticate a caller-created DTO. */
export function assertFacts(f:ExplanationFacts):void {
  const r=f?.result,d=f?.decision,c=f?.checkpoint
  if(!r||!d||!c||f.scenario!==SCENARIO||r.status!=='supported'||d.eventId!=='bank'||d.decisionId!=='skip'||d.tileId!==17
    ||!Number.isSafeInteger(d.sequence)||d.sequence<=1||!Number.isSafeInteger(c.sequence)||c.sequence<=d.sequence
    ||!Number.isSafeInteger(d.turn)||!Number.isSafeInteger(c.turn)||d.turn<1||c.turn!==d.turn+1||c.lap!==d.lap||![1,2,3,4].includes(d.lap)
    ||r.checkpointLap!==c.lap||r.checkpointTurn!==c.turn||f.horizon!=='recorded-next-completed-start'
    ||f.liquidity!=='principal-locked-until-comparison-start'||f.assumption?.term!==1
    ||f.assumption.budgetMeaning!=='analysis-assumption-not-recorded-intent'||r.principal!==5_000_000
    ||!['principal','actualCash','alternativeCash','difference','actualLiquidBuffer','alternativeLiquidBuffer','fees','debt','obligations'].every(k=>{const v=r[k as keyof typeof r];return typeof v==='number'&&Number.isSafeInteger(v)&&v>=0})
    ||r.difference<=0||r.alternativeCash-r.actualCash!==r.difference||r.actualLiquidBuffer-r.alternativeLiquidBuffer!==r.principal
    ||r.fees!==0||r.debt!==0||r.obligations!==0)throw new ExplanationRejected()
}
export function validateClaims(raw:unknown,facts:ExplanationFacts):Readonly<ExplanationPlan>{const plan=parsePlan(raw);assertFacts(facts);return plan}
/** Provider sees public scenario/tradeoff categories, not balances, history, identity or fingerprints. */
export function semanticFacts(facts:ExplanationFacts){
  assertFacts(facts)
  return Object.freeze({scenario:SCENARIO,actual:'explicit-bank-skip',alternative:'hypothetical-fixed-budget-deposit-term1',
    budgetMeaning:'analysis-assumption-not-recorded-intent',horizon:'recorded-next-completed-start',outcome:'alternative-cash-higher-at-checkpoint',
    liquidity:'immediate-buffer-reduced-principal-locked',fees:'zero-in-verified-slice',remainingDebtAndObligations:'zero-at-checkpoint',
    hindsight:'past-outcome-does-not-prove-original-choice-wrong'} as const)
}
export type MockInput = ReturnType<typeof semanticFacts>
export type OfflineProvider = (input:MockInput,signal:AbortSignal)=>Promise<unknown>
