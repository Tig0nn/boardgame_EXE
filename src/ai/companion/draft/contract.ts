import {array,enumeration,integer,literal,nullable,object,text,invalid} from '../schema.ts'
import {canonicalJson,sha256} from '../serialization.ts'
import {parseQuestionText} from '../question-contract.ts'
import {parseGameplayContext} from '../universal/contract.ts'
import {bondIssuer} from '../../../data/bond-issuers.ts'
import {ECONOMY} from '../../../data/config.ts'
import {DRAFT_CONTEXT,DRAFT_POLICY} from './types.ts'
import type {DraftContext,DraftInput,DraftPreview,DraftRequest} from './types.ts'
const inputSchema=object({form:enumeration(['investment','bank','rebalancing','business','funding']),operation:enumeration(['buy','sell','deposit','upgrade','fund']),asset:nullable(enumeration(['gold','stocks','bonds'])),amount:nullable(integer(-Number.MAX_SAFE_INTEGER)),symbolId:nullable(text(32)),issuerId:nullable(enumeration(['an-tam','but-pha'])),lotId:nullable(text(96)),preferenceId:nullable(enumeration(['checkin','budget','taste'])),source:nullable(enumeration(['savings','stocks','gold','bonds','debt'])),term:nullable(value=>[1,2,3].includes(value as number)?value as 1|2|3:invalid())})
export function normalizeDraftInput(input:Partial<DraftInput>):DraftInput {
 return inputSchema({form:input.form,operation:input.operation,asset:input.asset??null,amount:Number.isSafeInteger(input.amount)?input.amount:null,symbolId:input.symbolId??null,issuerId:input.issuerId??null,lotId:input.lotId??null,preferenceId:input.preferenceId??null,source:input.source??null,term:input.term??null})
}
const lineSchema=object({code:enumeration(['entered','price','payNow','cashAfter','gross','spread','fee','net','interest','maturity','term','principal','coupon','incremental','lost','used','pendingAfter','cashAfterStep','debtAfter']),value:integer()})
const previewSchema=object({status:enumeration(['quoted','invalid','unavailable','unsupported','missing']),reason:enumeration(['supported','amount','cash','holding','selection','action','unsupported','missing']),lines:array(lineSchema,0,12)})
const contextSchema=object({version:literal(DRAFT_CONTEXT),actual:parseGameplayContext,draftId:text(96),draftRevision:integer(),selection:nullable(inputSchema),selectedAvailable:nullable(integer()),lotSubject:nullable(text(16,/^lot-[1-9][0-9]*$/)),matchingPreferenceId:nullable(enumeration(['checkin','budget','taste'])),preview:previewSchema})
/** Reconstruct the complete preview from closed public facts and the explicit draft, never model text. */
export function previewDraft(c:Omit<DraftContext,'preview'>):DraftPreview {
 const d=c.selection,a=c.actual
 const fail=(status:DraftPreview['status'],reason:DraftPreview['reason']):DraftPreview=>({status,reason,lines:[]})
 const fact=(code:string,subject='overall')=>a.facts.find(f=>f.code===code&&f.subject===subject)?.value
 if(!d)return fail('missing','missing')
 const bank=d.form==='bank'&&d.operation==='deposit'&&d.asset===null&&d.symbolId===null&&[1,2,3].includes(d.term??0)&&a.domain==='bank'
 const business=d.form==='business'&&d.operation==='upgrade'&&a.domain==='business'&&d.preferenceId!==null&&d.asset===null&&d.amount===ECONOMY.business.upgradeCost
 const funding=d.form==='funding'&&d.operation==='fund'&&a.domain==='funding'&&d.source!==null&&d.asset===null
 const trade=d.form==='investment'&&a.phase==='event'&&a.domain===d.asset||d.form==='rebalancing'&&a.domain==='rebalancing'&&d.operation==='sell'
 if(!bank&&!business&&!funding&&(!trade||!['gold','stocks','bonds'].includes(d.asset??'')||!['buy','sell'].includes(d.operation)||d.term!==null))return fail('unsupported','unsupported')
 // Reject irrelevant or mutually conflicting selections; every display refers to one explicit operation.
 if(!bank&&d.term!==null||!business&&d.preferenceId!==null||!funding&&d.source!==null||d.form!=='investment'&&d.symbolId!==null)return fail('invalid','selection')
 const bondBuy=d.asset==='bonds'&&d.operation==='buy',bondSale=d.asset==='bonds'&&d.operation==='sell'||funding&&d.source==='bonds',saving=funding&&d.source==='savings'
 if(!bondBuy&&d.issuerId!==null||!bondSale&&!saving&&d.lotId!==null||bondBuy&&d.issuerId===null||bondSale&&(!d.lotId||!c.lotSubject)||saving&&(!d.lotId||!c.lotSubject))return fail('invalid','selection')
 if(d.asset==='stocks'&&d.form==='investment'&&!a.facts.some(f=>f.code==='price'&&f.subject===d.symbolId)||d.asset!=='stocks'&&d.symbolId!==null)return fail('invalid','selection')
 if(!a.actions.includes(funding?`fund-${d.source}`:d.operation))return fail('unavailable','action')
 if(d.amount===null||d.amount<=0)return fail('invalid','amount')
 const amount=d.amount,cash=fact('cash')!,lines:DraftPreview['lines']=[{code:'entered',value:amount}]
 if(bank||business||d.operation==='buy') {
  if(amount>cash)return fail('invalid','cash')
  lines.push({code:'payNow',value:amount},{code:'cashAfter',value:cash-amount})
  if(bank){const rate=fact('rate',`term-${d.term}`)!;lines.push({code:'term',value:d.term!},{code:'interest',value:Math.round(amount*(rate/10000)*d.term!)},{code:'maturity',value:a.lap+d.term!-1})}
  else if(business){if(!c.matchingPreferenceId)return fail('missing','missing');lines.push({code:'incremental',value:ECONOMY.business.baseUplift+(d.preferenceId===c.matchingPreferenceId?ECONOMY.business.matchingBonus:0)})}
  else {
   const price=fact('price',d.asset==='stocks'?d.symbolId!:d.asset==='bonds'?d.issuerId!:'gold')
   if(price===undefined||price<=0)return fail('invalid','selection')
   lines.push({code:'price',value:price})
   if(bondBuy){if(fact('creditState',d.issuerId!)!==0)return fail('unavailable','action');const rule=bondIssuer(d.issuerId!),principal=Math.round(amount/price*rule.faceValue);lines.push({code:'principal',value:principal},{code:'coupon',value:Math.round(principal*rule.coupon)},{code:'maturity',value:a.lap+rule.term-1})}
  }
 }else{
  const asset=funding?d.source!:d.asset!
  const total=asset==='bonds'?fact('gross',c.lotSubject!):asset==='savings'?fact('principal',c.lotSubject!):asset==='debt'?Math.min(fact('headroom')!,fact('remaining')!):fact(d.form==='investment'?'holding':'gross',asset)
  const available=asset==='stocks'&&d.form==='investment'?c.selectedAvailable:total??0
  if(available===null||amount>available||saving&&amount!==available)return fail('invalid','holding')
  const spread=asset==='gold'?Math.round(amount*ECONOMY.goldSpread):0,fee=['gold','stocks','bonds'].includes(asset)?Math.round((amount-spread)*ECONOMY.tradeFees[asset as 'gold'|'stocks'|'bonds']):0,net=amount-spread-fee
  lines.push({code:'gross',value:amount},{code:'spread',value:spread},{code:'fee',value:fee},{code:'net',value:net})
  if(funding){const remaining=fact('remaining')!,used=Math.min(remaining,cash+net);lines.push({code:'used',value:used},{code:'pendingAfter',value:remaining-used},{code:'cashAfterStep',value:cash+net-used});if(saving)lines.push({code:'lost',value:fact('lost',c.lotSubject!)!});if(asset==='debt')lines.push({code:'debtAfter',value:fact('debt')!+amount})}
  else lines.push({code:'cashAfter',value:cash+net})
 }
 if(lines.some(l=>!Number.isSafeInteger(l.value)||l.value<0))return fail('invalid','amount')
 return {status:'quoted',reason:'supported',lines}
}

