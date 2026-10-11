import type { GameEvent } from '../game/types.ts'
import { ECONOMY, RULES, MACRO_EVENTS } from './config.ts'
import { money } from '../game/format.ts'

const skip = { id: 'skip', label: 'Bỏ qua cơ hội', detail: 'Giữ tiền mặt, không thay đổi danh mục.' }
const payment = (cost: number) => ({ id: 'pay', label: `Thanh toán ${money(cost)}`, detail: 'Nếu thiếu tiền, bạn chọn nguồn thanh toán.', cost })
const defer = (obligation: number) => ({ id: 'defer', label: 'Thanh toán cuối vòng', detail: `Nghĩa vụ tại START +${money(obligation)}.`, obligation })
export const EVENTS: GameEvent[] = [
  ...(['stocks', 'bonds', 'gold', 'business'] as const).map(asset => ({
    id: asset, category: 'investment' as const,
    title: { stocks: 'Cổ phiếu hư cấu', bonds: 'Trái phiếu hư cấu', gold: 'Vàng giả lập', business: 'Cơ sở kinh doanh' }[asset],
    description: 'Chỉ giao dịch tại ô tương ứng. Xem báo giá và dòng tiền trước khi quyết định.', options: [skip],
  })),
  { id: 'bank', category: 'investment', title: 'Ngân hàng', description: 'Mỗi lần gửi tạo khoản riêng, kỳ hạn 1/2/3 lần qua START; không tự tái tục.', options: [skip] },
  { id: 'course', category: 'income', title: 'Khóa học chuyên môn', description: 'Học một lần trong màn. Lương tăng từ START kế tiếp; học phí không hoàn lại.', options: [
    { id: 'upgrade', label: `Tham gia khóa học ${money(RULES.courseCost)}`, detail: `Lương +${money(RULES.courseBoost)}/vòng từ START kế tiếp.`, cost: RULES.courseCost, recurringIncomeIncrease: RULES.courseBoost }, skip] },
  { id: 'living', category: 'obligation', title: 'Chi phí sinh hoạt', description: 'Bắt buộc khi dừng đúng ô. Đi ngang qua không trả; START không trừ lại.', options: [payment(RULES.livingCost)] },
  { id: 'medical', category: 'shock', title: 'Một hóa đơn bất ngờ', description: 'Chi phí khám chữa bệnh cần được giải quyết.', options: [payment(ECONOMY.personal.medical[0]), defer(ECONOMY.personal.medical[1])] },
  { id: 'repair', category: 'shock', title: 'Chiếc xe cần sửa', description: 'Chọn sửa ngay hoặc sửa tạm rồi thanh toán phần còn lại.', options: [
    { ...payment(ECONOMY.personal.repair[0]), id: 'full' }, { id: 'temporary', label: 'Sửa tạm, hoàn tất cuối vòng', detail: `Trả ${money(ECONOMY.personal.repair[1])} ngay + ${money(ECONOMY.personal.repair[2])} tại START.`, cost: ECONOMY.personal.repair[1], obligation: ECONOMY.personal.repair[2] }] },
  { id: 'family', category: 'shock', title: 'Gia đình cần hỗ trợ', description: 'Chọn thời điểm thanh toán phù hợp với dòng tiền.', options: [payment(ECONOMY.personal.family[0]), defer(ECONOMY.personal.family[1])] },
  { id: 'bills', category: 'obligation', title: 'Đến kỳ thanh toán', description: 'Trả sớm được giảm phí.', options: [payment(ECONOMY.obligation.bills[0]), defer(ECONOMY.obligation.bills[1])] },
  { id: 'contract', category: 'obligation', title: 'Khoản phí hợp đồng', description: 'Một khoản phí đã cam kết đến hạn.', options: [payment(ECONOMY.obligation.contract[0]), defer(ECONOMY.obligation.contract[1])] },
  { id: 'bonus', category: 'obligation', title: 'Thưởng hợp đồng', description: 'Bạn nhận khoản thưởng một lần, không tăng lương định kỳ.', options: [{ id: 'receive', label: 'Nhận thưởng', detail: `Tiền mặt +${money(ECONOMY.obligation.bonus)}.`, income: ECONOMY.obligation.bonus }] },
  ...MACRO_EVENTS.map(event => ({ id: event.id, category: 'shock' as const, title: event.label,
    description: 'Cú sốc đã cập nhật ngay toàn thị trường và trạng thái kinh doanh, kể cả tài sản bạn chưa sở hữu. Không lặp tại START.',
    options: [{ id: 'acknowledge', label: 'Đã xem tác động', detail: 'Tiếp tục từ giá sau cú sốc.' }] })),
]
