import { hasPeriodicLiving, PERIODIC_LIVING_COST } from '../../../src/game/living-expenses.ts'
import { RULES } from '../../../src/data/config.ts'
import type { LivingExpenseRulesVersion } from '../../../src/game/types.ts'
import type { GameplayProfile } from '../../../src/game/types.ts'
import { isCoreMvp } from '../../../src/game/rules-profile.ts'

export function livingPresentation(game?: { livingExpenseRulesVersion?: LivingExpenseRulesVersion; gameplayProfile?: GameplayProfile }) {
  if(game===undefined||isCoreMvp(game))return {periodic:true,amount:5e6,label:'Sinh hoạt mỗi START',text:'Mỗi khi hoàn thành một vòng qua START, nhận lương rồi thanh toán5 triệu sinh hoạt.',detail:'Thu cả START vòng 4; không thu lúc bắt đầu ván. Biến cố cá nhân tại ô 4 là chi phí bất ngờ riêng. Bạn tự chọn mức dự phòng phù hợp.'}
  const periodic = game === undefined || hasPeriodicLiving(game)
  return periodic ? {
    periodic, amount: PERIODIC_LIVING_COST, label: 'Sinh hoạt mỗi START',
    text: 'Mỗi khi hoàn thành một vòng và qua START, bạn nhận lương và tự động thanh toán 7 triệu tiền sinh hoạt.',
    detail: 'Chuẩn bị tiền cho sinh hoạt mỗi vòng, kể cả vòng 4; không thu khi bắt đầu ván. Biến cố cá nhân ở ô 8 và 18 là khoản bất ngờ riêng: sửa xe, khám bệnh hoặc hỗ trợ gia đình. Giữ thanh khoản cho cả hai loại chi phí.',
  } : {
    periodic, amount: RULES.livingCost, label: 'Sinh hoạt khi dừng đúng ô',
    text: 'Dừng ở ô Sinh hoạt 4 hoặc 15 cần trả 7 triệu. Đi ngang qua và qua START không thu khoản này.',
    detail: 'Phiên lịch sử giữ luật và bàn cờ gốc. Biến cố cá nhân tại ô 8 và 18 vẫn là chi phí riêng, với lựa chọn thanh toán ngay hoặc hẹn cuối vòng.',
  }
}
