import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mentionedMoney} from '../src/ai/companion/semantic/safety-lexical.ts'
import {semanticFixture} from './helpers/semantic.ts'
import {fundingWith,liveBondEncounter,ownedBusiness} from './helpers/draft.ts'
import {encounter} from './helpers/universal.ts'
import {createDraftRequest,answerDraft,validateDraftResponse,DRAFT_QUESTIONS,normalizeDraftInput,projectDraftContext} from '../src/ai/companion/draft-index.ts'
import type {DraftInput} from '../src/ai/companion/draft-index.ts'
import {classifySemantic,createSemanticRequest,answerSemantic,validateSemanticResponse} from '../src/ai/companion/semantic-index.ts'

// P5 development acceptance cases, authored separately from the frozen v1/P4 fixtures.
const amounts:[string,number][]=[
 ['1,5 triệu',1_500_000],['1.500.000 đồng',1_500_000],['1,500,000 đồng',1_500_000],
 ['1 500 000 đồng',1_500_000],['1\u00a0500\u00a0000 đồng',1_500_000],['1,5tr',1_500_000],
 ['mười hai triệu',12_000_000],['hai mươi ba triệu',23_000_000],['một trăm nghìn',100_000],
 ['hai triệu rưỡi',2_500_000],['hai ty',2_000_000_000],['hai mươi ba triệu'.normalize('NFD'),23_000_000],['0,500 triệu',500_000],
]
for(const [text,value] of amounts)test('P5 money preserves the complete amount: '+text,()=>{
 assert.deepEqual(mentionedMoney('Gửi '+text+' đang nhập'),{value,ambiguous:false})
})
for(const text of ['-2 triệu','0 đồng','1..500.000 đồng','1,23,456 đồng','1 triệu và 2 triệu','9007199254740992 đồng','1tr5','12abc triệu','âm hai triệu','−2 triệu','hai chục triệu','hai triệu rưỡi rưỡi','1 triệu và 2000000','３ triệu','½ triệu','âm 2000000','−2000000'])test('P5 money declines unsafe or unsupported notation: '+text,()=>{
 assert.deepEqual(mentionedMoney('Gửi '+text+' đang nhập'),{value:null,ambiguous:true})
})
for(const text of ['Máy bay hoạt động ra sao?','Công ty này là gì?','1 kỳ hạn','Mã ABC123'])test('P5 currency aliases without an amount are ordinary words: '+text,()=>{
 assert.deepEqual(mentionedMoney(text),{value:null,ambiguous:false})
})
function bank(amount=2_000_000){return semanticFixture({id:'p5-bank',fixture:'bank',question:'',status:'route',draft:{form:'bank',operation:'deposit',amount,term:2}})}
for(const [text,value] of amounts.filter(([,value])=>value<30_000_000))test('P5 router and safety agree on amount: '+text,async()=>{
 const {state,context}=bank(value),before=JSON.stringify(state),question='Giải thích khoản gửi '+text+' đang nhập'
 const route=classifySemantic(question,context)
 assert.equal(route.status,'route');assert.equal(route.mentionedAmount,value);assert.equal(route.scope,'draft');assert.equal(route.intent,'explain')
 const r=await createSemanticRequest(context,question,'p5-money'),a=await answerSemantic(r)
 assert.equal(a.status,'answered');assert.deepEqual(a.draft!.lines,context.draft!.preview.lines)
 assert.equal(JSON.stringify(state),before);assert.deepEqual(await validateSemanticResponse(a,r),a)
})
test('P5 canonical draft prompts answer mechanism, cashflow and validity distinctly',async()=>{
 const {context}=bank(),responses=[]
 for(const q of DRAFT_QUESTIONS){const r=await createDraftRequest(context.draft!,q,'p5-draft'),a=await answerDraft(r);assert.equal(a.status,'answered');assert.deepEqual(a.lines,context.draft!.preview.lines);assert.deepEqual(await validateDraftResponse(a,r),a);responses.push(a)}
 assert.equal(new Set(responses.map(a=>a.conclusion)).size,3)
 assert.match(responses[1].explanation,/Dự kiến trả ngay/);assert.match(responses[1].explanation,/Dự kiến tiền mặt sau giao dịch/)
 assert.match(responses[2].explanation,/không.*khuyến nghị/i)
})
for(const [index,question] of DRAFT_QUESTIONS.entries())test('P5 semantic delivery preserves canonical draft question '+index,async()=>{
 const {context}=bank(),r=await createSemanticRequest(context,question,'p5-canonical'),a=await answerSemantic(r)
 const expected=await answerDraft(await createDraftRequest(context.draft!,question,r.requestId))
 assert.equal(a.route.intent,index===1?'cashflow':'explain');assert.deepEqual(a.draft,expected)
})
for(const kind of ['gold','stocks','bonds','upgrade','debt','savings'] as const)test('P5 cashflow answer uses validated preview across forms: '+kind,async()=>{
 const state=kind==='bonds'?liveBondEncounter():kind==='upgrade'?ownedBusiness():kind==='debt'||kind==='savings'?fundingWith(kind):encounter(kind)
 const input:Partial<DraftInput>=kind==='upgrade'?{form:'business',operation:'upgrade',amount:5_000_000,preferenceId:'taste'}:kind==='debt'||kind==='savings'?{form:'funding',operation:'fund',source:kind,amount:1_000_000,lotId:kind==='savings'?state.deposits[0].id:null}:{form:'investment',operation:'buy',asset:kind,amount:1_000_000,...(kind==='stocks'?{symbolId:state.market.stocks[0].id}:kind==='bonds'?{issuerId:'an-tam' as const}:{})}
 const before=JSON.stringify(state),context=projectDraftContext(state,{sessionEpoch:'p5-forms',revision:1,draftId:'form',draftRevision:1},normalizeDraftInput(input))
 assert.equal(context.preview.status,'quoted')
 const request=await createDraftRequest(context,DRAFT_QUESTIONS[1],'p5-forms'),a=await answerDraft(request)
 assert.equal(a.status,'answered');assert.deepEqual(a.lines,context.preview.lines)
 assert.match(a.explanation,kind==='debt'||kind==='savings'?/Tiền mặt sau riêng bước/:/Dự kiến tiền mặt sau giao dịch/)
 if(kind==='savings')assert.match(a.explanation,/Lãi chưa nhận sẽ mất khi rút sớm/)
 assert.deepEqual(await validateDraftResponse(a,request),a);assert.equal(JSON.stringify(state),before)
})
test('P5 invalid draft offers an actionable correction without a quote',async()=>{
 const {context}=bank(999_000_000),a=await answerDraft(await createDraftRequest(context.draft!,DRAFT_QUESTIONS[2],'p5-invalid'))
 assert.equal(a.status,'fallback');assert.equal(a.reason,'cash');assert.deepEqual(a.lines,[]);assert.match(a.explanation,/giảm.*giá trị/i)
})
for(const [question,intent,notice,status] of [
 ['Giải thích khoản gửi đang nhập','explain',null,'answered'],
 ['Tiền mặt sau khoản gửi đang nhập là bao nhiêu?','cashflow',null,'answered'],
 ['Rủi ro khoản gửi đang nhập là gì?','risk',/rút sớm/,'answered'],
 ['Bài học từ khoản gửi đang nhập là gì?','learn',/tiền mặt/,'answered'],
 ['So sánh các kỳ hạn của khoản gửi đang nhập','compare',/một phương án/,'limited'],
] as const)test('P5 draft intent produces a relevant answer: '+intent,async()=>{
 const {context}=bank(),r=await createSemanticRequest(context,question,'p5-intent'),a=await answerSemantic(r)
 assert.equal(a.route.intent,intent);assert.equal(a.status,status);assert.equal(a.route.scope,'draft')
 assert.deepEqual(a.draft!.lines,context.draft!.preview.lines);assert.equal(a.gameplay,null)
 if(notice)assert.match(a.notice,notice)
 if(intent==='cashflow')assert.match(a.draft!.explanation,/Dự kiến tiền mặt sau giao dịch/)
 assert.deepEqual(await validateSemanticResponse(a,r),a)
})
for(const question of ['Gửi mười hai triệu đang nhập thì tiền mặt còn bao nhiêu?','Gửi 1,23,456 đồng đang nhập thì còn bao nhiêu?','Gửi 1tr5 đang nhập có rủi ro gì?'])test('P5 mismatched or malformed amount never reuses a quote: '+question,async()=>{
 const {context}=bank(),a=await answerSemantic(await createSemanticRequest(context,question,'p5-refusal'))
 assert.equal(a.status,'clarify');assert.equal(a.draft,null);assert.equal(a.gameplay,null)
})
