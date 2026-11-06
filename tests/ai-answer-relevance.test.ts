import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from '../mobile_app/node_modules/vite/dist/node/index.js'
import react from '@vitejs/plugin-react'
import {acceptanceFixture} from './helpers/semantic-p4.ts'
import type {AcceptanceCase} from './helpers/semantic-p4.ts'
import {createSemanticRequest,answerSemantic,validateSemanticResponse} from '../src/ai/companion/semantic-index.ts'
import {createDraftRequest,answerDraft,DRAFT_QUESTIONS} from '../src/ai/companion/draft-index.ts'

async function ask(question:string,draft:AcceptanceCase['draft']=null,fixture='bank'){
 const f=acceptanceFixture({id:'answer-relevance',fixture,question,draft,expected:'correct-answer'}),request=await createSemanticRequest(f.context,question,'answer-relevance')
 return {f,request,response:await answerSemantic(request)}
}
const text=(html:string)=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()
const firstParagraph=(html:string)=>text(html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)?.[1]??'')
function containsMoney(s:string,value:number){
 const compact=value>=1_000_000&&value%1_000_000===0?(value/1_000_000).toLocaleString('vi-VN')+' triệu':null
 assert(s.includes(value.toLocaleString('vi-VN'))||compact!==null&&s.includes(compact),'Missing validated value '+value+' in '+s)
}
test('answer relevance uses risk-specific facts and leads with validated monetary results',async t=>{
 const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-ai-answer-relevance',plugins:[react(),{
  name:'answer-relevance-test',resolveId(id){if(id==='virtual:answer-relevance')return '\0answer-relevance'},
  load(id){if(id==='\0answer-relevance')return `
   import{createElement}from'react';import{renderToStaticMarkup}from'react-dom/server';
   import{SemanticAiResult}from'/mobile_app/src/components/SemanticAiResult.tsx';
   import{DraftAiResult}from'/mobile_app/src/components/DraftAiResult.tsx';
   export const render=(response,context,current=true)=>renderToStaticMarkup(createElement(SemanticAiResult,{view:{response,context,status:response.status,isCurrent:()=>current},active:true}));
   export const renderDraft=(response,context)=>renderToStaticMarkup(createElement(DraftAiResult,{view:{response,context,status:response.status,isCurrent:()=>true},active:true}));
  `},
 }],resolve:{dedupe:['react','react-dom']},server:{middlewareMode:true},appType:'custom'})
 try{
  const {render,renderDraft}=await server.ssrLoadModule('virtual:answer-relevance')
  for(const q of ['Rút trước hạn có làm mất lãi không?','Điều gì bất lợi nếu cần rút tiết kiệm trước hạn?','Tiết kiệm có rủi ro gì?'])await t.test('risk does not dump unrelated balance or obligations: '+q,async()=>{
   const {f,response:a}=await ask(q),html=render(a,f.context)
   assert.equal(a.status,'answered');assert.equal(a.route.intent,'risk');assert.match(text(html),/rút sớm.*mất lãi/i)
   assert(a.gameplay!.facts.some(f=>f.code==='cash'));assert(a.gameplay!.facts.some(f=>f.code==='obligations'))
   assert.doesNotMatch(html,/Tiền mặt hiện có|Nghĩa vụ đã cam kết|Giá trị ròng|Tiền có thể thanh lý/)
  })
  await t.test('draft risk does not show cash-after merely because a preview exists',async()=>{
   const {f,response:a}=await ask('Nếu phải rút trước hạn, bản nháp gửi có điểm bất lợi nào?',{form:'bank',operation:'deposit',amount:1_750_000,term:1}),html=render(a,f.context)
   assert.equal(a.route.intent,'risk');assert(a.draft!.lines.some(l=>l.code==='cashAfter'));assert.match(text(html),/rút sớm mất lãi/)
   assert.doesNotMatch(html,/Dự kiến tiền mặt sau giao dịch|Tiền mặt hiện có|Nghĩa vụ đã cam kết/)
  })
  await t.test('risk can still show cash when liquidity is explicitly asked, without unrelated obligations',async()=>{
   const {f,response:a}=await ask('Rủi ro thiếu tiền mặt khi gửi tiết kiệm là gì?'),html=render(a,f.context)
   assert.equal(a.status,'answered');assert.equal(a.route.intent,'risk');assert.match(html,/Tiền mặt hiện có/);assert.doesNotMatch(html,/Nghĩa vụ đã cam kết|Giá trị ròng/)
  })
  await t.test('risk can still show obligations when they are the question target',async()=>{
   const {f,response:a}=await ask('Rủi ro nghĩa vụ đã cam kết trong tình huống này là gì?'),html=render(a,f.context)
   assert.equal(a.status,'answered');assert.equal(a.route.intent,'risk');assert.match(html,/Nghĩa vụ đã cam kết/);assert.doesNotMatch(html,/Tiền mặt hiện có|Giá trị ròng/)
  })
  const cases=[
   [2_750_000,'Nộp khoản gửi đang điền xong thì tiền trong ví của mình còn bao nhiêu?'],
   [7_000_000,'Với khoản gửi đang chọn, ví còn lại mấy đồng?'],
   [13_000_000,'Tiền mặt còn lại sau phương án đang nhập là bao nhiêu?'],
   [485_000,'Giải thích giúp ví sau khoản gửi đang nhập còn bao nhiêu.'],
  ] as const
  for(const [amount,q] of cases)await t.test('balance result comes before mechanism, using exact preview values: '+amount,async()=>{
   const {f,response:a}=await ask(q,{form:'bank',operation:'deposit',amount,term:1}),html=render(a,f.context),lead=firstParagraph(html)
   assert.equal(a.status,'answered');assert.equal(a.route.intent,'cashflow')
   assert.match(lead,/^Sau khi gửi /);containsMoney(lead,a.draft!.lines.find(l=>l.code==='entered')!.value);containsMoney(lead,a.draft!.lines.find(l=>l.code==='cashAfter')!.value)
   assert.match(lead,/ví của bạn còn .* đồng\.$/);assert.doesNotMatch(lead,/tiền gốc|lãi|kỳ hạn/i)
   const main=html.split('<details>')[0];assert.doesNotMatch(main,/<dl|Lãi chỉ được nhận|Tiền gốc rời/);assert.match(html,/<details><summary>Xem thêm dữ kiện liên quan/)
  })
  await t.test('funding balance is scoped to this step and never presented as a final settlement',async()=>{
   const {f,response:a}=await ask('Sau nguồn vàng đang chọn, tiền mặt còn lại bao nhiêu?',{form:'funding',operation:'fund',source:'gold',amount:215_000},'funding'),html=render(a,f.context),lead=firstParagraph(html)
   assert.equal(a.status,'answered');assert.match(lead,/riêng bước|bước huy động/);containsMoney(lead,a.draft!.lines.find(l=>l.code==='cashAfterStep')!.value)
   assert.doesNotMatch(lead,/đã tất toán|đã hoàn tất sự kiện/);assert.match(text(html),/Chưa bao gồm bước tiếp tục sự kiện/)
  })
  await t.test('direct Draft cashflow has a validated result before mechanism copy too',async()=>{
   const {f}=await ask('Câu hỏi fixture',{form:'bank',operation:'deposit',amount:4_000_000,term:1}),request=await createDraftRequest(f.context.draft!,DRAFT_QUESTIONS[1],'direct-relevance'),a=await answerDraft(request),html=renderDraft(a,f.context.draft),lead=firstParagraph(html)
   assert.match(lead,/^Bạn dự kiến trả ngay|^Sau khi gửi/);containsMoney(lead,a.lines.find(l=>l.code==='payNow')!.value);assert.doesNotMatch(lead,/tiền gốc|lãi|kỳ hạn/i)
  })
  await t.test('amount mismatch never acquires an answer-first quote',async()=>{
   const {f,response:a}=await ask('Gửi 9 triệu đang chọn thì ví còn lại bao nhiêu?',{form:'bank',operation:'deposit',amount:6_000_000,term:1}),html=render(a,f.context)
   assert.equal(a.status,'clarify');assert(html.includes(a.notice));assert.doesNotMatch(html,/Sau khi gửi|ví của bạn còn|<dl/)
  })
  await t.test('missing or invalid preview never fabricates a cash-after result',async()=>{
   for(const draft of [null,{form:'bank',operation:'deposit',amount:999_000_000,term:1}] as const){
    const {f,response:a}=await ask('Ví sau khoản gửi đang nhập còn bao nhiêu?',draft),html=render(a,f.context)
    assert.notEqual(a.status,'answered');assert.doesNotMatch(html,/Sau khi gửi|ví của bạn còn|<dl/)
   }
  })
  await t.test('stale delivery cannot show the new result sentence',async()=>{
   const {f,response:a}=await ask('Ví sau khoản gửi đang chọn còn bao nhiêu?',{form:'bank',operation:'deposit',amount:6_000_000,term:1})
   assert.equal(render(a,f.context,false),'')
  })
  await t.test('mismatched draft identity cannot supply personalized action wording',async()=>{
   const {f,response:a}=await ask('Ví sau khoản gửi đang chọn còn bao nhiêu?',{form:'bank',operation:'deposit',amount:6_000_000,term:1})
   const context={...f.context,draft:{...f.context.draft!,draftRevision:f.context.draft!.draftRevision+1}},html=render(a,context)
   assert.doesNotMatch(firstParagraph(html),/^Sau khi gửi/)
  })
  await t.test('render preserves payload, quote identity, snapshot and tamper validation',async()=>{
   const {f,request,response:a}=await ask('Ví còn lại bao nhiêu sau khoản gửi đang điền?',{form:'bank',operation:'deposit',amount:6_500_000,term:1}),before=JSON.stringify({state:f.state,context:f.context,request,response:a})
   render(a,f.context);assert.equal(JSON.stringify({state:f.state,context:f.context,request,response:a}),before);assert.deepEqual(await validateSemanticResponse(a,request),a)
   await assert.rejects(validateSemanticResponse({...a,draft:{...a.draft!,draftId:'different-form'}},request))
   await assert.rejects(validateSemanticResponse({...a,draft:{...a.draft!,lines:a.draft!.lines.map(l=>l.code==='cashAfter'?{...l,value:l.value+1}:l)}},request))
  })
 }finally{await server.close()}
})
