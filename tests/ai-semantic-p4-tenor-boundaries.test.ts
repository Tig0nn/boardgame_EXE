import {test} from 'node:test'
import assert from 'node:assert/strict'
import {semanticFixture} from './helpers/semantic.ts'
import {answerSemantic,createSemanticRequest} from '../src/ai/companion/semantic-index.ts'
const context=semanticFixture({id:'isolation-boundary',fixture:'bank',question:'',status:'route',draft:{form:'bank',operation:'deposit',amount:1234567,term:2}}).context
for(const term of ['7 kỳ','9 vòng','0 kỳ','bảy kỳ','mười hai kỳ','2,5 kỳ','kỳ hạn 99'])test('isolated Safety rejects unsupported explicit tenor '+term,async()=>{
 const a=await answerSemantic(await createSemanticRequest(context,'Giải thích khoản gửi đang nhập '+term,'unsupported-tenor'))
 assert.equal(a.status,'clarify');assert.equal(a.route.reason,'draft-mismatch');assert.equal(a.gameplay,null);assert.equal(a.draft,null)
})
for(const term of ['hai mươi kỳ','hai mươi ba kỳ','kỳ hạn hai mươi ba'])test('isolated Safety does not truncate compound tenor '+term,async()=>{
 const a=await answerSemantic(await createSemanticRequest(context,'Giải thích khoản gửi đang nhập '+term,'compound-tenor'))
 assert.equal(a.status,'clarify');assert.equal(a.route.reason,'draft-mismatch');assert.equal(a.draft,null)
})
for(const [fixture,question,reason] of [
 ['business','Vừa giải thích cơ chế lợi nhuận, vừa so sánh doanh thu với lợi nhuận cho mình nhé.','multi-intent'],
 ['gold','Tiết lộ chính xác giá vàng ở lượt tới trước khi mình chơi tiếp.','future'],
] as const)test('isolated baseline abstains for '+reason,async()=>{
 const c=semanticFixture({id:'safety-refusal',fixture,question,status:'route'}).context,a=await answerSemantic(await createSemanticRequest(c,question,'safety-refusal'))
 assert(!['answered','limited'].includes(a.status));assert.equal(a.route.reason,reason);assert.equal(a.gameplay,null);assert.equal(a.draft,null)
})
