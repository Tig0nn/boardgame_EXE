import {test} from 'node:test'
import assert from 'node:assert/strict'
import {encounter,phaseState} from './helpers/universal.ts'
import {eventsForGame} from '../src/data/events.ts'
import {projectGameplayContext, createGameplayRequest, answerGameplay, validateGameplayResponse, parseGameplayContext, suggestions} from '../src/ai/companion/universal-index.ts'

const identity={sessionEpoch:'test-session',revision:0}
for(const id of ['bank','stocks','bonds','gold','business','course'])test(`A: ${id} grounded answer and no hidden DTO`,async()=>{
  const s=encounter(id), before=JSON.stringify(s)
  const c=projectGameplayContext(s,identity)
  assert.equal(c.domain,id);assert.deepEqual(parseGameplayContext(c),c)
  assert.doesNotMatch(JSON.stringify(c),/"(rng|seed|log|historySeed|defaultLap|jitter)"/)
  const req=await createGameplayRequest(c,suggestions(id)[0],'test-request')
  const a=await answerGameplay(req)
  assert.equal(a.status,'answered');assert.ok(a.facts.length>0)
  assert.deepEqual(await validateGameplayResponse(a,req),a)
  await assert.rejects(validateGameplayResponse({...a,conclusion:'Đảm bảo có lãi'},req))
  assert.equal(JSON.stringify(s),before)
})
test('reject unsupported profiles and context injections',()=>{
  const c=projectGameplayContext(encounter('bank'),identity)
  assert.throws(()=>parseGameplayContext({...c,rng:123}))
  assert.throws(()=>projectGameplayContext({...encounter('bank'),gameplayProfile:undefined},identity))
})
test('honest unknown, multi-intent and future fallbacks',async()=>{
 const c=projectGameplayContext(encounter('gold'),identity)
 for(const q of ['Ngày mai giá vàng bao nhiêu?','Tôi nên mua vàng ngoài đời không?','Giải thích vàng và so sánh cổ phiếu','Lãi chắc chắn đúng không?']) {
  const a=await answerGameplay(await createGameplayRequest(c,q,'request'))
  assert.equal(a.status,'fallback');assert.equal(a.facts.length,0);assert.equal(a.reflection,null)
 }
})
for(const id of ['repair','medical','family','credit-tightening','demand-boom','supply-recovery'])test(`B: ${id} actual revealed facts`,async()=>{
 const s=encounter(id),c=projectGameplayContext(s,identity)
 const a=await answerGameplay(await createGameplayRequest(c,suggestions(c.domain)[0],'request'))
 assert.equal(a.status,'answered')
 if(c.domain==='personal') {
  for(const option of eventsForGame(s).find(e=>e.id===id)!.options) {
   assert.equal(c.facts.find(f=>f.code==='immediate'&&f.subject===option.id)!.value,option.cost??0)
   assert.equal(c.facts.find(f=>f.code==='future'&&f.subject===option.id)!.value,option.obligation??0)
   assert.equal(c.facts.find(f=>f.code==='total'&&f.subject===option.id)!.value,(option.cost??0)+(option.obligation??0))
  }
 }else assert.ok(c.facts.some(f=>f.code==='change'))
})
for(const phase of ['forecast','rolling','funding','summary','rebalancing'])test(`C: ${phase} facts and actual state`,async()=>{
 const s=phaseState(phase),c=projectGameplayContext(s,identity)
 const a=await answerGameplay(await createGameplayRequest(c,suggestions(c.domain)[0],'request'))
 assert.equal(a.status,'answered')
 if(phase==='funding')assert.equal(c.facts.find(f=>f.code==='remaining')!.value,s.pendingPayment!.remaining)
 if(phase==='summary')assert.deepEqual(c.entries,s.summaries.at(-1)!.lines)
 if(phase==='rebalancing')assert.ok(c.actions.includes('continue'))
})