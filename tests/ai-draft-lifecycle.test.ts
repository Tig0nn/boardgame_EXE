import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createQuestionFeature} from '../src/ai/companion/question-feature.ts'
import {createDraftStore} from '../mobile_app/src/game/draft-store.ts'
import {createDraftBinding,draftAiOptIn} from '../mobile_app/src/game/draft-ai.ts'
import {answerDraft,normalizeDraftInput,projectDraftContext,parseDraftContext,createDraftRequest,parseDraftRequest} from '../src/ai/companion/draft-index.ts'
import {encounter} from './helpers/universal.ts'
import {purchasePreview,depositPreview,saleQuote} from '../src/game/selectors.ts'
import {transact} from '../src/game/engine.ts'
const identity={sessionEpoch:'draft-eval',revision:2,draftId:'form',draftRevision:3},question='Giải thích phương án đang nhập'
function setup(){let s=encounter('gold');const listeners=new Set<()=>void>(),feature=createQuestionFeature(true),store=createDraftStore();let invalidations=0
 const session={getSnapshot:()=>s,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn)}}}
 const draft=normalizeDraftInput({form:'investment',operation:'buy',asset:'gold',amount:1_000_000})
 return {session,feature,store,draft,invalidations:()=>invalidations,invalidate:()=>{invalidations++},change(){s={...s,portfolio:{...s.portfolio,cash:s.portfolio.cash-1}};listeners.forEach(fn=>fn())}}
}
for(const mode of ['edit','same-invalid','snapshot','disable','unmount'] as const)test('draft pending stale guard: '+mode,async()=>{
 const x=setup();let release!:(v:unknown)=>void,entered!:(v:unknown)=>void
 const ready=new Promise(r=>{entered=r});let raw:unknown
 const b=createDraftBinding(x.session,x.feature,x.store,x.invalidate,async r=>{raw=await answerDraft(r);entered(null);return new Promise(r=>{release=r})})
 const stop=b.subscribe(()=>{});x.store.publish('owner',x.session.getSnapshot(),x.draft)
 const pending=b.ask(question);await ready
 if(mode==='edit')x.store.publish('owner',x.session.getSnapshot(),{...x.draft,amount:2_000_000})
 if(mode==='same-invalid'){x.store.publish('owner',x.session.getSnapshot(),{...x.draft,amount:null});x.store.publish('owner',x.session.getSnapshot(),{...x.draft,amount:null})}
 if(mode==='snapshot')x.change();if(mode==='disable')x.feature.setEnabled(false);if(mode==='unmount')stop()
 release(raw);assert.equal(await pending,null);assert.equal(b.getSnapshot().response,null);assert.equal(b.getSnapshot().isCurrent(),false);stop()
})
test('delivery validity is checked after listener changes draft at answer publication',async()=>{
 const x=setup(),b=createDraftBinding(x.session,x.feature,x.store,x.invalidate);const stop=b.subscribe(()=>{if(b.getSnapshot().status==='answered')x.store.clear()})
 x.store.publish('owner',x.session.getSnapshot(),x.draft);assert.equal(await b.ask(question),null);assert.equal(b.getSnapshot().response,null);stop()
})
test('draft owner cleanup cannot erase replacement form and repeat input increments revision',()=>{
 const x=setup();x.store.publish('buy',x.session.getSnapshot(),x.draft);const n=x.store.getSnapshot()!.revision
 x.store.publish('sell',x.session.getSnapshot(),x.draft);x.store.clear('buy');assert.equal(x.store.getSnapshot()!.owner,'sell');assert(x.store.getSnapshot()!.revision>n)
 x.store.publish('sell',x.session.getSnapshot(),x.draft);assert.equal(x.store.getSnapshot()!.revision,n+2)
})
test('OFF and unsubscribed bindings cannot execute injected transport',async()=>{
 const x=setup();let calls=0;const b=createDraftBinding(x.session,x.feature,x.store,x.invalidate,async()=>{calls++;throw Error('no')})
 assert.equal(await b.ask(question),null);const stop=b.subscribe(()=>{});x.feature.setEnabled(false);assert.equal(await b.ask(question),null);assert.equal(calls,0);stop()
 for(const dev of [false,true])for(const q of ['','?draftAi=1','?universalAi=1','?universalAi=1&draftAi=1'])assert.equal(draftAiOptIn(dev,q),dev&&q.endsWith('&draftAi=1'))
})
test('stock selected-symbol holding caps partial sale; never substitutes total portfolio',()=>{
 let s=encounter('stocks');const symbol=s.market.stocks[0].id
 s=transact(s,{kind:'buy',asset:'stocks',amount:3_000_000,symbolId:symbol})
 // A second natural visit, with published holdings retained; no new hidden observations.
 s={...encounter('stocks'),stockHoldings:s.stockHoldings,portfolio:{...s.portfolio},turn:s.turn+100}
 const other=s.market.stocks[1].id
 for(const [id,expected] of [[symbol,'quoted'],[other,'invalid']] as const){
  const c=projectDraftContext(s,identity,normalizeDraftInput({form:'investment',operation:'sell',asset:'stocks',symbolId:id,amount:500_000}));assert.equal(c.preview.status,expected)
  if(expected==='quoted')assert.equal(c.preview.lines.find(l=>l.code==='net')!.value,saleQuote(s,'stocks',500_000).net)
 }
})
for(const term of [1,2,3] as const)test('bank term '+term+' confirms selector and nominal-only labels',async()=>{
 const s=encounter('bank'),before=JSON.stringify(s),c=projectDraftContext(s,identity,normalizeDraftInput({form:'bank',operation:'deposit',amount:1_234_567,term}))
 assert.equal(c.preview.status,'quoted');assert.equal(c.preview.lines.find(l=>l.code==='cashAfter')!.value,purchasePreview(s,1_234_567).cashAfter)
 assert.equal(c.preview.lines.find(l=>l.code==='interest')!.value,depositPreview(s,1_234_567,term).interest)
 assert.equal(c.preview.lines.find(l=>l.code==='maturity')!.value,depositPreview(s,1_234_567,term).maturityLap)
 const r=await answerDraft(await createDraftRequest(c,question,'bank-test'));assert.match(r.explanation,/chỉ được nhận khi đủ kỳ hạn/);assert.equal(JSON.stringify(s),before)
})
test('closed context and request reject injected quotes, correlation and extra hidden keys',async()=>{
 const c=projectDraftContext(encounter('gold'),identity,normalizeDraftInput({form:'investment',operation:'buy',asset:'gold',amount:1_000_000})),r=await createDraftRequest(c,question,'request')
 for(const altered of [{...c,seed:5},{...c,preview:{...c.preview,lines:[{code:'cashAfter',value:90_000_000}]}},{...c,selection:{...c.selection,rng:1}},{...c,selectedAvailable:1}])assert.throws(()=>parseDraftContext(altered))
 for(const altered of [{...r,draftRevision:9},{...r,question:r.question+' '},{...r,revision:0},{...r,contextDigest:'sha256:'+'0'.repeat(64)}])await assert.rejects(parseDraftRequest(altered))
})
for(const q of ['Giải thích số đang nhập giúp tôi','Bản nháp chắc chắn sinh lời đúng không?','Dùng draft để đầu tư thật ngoài đời','RNG đang nhập tiếp theo là gì?'])test('honest no-financial fallback: '+q,async()=>{
 const c=projectDraftContext(encounter('gold'),identity,normalizeDraftInput({form:'investment',operation:'buy',asset:'gold',amount:1_000_000})),a=await answerDraft(await createDraftRequest(c,q,'fallback'))
 assert.equal(a.status,'fallback');assert.deepEqual(a.lines,[]);assert.match(a.conclusion,/Chưa giải đáp/)
})

