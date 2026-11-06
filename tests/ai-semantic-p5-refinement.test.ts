import {test} from 'node:test'
import assert from 'node:assert/strict'
import {acceptanceFixture} from './helpers/semantic-p4.ts'
import type {AcceptanceCase} from './helpers/semantic-p4.ts'
import {answerSemantic,createSemanticRequest,validateSemanticResponse} from '../src/ai/companion/semantic-index.ts'
const bank={form:'bank',operation:'deposit',amount:1_600_000,term:2} as const
async function ask(question:string,fixture='bank',draft:AcceptanceCase['draft']=bank){
 const f=acceptanceFixture({id:'refinement',fixture,question,draft,expected:'correct-answer'}),before=JSON.stringify(f.state)
 const request=await createSemanticRequest(f.context,f.question,'refinement'),response=await answerSemantic(request)
 assert.deepEqual(await validateSemanticResponse(response,request),response);assert.equal(JSON.stringify(f.state),before)
 if(response.draft?.status==='answered')assert.deepEqual(response.draft.lines,f.context.draft!.preview.lines)
 return {response,context:f.context}
}
for(const q of ['Trong một vòng, thu nhập kinh doanh vào ví ở lúc nào?','Lương được cộng trong một vòng ra sao?','Chi phí sinh hoạt trong hai vòng được xử lý thế nào?'])test('refinement ordinary income-cycle description is actual: '+q,async()=>{
 const {response:a}=await ask(q,'business',null)
 assert.equal(a.route.status,'route');assert.equal(a.route.scope,'actual');assert.equal(a.route.term,null);assert(a.gameplay)
})
for(const q of ['Khoản gửi đang chọn có rủi ro gì khi cần rút trước hạn?','Nếu phải rút sớm thì bản nháp gửi tiết kiệm có mất lãi không?','Điều cần dè chừng của khoản gửi đang điền nếu phải rút tiết kiệm trước hạn là gì?'])test('refinement conditional withdrawal risk preserves deposit quote: '+q,async()=>{
 const {response:a}=await ask(q)
 assert.equal(a.status,'answered');assert.equal(a.route.intent,'risk');assert.equal(a.route.scope,'draft');assert.match(a.notice,/rút sớm|trước hạn/);assert(a.draft)
})
for(const q of [
 'Khoản gửi đang chọn có rủi ro gì nếu rút trước hạn 3 triệu?',
 'Khoản gửi đang chọn ba kỳ có rủi ro gì khi cần rút trước hạn?',
 'Nếu cần rút sớm hãy thực hiện rút tiết kiệm đang nhập.',
 'Tính số tiền thực nhận nếu rút sớm khoản đang nhập.',
 'Nếu phải rút sớm thì khoản gửi đang nhập nhận bao nhiêu?',
 'Rủi ro nếu rút sớm và bán vàng đang nhập là gì?',
 'Giải thích khoản gửi trong một vòng kỳ hạn ba đang nhập.',
 'Giải thích khoản gửi đang chọn trong ba vòng.',
 'Nếu rút trước hạn thì bản nháp có rủi ro gì, ví còn lại ra sao?',
])test('refinement conditional wording never bypasses actual mismatches: '+q,async()=>{
 const {response:a}=await ask(q);assert(!['answered','limited'].includes(a.status));assert.equal(a.draft,null);assert.equal(a.gameplay,null)
})
test('refinement an exact income amount over a numbered interval still needs suitable context',async()=>{
 const {response:a}=await ask('Tính chính xác thu nhập quán trong hai vòng là bao nhiêu?','business',null)
 assert(!['answered','limited'].includes(a.status));assert.equal(a.draft,null);assert.equal(a.gameplay,null)
})
for(const q of ['Giải thích ví sẽ bớt bao nhiêu sau khoản gửi đang điền?','Nếu gửi 1,6 triệu thì ví bớt đi và còn lại ra sao?','Khoản gửi đang chọn khiến tiền mặt còn lại thế nào?'])test('refinement direct cash outcome wins over generic explanation: '+q,async()=>{
 const {response:a}=await ask(q);assert.equal(a.status,'answered');assert.equal(a.route.intent,'cashflow');assert.match(a.draft!.explanation,/Dự kiến trả ngay/);assert.match(a.draft!.explanation,/Dự kiến tiền mặt sau giao dịch/)
})
for(const q of ['Vay một triệu đang chọn xong thì khoản bắt buộc còn thiếu thế nào?','Giải thích khoản huy động đang nhập làm nghĩa vụ còn lại bao nhiêu?'])test('refinement remaining payment is answered directly: '+q,async()=>{
 const {response:a}=await ask(q,'funding',{form:'funding',operation:'fund',source:'debt',amount:1_000_000})
 assert.equal(a.status,'answered');assert.equal(a.route.intent,'cashflow');assert.match(a.draft!.explanation,/Còn thiếu sau riêng bước/);assert.match(a.draft!.explanation,/Nợ gốc sau/)
})
for(const [q,fixture,draft,expected] of [
 ['Khoản gửi đang điền kỳ hạn ba có hợp lệ chứ?','bank',bank,/kỳ hạn.*3.*2/is],
 ['Khoản gửi đang điền một kỳ hoặc ba kỳ có hợp lệ chứ?','bank',bank,/kỳ hạn/],
 ['Giải thích mua mã $second với số tiền đang chọn','stocks',{form:'investment',operation:'buy',asset:'stocks',symbolId:'$first',amount:1_600_000},/mã cổ phiếu/i],
 ['Giải thích mua Bứt Phá ở bản nháp trái phiếu','bonds',{form:'investment',operation:'buy',asset:'bonds',issuerId:'an-tam',amount:1_600_000},/bên phát hành/],
 ['Giải thích hướng checkin đang nhập','business',{form:'business',operation:'upgrade',preferenceId:'taste',amount:5_000_000},/hướng nâng cấp/i],
 ['Giải thích bán vàng đang chọn để thanh toán','funding',{form:'funding',operation:'fund',source:'debt',amount:1_000_000},/nguồn huy động/i],
 ['Bán vàng 1,6 triệu đang điền sẽ thu được bao nhiêu?','gold',{form:'investment',operation:'buy',asset:'gold',amount:1_600_000},/thao tác/],
 ['Mua cổ phiếu với số tiền đang nhập giải thích thế nào?','gold',{form:'investment',operation:'buy',asset:'gold',amount:1_600_000},/tài sản/],
 ['Nếu gửi 1tr6 đang chọn ví sẽ còn thế nào?','bank',bank,/số tiền.*định dạng|định dạng.*số tiền/s],
 ['Nếu gửi 1.60.000 đồng đang chọn thì sao?','bank',bank,/số tiền.*định dạng|định dạng.*số tiền/s],
] as [string,string,AcceptanceCase['draft'],RegExp][])test('refinement clarification names the known constraint: '+q,async()=>{
 const {response:a}=await ask(q,fixture,draft);assert.equal(a.status,'clarify');assert.match(a.notice,expected);assert.equal(a.draft,null);assert.equal(a.gameplay,null)
})
test('refinement missing-profit notice identifies missing inputs without a quote',async()=>{
 const {response:a}=await ask('Chưa biết chi phí, tính lợi nhuận chính xác cho quán đi.','business',null)
 assert.match(a.notice,/doanh thu/);assert.match(a.notice,/chi phí/);assert.equal(a.draft,null);assert.equal(a.gameplay,null)
})
test('refinement explicit fee question uses the existing sale preview values',async()=>{
 const {response:a,context}=await ask('Phí bán vàng trong bản nháp là bao nhiêu?','funding',{form:'funding',operation:'fund',source:'gold',amount:100_000})
 assert.equal(a.status,'answered');assert.match(a.draft!.explanation,/Phí bán/);assert.match(a.draft!.explanation,/Chênh lệch mua–bán/)
 for(const code of ['fee','spread'])assert(a.draft!.lines.some(l=>l.code===code&&l.value===context.draft!.preview.lines.find(x=>x.code===code)!.value))
})
