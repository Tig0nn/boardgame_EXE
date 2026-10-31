import type {GameplayContext,GameplayDomain,GameplayIntent} from './types.ts'
import {factValue} from './facts.ts'
export function groundedConclusion(c:GameplayContext,intent:GameplayIntent,fallback:string):string {
 if(c.domain==='funding'&&intent==='cashflow')return `Còn thiếu ${factValue(c.facts.find(f=>f.code==='remaining')!)} cho khoản thanh toán bắt buộc.`
 if(c.domain==='overview'&&intent==='cashflow')return `Tiền mặt hiện có: ${factValue(c.facts.find(f=>f.code==='cash')!)}.`
 if(c.domain==='bank'&&intent==='compare')return 'Kỳ hạn dài có lãi suất cao hơn, nhưng khóa tiền lâu hơn.'
 if(c.domain==='stocks'&&intent==='risk')return 'Giá có thể giảm; bán cổ phiếu còn chịu phí giao dịch.'
 if(c.domain==='gold'&&['risk','compare'].includes(intent))return 'Mua rồi bán ngay có thể mất tiền vì spread và phí.'
 if(c.domain==='bonds'&&intent==='risk')return 'Coupon là cam kết, không bảo đảm tiền sẽ về đúng hạn.'
 if(c.domain==='personal'&&intent==='compare')return 'So sánh khoản trả ngay với nghĩa vụ thêm tại START.'
 if(c.domain==='course'&&intent==='compare')return 'So sánh học phí, tăng lương và điều kiện mua từng khóa.'
 if(c.domain==='summary'&&intent==='cashflow')return 'Các dòng START đã ghi nhận dưới đây giải thích thu/chi và nghĩa vụ.'
 return fallback
}
export function groundedCaveat(c:GameplayContext):string {
 if(c.domain==='business'&&c.facts.find(f=>f.code==='capital')?.value===0)return ' Bạn chưa có quán trong snapshot này; chưa thể nâng cấp hay nhận thu nhập quán.'
 if(c.domain==='business'&&!c.actions.includes('upgrade'))return ' Snapshot này chưa có quyền nâng cấp; mức tăng theo chuyên môn hiện tại chỉ là tham chiếu, không phải lựa chọn đang khả dụng.'
 if(c.domain==='stocks'&&!c.facts.some(f=>f.code==='net'))return ' Chưa có cổ phiếu có báo giá bán trong snapshot này; chỉ giải thích cơ chế phí, không nêu số tiền bán.'
 if(c.domain==='gold'&&!c.facts.some(f=>f.code==='net'))return ' Chưa có vàng đang sở hữu để báo giá bán; phần này chỉ giải thích cơ chế spread và phí.'
 if(c.eventId==='repair')return ' Sửa tạm không miễn phí: vẫn trả ngay và thêm khoản hẹn tại START. Nghĩa vụ mới chỉ được ghi nhận khi hoàn tất thanh toán ban đầu; nếu phải huy động vốn thì lựa chọn chưa hoàn tất.'
 if(c.domain==='funding'&&c.entries.length)return ' Đang chờ huy động: dòng âm ghi nhận nghĩa vụ, không chứng minh khoản đó đã trả xong; số còn thiếu được tách riêng.'
 return ''
}
export function learningPrompt(domain:GameplayDomain):string {
 return ({bank:'Khi nào bạn cần dùng tiền lại, và khoản gửi có đáo hạn kịp không?',stocks:'Nếu phải bán khi giá giảm, bạn còn đủ tiền cho nghĩa vụ không?',gold:'Bạn đã tính spread và phí vào khả năng chi trả chưa?',bonds:'Bạn sẽ chi trả thế nào nếu coupon hoặc gốc bị chậm?',business:'Số START còn lại có phù hợp với vốn nâng cấp bị khóa không?',course:'Bạn còn tới đủ START để hưởng phần tăng lương mong đợi không?',personal:'Giữ tiền hôm nay sẽ đi cùng nghĩa vụ nào ở START?',macro:'Thay đổi giá tài sản khác tiền nhận được như thế nào?',funding:'Nguồn nào giữ khả năng thanh toán với chi phí có điều kiện mà bạn chấp nhận?',summary:'Dòng thu/chi nào làm tiền sẵn dùng thay đổi?',rebalancing:'Sau bán tài sản hoặc trả nợ, bạn còn khoản dự phòng nào?',forecast:'Bạn sẽ kiểm tra tín hiệu nào thay vì coi dự báo là chắc chắn?',overview:'Bạn cần giữ khoản tiền nào sẵn dùng trước quyết định tiếp theo?'} as const)[domain]
}
export function missingDataExplanation(c:GameplayContext):string {
 if(c.domain==='bank')return 'Chưa có khoản tiết kiệm đang hoạt động để xác định vòng đáo hạn. Bạn có thể hỏi về cơ chế hoặc các kỳ hạn.'
 if(['stocks','bonds','gold','rebalancing'].includes(c.domain))return 'Chưa có tài sản hoặc lô có báo giá bán khả dụng trong snapshot này. Chưa thể nêu tiền bán; không giả định bạn đã mua.'
 if(c.domain==='business')return 'Bạn chưa sở hữu quán trong snapshot này nên chưa có khoản thu hồi bán quán. Bạn có thể hỏi về vốn mua và cơ chế thu nhập.'
 if(c.domain==='macro')return 'Thiếu bản ghi công khai của cú sốc đã xảy ra. Không thể nêu tác động cụ thể hoặc dựng lại lịch sử.'
 return 'Chưa có đủ dữ kiện cho câu hỏi này. Hãy hỏi một ý về tình huống hiện tại hoặc quay lại Quyết định.'
}