import {classifyRepairQuestion} from '../questions/routing.ts'
import type {GameplayDomain,GameplayIntent,GameplayContext} from './types.ts'
export const QUESTION_BANK:Record<GameplayDomain,Record<GameplayIntent,string[]>>={
 bank:{explain:['Gửi tiết kiệm hoạt động thế nào?','Tiết kiệm là gì?'],compare:['Gửi tiết kiệm kỳ hạn nào khác nhau thế nào?','So sánh các kỳ hạn tiết kiệm'],risk:['Rút trước hạn ảnh hưởng đến lãi ra sao?','Rủi ro khi gửi tiết kiệm là gì?','Rút sớm vẫn nhận đủ lãi đúng không?'],cashflow:['Tiền mặt và tiền tiết kiệm khác nhau thế nào?','Khi nào tiết kiệm đáo hạn?'],learn:['Tôi học được gì từ tiết kiệm?']},
 stocks:{explain:['Cổ phiếu hoạt động thế nào?','Giá cổ phiếu hiện tại là bao nhiêu?'],compare:['Nếu bán lúc này thì phí ảnh hưởng thế nào?','Báo giá bán cổ phiếu hiện tại'],risk:['Vì sao mua cổ phiếu có thể lỗ?','Cổ phiếu có rủi ro gì?','Cổ phiếu chắc chắn không lỗ đúng không?'],cashflow:['Mua cổ phiếu ảnh hưởng tiền mặt thế nào?'],learn:['Tôi học được gì từ cổ phiếu?']},
 bonds:{explain:['Trái phiếu hoạt động thế nào?','Coupon là gì?'],compare:['Hai tổ chức phát hành khác nhau thế nào?','Bán trái phiếu lúc này nhận được gì?'],risk:['Rủi ro tín dụng là gì?','Nếu trái phiếu bị chậm trả thì sao?','Trái phiếu luôn trả đúng hạn đúng không?'],cashflow:['Khi nào nhận lãi trái phiếu?'],learn:['Tôi học được gì từ trái phiếu?']},
 gold:{explain:['Vàng trong game hoạt động thế nào?','Giá vàng hiện tại là bao nhiêu?'],compare:['Chênh lệch mua bán ảnh hưởng thế nào?','Báo giá bán vàng hiện tại'],risk:['Vì sao mua xong bán ngay có thể mất tiền?','Vàng có rủi ro gì?','Vàng miễn phí mua bán đúng không?'],cashflow:['Mua vàng ảnh hưởng tiền mặt thế nào?'],learn:['Tôi học được gì từ vàng?']},
 business:{explain:['Quán mang về thu nhập ra sao?','Kinh doanh hoạt động thế nào?'],compare:['Nâng cấp có đáng cân nhắc không?','Bán quán thu hồi được bao nhiêu?'],risk:['Kinh doanh có rủi ro gì?','Nâng cấp chắc chắn hòa vốn đúng không?'],cashflow:['Mua quán ảnh hưởng tiền mặt thế nào?'],learn:['Tôi học được gì từ kinh doanh?']},
 course:{explain:['Thu nhập tăng từ khi nào?','Khóa học hoạt động thế nào?'],compare:['Hai khóa học khác nhau thế nào?','So sánh học phí và tăng lương'],risk:['Học phí có được hoàn lại không?'],cashflow:['Học phí ảnh hưởng tiền mặt thế nào?'],learn:['Tôi học được gì từ khóa học?']},
 personal:{explain:['Tình huống này yêu cầu gì?','Sửa tạm có miễn phí không?'],compare:['Thanh toán ngay hay trả sau khác nhau thế nào?','So sánh trả ngay và sửa tạm'],risk:['Trả sau có rủi ro gì?','Sửa tạm có rủi ro gì?'],cashflow:['Nếu không đủ tiền thì có những nguồn nào hợp lệ?'],learn:['Tôi học được gì từ quyết định này?']},
 macro:{explain:['Tin kinh tế này có nghĩa gì?','Biến cố kinh tế tác động thế nào?'],compare:['Vì sao các tài sản phản ứng khác nhau?'],risk:['Tin tốt có đảm bảo lợi nhuận không?'],cashflow:['Tin kinh tế có làm tăng tiền mặt ngay không?'],learn:['Tôi học được gì từ tin kinh tế?']},
 funding:{explain:['Vì sao tôi phải huy động vốn?'],compare:['Những nguồn thanh toán nào hợp lệ?','Nếu không đủ tiền thì có những nguồn nào hợp lệ?'],risk:['Vay để thanh toán có rủi ro gì?','Rút tiết kiệm trước hạn ảnh hưởng gì?'],cashflow:['Tôi còn thiếu bao nhiêu tiền?'],learn:['Tôi học được gì từ thiếu tiền mặt?']},
 summary:{explain:['START vừa xử lý những gì?','Vì sao tiền mặt thay đổi ở START?'],compare:['Giá trị tài sản và tiền mặt khác nhau thế nào?'],risk:['Đạt mục tiêu có được đảm bảo không?'],cashflow:['Thu nhập và chi phí vòng này là gì?'],learn:['Tôi học được gì từ tổng kết vòng?']},
 rebalancing:{explain:['Tại START tôi được làm gì?'],compare:['Bán tài sản lúc này nhận được gì?'],risk:['Trả nợ ảnh hưởng thanh khoản thế nào?'],cashflow:['Tiền mặt hiện có là bao nhiêu?'],learn:['Tôi học được gì từ tái cân bằng?']},
 forecast:{explain:['Bản tin đầu vòng có nghĩa gì?'],compare:['Giá trị tài sản và tiền mặt khác nhau thế nào?'],risk:['Dự báo có chắc chắn không?'],cashflow:['Thu nhập và sinh hoạt định kỳ là gì?'],learn:['Tôi nên quan sát gì ở vòng này?']},
 overview:{explain:['Tình hình tài chính hiện tại thế nào?'],compare:['Giá trị tài sản và tiền mặt khác nhau thế nào?'],risk:['Đạt mục tiêu có được đảm bảo không?'],cashflow:['Tiền mặt hiện có là bao nhiêu?'],learn:['Tôi nên quan sát gì trước khi gieo xúc xắc?']},
}
export function normalizeQuestion(q:string) {return q.normalize('NFD').replace(/\p{M}/gu,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[?!.:,;]/g,'').replace(/\s+/g,' ').trim()}
export function suggestions(domain:GameplayDomain,profile?:GameplayContext['profile'],context?:GameplayContext):string[] {
 const b=QUESTION_BANK[domain]
 const comparison=domain==='course'&&profile==='core-mvp-b18-v1'?b.compare[1]:context&&['stocks','rebalancing'].includes(domain)&&!context.facts.some(f=>f.code==='net')?b.learn[0]:b.compare[0]
 return [b.explain[0],comparison,b.risk[0]]
}
export function classifyGameplay(q:string,domain:GameplayDomain,eventId?:string|null):GameplayIntent|null {
 const n=normalizeQuestion(q)
 for(const intent of ['explain','compare','risk','cashflow','learn'] as const)if(QUESTION_BANK[domain][intent].some(p=>normalizeQuestion(p)===n))return intent
 if(domain==='personal'&&eventId==='repair'){
  const route=classifyRepairQuestion(q)
  if(route.intent!=='unsupported')return ({rules:'explain',cost:'explain',compare:'compare',liquidity:'cashflow',risk:'risk',learning:'learn'} as const)[route.intent]
 }
 return null
}