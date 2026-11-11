import type {GameState,LogEntry} from '../../../src/game/types.ts'
/** Pin engine/data source; separate identity from Bank even for the same executable. */
export const GOLD_ENGINE_SOURCE='5a9f6aa4907ad5d2e2013fe68d6d22fa10debd9e3c93c2c01ced11f2494d8415'
export const GOLD_ENGINE_VERSION=`g6b1-gold-v1:${GOLD_ENGINE_SOURCE}`
export const GOLD_POLICY='gold-skip-buy5m-next-start-sale.v1' as const
export const GOLD_PRINCIPAL=5_000_000 as const
export type GoldSession={getSnapshot():GameState;subscribe(fn:()=>void):()=>void}
export type GoldDecision={sequence:number;turn:number;lap:number;tileId:number;eventId:'gold';decisionId:'skip'}
export type GoldHorizon={sequence:number;turn:number;lap:number;phase:'rebalancing';witnessSequence:number;witnessKind:'recorded-current-state'|'later-recorded-command'}
export type GoldContext={feature:'gold-historical';policy:typeof GOLD_POLICY;engine:string;transcript:string;prefix:string;config:string;decision:GoldDecision;checkpoint:GoldHorizon|null}
export type GoldKnown={policy:typeof GOLD_POLICY;principal:typeof GOLD_PRINCIPAL;assumption:'analysis-budget-not-recorded-intent';actualImmediateCash:number;alternativeImmediateCash:number;priceAtDecision:number;units:number;buyFee:0;spreadRate:number;saleFeeRate:number;liquidity:'cash-reduced-until-legal-sale'}
export type GoldDTO={status:'blocked';reason:string}|({status:'known'}&GoldKnown)|({status:'supported';actualCash:number;alternativeCashBeforeSale:number;heldGoldGross:number;spread:number;saleFee:number;netSaleProceeds:number;alternativeCashAfterSale:number;difference:number;bookGain:number;debt:0;obligations:0;checkpoint:GoldHorizon;saleAssumption:'hypothetical-full-new-gold-sale-at-next-start'}&GoldKnown)
type ReadonlyGold<T> = T extends {checkpoint:GoldHorizon} ? Readonly<Omit<T,'checkpoint'>>&{readonly checkpoint:Readonly<GoldHorizon>} : Readonly<T>
export type GoldReadDTO=ReadonlyGold<GoldDTO>
export type GoldEnvelope={context:GoldContext;result:GoldDTO}
export class GoldRejected extends Error {}
export function requireGold(value:unknown,reason:string):asserts value{if(!value)throw new GoldRejected(reason)}
const stable=(value:unknown)=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)
export const goldEqual=(a:unknown,b:unknown)=>stable(a)===stable(b)
export async function goldDigest(v:unknown){const bytes=new TextEncoder().encode(JSON.stringify(v));const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('')}
export const goldCommand=(e:LogEntry)=>['roll','decision','rebalancing','funding'].includes(e.kind)
/** Ex-ante structural eligibility only: never rank by a later price or retry after a path failure. */
function candidate(e:LogEntry){const s=e.before;return e.kind==='decision'&&e.eventId==='gold'&&e.decisionId==='skip'&&[5,16].includes(e.tileId)&&e.tileId===s.position&&s.phase==='event'&&s.lap<4&&s.portfolio.cash>=GOLD_PRINCIPAL&&s.goldUnits===0&&s.goldCostBasis===0&&['stocks','bonds','gold','business','savings','debt'].every(k=>s.portfolio[k as keyof typeof s.portfolio]===0)&&s.obligations===0&&s.pendingCost===0&&!s.termination}
export function firstGoldSequence(s:Pick<GameState,'log'>){return s.log.find(candidate)?.sequence??null}
export type GoldSource={schemaVersion:number;rulesVersion:string;seed:string;state:GameState;entries:LogEntry[];financialConfig:unknown;[key:string]:unknown}
export function parseGoldSource(text:string):GoldSource{
 requireGold(text.length<=20_000_000,'source-too-large');const d=JSON.parse(text) as GoldSource
 requireGold(d.schemaVersion===7&&d.rulesVersion==='gameplay-core-mvp-b18-multi-course-v1'&&d.state?.gameplayProfile==='core-mvp-b18-multi-course-v1'&&d.state.totalLaps===4&&d.seed===d.state.seed,'version-unsupported')
 requireGold(Array.isArray(d.entries)&&d.entries.length>1&&d.entries.length<=500&&d.entries.every((e,i)=>e.sequence===i+1)&&goldEqual(d.entries,d.state.log),'history-invalid');return d
}
export async function goldContextFor(text:string,selected?:number):Promise<GoldContext>{
 const d=parseGoldSource(text),sequence=firstGoldSequence({log:d.entries});requireGold(sequence!==null,'explicit-eligible-gold-skip-required');requireGold(selected===undefined||selected===sequence,'first-eligible-required')
 const e=d.entries[sequence-1],settlement=d.entries.find(x=>x.kind==='settlement'&&x.sequence>sequence),witness=settlement?d.entries.find(x=>x.sequence>settlement.sequence&&goldCommand(x)):undefined
 const current=settlement&&d.state.phase==='rebalancing'&&d.state.log.length===settlement.sequence&&d.state.lap===settlement.lap&&d.state.turn===settlement.after.turn
 const checkpoint:GoldHorizon|null=settlement&&(witness||current)?{sequence:settlement.sequence,turn:settlement.after.turn,lap:settlement.lap,phase:'rebalancing',witnessSequence:witness?.sequence??settlement.sequence,witnessKind:current?'recorded-current-state':'later-recorded-command'}:null
 return{feature:'gold-historical',policy:GOLD_POLICY,engine:GOLD_ENGINE_VERSION,transcript:await goldDigest(text),prefix:await goldDigest(d.entries.slice(0,sequence)),config:await goldDigest(d.financialConfig),decision:{sequence,turn:e.turn,lap:e.lap,tileId:e.tileId,eventId:'gold',decisionId:'skip'},checkpoint}
}
export const deltaMeaning=(n:number)=>n<0?'loss-avoided':n>0?'gain-forgone':'no-net-difference'
/** Exact allowlist copies at the worker/main trust boundary; never retain arbitrary worker fields. */
export function publicGoldDTO(raw:GoldDTO):GoldDTO{
 if(raw.status==='blocked'){requireGold(typeof raw.reason==='string'&&raw.reason.length<100,'dto-invalid');return{status:'blocked',reason:raw.reason}}
 requireGold(raw.policy===GOLD_POLICY&&raw.principal===GOLD_PRINCIPAL&&raw.assumption==='analysis-budget-not-recorded-intent'&&raw.liquidity==='cash-reduced-until-legal-sale'&&raw.buyFee===0,'dto-invalid')
 const known:GoldKnown={policy:raw.policy,principal:raw.principal,assumption:raw.assumption,actualImmediateCash:raw.actualImmediateCash,alternativeImmediateCash:raw.alternativeImmediateCash,priceAtDecision:raw.priceAtDecision,units:raw.units,buyFee:0,spreadRate:raw.spreadRate,saleFeeRate:raw.saleFeeRate,liquidity:raw.liquidity}
 requireGold([known.actualImmediateCash,known.alternativeImmediateCash,known.priceAtDecision].every(n=>Number.isSafeInteger(n)&&n>=0)&&known.priceAtDecision>0&&Number.isFinite(known.units)&&known.units>0&&known.actualImmediateCash-known.alternativeImmediateCash===GOLD_PRINCIPAL&&known.spreadRate===.03&&known.saleFeeRate===.01,'dto-invalid')
 if(raw.status==='known')return{status:'known',...known}
 requireGold(raw.status==='supported'&&raw.saleAssumption==='hypothetical-full-new-gold-sale-at-next-start'&&raw.debt===0&&raw.obligations===0,'dto-invalid')
 const c=raw.checkpoint;requireGold(c&&c.phase==='rebalancing'&&[c.sequence,c.turn,c.lap,c.witnessSequence].every(Number.isSafeInteger)&&c.sequence>0&&c.turn>0&&c.lap>0&&c.lap<4&&c.witnessSequence>=c.sequence&&['recorded-current-state','later-recorded-command'].includes(c.witnessKind),'dto-invalid')
 const checkpoint:GoldHorizon={sequence:c.sequence,turn:c.turn,lap:c.lap,phase:'rebalancing',witnessSequence:c.witnessSequence,witnessKind:c.witnessKind}
 const values=[raw.actualCash,raw.alternativeCashBeforeSale,raw.heldGoldGross,raw.spread,raw.saleFee,raw.netSaleProceeds,raw.alternativeCashAfterSale]
 requireGold(values.every(n=>Number.isSafeInteger(n)&&n>=0)&&Number.isSafeInteger(raw.difference)&&Number.isSafeInteger(raw.bookGain)&&raw.heldGoldGross-raw.spread-raw.saleFee===raw.netSaleProceeds&&raw.alternativeCashBeforeSale+raw.netSaleProceeds===raw.alternativeCashAfterSale&&raw.alternativeCashAfterSale-raw.actualCash===raw.difference&&raw.netSaleProceeds-GOLD_PRINCIPAL===raw.difference&&raw.heldGoldGross-GOLD_PRINCIPAL===raw.bookGain,'dto-invalid')
 return{status:'supported',...known,actualCash:raw.actualCash,alternativeCashBeforeSale:raw.alternativeCashBeforeSale,heldGoldGross:raw.heldGoldGross,spread:raw.spread,saleFee:raw.saleFee,netSaleProceeds:raw.netSaleProceeds,alternativeCashAfterSale:raw.alternativeCashAfterSale,difference:raw.difference,bookGain:raw.bookGain,debt:0,obligations:0,checkpoint,saleAssumption:raw.saleAssumption}
}
