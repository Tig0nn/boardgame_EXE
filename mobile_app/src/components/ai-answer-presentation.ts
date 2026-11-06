import type {GameplayResponse,GameplayFact,GameplayIntent} from '../../../src/ai/companion/universal/types.ts'
import type {DraftResponse,DraftContext} from '../../../src/ai/companion/draft/types.ts'
import type {SemanticRoute} from '../../../src/ai/companion/semantic/types.ts'
import {factLabel,factValue} from '../../../src/ai/companion/universal/facts.ts'
import {draftLineLabels} from '../../../src/ai/companion/draft/answer.ts'

export interface AnswerDetail {key:string;label:string;value:string}
export interface AnswerPresentation {lead?:string;paragraphs:string[];details:AnswerDetail[]}
type Route=Pick<SemanticRoute,'intent'|'focus'|'symbolId'|'issuerId'>
const genericConclusions=new Set([
 'Xem cơ chế cùng dữ kiện hiện tại trước khi quyết định.',
 'Phân biệt tiền chi ngay, tiền nhận và điều kiện của từng lựa chọn.',
 'Kết quả có điều kiện; hãy giữ khả năng thanh toán khoản bắt buộc.',
 'Dòng tiền chi được khác giá trị tài sản và khoản sẽ nhận.',
 'Quan sát chi phí cơ hội và thanh khoản trong quyết định này.',
])
const genericNotice='Giải thích bằng dữ kiện đã công bố; bạn tự quyết định.'
const genericDraftLimits=new Set([
 'Báo giá dự kiến từ snapshot hiện tại; chỉ nút xác nhận của bạn mới thực hiện giao dịch.',
 'Không dự đoán giá, lợi nhuận hoặc sự kiện tương lai. Không phải khuyến nghị đầu tư ngoài đời.',
 'Không có báo giá hay giao dịch mới được thực hiện.',
])
const unique=(items:string[])=>[...new Set(items.map(s=>s.trim()).filter(Boolean))]
const sentences=(text:string)=>text.trim().split(/(?<=[.!?])\s+/u).filter(Boolean)
const topics:Partial<Record<SemanticRoute['focus'],RegExp>>={
 fees:/spread|phí|chênh lệch/i,sale:/bán|thực nhận|phí|spread/i,
 maturity:/kỳ hạn|đáo hạn|rút sớm/i,income:/thu nhập|lương|coupon|START/,
 liquidity:/tiền mặt|thanh khoản|thiếu tiền|chi phí/i,
 obligation:/nghĩa vụ|khoản bắt buộc|khoản hẹn|thanh toán/i,
 breakeven:/vốn|hòa vốn|thu nhập|START/i,
}
const critical=/rút sớm|chậm trả|mất gốc|mất vốn|mất tiền|chưa có quán|chưa có quyền|chưa hoàn tất|nghĩa vụ mới chỉ|vượt thời điểm kết thúc/i
const focusCodes:Partial<Record<SemanticRoute['focus'],string[]>>={
 fees:['spread','fee','net'],sale:['gross','spread','fee','net'],
 maturity:['principal','rate','interest','maturity','term'],
 liquidity:['cash','after','cashAfter','cashAfterStep','payNow','net','used','shortfall','remaining','immediate','future','obligations'],
 obligation:['paymentTotal','remaining','immediate','future','obligations','net','used','pendingAfter','cashAfterStep'],
 income:['received','salary','businessIncome','courseCost','courseBoost','courseNominal','courseNet','coupon'],
 breakeven:['capital','purchaseCost','upgradeCost','incremental','courseCost','courseBoost','courseNominal','courseNet'],
}
const intentCodes:Record<GameplayIntent,string[]>={
 explain:['price','change','beforePrice','observed','rate','principal','interest','maturity','coupon','courseCost','courseBoost','purchaseCost','upgradeCost','incremental','immediate','future','shortfall','remaining'],
 compare:['rate','coupon','spread','fee','net','immediate','future','total','after','shortfall','courseCost','courseBoost','upgradeCost','incremental'],
 risk:['lost','spread','fee','creditState','outstanding','loss','shortfall','remaining','maturity'],
 cashflow:['cash','immediate','future','after','shortfall','remaining','paymentTotal','spread','fee','net','received','debtPaid','obligations','salary','living','businessIncome'],
 learn:['cash','obligations','shortfall','remaining','spread','fee','lost'],
}

/** Presentation only: select existing canonical text/values, never calculate a quote or mutate its payload. */
export function presentGameplay(response:GameplayResponse,route?:Route,notice=''):AnswerPresentation {
 if(response.status!=='answered')return {paragraphs:unique([notice, response.explanation].filter(s=>s!==genericNotice)),details:[]}
 const intent=route?.intent??response.intent??'explain',focus=route?.focus??'general'
 const explanation=sentences(response.explanation).filter(s=>!/^Bản giải thích chưa nhận/.test(s))
 const relevant=topics[focus]??(intent==='risk'?/có thể|mất|rút sớm|chậm|không bảo đảm|nghĩa vụ/i:intent==='cashflow'?/tiền mặt|nhận|trả|thu nhập|phí|spread|nghĩa vụ/i:null)
 const selected=relevant?explanation.filter(s=>relevant.test(s)):explanation
 const paragraphs=unique([
  ...(notice&&notice!==genericNotice?sentences(notice):[]),
  ...(!genericConclusions.has(response.conclusion)?[response.conclusion]:[]),
  ...(selected.length?selected:explanation).slice(0,2),
  ...explanation.filter(s=>critical.test(s)),
  ...(intent==='learn'&&response.reflection?[response.reflection]:[]),
 ])
 const riskCodes=[...intentCodes.risk,...(focus==='liquidity'?['cash']:focus==='obligation'?['obligations']:[])]
 const codes=new Set(intent==='risk'?riskCodes:focusCodes[focus]??intentCodes[intent]),subject=route?.symbolId??route?.issuerId
 const facts=response.facts.filter(f=>(codes.has(f.code)||['shortfall','remaining','loss','outstanding'].includes(f.code)&&f.value>0)&&(!subject||f.subject===subject||f.subject==='overall'))
 const details=facts.map((f:GameplayFact)=>({key:f.code+':'+f.subject,label:factLabel(f),value:factValue(f)}))
 if(intent==='cashflow')response.entries.forEach((e,i)=>details.push({key:'entry:'+i,label:e.label,value:e.amount.toLocaleString('vi-VN')+' đ'}))
 return {paragraphs,details}
}

