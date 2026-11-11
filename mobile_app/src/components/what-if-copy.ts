import { money } from '../../../src/game/format.ts'
import type { RepairWhatIf } from '../../../src/game/what-if.ts'
import type { RepairAnalysis } from '../../../src/game/what-if-analysis.ts'

/** Display copy only: shorten the existing analysis; do not compute new financial conclusions. */
export function compactRepairCopy(c: RepairWhatIf, analysis: RepairAnalysis) {
  if (analysis.status === 'invalid') return { quick: ['Chưa thể kết luận vì dữ liệu không nhất quán.'], insights: analysis.sections }
  const [evaluation, , risk, lesson] = analysis.sections
  const paid = c.actual.status === 'paid' && c.alternative.status === 'paid'
  const name = (choice: string) => choice === 'full' ? 'Sửa ngay' : 'Sửa tạm'
  const quick = paid ? [
    `Sửa tạm giữ thêm ${money(c.temporaryCashKept)} tiền mặt, đổi lại tổng cam kết cao hơn ${money(c.temporaryExtraCost)}.`,
    'Đây là chi phí trì hoãn; chưa cho biết tiền giữ lại sẽ mang lại lợi ích gì.',
  ] : [
    `${name(c.alternative.choice)} ${c.alternative.status === 'paid' ? 'trả được ngay; lựa chọn thực tế vẫn cần tài trợ.' : 'chưa trả đủ chỉ với tiền mặt hiện có.'}`,
    'Chưa thể so tổng chi phí sau tài trợ khi chưa chọn nguồn tiền.',
  ]
  let riskText: string
  switch (risk.id) {
    case 'reserve-covered': riskText = 'Cả hai còn đủ tiền mặt đối chiếu các khoản đã biết; chưa thấy nhu cầu giữ thêm tiền từ riêng các khoản này.'; break
    case 'reserve-alternative-shortfall': riskText = `Phương án khác thiếu ${money(-Number(analysis.facts['reserve.alternative'].value))} để dành cho các khoản đã biết, dù trả được sửa xe ngay.`; break
    case 'reserve-shortfall': riskText = `Lựa chọn thực tế thiếu ${money(-Number(analysis.facts['reserve.actual'].value))} dự phòng cho các khoản đã biết.${Number(analysis.facts['reserve.alternative'].value) < 0 ? ' Đổi phương án cũng chưa đủ.' : ' Phương án khác khép được khoảng thiếu tĩnh này.'}`; break
    case 'context-missing': riskText = 'Thiếu dữ liệu nghĩa vụ cũ; chưa đánh giá được tiền còn lại có bao phủ các khoản đã biết hay không.'; break
    default: riskText = 'Có nhánh chưa trả đủ. Nghĩa vụ sửa xe trả chậm chỉ phát sinh khi thanh toán đủ phần trả ngay.'
  }
  return { quick, insights: [
    { id: evaluation.id, text: c.actual.status === 'paid'
      ? c.actual.choice === 'full'
        ? 'Bạn chốt chi phí thấp hơn mà không cần huy động vốn.'
        : 'Bạn giữ thanh khoản bằng cách hoãn chi; phần hoãn vẫn phải trả ở Xuất phát.'
      : c.actual.status === 'insolvent' ? 'Lựa chọn thực tế không còn nguồn thanh toán hợp lệ.' : 'Lựa chọn thực tế vẫn cần nguồn tiền để hoàn tất.' },
    { id: risk.id, text: riskText },
    { id: lesson.id, text: lesson.id === 'lesson-funding'
      ? 'Phí và lãi của nguồn tài trợ chưa được mô phỏng; chưa thể xếp hạng chi phí sau tài trợ.'
      : lesson.id === 'lesson-reserve'
        ? 'Thiếu dự phòng tĩnh không đồng nghĩa sẽ mất khả năng thanh toán; chưa bù thu nhập hoặc đáo hạn.'
        : 'Chưa có bằng chứng tiền giữ lại sẽ sinh lời hay tránh biến cố. Đánh giá có thể đổi nếu có nhu cầu chi được xác nhận.' },
  ] }
}
