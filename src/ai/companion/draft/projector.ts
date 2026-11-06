import {projectGameplayContext} from '../universal/projector.ts'
import {purchasePreview,saleQuote,depositPreview,businessOverview,lostInterestOnWithdrawal} from '../../../game/selectors.ts'
import {creditBondLots,createCreditBondLot} from '../../../game/bond-credit.ts'
import {currentCustomerPreference} from '../../../game/customer-preferences.ts'
import type {GameState} from '../../../game/types.ts'
import {parseDraftContext,previewDraft,normalizeDraftInput} from './contract.ts'
import {DRAFT_CONTEXT} from './types.ts'
import type {DraftContext,DraftInput,DraftIdentity} from './types.ts'
/** Read-only selection. Raw snapshot/holdings/hidden state never enter the DTO. */
export function projectDraftContext(s:GameState,identity:DraftIdentity,input:DraftInput|null):DraftContext {
 const actual=projectGameplayContext(s,{sessionEpoch:identity.sessionEpoch,revision:identity.revision}),selection=input?normalizeDraftInput(input):null
 let selectedAvailable:number|null=null
 if(selection?.form==='investment'&&selection.asset==='stocks'&&selection.operation==='sell') {
  const stock=s.market.stocks.find(x=>x.id===selection.symbolId)
  selectedAvailable=stock?Math.min(s.portfolio.stocks,Math.round(stock.currentPrice*(s.stockHoldings[stock.id]?.units??0))):0
 }
 let lotSubject:string|null=null
 if(selection&&(selection.asset==='bonds'&&selection.operation==='sell'||selection.form==='funding'&&selection.source==='bonds')){const i=creditBondLots(s).findIndex(x=>x.lot.id===selection.lotId);if(i>=0)lotSubject='lot-'+(i+1)}
 if(selection?.form==='funding'&&selection.source==='savings'){const i=s.deposits.filter(x=>x.status==='active').findIndex(x=>x.id===selection.lotId);if(i>=0)lotSubject='lot-'+(i+1)}
 const matchingPreferenceId=selection?.form==='business'?currentCustomerPreference(s).id:null
 const base={version:DRAFT_CONTEXT,actual,draftId:identity.draftId,draftRevision:identity.draftRevision,selection,selectedAvailable,lotSubject,matchingPreferenceId},preview=previewDraft(base)
 if(preview.status==='quoted'&&selection) {
  const value=(code:string)=>preview.lines.find(l=>l.code===code)?.value,amount=selection.amount!
  if(selection.operation==='fund'){
   const source=selection.source!
   if(['stocks','bonds','gold'].includes(source)){const q=saleQuote(s,source as 'stocks'|'bonds'|'gold',amount,selection.lotId??undefined);for(const code of ['gross','spread','fee','net'] as const)if(value(code)!==q[code])throw Error('Draft funding mismatch')}
   if(source==='savings'&&value('lost')!==lostInterestOnWithdrawal(s,selection.lotId!))throw Error('Draft withdrawal mismatch')
  }else if(selection.operation==='sell') {
   const q=saleQuote(s,selection.asset as 'gold'|'stocks'|'bonds',amount,selection.lotId??undefined)
   for(const code of ['gross','spread','fee','net'] as const)if(value(code)!==q[code])throw Error('Draft quote mismatch')
  }else {
   const q=purchasePreview(s,amount)
   if(!q.valid||value('cashAfter')!==q.cashAfter)throw Error('Draft purchase mismatch')
   if(selection.operation==='upgrade'&&value('incremental')!==businessOverview(s,selection.preferenceId!).incrementalIncome)throw Error('Draft business mismatch')
   if(selection.asset==='bonds'&&selection.operation==='buy'){const lot=createCreditBondLot(s,selection.issuerId!,amount);if(value('principal')!==lot.principal||value('coupon')!==Math.round(lot.principal*lot.credit!.couponRate)||value('maturity')!==lot.maturityLap)throw Error('Draft bond mismatch')}
   if(selection.operation==='deposit') {const d=depositPreview(s,amount,selection.term!);if(value('interest')!==d.interest||value('maturity')!==d.maturityLap)throw Error('Draft deposit mismatch')}
  }
 }
 return parseDraftContext({...base,preview})
}
