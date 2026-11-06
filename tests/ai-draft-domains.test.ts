import {liveBondEncounter} from './helpers/draft.ts'
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {encounter,phaseState} from './helpers/universal.ts'
import {transact} from '../src/game/engine.ts'
import {fundSource} from '../src/game/transactions.ts'
import {createCreditBondLot,creditBondLots} from '../src/game/bond-credit.ts'
import {businessOverview,saleQuote,lostInterestOnWithdrawal} from '../src/game/selectors.ts'
import {currentCustomerPreference} from '../src/game/customer-preferences.ts'
import {normalizeDraftInput,projectDraftContext,createDraftRequest,answerDraft,parseDraftContext} from '../src/ai/companion/draft-index.ts'
import type {DraftInput} from '../src/ai/companion/draft-index.ts'
const identity={sessionEpoch:'domain-quotes',revision:1,draftId:'form',draftRevision:1},q='Giải thích phương án đang nhập'
for(const issuerId of ['an-tam','but-pha'] as const)test('bond buy '+issuerId+' uses read-only lot constructor and conditional coupon',async()=>{
 const s=liveBondEncounter(),before=JSON.stringify(s),amount=1_234_567,d=normalizeDraftInput({form:'investment',operation:'buy',asset:'bonds',issuerId,amount}),c=projectDraftContext(s,identity,d),lot=createCreditBondLot(s,issuerId,amount)
 assert.equal(c.preview.status,'quoted');for(const [code,value] of [['principal',lot.principal],['coupon',Math.round(lot.principal*lot.credit!.couponRate)],['maturity',lot.maturityLap]])assert.equal(c.preview.lines.find(l=>l.code===code)!.value,value)
 const a=await answerDraft(await createDraftRequest(c,q,'bond-buy'));assert.match(a.explanation,/chậm trả hoặc mất vốn/);assert.equal(JSON.stringify(s),before)
 const altered={...s,bondCredit:{...s.bondCredit!,issuers:s.bondCredit!.issuers.map(i=>i.id===issuerId?{...i,status:'delayed' as const}:i)}}
 assert.notEqual(projectDraftContext(altered,identity,d).preview.status,'quoted')
})
function bonds(){const s=liveBondEncounter(),b=transact(s,{kind:'buy',asset:'bonds',issuerId:'an-tam',amount:3_000_000});return {...s,turn:s.turn+1,portfolio:b.portfolio,bondLots:b.bondLots}}
for(const form of ['investment','rebalancing'] as const)test('bond partial selected lot sale at '+form+' matches selector and rejects unavailable lot',()=>{
 const s=form==='rebalancing'?{...bonds(),phase:'rebalancing' as const,eventId:null}:bonds(),lot=creditBondLots(s)[0],d=normalizeDraftInput({form,operation:'sell',asset:'bonds',amount:1_000_000,lotId:lot.lot.id}),c=projectDraftContext(s,identity,d),quote=saleQuote(s,'bonds',1_000_000,lot.lot.id)
 assert.equal(c.preview.status,'quoted');assert.equal(c.preview.lines.find(l=>l.code==='net')!.value,quote.net)
 assert.equal(projectDraftContext(s,identity,{...d,lotId:'missing'}).preview.status,'invalid')
 const dead={...s,bondCredit:{...s.bondCredit!,issuers:s.bondCredit!.issuers.map(i=>({...i,status:'defaulted' as const}))}}
 assert.notEqual(projectDraftContext(dead,identity,d).preview.status,'quoted')
 assert.throws(()=>parseDraftContext({...c,lotSubject:'lot-999',preview:c.preview}))
})
test('business specialization upgrade is conditional on current public preference and actual upgrade rights',async()=>{
 const s=encounter('business'),b=transact(s,{kind:'buy',asset:'business',amount:20_000_000}),game={...s,turn:s.turn+1,portfolio:b.portfolio,business:b.business,businessPurchaseTurn:b.businessPurchaseTurn},before=JSON.stringify(game)
 for(const preferenceId of ['checkin','budget','taste'] as const){const c=projectDraftContext(game,identity,normalizeDraftInput({form:'business',operation:'upgrade',amount:5_000_000,preferenceId}));assert.equal(c.preview.status,'quoted');assert.equal(c.preview.lines.find(l=>l.code==='incremental')!.value,businessOverview(game,preferenceId).incrementalIncome);const a=await answerDraft(await createDraftRequest(c,q,'business'));assert.match(a.explanation,/thị hiếu vòng sau/)}
 assert.equal(JSON.stringify(game),before);assert(['checkin','budget','taste'].includes(currentCustomerPreference(game).id))
 assert.equal(projectDraftContext({...game,turn:game.businessPurchaseTurn!},identity,normalizeDraftInput({form:'business',operation:'upgrade',amount:5_000_000,preferenceId:'checkin'})).preview.status,'unavailable')
})
for(const source of ['debt','gold','stocks','bonds','savings'] as const)test('funding '+source+' equals trusted immediate funding transaction, excluding continuation',async()=>{
 let s=phaseState('funding'),lotId:string|null=null,amount=100_000
 if(source==='gold'||source==='stocks'){const base=encounter(source),b=transact(base,{kind:'buy',asset:source,amount:3_000_000,symbolId:source==='stocks'?base.market.stocks[0].id:undefined});s={...s,portfolio:{...s.portfolio,[source]:b.portfolio[source]},stockHoldings:b.stockHoldings,goldUnits:b.goldUnits,goldCostBasis:b.goldCostBasis}}
 if(source==='bonds'){const b=bonds();s={...s,bondLots:b.bondLots,bondCredit:b.bondCredit,portfolio:{...s.portfolio,bonds:b.portfolio.bonds}};lotId=b.bondLots[0].id}
 if(source==='savings'){const b=transact(encounter('bank'),{kind:'deposit',amount:1_000_000,term:2});s={...s,deposits:b.deposits,portfolio:{...s.portfolio,savings:b.portfolio.savings}};lotId=b.deposits[0].id;amount=1_000_000}
 const before=JSON.stringify(s),d=normalizeDraftInput({form:'funding',operation:'fund',source,amount,lotId}),c=projectDraftContext(s,identity,d);assert.equal(c.preview.status,'quoted')
 const after=fundSource(s,source,amount,lotId??undefined),line=(code:string)=>c.preview.lines.find(l=>l.code===code)!.value
 assert.equal(line('cashAfterStep'),after.portfolio.cash);assert.equal(line('pendingAfter'),after.pendingPayment!.remaining);assert.equal(line('used'),s.pendingPayment!.remaining-after.pendingPayment!.remaining)
 if(source==='savings')assert.equal(line('lost'),lostInterestOnWithdrawal(s,lotId!));if(source==='debt')assert.equal(line('debtAfter'),after.portfolio.debt)
 assert.equal(JSON.stringify(s),before);const a=await answerDraft(await createDraftRequest(c,q,'funding'));assert.match(a.explanation,/Chưa bao gồm bước tiếp tục/)
 if(source==='savings')assert.notEqual(projectDraftContext(s,identity,{...d,amount:amount/2}).preview.status,'quoted')
})
test('mutually conflicting draft selections never produce a quote',()=>{
 const s=encounter('gold'),base=normalizeDraftInput({form:'investment',operation:'buy',asset:'gold',amount:1_000_000})
 for(const patch of [{issuerId:'an-tam'},{source:'debt'},{preferenceId:'taste'},{lotId:'bond-1'},{term:2},{symbolId:'VCB'}] as Partial<DraftInput>[])assert.notEqual(projectDraftContext(s,identity,{...base,...patch}).preview.status,'quoted')
})
