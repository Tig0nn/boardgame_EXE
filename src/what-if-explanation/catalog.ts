import { money } from '../game/format.ts'
import { validateClaims } from './claims.ts'
import { ExplanationRejected } from './contracts.ts'
import type { ExplanationFacts, Slot } from './contracts.ts'
export type ExplanationSection = Readonly<{slot:Slot;title:string;text:string}>
/** Reviewed lessons complement the numeric cards; all numbers come from current engine facts. */
export function renderExplanation(raw:unknown,facts:ExplanationFacts):readonly ExplanationSection[]{
 const plan=validateClaims(raw,facts),r=facts.result,p=money(r.principal),delta=money(r.difference)
 const summary=plan.summary==='actual-assumption-brief'
  ?`Bạn đã bỏ qua gửi tiết kiệm. Gửi ${p} kỳ hạn ${facts.assumption.term} là giả định so sánh, không phải ý định được ghi nhận của bạn.`
  :`Lịch sử ghi nhận bạn bỏ qua gửi tiết kiệm. Gửi ${p}, kỳ hạn ${facts.assumption.term}, chỉ là giả định; không chứng minh bạn định giữ đúng khoản này.`
 const interpretation=plan.interpretation==='higher-cash-at-checkpoint'
  ?`Engine xác minh nhánh gửi cao hơn ${delta} tại START đã hoàn tất; đây không phải dự báo.`
  :`Tại START đã hoàn tất, engine ghi nhận phương án gửi có thêm ${delta}; đây không phải dự báo.`
 const tradeoff=plan.tradeoff==='locked-principal'
  ?'Khoản gửi bị khóa tới START kế tiếp, làm giảm tiền dùng ngay cho các khoản cần chi.'
  :`Sau lựa chọn, nhánh gửi còn ${money(r.alternativeLiquidBuffer)} dùng ngay, so với ${money(r.actualLiquidBuffer)} khi bỏ qua. Khoản gửi bị khóa tới START kế tiếp.`
 const takeaway=plan.takeaway==='hindsight-limit'
  ?'Kết quả quá khứ không chứng minh bạn chọn sai. Lúc quyết định, bạn còn cần cân nhắc tiền sẵn dùng.'
  :'Bạn quyết định với thông tin có lúc đó. Kết quả đã qua không đủ để nói bạn chọn sai hoặc bảo đảm tương lai.'
 const sections:ExplanationSection[]=[{slot:'summary',title:'Lựa chọn',text:summary},{slot:'interpretation',title:'Chênh lệch',text:interpretation},{slot:'tradeoff',title:'Đánh đổi',text:tradeoff},{slot:'takeaway',title:'Bài học',text:takeaway}]
 const text=sections.map(s=>s.text).join(' ')
 if(text.split(/\s+/).length>160||[...text].length>1400)throw new ExplanationRejected()
 return Object.freeze(sections.map(s=>Object.freeze(s)))
}
