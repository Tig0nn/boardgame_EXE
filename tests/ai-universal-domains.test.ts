import {test} from 'node:test'
import assert from 'node:assert/strict'
import {encounter,phaseState} from './helpers/universal.ts'
import {projectGameplayContext,parseGameplayContext,createGameplayRequest,parseGameplayRequest,answerGameplay,validateGameplayResponse} from '../src/ai/companion/universal-index.ts'
import {transact,decide} from '../src/game/engine.ts'
import {beginSettlement} from '../src/game/settlement.ts'
import {saleQuote,depositPreview,businessOverview} from '../src/game/selectors.ts'
import {createCoreMvpGame,createPlayerGame} from '../src/game/new-game.ts'
import {advance} from '../src/game/engine.ts'
const identity={sessionEpoch:'domain-check',revision:9}
test('canonical economics reject recomputed-digest rule tampering',async()=>{
 const c=projectGameplayContext(encounter('repair'),identity)
 for(const code of ['immediate','future','total']) {
  const bad=structuredClone(c);bad.facts.find(f=>f.code===code)!.value+=1
  assert.throws(()=>parseGameplayContext(bad))
 }
 const bank=projectGameplayContext(encounter('bank'),identity),bad=structuredClone(bank);bad.facts.find(f=>f.code==='rate')!.value=9999;assert.throws(()=>parseGameplayContext(bad))
})
test('quote selectors: owned stocks/gold, fees/spread, actual business and course purchase',()=>{
 for(const asset of ['stocks','gold'] as const){
  const s=encounter(asset),bought=transact(s,{kind:'buy',asset,amount:1_000_000,symbolId:s.market.stocks[0].id})
  const c=projectGameplayContext({...bought,phase:'rebalancing'},identity),q=saleQuote(bought,asset)
  for(const code of ['gross','fee','spread','net'] as const)assert.equal(c.facts.find(f=>f.code===code&&f.subject===asset)!.value,q[code])
 }
 const s=encounter('business'),owned=transact(s,{kind:'buy',asset:'business',amount:20_000_000})
 const c=projectGameplayContext({...owned,phase:'event',eventId:'business'},identity)
 assert.equal(c.facts.find(f=>f.code==='businessIncome')!.value,businessOverview(owned).income)
 assert.ok(!c.actions.includes('upgrade'));assert.ok(!c.actions.includes('sell'))
 const course=decide(encounter('course'),'course-basic');assert.equal(course.recurringIncome,16_000_000)
})
test('bank rates and existing lot interest use pinned selectors, no new deposit implied',()=>{
 const bank=encounter('bank'),s={...bank,lap:1 as number,deposits:[{id:'deposit-1',principal:1_000_000,rate:.04,startLap:1,maturityLap:1,status:'active' as const,earnedInterest:0}]}
 const c=projectGameplayContext(s,identity)
 assert.equal(c.facts.find(f=>f.code==='interest')!.value,depositPreview(bank,1_000_000,1).interest)
 assert.equal(c.facts.find(f=>f.code==='lost')!.value,40_000)
})
test('core single-course supported; C20 and mismatched versions fail closed',()=>{
 const core=advance(createCoreMvpGame('core',0));assert.equal(projectGameplayContext(core,identity).profile,'core-mvp-b18-v1')
 assert.throws(()=>projectGameplayContext(createPlayerGame('legacy',0),identity))
 const s=encounter('bonds');for(const changed of [{bondRulesVersion:'v2.4-single-issuer' as const},{encounterRulesVersion:'legacy-multi-action' as const},{businessRulesVersion:'v2.2-trend-shock' as const}])assert.throws(()=>projectGameplayContext({...s,...changed},identity))
 assert.throws(()=>projectGameplayContext({...s,eventId:'gold'},identity))
})
test('missing revealed macro evidence and no holding comparison fall back',async()=>{
 const s=encounter('credit-tightening'),c=projectGameplayContext({...s,log:[]},identity)
 assert.equal((await answerGameplay(await createGameplayRequest(c,'Tin kinh tế này có nghĩa gì?','req'))).reason,'missing-data')
 const gold=projectGameplayContext(encounter('gold'),identity)
 assert.equal((await answerGameplay(await createGameplayRequest(gold,'Báo giá bán vàng hiện tại','req'))).reason,'missing-data')
})
test('session/revision/exact question mutation, extra keys and response substitution rejected',async()=>{
 const req=await createGameplayRequest(projectGameplayContext(encounter('bank'),identity),'Tiết kiệm là gì?','request')
 for(const changed of [{revision:10},{question:req.question+' '},{extra:'seed'}])await assert.rejects(parseGameplayRequest({...req,...changed}))
 await assert.rejects(validateGameplayResponse({...await answerGameplay(req),extra:'ignored'},req))
 assert.throws(()=>parseGameplayContext({...req.context,actions:['buy']}))
})
test('settlement funding pause exposes posted obligations, not completed receipts',()=>{
 const s=phaseState('rolling')
 const poor={...s,portfolio:{...s.portfolio,cash:0},obligations:20_000_000}
 const paused=beginSettlement(poor),c=projectGameplayContext(paused,identity)
 assert.equal(c.domain,'funding');assert.equal(paused.pendingPayment!.origin,'settlement');assert.deepEqual(c.entries,paused.settlement!.lines)
 assert.equal(c.facts.find(f=>f.code==='remaining')!.value,paused.pendingPayment!.remaining)
})
test('review: reject financial facts from another domain or with an unrelated subject',async()=>{
 const cases=[
  ['bank',{code:'courseCost',subject:'basic',value:1}],
  ['bank',{code:'price',subject:'FPT',value:1}],
  ['stocks',{code:'rate',subject:'term-1',value:9999}],
  ['gold',{code:'creditState',subject:'an-tam',value:1}],
  ['bonds',{code:'coupon',subject:'gold',value:1}],
  ['bonds',{code:'price',subject:'FPT',value:1}],
  ['business',{code:'incremental',subject:'gold',value:1}],
  ['course',{code:'courseCost',subject:'upgrade',value:1}],
  ['repair',{code:'immediate',subject:'upgrade',value:1}],
 ] as const
 for(const [id,fact]of cases){const c=projectGameplayContext(encounter(id),identity);c.facts.push(fact);assert.throws(()=>parseGameplayContext(c),id);await assert.rejects(createGameplayRequest(c,'Tiết kiệm là gì?','bad-request'))}
})
test('review: reject missing primary observations and inconsistent published price changes',()=>{
 for(const id of ['stocks','gold','bonds']){
  const c=projectGameplayContext(encounter(id),identity);c.facts=c.facts.filter(f=>f.code!=='holding');assert.throws(()=>parseGameplayContext(c),id)
 }
 const macro=projectGameplayContext(encounter('credit-tightening'),identity);macro.facts.find(f=>f.code==='change')!.value++;assert.throws(()=>parseGameplayContext(macro))
 const funding=projectGameplayContext(phaseState('funding'),identity);funding.facts=funding.facts.filter(f=>f.code!=='paymentTotal');assert.throws(()=>parseGameplayContext(funding))
})
test('review: observed bond credit status and executable lot quotes stay distinct',async()=>{
 const initial=encounter('bonds'),bought=transact(initial,{kind:'buy',asset:'bonds',issuerId:'an-tam',amount:1_000_000})
 for(const [i,status]of (['performing','delayed','defaulted','resolved'] as const).entries()){
  const s=structuredClone(bought);s.phase='event';s.eventId='bonds';s.bondCredit!.issuers.find(x=>x.id==='an-tam')!.status=status
  const c=projectGameplayContext(s,identity);assert.equal(c.facts.find(f=>f.code==='creditState'&&f.subject==='an-tam')!.value,i)
  assert.equal(c.facts.some(f=>f.code==='net'&&f.subject==='lot-1'),i<2)
  const a=await answerGameplay(await createGameplayRequest(c,'Nếu trái phiếu bị chậm trả thì sao?','credit-request'));assert.equal(a.status,'answered');assert.match(a.explanation,/không phải tiền mặt đã nhận/)
 }
})
test('review: insufficient cash does not advertise optional purchases or upgrades',()=>{
 for(const id of ['bank','stocks','gold','bonds','business','course']){
  const s=encounter(id);s.portfolio.cash=0;const c=projectGameplayContext(s,identity)
  assert.ok(!c.actions.some(a=>['buy','deposit','upgrade','course-basic','course-advanced'].includes(a)),id)
 }
 const s=encounter('repair');s.portfolio.cash=0;const c=projectGameplayContext(s,identity)
 assert.equal(c.facts.find(f=>f.code==='shortfall'&&f.subject==='full')!.value,4_000_000);assert.ok(c.resources.includes('debt'))
})