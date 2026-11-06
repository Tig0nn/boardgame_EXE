import {extractExplicitSlots} from './safety.ts'
import {words} from './safety-lexical.ts'
import type {SemanticContext,SemanticRoute} from './types.ts'

/** Name only constraints already established by Safety; never quote another selection. */
export function clarificationNotice(question:string,c:SemanticContext,route:SemanticRoute):string|null {
 const s=extractExplicitSlots(question,c),d=c.draft?.selection
 if(route.reason==='ambiguous'&&s.ambiguousAmount)return 'Số tiền chưa rõ hoặc định dạng chưa được hỗ trợ. Hãy hỏi một số tiền nguyên dương, ví dụ 1600000 đồng hoặc 1,6 triệu, và nhập cùng giá trị vào form. Không tự sửa form hoặc tính báo giá khác.'
 if(route.reason==='amount-mismatch'&&d&&s.amount!==null)return `Số tiền trong câu hỏi là ${s.amount.toLocaleString('vi-VN')} đồng, khác giá trị đang nhập ${d.amount?.toLocaleString('vi-VN')??'chưa hợp lệ'} đồng. Hãy chỉnh form hoặc câu hỏi cho khớp rồi hỏi lại; chưa có báo giá cho số tiền khác.`
 if(route.reason==='missing-data'&&words(question).has('lợi nhuận','doanh thu'))return 'Chưa đủ dữ kiện để tính lợi nhuận: cần doanh thu, chi phí và khoảng thời gian/điều kiện tương ứng. Chỉ có thể giải thích dữ kiện đã công bố; không tự giả định doanh thu hoặc chi phí.'
 if(route.reason!=='draft-mismatch'||!d)return null
 const next=' Hãy chỉnh lựa chọn trong Quyết định hoặc làm rõ câu hỏi; chưa có báo giá cho lựa chọn khác.'
 if(s.malformed&&words(question).has('kỳ','kỳ hạn','vòng'))return 'Kỳ hạn trong câu hỏi chưa rõ hoặc chưa được hỗ trợ; cần một kỳ hạn hợp lệ khớp form.'+next
 if(s.terms.length){
  if(s.terms.length===1&&Number.isSafeInteger(s.terms[0])&&s.terms[0]>=0&&s.terms[0]<1000)return `Kỳ hạn trong câu hỏi là ${s.terms[0]}, còn form đang chọn ${d.term??'không có kỳ hạn'}${d.term?' kỳ':''}.`+next
  return 'Câu hỏi có nhiều kỳ hạn hoặc kỳ hạn chưa được hỗ trợ; form chỉ có một kỳ hạn đang chọn.'+next
 }
 if(s.symbols.some(id=>id!==d.symbolId?.toLocaleLowerCase('vi'))||s.symbols.length>1)return 'Mã cổ phiếu trong câu hỏi không khớp một mã đang chọn trong form.'+next
 if(s.issuers.some(id=>id!==d.issuerId)||s.issuers.length>1)return 'Bên phát hành trái phiếu trong câu hỏi không khớp bên phát hành đang chọn.'+next
 if(s.preferences.some(id=>id!==d.preferenceId)||s.preferences.length>1)return 'Hướng nâng cấp trong câu hỏi không khớp hướng đang chọn cho quán.'+next
 const asset=d.asset??(d.form==='bank'?'bank':d.form==='business'?'business':d.source==='savings'?'bank':d.source)
 if(d.form==='funding'&&s.sources.some(source=>source!==d.source))return 'Nguồn huy động trong câu hỏi không khớp nguồn đang chọn để thanh toán.'+next
 if(s.assets.some(a=>a!==asset))return 'Loại tài sản trong câu hỏi không khớp tài sản của phương án đang nhập.'+next
 if(s.operations.some(op=>op!==d.operation&&!(d.form==='funding'&&['fund','sell'].includes(op))))return 'Thao tác mua/bán/gửi/rút trong câu hỏi không khớp thao tác của form đang chọn.'+next
 return null
}
