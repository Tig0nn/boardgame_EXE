import {assertSemanticPayloadConsistency} from './safety.ts'
import {createGameplayRequest} from '../universal/contract.ts'
import {answerGameplay,validateGameplayResponse} from '../universal/answer.ts'
import {QUESTION_BANK,normalizeQuestion} from '../universal/questions.ts'
import {createDraftRequest} from '../draft/contract.ts'
import {answerDraft,validateDraftResponse,DRAFT_QUESTIONS} from '../draft/answer.ts'
import {canonicalJson} from '../serialization.ts'
import {object,literal,text,integer,enumeration,plainText,invalid} from '../schema.ts'
import {parseSemanticRequest,parseSemanticRoute} from './contract.ts'
import {classifySemantic} from './routing.ts'
import {clarificationNotice} from './clarification.ts'
import type {SemanticRequest,SemanticResponse,SemanticRoute} from './types.ts'
export const routeNotices:Record<SemanticRoute['reason'],string>={supported:'Giải thích bằng dữ kiện đã công bố; bạn tự quyết định.',ambiguous:'Bạn muốn hỏi cơ chế, rủi ro hay số tiền của phương án nào? Hãy hỏi rõ một ý.', 'multi-intent':'Có nhiều ý trong câu hỏi. Hãy hỏi từng ý để tránh ghép sai dữ kiện.',unsupported:'Chưa hỗ trợ ý này. AI chưa giải đáp câu hỏi và không chọn hoặc giao dịch thay bạn.', 'outside-game':'Chỉ giải thích trong game; không tư vấn đầu tư thật hoặc trả lời chủ đề ngoài phạm vi.',future:'Không biết RNG, giá hoặc sự kiện chưa công bố. Chỉ giải thích dữ kiện hiện tại.',policy:'Không thể làm theo yêu cầu đổi luật, bỏ policy hoặc tiết lộ thông tin bí mật.', 'cross-domain':'Chưa có đủ context của các đối tượng được hỏi để so sánh chính xác trong tình huống này.', 'draft-missing':'Cần giá trị/phương án đang nhập. Hãy quay lại Quyết định chọn form và nhập, hoặc hỏi cơ chế chung.', 'draft-mismatch':'Câu hỏi không khớp tài sản, mã, kỳ hạn hoặc thao tác đang chọn. Hãy chỉnh form hoặc làm rõ câu hỏi.', 'amount-mismatch':'Số tiền trong câu hỏi không khớp form. AI không sửa form hoặc tính giao dịch giả định; hãy nhập giá trị muốn phân tích.', 'missing-data':'Đã nhận diện ý hỏi nhưng thiếu dữ kiện đủ điều kiện để kết luận.', 'breakeven-unknown':'Không xác định được bao lâu hoàn vốn từ dữ kiện hiện tại. Chỉ có thể giải thích chi phí và điều kiện; không dự báo thu nhập, thị hiếu hoặc lần gặp ô tiếp theo.'}
export async function answerSemantic(raw:unknown):Promise<SemanticResponse>{
 const r=await parseSemanticRequest(raw),route=classifySemantic(r.question,r.context)
 let gameplay:SemanticResponse['gameplay']=null,draft:SemanticResponse['draft']=null,status:SemanticResponse['status']=route.status==='clarify'?'clarify':'fallback',notice=clarificationNotice(r.question,r.context,route)??routeNotices[route.reason]
 if(route.status==='route'&&route.intent){
  if(route.scope==='draft'&&r.context.draft){
   const index=route.intent==='cashflow'?1:normalizeQuestion(r.question)===normalizeQuestion(DRAFT_QUESTIONS[2])?2:0
   const internal=await createDraftRequest(r.context.draft,DRAFT_QUESTIONS[index],r.requestId)
   draft=await validateDraftResponse(await answerDraft(internal),internal);status=draft.status==='answered'?'answered':'fallback'
   if(status==='answered'&&route.reason==='supported'){
    const d=r.context.draft.selection!
    if(route.intent==='compare'){status='limited';notice='Hiện chỉ có báo giá của một phương án đang nhập. Chưa có báo giá của phương án khác để kết luận so sánh. Hãy đổi lựa chọn trong Quyết định rồi hỏi riêng từng phương án.'}
    if(route.intent==='learn')notice=d.operation==='fund'?'Bài học: phân biệt tiền huy động, tiền dùng trả khoản bắt buộc và khoản còn thiếu; báo giá chỉ mô tả riêng bước này.':'Bài học: phân biệt khoản trả ngay, tiền mặt còn lại và thu nhập có điều kiện; kiểm tra dòng tiền trước khi xác nhận.'
    if(route.intent==='risk')notice=d.operation==='deposit'?'Rủi ro cần lưu ý: tiền gửi rời tiền mặt; rút sớm mất lãi chưa nhận. Đủ kỳ hạn mới nhận lãi.':d.operation==='upgrade'?'Rủi ro cần lưu ý: chi phí nâng cấp trả ngay, thưởng phụ thuộc thị hiếu; chưa đủ dữ kiện đảm bảo hòa vốn.':d.operation==='fund'?'Rủi ro cần lưu ý: bán/rút có thể chịu phí hoặc mất lãi; vay tăng nợ gốc. Báo giá chưa tính lãi vay tương lai hoặc bước tiếp tục sự kiện.':d.asset==='bonds'?'Rủi ro cần lưu ý: trái phiếu có thể chậm trả hoặc mất vốn; coupon và mệnh giá không phải tiền mặt đã nhận.':'Rủi ro cần lưu ý: giá trị tài sản khác tiền mặt thực nhận sau phí/chênh lệch; mua không đảm bảo có lãi hoặc thu hồi vốn.'
   }
  }
  else{
   const c=r.context.actual,bank=QUESTION_BANK[c.domain]
   let q=bank[route.intent][0]
   if(route.focus==='sale')q=c.domain==='gold'?'Báo giá bán vàng hiện tại':c.domain==='stocks'?'Báo giá bán cổ phiếu hiện tại':c.domain==='bonds'?'Bán trái phiếu lúc này nhận được gì?':q
   if(route.focus==='maturity'&&c.domain==='bank')q='Khi nào tiết kiệm đáo hạn?'
   const internal=await createGameplayRequest(c,q,r.requestId);gameplay=await validateGameplayResponse(await answerGameplay(internal),internal);status=gameplay.status==='answered'?'answered':'fallback'
  }
  if(status==='fallback')notice=routeNotices['missing-data']
  if(route.reason==='breakeven-unknown'&&status==='answered')status='limited'
 }
 assertSemanticPayloadConsistency(r,route,gameplay,draft)
 return {version:1,policy:r.policy,requestId:r.requestId,sessionEpoch:r.sessionEpoch,revision:r.revision,contextDigest:r.contextDigest,questionDigest:r.questionDigest,source:'deterministic',status,route,notice,gameplay,draft}
}
/** Financial subresponses pass their original validators; the new envelope must match exactly too. */
const responseSchema=object({version:literal(1),policy:literal('b18-semantic-question.v1'),requestId:text(),sessionEpoch:text(48),revision:integer(),contextDigest:text(71),questionDigest:text(71),source:literal('deterministic'),status:enumeration(['answered','limited','clarify','fallback']),route:parseSemanticRoute,notice:plainText(600),gameplay:value=>value,draft:value=>value})
export async function validateSemanticResponse(raw:unknown,request:SemanticRequest):Promise<SemanticResponse>{const expected=await answerSemantic(request),parsed=responseSchema(raw);if(canonicalJson(parsed)!==canonicalJson(expected))invalid();return expected}