export function parseDraftContext(raw:unknown):DraftContext {
 const c=contextSchema(raw),d=c.selection
 if(d?.form==='investment'&&d.asset==='stocks'&&d.operation==='sell') {
  const total=c.actual.facts.find(f=>f.code==='holding'&&f.subject==='stocks')?.value??0
  if(c.selectedAvailable===null||c.selectedAvailable>total)invalid()
 }else if(c.selectedAvailable!==null)invalid()
 const usesLot=!!d&&(d.asset==='bonds'&&d.operation==='sell'||d.form==='funding'&&['savings','bonds'].includes(d.source??''))
 if(!usesLot&&c.lotSubject!==null||d?.form!=='business'&&c.matchingPreferenceId!==null)invalid()
 if(canonicalJson(previewDraft(c))!==canonicalJson(c.preview))invalid()
 return c
}
const hash=text(71,/^sha256:[0-9a-f]{64}$/)
const requestSchema=object({version:literal(1),policy:literal(DRAFT_POLICY),requestId:text(),sessionEpoch:text(48),revision:integer(),draftId:text(),draftRevision:integer(),context:parseDraftContext,contextDigest:hash,question:parseQuestionText,questionDigest:hash})
export async function parseDraftRequest(raw:unknown):Promise<DraftRequest>{
 const r=requestSchema(raw),c=r.context
 if(r.sessionEpoch!==c.actual.sessionEpoch||r.revision!==c.actual.revision||r.draftId!==c.draftId||r.draftRevision!==c.draftRevision)invalid()
 if(await sha256(canonicalJson(c))!==r.contextDigest||await sha256(r.question)!==r.questionDigest)invalid()
 return r
}
export async function createDraftRequest(raw:unknown,question:unknown,requestId:unknown):Promise<DraftRequest>{
 const context=parseDraftContext(raw),q=parseQuestionText(question)
 return parseDraftRequest({version:1,policy:DRAFT_POLICY,requestId,sessionEpoch:context.actual.sessionEpoch,revision:context.actual.revision,draftId:context.draftId,draftRevision:context.draftRevision,context,contextDigest:await sha256(canonicalJson(context)),question:q,questionDigest:await sha256(q)})
}
