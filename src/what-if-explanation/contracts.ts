import type { Checkpoint, Decision, ReviewDTO } from '../../mobile_app/src/game/bank-historical-contract.ts'
export const SCENARIO = 'b18-bank-skip-deposit5m-term1.v1' as const
export const SLOT_IDS = Object.freeze({
  summary: Object.freeze(['actual-assumption-brief','actual-assumption-explicit'] as const),
  interpretation: Object.freeze(['higher-cash-at-checkpoint','interest-difference-at-checkpoint'] as const),
  tradeoff: Object.freeze(['locked-principal','immediate-buffer-tradeoff'] as const),
  takeaway: Object.freeze(['hindsight-limit','information-at-decision-time'] as const),
})
export type Slot = keyof typeof SLOT_IDS
export type ExplanationPlan = { [K in Slot]: (typeof SLOT_IDS)[K][number] }
export const SLOTS = Object.freeze(Object.keys(SLOT_IDS) as Slot[])
export const DEFAULT_PLAN: Readonly<ExplanationPlan> = Object.freeze({summary:SLOT_IDS.summary[0],interpretation:SLOT_IDS.interpretation[0],tradeoff:SLOT_IDS.tradeoff[0],takeaway:SLOT_IDS.takeaway[0]})
/** Detached facts only. Authenticity comes from the private issued lease, never this public type. */
export type ExplanationFacts = {
  scenario: typeof SCENARIO; decision: Decision; checkpoint: NonNullable<Checkpoint>
  assumption: { term: 1; budgetMeaning: 'analysis-assumption-not-recorded-intent' }
  horizon: 'recorded-next-completed-start'; liquidity: 'principal-locked-until-comparison-start'
  result: Extract<ReviewDTO,{status:'supported'}>
}
export interface ExplanationLease { read(): ExplanationFacts | null; onInvalidated(listener:()=>void):()=>void; release():void }
export class ExplanationRejected extends Error { constructor(){super('explanation-rejected')} }
const fail = (): never => { throw new ExplanationRejected() }
/** Flat string-only JSON grammar: detects duplicate decoded keys without a generic JSON repair/parser. */
function decodePlan(text:string):unknown {
  if(text.length>1024||new TextEncoder().encode(text).length>1024)fail()
  let at=0
  const space=()=>{while(/[\t\n\r ]/.test(text[at]??'') && at<text.length)at++}
  const take=(c:string)=>{space();if(text[at++]!==c)fail()}
  const string=()=>{space();const token=/"(?:[^"\\]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/y;token.lastIndex=at;const m=token.exec(text);if(!m) return fail();at=token.lastIndex;return JSON.parse(m[0]) as string}
  const out:Record<string,string>=Object.create(null)
  take('{')
  for(let i=0;i<4;i++){
    if(i)take(',');const key=string();if(Object.hasOwn(out,key))fail();take(':');out[key]=string()
  }
  take('}');space();if(at!==text.length)fail();return out
}
/** No arbitrary prose/numeric fields/HTML survive. Returned plan is a new frozen allowlist copy. */
export function parsePlan(raw:unknown):Readonly<ExplanationPlan> {
  try {
    if(raw instanceof Uint8Array){if(raw.byteLength>1024)fail();raw=new TextDecoder('utf-8',{fatal:true}).decode(raw)}
    if(typeof raw==='string')raw=decodePlan(raw)
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail()
    const proto=Object.getPrototypeOf(raw);if(proto!==Object.prototype&&proto!==null)return fail()
    const keys=Reflect.ownKeys(raw);if(keys.length!==4||keys.some(k=>typeof k!=='string'||!SLOTS.includes(k as Slot)))return fail()
    const out={} as ExplanationPlan
    for(const key of SLOTS){const d=Object.getOwnPropertyDescriptor(raw,key);if(!d||!('value'in d)||!d.enumerable||typeof d.value!=='string'||!(SLOT_IDS[key] as readonly string[]).includes(d.value))return fail();Object.defineProperty(out,key,{value:d.value,enumerable:true})}
    return Object.freeze(out)
  }catch{throw new ExplanationRejected()}
}
