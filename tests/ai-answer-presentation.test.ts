import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from '../mobile_app/node_modules/vite/dist/node/index.js'
import react from '@vitejs/plugin-react'
import {acceptanceFixture} from './helpers/semantic-p4.ts'
import type {AcceptanceCase} from './helpers/semantic-p4.ts'
import {createSemanticRequest,answerSemantic,validateSemanticResponse} from '../src/ai/companion/semantic-index.ts'
import {createGameplayRequest,answerGameplay} from '../src/ai/companion/universal-index.ts'
import {createDraftRequest,answerDraft,DRAFT_QUESTIONS} from '../src/ai/companion/draft-index.ts'

const bank={form:'bank',operation:'deposit',amount:1_400_000,term:2} as const
const fixture=(fixture:string,question:string,draft:AcceptanceCase['draft']=null)=>acceptanceFixture({id:'presentation',fixture,question,draft,expected:'correct-answer'})
async function semantic(name:string,q:string,draft:AcceptanceCase['draft']=null){const f=fixture(name,q,draft),request=await createSemanticRequest(f.context,q,'presentation');return {f,request,response:await answerSemantic(request)}}
const text=(html:string)=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()
const fixed=/Giải thích bằng dữ kiện đã công bố; bạn tự quyết định|Chỉ giải thích trò chơi B18; không khuyến nghị|Không dự báo giá, RNG hay sự kiện tương lai|Báo giá và thu nhập danh nghĩa có điều kiện|Dữ liệu từ phiên chơi cục bộ|chưa được máy chủ xác thực|Báo giá dự kiến từ snapshot hiện tại; chỉ nút xác nhận|Không dự đoán giá, lợi nhuận hoặc sự kiện tương lai/
const noEmpty=(html:string)=>assert.doesNotMatch(html,/<(p|ul|li|dl|details)\b[^>]*>\s*<\/\1>/)