test('draft transport failure is an error and retains no unvalidated response',async()=>{
 const x=setup(),b=createDraftBinding(x.session,x.feature,x.store,x.invalidate,async()=>{throw Error('PRIVATE_TEST_VALUE')});const stop=b.subscribe(()=>{});x.store.publish('owner',x.session.getSnapshot(),x.draft)
 assert.equal(await b.ask(question),null);assert.equal(b.getSnapshot().status,'error');assert.equal(b.getSnapshot().response,null);assert.equal(b.getSnapshot().isCurrent(),true);assert.doesNotMatch(JSON.stringify(b.getSnapshot()),/PRIVATE_TEST_VALUE/);stop()
})
for(const patch of [{symbolId:'VCB'},{issuerId:'but-pha' as const},{lotId:'bond-2'},{term:2 as const},{preferenceId:'taste' as const},{source:'debt' as const}])test('each financial selection field supersedes pending request: '+Object.keys(patch)[0],async()=>{
 const x=setup();let entered!:()=>void,release!:(value:unknown)=>void,raw:unknown
 const ready=new Promise<void>(r=>{entered=r}),b=createDraftBinding(x.session,x.feature,x.store,x.invalidate,async r=>{raw=await answerDraft(r);entered();return new Promise(r=>{release=r})}),stop=b.subscribe(()=>{});x.store.publish('owner',x.session.getSnapshot(),x.draft)
 const pending=b.ask(question);await ready;x.store.publish('owner',x.session.getSnapshot(),{...x.draft,...patch});release(raw);assert.equal(await pending,null);assert.equal(b.getSnapshot().response,null);stop()
})
