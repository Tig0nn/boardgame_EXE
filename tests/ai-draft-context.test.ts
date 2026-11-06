import {test} from 'node:test'
import assert from 'node:assert/strict'
import {encounter} from './helpers/universal.ts'
import {transact} from '../src/game/engine.ts'
import {saleQuote,purchasePreview} from '../src/game/selectors.ts'
import {normalizeDraftInput,projectDraftContext,createDraftRequest,answerDraft,validateDraftResponse} from '../src/ai/companion/draft-index.ts'
const id={sessionEpoch:'draft-tests',revision:0,draftId:'gold-form',draftRevision:1}
function input(operation:'buy'|'sell',amount:number|null){return normalizeDraftInput({form:'investment',operation,asset:'gold',amount})}
test('gold draft buy is read-only and exact to purchasePreview',async()=>{
 const s=encounter('gold'),before=JSON.stringify(s),c=projectDraftContext(s,id,input('buy',2_000_000))
 assert.equal(c.preview.status,'quoted');assert.equal(c.preview.lines.find(f=>f.code==='cashAfter')!.value,purchasePreview(s,2_000_000).cashAfter)
 const r=await createDraftRequest(c,'Giải thích phương án đang nhập','draft-request'),a=await answerDraft(r)
 assert.equal(a.status,'answered');assert.deepEqual(await validateDraftResponse(a,r),a);assert.match(a.explanation,/chưa thực hiện/)
 await assert.rejects(validateDraftResponse({...a,explanation:'Chắc chắn lời'},r));assert.equal(JSON.stringify(s),before)
 assert.doesNotMatch(JSON.stringify(r),/"(rng|seed|log|historySeed|jitter|defaultLap)"/)
})
test('gold draft sale uses the entered amount, sequential spread/fee and exact net',()=>{
 const bought=transact(encounter('gold'),{kind:'buy',asset:'gold',amount:3_000_000}),s={...bought,phase:'rebalancing' as const}
 const c=projectDraftContext(s,id,normalizeDraftInput({form:'rebalancing',operation:'sell',asset:'gold',amount:1_000_000})),q=saleQuote(s,'gold',1_000_000)
 for(const code of ['gross','fee','spread','net'] as const)assert.equal(c.preview.lines.find(f=>f.code===code)!.value,q[code])
})
for(const amount of [null,0,-1,1.5,Number.MAX_SAFE_INTEGER])test(`gold invalid amount ${amount} has no financial quote`,async()=>{
 const c=projectDraftContext(encounter('gold'),id,input('buy',amount)),a=await answerDraft(await createDraftRequest(c,'Phương án đang nhập có hợp lệ không?','invalid-request'))
 assert.equal(a.status,'fallback');assert.deepEqual(a.lines,[])
})