test('Companion answer presentation renders concise grounded content without changing payloads',async t=>{
 const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-ai-answer-presentation',plugins:[react(),{
  name:'answer-presentation-test',resolveId(id){if(id==='virtual:answer-presentation')return '\0answer-presentation'},
  load(id){if(id==='\0answer-presentation')return `
   import{createElement}from'react';import{renderToStaticMarkup}from'react-dom/server';
   import{SemanticAiResult}from'/mobile_app/src/components/SemanticAiResult.tsx';
   import{DraftAiResult}from'/mobile_app/src/components/DraftAiResult.tsx';
   import{GameplayAiContent}from'/mobile_app/src/components/GameplayAi.tsx';
   export function render(name,response,context,current=true){const view={response,context,question:'',status:response?.status??'idle',isCurrent:()=>current};return renderToStaticMarkup(createElement({semantic:SemanticAiResult,draft:DraftAiResult,gameplay:GameplayAiContent}[name],{view,active:true,binding:{edit(){},ask(){},close(){}}}));}
  `},
 }],resolve:{dedupe:['react','react-dom']},server:{middlewareMode:true},appType:'custom'})
 try{
  const {render}=await server.ssrLoadModule('virtual:answer-presentation')
  await t.test('semantic removes generic notice, headings and fixed footer while preserving internal limitations',async()=>{
   const {response:a}=await semantic('bank','Giải thích khoản gửi đang điền',bank),before=JSON.stringify(a)
   const html=render('semantic',a);assert.doesNotMatch(text(html),fixed);assert.doesNotMatch(html,/<h3|gameplay-limitations/)
   assert.equal(JSON.stringify(a),before);assert(a.draft!.limitations.length>=3);noEmpty(html)
  })
  await t.test('universal answer stays within four short sentences and avoids context/action dumps',async()=>{
   const f=fixture('gold','Vàng trong game hoạt động thế nào?'),r=await createGameplayRequest(f.context.actual,f.question,'presentation'),a=await answerGameplay(r)
   assert.equal(a.status,'answered');const html=render('gameplay',a,f.context.actual)
   assert.doesNotMatch(text(html),fixed);assert.doesNotMatch(html,/Quyền quyết định hiện tại|Nguồn huy động hiện có|AI giải thích tình huống đang mở/)
   const result=html.match(/class="gameplay-result"[^>]*>([\s\S]*?)<\/div>\s*<button/)!;assert(result)
   assert(text(result[1]).split(/[.!?](?:\s|$)/).filter(s=>s.trim()).length<=4);noEmpty(html)
  })
  await t.test('draft keeps early-withdrawal consequence and relevant interest/maturity values',async()=>{
   const f=fixture('bank',DRAFT_QUESTIONS[0],bank),r=await createDraftRequest(f.context.draft!,f.question,'presentation'),a=await answerDraft(r),html=render('draft',a)
   assert.match(text(html),/rút sớm mất lãi/);assert.match(text(html),/Lãi danh nghĩa nếu giữ đủ kỳ hạn|Đáo hạn/)
   assert.doesNotMatch(text(html),fixed);assert.doesNotMatch(text(html),/Đây là khoản gửi dự kiến, chưa thực hiện/);noEmpty(html)
  })
  await t.test('risk answer leads with the actual risk rather than cashflow or a generic preamble',async()=>{
   const {response:a}=await semantic('bank','Khoản gửi đang chọn có điều gì phải dè chừng khi rút trước hạn?',bank),html=render('semantic',a)
   assert.equal(a.route.intent,'risk');assert.match(text(html),/^Rủi ro cần lưu ý:/);assert.match(text(html),/rút sớm mất lãi/);assert.doesNotMatch(text(html),fixed)
  })
  await t.test('fee question shows validated spread, fee and net without unrelated context',async()=>{
   const {response:a}=await semantic('funding','Phần chênh lệch mua–bán của nguồn vàng đang điền trừ bao nhiêu tiền?',{form:'funding',operation:'fund',source:'gold',amount:140_000}),html=render('semantic',a)
   assert.equal(a.route.intent,'cashflow')
   for(const code of ['spread','fee','net']){const l=a.draft!.lines.find(l=>l.code===code)!;assert(l);assert(html.includes(l.value.toLocaleString('vi-VN')))}
   assert.doesNotMatch(html,/Giá hiện tại \/ đơn vị|Kỳ hạn đã chọn|Giá trị đang nhập/);noEmpty(html)
  })
  await t.test('cashflow preserves the remaining funding gap and amount used for obligations',async()=>{
   const {response:a}=await semantic('funding','Nguồn vàng đang nhập làm khoản còn thiếu còn lại bao nhiêu?',{form:'funding',operation:'fund',source:'gold',amount:140_000}),html=render('semantic',a)
   for(const code of ['used','pendingAfter','cashAfterStep']){const l=a.draft!.lines.find(l=>l.code===code)!;assert(l);assert(html.includes(l.value.toLocaleString('vi-VN')))}
   assert.match(text(html),/Còn thiếu|còn thiếu/);assert.doesNotMatch(text(html),fixed)
  })
  await t.test('specific amount mismatch remains visible with no quote',async()=>{
   const {response:a}=await semantic('bank','Giải thích khoản gửi 1,5 triệu đang chọn',bank),html=render('semantic',a)
   assert.equal(a.status,'clarify');assert(html.includes(a.notice));assert.doesNotMatch(html,/<dl/)
  })
  await t.test('future refusal remains visible rather than being hidden with fixed disclaimers',async()=>{
   const {response:a}=await semantic('gold','Ngày mai giá vàng sẽ tăng bao nhiêu?'),html=render('semantic',a)
   assert.equal(a.status,'fallback');assert(html.includes(a.notice));assert.match(text(html),/Không biết RNG/)
  })
  await t.test('bond risk retains delayed payment and loss consequences',async()=>{
   const {response:a}=await semantic('bonds','Rủi ro của trái phiếu đang nhập là gì?',{form:'investment',operation:'buy',asset:'bonds',issuerId:'an-tam',amount:1_400_000}),html=render('semantic',a)
   assert.equal(a.status,'answered');assert.match(text(html),/chậm trả|mất vốn/);assert.match(text(html),/coupon|Coupon/);assert.doesNotMatch(text(html),fixed)
  })
  await t.test('invalid draft still explains insufficient cash',async()=>{
   const f=fixture('bank',DRAFT_QUESTIONS[0],{...bank,amount:999_000_000}),r=await createDraftRequest(f.context.draft!,f.question,'presentation'),a=await answerDraft(r),html=render('draft',a)
   assert.equal(a.status,'fallback');assert.match(text(html),/vượt tiền mặt/);assert.doesNotMatch(html,/<dl/);noEmpty(html)
  })
  await t.test('stale semantic and draft responses leave no empty result container',async()=>{
   const {response:a}=await semantic('bank','Giải thích khoản gửi đang điền',bank)
   assert.equal(render('semantic',a,undefined,false),'');assert.equal(render('draft',a.draft,undefined,false),'')
  })
  await t.test('idle result components leave no empty paragraphs, bullets or reserved space',()=>{
   assert.equal(render('semantic',null),'');assert.equal(render('draft',null),'')
  })
  await t.test('learning reflection is retained only for learning intent',async()=>{
   const f=fixture('gold','Tôi học được gì từ vàng?'),r=await createGameplayRequest(f.context.actual,f.question,'presentation'),a=await answerGameplay(r)
   assert.equal(a.intent,'learn');assert(text(render('gameplay',a,f.context.actual)).includes(a.reflection!))
   const {response:b}=await semantic('bank','Giải thích cơ chế ngân hàng')
   if(b.gameplay?.reflection)assert(!text(render('semantic',b)).includes(b.gameplay.reflection))
  })
  await t.test('render does not change canonical response, snapshot, quote identity or tamper validation',async()=>{
   const {f,request,response:a}=await semantic('bank','Giải thích khoản gửi đang điền',bank),before=JSON.stringify({state:f.state,request,response:a})
   render('semantic',a);assert.equal(JSON.stringify({state:f.state,request,response:a}),before);assert.deepEqual(await validateSemanticResponse(a,request),a)
   await assert.rejects(validateSemanticResponse({...a,draft:{...a.draft!,draftRevision:a.draft!.draftRevision+1}},request))
   await assert.rejects(validateSemanticResponse({...a,draft:{...a.draft!,lines:a.draft!.lines.map((l,i)=>i===0?{...l,value:l.value+1}:l)}},request))
  })
  await t.test('end-of-game maturity caveat and extra relevant facts are preserved',async()=>{
   const {response:a}=await semantic('bank','Giải thích khoản gửi đang điền',bank),html=render('semantic',a)
   const caveat=a.draft!.limitations.find(l=>/vượt thời điểm kết thúc ván/.test(l));assert(caveat);assert(html.includes(caveat))
   const f=fixture('personal','So sánh trả ngay và sửa tạm'),r=await createGameplayRequest(f.context.actual,f.question,'presentation'),b=await answerGameplay(r),full=render('gameplay',b,f.context.actual)
   assert.equal(b.status,'answered');assert.match(full,/<details><summary>Xem thêm dữ kiện liên quan/);noEmpty(full)
  })
  await t.test('liquidity question retains the exact payment and cash-after values',async()=>{
   const {response:a}=await semantic('bank','Tiền mặt trong ví sau khoản gửi đang điền còn bao nhiêu?',bank),html=render('semantic',a)
   assert.equal(a.status,'answered');assert.equal(a.route.intent,'cashflow')
   for(const code of ['payNow','cashAfter']){const line=a.draft!.lines.find(l=>l.code===code)!;assert(line);assert(html.includes(line.value.toLocaleString('vi-VN')))}
  })
  await t.test('direct Draft cashflow keeps fee and spread after removing repeated monetary prose',async()=>{
   const f=fixture('funding',DRAFT_QUESTIONS[1],{form:'funding',operation:'fund',source:'gold',amount:140_000}),r=await createDraftRequest(f.context.draft!,f.question,'presentation'),a=await answerDraft(r),html=render('draft',a)
   assert.equal(a.status,'answered');for(const code of ['spread','fee','net','used','pendingAfter']){const l=a.lines.find(l=>l.code===code)!;assert(l);assert(html.includes(l.value.toLocaleString('vi-VN')))}
  })
  await t.test('current price remains visible in the actual answer without generating a new quote',async()=>{
   const {response:a}=await semantic('gold','Giá vàng hiện tại là bao nhiêu?'),html=render('semantic',a)
   assert.equal(a.status,'answered');const price=a.gameplay!.facts.find(f=>f.code==='price')!;assert(price);assert(html.includes(price.value.toLocaleString('vi-VN')));assert.match(text(html),/Giá hiện tại/)
  })
 }finally{await server.close()}
})
