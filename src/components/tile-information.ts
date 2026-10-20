import type {GameState,TileType} from '../game/types.ts'
import {isMultiCourse,rulesForGame,MULTI_COURSE_RULES} from '../game/rules-profile.ts'
import {hasPeriodicLiving} from '../game/living-expenses.ts'
import {tileTradingEnabled,singleActionEncounters,businessPurchaseCompletes} from '../game/encounters.ts'
import {hasBondCredit} from '../game/bond-credit.ts'

export function tileInformation(type:TileType,game?:GameState):string{
  const rules=game?rulesForGame(game):MULTI_COURSE_RULES
  const tileSales=!game||tileTradingEnabled(game)
  const trade=tileSales?'Mua hoặc bán tại ô, tối đa một giao dịch thành công mỗi lần ghé.':'Mua tại ô; bán tại ô Xuất phát hoặc khi cần huy động tiền thanh toán.'
  switch(type){
    case 'start':return `Qua ô Xuất phát nhận lương, cập nhật thị trường và xử lý khoản đến hạn${!game||hasPeriodicLiving(game)?`, sinh hoạt ${rules.livingCost/1e6} triệu`:''}, nợ/nghĩa vụ. Có quyền bán tài sản tài chính, không bán quán. Hoàn thành ${game?.totalLaps??4} lần qua ô Xuất phát thì xét mục tiêu.`
    case 'bank':return `${!game||singleActionEncounters(game)?'Gửi một khoản mới mỗi lần ghé':'Gửi tiết kiệm tại ô'}, chọn kỳ hạn 1/2/3 kỳ (mỗi kỳ là một lần qua ô Xuất phát). Rút sớm khi thiếu tiền mất lãi chưa nhận; giữ tiền mặt cho nhu cầu trước hạn.`
    case 'stocks':return `${trade} Giá cổ phiếu có thể giảm; tiền thực nhận khi bán đã trừ phí. Có thể bỏ qua.`
    case 'gold':return `${trade} Vàng không trả lãi định kỳ; giá có thể giảm, khi bán chịu chênh lệch mua/bán và phí.`
    case 'bonds':return `${trade} ${!game||hasBondCredit(game)?'Chọn nhà phát hành; lãi trái phiếu định kỳ cao đi cùng rủi ro chậm trả hoặc mất vốn. Lãi trái phiếu định kỳ/gốc chưa nhận chưa phải tiền mặt.':'Trái phiếu theo hợp đồng đã lưu; nhận lãi trái phiếu định kỳ/gốc khi tới hạn. Bán trước hạn chịu giá thị trường và phí.'}`
    case 'course':return !game||isMultiCourse(game)?'Hai khóa độc lập: 6 triệu / +2 triệu và 10 triệu / +4 triệu lương mỗi lần qua ô Xuất phát. Mỗi lần ghé học một khóa bằng tiền mặt, tăng lương từ lần qua ô Xuất phát kế tiếp; phí không hoàn lại. Có thể bỏ qua.':`Học một lần: ${rules.courseCost!/1e6} triệu / +${rules.courseBoost!/1e6} triệu lương mỗi lần qua ô Xuất phát kế tiếp. Chỉ dùng tiền mặt; học phí không hoàn lại. Đã học thì tiếp tục.`
    case 'macro':return 'Sự kiện đổi giá thị trường và giá trị quán ngay, kể cả tài sản chưa sở hữu. Xem tác động rồi tiếp tục; cú sốc không lặp lại tại ô Xuất phát.'
    case 'personal':return 'Gặp một trong ba tình huống: khám bệnh, sửa xe hoặc hỗ trợ gia đình. Chọn thanh toán ngay hay hẹn theo tình huống; thiếu tiền phải chọn nguồn huy động tiền thanh toán, có thể mất lãi hoặc phát sinh nợ.'
    case 'business':return `${game&&!businessPurchaseCompletes(game)?'Mua hoặc bán quán tại ô; nâng cấp từ lần ghé sau.':'Mua quán; từ lần ghé sau có thể nâng cấp hoặc bán.'} Quán tạo dòng tiền tại ô Xuất phát nhưng giá bán có thể giảm. Chỉ bán tại ô Kinh doanh; vốn chưa bán không tính vào đích.`
    case 'living':return 'Dừng đúng ô phải trả sinh hoạt theo luật ván cũ. Đi ngang không trả lại; thiếu tiền cần chọn nguồn thanh toán.'
    case 'obligation':return 'Gặp khoản thu hoặc khoản phải trả theo ván đã lưu. Đọc lựa chọn và thời hạn trước khi quyết định; khoản hẹn được xử lý tại ô Xuất phát.'
  }
}