// Unit formatting only. Every financial value comes from an existing validated line.
const shortMoney=(value:number)=>value>=1_000_000&&value%1_000_000===0?`${(value/1_000_000).toLocaleString('vi-VN')} triệu`:value.toLocaleString('vi-VN')
function draftCashflowLead(response:DraftResponse,focus:SemanticRoute['focus'],context?:DraftContext):string|undefined {
 const line=(code:string)=>response.lines.find(l=>l.code===code)
 if(focus==='liquidity'){
  const balance=line('cashAfter'),entered=line('entered'),stepBalance=line('cashAfterStep')
  if(stepBalance)return `Sau riêng bước huy động/thanh toán này, tiền mặt còn ${shortMoney(stepBalance.value)} đồng.`
  if(balance){
   const sameDraft=context?.draftId===response.draftId&&context.draftRevision===response.draftRevision&&context.actual.sessionEpoch===response.sessionEpoch&&context.actual.revision===response.revision
   if(sameDraft&&context?.selection?.operation==='deposit'&&entered&&context.selection.amount===entered.value)return `Sau khi gửi ${shortMoney(entered.value)}, ví của bạn còn ${shortMoney(balance.value)} đồng.`
   return `Sau giao dịch dự kiến, ví của bạn còn ${shortMoney(balance.value)} đồng.`
  }
 }
 const pending=line('pendingAfter')
 if(focus==='obligation'&&pending)return `Sau riêng bước huy động này, khoản bắt buộc còn thiếu ${shortMoney(pending.value)} đồng.`
 if(focus==='fees'){
  const costs=response.lines.filter(l=>['spread','fee'].includes(l.code))
  if(costs.length)return costs.map(l=>`${draftLineLabels[l.code]}: ${shortMoney(l.value)} đồng`).join('; ')+'.'
 }
 const pay=line('payNow'),net=line('net')
 if(pay)return `Bạn dự kiến trả ngay ${shortMoney(pay.value)} đồng.`
 if(net)return `Bạn dự kiến thực nhận ${shortMoney(net.value)} đồng.`
 return undefined
}

export function presentDraft(response:DraftResponse,route?:Route,notice='',context?:DraftContext):AnswerPresentation {
 if(response.status!=='answered')return {paragraphs:unique([notice,response.explanation].filter(s=>s!==genericNotice)),details:[]}
 const intent=route?.intent??(/^Dòng tiền dự kiến/.test(response.conclusion)?'cashflow':'explain'),focus=route?.focus??'general'
 const specificNotice=notice&&notice!==genericNotice?sentences(notice):[]
 const explanation=sentences(response.explanation).filter(s=>!/^Đây là .*chưa thực hiện\.$/.test(s)&&!/^Hợp lệ theo lựa chọn/.test(s)&&!(s.includes(' đồng')&&s.includes(':')))
 const paragraphs=unique([
  ...specificNotice,
  ...(/^Phương án đang nhập hợp lệ/.test(response.conclusion)?['Giá trị đang nhập hợp lệ.']:[]),
  ...(intent==='risk'&&specificNotice.length?[]:explanation),
 ])
 // Keep decision-specific caveats; only the fixed footer is hidden. Avoid repeating the same risk twice.
 for(const limit of response.limitations){
  if(genericDraftLimits.has(limit))continue
  if(/chậm trả/.test(limit)&&paragraphs.some(p=>/chậm trả/.test(p)))continue
  if(/^Lãi và đáo hạn chỉ áp dụng/.test(limit)&&paragraphs.some(p=>/đủ kỳ hạn/.test(p)))continue
  paragraphs.push(limit)
 }
 const cashflow=['payNow','cashAfter','spread','fee','net','lost','used','pendingAfter','cashAfterStep','debtAfter']
 const defaults=intent==='cashflow'?cashflow:intent==='risk'?['lost','coupon','maturity','pendingAfter','debtAfter']:['payNow','cashAfter','net','interest','maturity','coupon','incremental','pendingAfter','cashAfterStep']
 const riskCodes=[...defaults,...(focus==='liquidity'?['cashAfter','cashAfterStep']:focus==='fees'?['spread','fee']:[])]
 const codes=new Set(intent==='risk'?riskCodes:focusCodes[focus]??defaults)
 const details=response.lines.filter(l=>codes.has(l.code)||['pendingAfter','lost'].includes(l.code)&&l.value>0).map(l=>({
  key:l.code,label:draftLineLabels[l.code],value:['maturity','term'].includes(l.code)?`${l.value} ${l.code==='term'?'kỳ':'vòng'}`:l.value.toLocaleString('vi-VN')+' đ',
 }))
 return {lead:intent==='cashflow'?draftCashflowLead(response,focus,context):undefined,paragraphs:unique(paragraphs),details}
}
