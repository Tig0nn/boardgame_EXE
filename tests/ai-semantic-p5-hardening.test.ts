import {test} from 'node:test'
import assert from 'node:assert/strict'
import {acceptanceFixture} from './helpers/semantic-p4.ts'
import type {AcceptanceCase} from './helpers/semantic-p4.ts'
import {createSemanticRequest,answerSemantic,validateSemanticResponse} from '../src/ai/companion/semantic-index.ts'
const bank={form:'bank',operation:'deposit',amount:1_400_000,term:2} as const
const goldFunding={form:'funding',operation:'fund',source:'gold',amount:140_000} as const
async function example(question:string,fixture='bank',draft:AcceptanceCase['draft']=bank){
 const f=acceptanceFixture({id:'hardening',fixture,question,draft,expected:'correct-answer'}),before=JSON.stringify(f.state)
 const request=await createSemanticRequest(f.context,f.question,'hardening'),response=await answerSemantic(request)
 assert.equal(JSON.stringify(f.state),before);assert.deepEqual(await validateSemanticResponse(response,request),response)
 if(response.draft?.status==='answered'){
  assert.deepEqual(response.draft.lines,f.context.draft!.preview.lines)
  assert.equal(response.draft.draftId,request.context.draft!.draftId);assert.equal(response.draft.draftRevision,request.context.draft!.draftRevision)
 }
 return {request,response,context:f.context}
}
for(const q of [
 'Nếu phải rút trước hạn, khoản gửi đang điền có điều gì đáng dè chừng?',
 'Trường hợp phải rút sớm, điểm bất lợi của bản nháp gửi này?',
 'Khoản tiết kiệm đang chọn có điều gì phải dè chừng khi rút trước hạn?',
 'Khi cần rút tiết kiệm trước hạn, bản nháp gửi hiện tại có bất lợi nào?',
 'Điểm bất lợi khi buộc rút sớm của giá trị này?',
])test('hardening risk intent survives draft scope without a cash result request: '+q,async()=>{
 const {response:a}=await example(q)
 assert.equal(a.status,'answered');assert.equal(a.route.intent,'risk');assert.equal(a.route.scope,'draft')
 assert.match(a.notice,/rút sớm.*mất lãi/);assert.doesNotMatch(a.draft!.conclusion,/Dòng tiền/)
})
for(const term of ['chênh lệch mua bán','chênh lệch mua–bán','chênh lệch giá mua - bán','chênh lệch giữa giá mua và giá bán','spread mua/bán'])test('hardening spread terminology uses one validated funding quote: '+term,async()=>{
 const {response:a,context}=await example('Phần '+term+' của nguồn vàng đang điền trừ bao nhiêu tiền?', 'funding',goldFunding)
 assert.equal(a.status,'answered');assert.equal(a.route.scope,'draft');assert.equal(a.route.intent,'cashflow')
 assert.match(a.draft!.explanation,/Chênh lệch mua–bán/);assert.match(a.draft!.explanation,/Phí bán/)
 assert.deepEqual(a.draft!.lines,context.draft!.preview.lines)
})
for(const q of ['Giải thích chênh lệch mua–bán trong cơ chế vàng giúp nhé.','Spread mua bán của vàng vận hành theo cơ chế nào?'])test('hardening general spread mechanism stays on actual context: '+q,async()=>{
 const {response:a}=await example(q,'gold',null);assert.equal(a.status,'answered');assert.equal(a.route.scope,'actual');assert.equal(a.route.intent,'explain');assert.equal(a.draft,null);assert(a.gameplay)
})
for(const q of [
 'Mua vàng rồi bán vàng đang nhập, phần chênh lệch mua bán trừ bao nhiêu?',
 'Hãy mua vàng rồi bán vàng, giải thích spread mua bán đang chọn.',
 'Giải thích chênh lệch mua rồi bán vàng đang nhập.',
 'Bán vàng đang chọn có chịu chênh lệch mua–bán không?',
 'Chênh lệch mua–bán khi mua cổ phiếu 1,4 triệu đang nhập ra sao?',
 'Phần chênh lệch mua–bán của mua vàng 1,5 triệu đang chọn là bao nhiêu?',
])test('hardening technical terms never erase independent trade constraints: '+q,async()=>{
 const {response:a}=await example(q,'gold',{form:'investment',operation:'buy',asset:'gold',amount:1_400_000})
 assert(!['answered','limited'].includes(a.status));assert.equal(a.draft,null);assert.equal(a.gameplay,null)
})
for(const q of [
 'Khoản gửi ba kỳ đang điền có gì dè chừng nếu phải rút sớm?',
 'Điểm bất lợi nếu rút trước hạn khoản gửi 1,5 triệu đang chọn?',
 'Nếu rút sớm bản nháp gửi thì ví sẽ còn lại bao nhiêu?',
 'Nếu rút trước hạn khoản đang chọn thì tiền thực nhận là bao nhiêu?',
 'Nếu muốn rút sớm thì hãy thực hiện rút khoản tiết kiệm đang chọn.',
 'Nếu phải rút trước hạn, chuyển bản nháp sang bán vàng có bất lợi gì?',
])test('hardening risk words cannot bypass tenor, amount or operation mismatches: '+q,async()=>{
 const {response:a}=await example(q);assert(!['answered','limited'].includes(a.status));assert.equal(a.draft,null);assert.equal(a.gameplay,null)
})
test('hardening source constraint remains authoritative next to a spread term',async()=>{
 const {response:a}=await example('Với nguồn bán vàng đang chọn, chênh lệch mua bán là bao nhiêu?','funding',{form:'funding',operation:'fund',source:'debt',amount:140_000})
 assert.equal(a.status,'clarify');assert.equal(a.route.reason,'draft-mismatch');assert.equal(a.draft,null)
})
test('hardening spread query without selected form cannot invent an amount-specific quote',async()=>{
 const {response:a}=await example('Tính chênh lệch mua–bán vàng cho 140 nghìn đồng.','gold',null)
 assert.equal(a.status,'clarify');assert.equal(a.draft,null);assert.equal(a.gameplay,null)
})
test('hardening response identity and quote tampering are still rejected',async()=>{
 const {request,response:a}=await example('Phần chênh lệch mua–bán ở nguồn vàng đang nhập là bao nhiêu tiền?','funding',goldFunding)
 assert.equal(a.status,'answered')
 await assert.rejects(validateSemanticResponse({...a,draft:{...a.draft!,draftRevision:a.draft!.draftRevision+1}},request))
 await assert.rejects(validateSemanticResponse({...a,draft:{...a.draft!,lines:a.draft!.lines.map((l,i)=>i===0?{...l,value:l.value+1}:l)}},request))
 await assert.rejects(validateSemanticResponse({...a,revision:a.revision+1},request))
})
