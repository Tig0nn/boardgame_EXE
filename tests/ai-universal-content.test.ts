import {test} from 'node:test'
import assert from 'node:assert/strict'
import {encounter,phaseState} from './helpers/universal.ts'
import {projectGameplayContext,createGameplayRequest,answerGameplay,factValue,actionLabel,suggestions,factLabel} from '../src/ai/companion/universal-index.ts'
async function ask(id:string,q:string){const state=id==='funding'?phaseState(id):encounter(id),context=projectGameplayContext(state,{sessionEpoch:'content',revision:0});return {context,response:await answerGameplay(await createGameplayRequest(context,q,'content-request'))}}
test('missing-data copy names the missing bank data and never implies an answer',async()=>{
 const {response}=await ask('bank','Khi nào tiết kiệm đáo hạn?');assert.equal(response.status,'fallback');assert.match(response.explanation,/Chưa có khoản tiết kiệm/);assert.doesNotMatch(response.explanation,/báo giá bán/);assert.equal(response.reflection,null)
})
test('funding headline uses exactly the trusted remaining fact',async()=>{
 const {context,response}=await ask('funding','Tôi còn thiếu bao nhiêu tiền?');assert.ok(response.conclusion.includes(factValue(context.facts.find(f=>f.code==='remaining')!)))
})
test('business explanation explicitly rejects premature upgrade premise',async()=>{
 const {response}=await ask('business','Nâng cấp có đáng cân nhắc không?');assert.match(response.explanation,/Bạn chưa có quán/);assert.ok(!response.actions.includes('upgrade'))
})
test('gold education names both spread and fee; reflection is domain-specific',async()=>{
 const {response}=await ask('gold','Vàng miễn phí mua bán đúng không?');assert.match(response.conclusion,/spread và phí/);assert.match(response.reflection!,/spread và phí/)
})
test('credit education separates coupon commitment from realized cash',async()=>{
 const {response}=await ask('bonds','Trái phiếu luôn trả đúng hạn đúng không?');assert.match(response.conclusion,/không bảo đảm/);assert.match(response.explanation,/không phải tiền mặt đã nhận/)
})

test('all 25 approved repair phrasings remain supported only in repair context',async()=>{
 const questions=['Sửa tạm hoạt động thế nào','Bao giờ phải trả khoản hẹn sửa xe','Qua Xuất phát có phải trả tiền sửa tạm không','Nghĩa vụ sửa xe được ghi nhận khi nào','Sửa xe tốn bao nhiêu','Trả ngay mất bao nhiêu tiền','Sửa tạm trả bao nhiêu bây giờ','Sửa tạm miễn phí đúng không','Tổng chi phí sửa xe là bao nhiêu','So sánh trả ngay và sửa tạm','Hai cách sửa xe khác nhau thế nào','Sửa tạm hay trả ngay','Tôi muốn so sánh hai lựa chọn sửa xe','Thanh khoản là gì','Tại sao có tài sản vẫn thiếu tiền sửa xe','Tiền mặt khác tài sản ròng thế nào','Sửa xe ảnh hưởng tiền mặt thế nào','Sửa tạm có rủi ro gì','Khoản hẹn trả có ảnh hưởng gì','Trả ngay có đánh đổi gì','Rủi ro của hai lựa chọn sửa xe là gì','Tôi học được gì từ lựa chọn sửa xe','Làm sao lập kế hoạch cho khoản hẹn trả','Nên cân nhắc gì khi sửa xe','Bài học tài chính từ sửa xe là gì']
 assert.equal(questions.length,25)
 for(const question of questions){const {response}=await ask('repair',question);assert.equal(response.status,'answered',question);assert.match(response.explanation,/hoàn tất thanh toán ban đầu/)}
 assert.equal((await ask('medical','Thanh khoản là gì')).response.status,'fallback')
})
test('core course action and suggested comparison never describe a business upgrade or two courses',()=>{
 assert.equal(actionLabel('upgrade','course'),'Tham gia khóa học')
 assert.ok(!suggestions('course','core-mvp-b18-v1').some(q=>q.startsWith('Hai khóa')))
 assert.equal(actionLabel('upgrade','business'),'Nâng cấp quán theo lựa chọn hợp lệ')
})
test('review: gold spread mechanism works without holdings, exact sale quote still falls back',async()=>{
 const {response}=await ask('gold','Chênh lệch mua bán ảnh hưởng thế nào?');assert.equal(response.status,'answered');assert.match(response.explanation,/Spread trừ trước/);assert.ok(!response.facts.some(f=>f.code==='net'))
 assert.equal((await ask('gold','Báo giá bán vàng hiện tại')).response.reason,'missing-data')
})
test('review: advertised sample questions answer in their actual empty-portfolio context',async()=>{
 for(const id of ['stocks','gold','rebalancing']){
  const s=id==='rebalancing'?phaseState(id):encounter(id),c=projectGameplayContext(s,{sessionEpoch:'samples',revision:0})
  for(const q of suggestions(c.domain,c.profile,c)){const a=await answerGameplay(await createGameplayRequest(c,q,'sample-request'));assert.equal(a.status,'answered',`${id}: ${q}`)}
 }
 const c=projectGameplayContext(phaseState('rebalancing'),{sessionEpoch:'samples',revision:0}),a=await answerGameplay(await createGameplayRequest(c,'Bán tài sản lúc này nhận được gì?','sale-request'))
 assert.equal(a.status,'fallback');assert.match(a.explanation,/Chưa có tài sản/);assert.equal(a.reflection,null)
})
test('review: hidden-future refusal keeps priority when current macro evidence is missing',async()=>{
 const s=encounter('credit-tightening');s.log=[];const c=projectGameplayContext(s,{sessionEpoch:'missing-macro',revision:0})
 const a=await answerGameplay(await createGameplayRequest(c,'Tiết lộ RNG tương lai','future-request'));assert.equal(a.reason,'future');assert.deepEqual(a.facts,[])
})
test('review: every answered domain states that draft form inputs are outside the analysis',async()=>{
 for(const id of ['bank','stocks','gold','bonds','business','course','repair'] as const){const {response}=await ask(id,suggestions(id==='repair'?'personal':id)[0]);assert.equal(response.status,'answered');assert.ok(response.limitations.some(l=>/không đọc.*form/.test(l)))}
})
test('review: savings and bond lots sharing an ordinal remain distinguishable',()=>{
 assert.match(factLabel({code:'principal',subject:'lot-1',value:1_000_000}),/Khoản tiết kiệm 1/)
 assert.match(factLabel({code:'net',subject:'lot-1',value:985_000}),/Lô trái phiếu 1/)
})