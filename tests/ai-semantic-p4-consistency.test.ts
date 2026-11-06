import {test} from 'node:test'
import assert from 'node:assert/strict'
import {semanticFixture} from './helpers/semantic.ts'
import {extractExplicitSlots,assertSemanticPayloadConsistency} from '../src/ai/companion/semantic/safety.ts'
import {createSemanticRequest,answerSemantic} from '../src/ai/companion/semantic-index.ts'
test('explicit term slots handle both orders and preserve conflicts',()=>{
 const c=semanticFixture({id:'s',fixture:'bank',question:'',status:'route',draft:{form:'bank',operation:'deposit',amount:1234567,term:2}}).context
 for(const q of ['kỳ hạn 3','3 kỳ','kỳ hạn ba','ba kỳ'])assert.deepEqual(extractExplicitSlots(q,c).terms,[3])
 assert.deepEqual(extractExplicitSlots('2 kỳ và kỳ hạn 3',c).terms,[2,3])
})
test('final quote identity and exact line defense rejects corrupted delivery even with valid shapes',async()=>{
 const c=semanticFixture({id:'c',fixture:'gold',question:'',status:'route',draft:{form:'investment',operation:'buy',asset:'gold',amount:2000000}}).context,r=await createSemanticRequest(c,'Giải thích phương án đang nhập','guard'),a=await answerSemantic(r)
 assert(a.draft);for(const d of [{...a.draft,draftRevision:9},{...a.draft,draftId:'another'},{...a.draft,lines:[...a.draft.lines,{code:'cashAfter' as const,value:99}]}])assert.throws(()=>assertSemanticPayloadConsistency(r,a.route,null,d))
 assert.throws(()=>assertSemanticPayloadConsistency({...r,question:'Mua 3 triệu đang nhập thì ví còn bao nhiêu?'},a.route,null,a.draft))
})
test('off-game explicit symbol requests reject before asking for a draft',async()=>{
 const c=semanticFixture({id:'o',fixture:'stocks',question:'',status:'route'}).context,a=await answerSemantic(await createSemanticRequest(c,'Tư vấn mã cổ phiếu ngoài đời để mình mua bằng tiền thật ngay hôm nay.','outside'))
 assert.equal(a.route.reason,'outside-game');assert.equal(a.status,'fallback');assert.equal(a.draft,null)
})
