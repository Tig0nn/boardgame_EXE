import { FinancialTerm } from './FinancialTerm'
import { goalForGame, CORE_MVP_RULES } from '../game/rules-profile'
import { goalProgress } from '../game/selectors'
import { money } from '../game/format'
import type { GameState } from '../game/types'
import { Icon } from './Icon'

export function GoalChecks({ game }: { game?: GameState }) {
  const target=game?goalForGame(game).target:CORE_MVP_RULES.goal,progress=game?goalProgress(game):null
  return <div className="goal-conditions" aria-label="Mục tiêu tích lũy 90 triệu">
    <div className={progress&&progress.funds>=target?'met':''}><Icon name="flag" size={16}/><span>Tích lũy đủ <strong>{money(target)}</strong> sau {game?.totalLaps??4} vòng.</span></div>
    <p><FinancialTerm term="proceeds" /> = tiền mặt + gốc tiết kiệm rút được + tiền bán tài sản tài chính sau phí, trừ nợ/khoản phải trả. Không tính quán chưa bán, lãi/lãi trái phiếu định kỳ chưa nhận; không tự bán tài sản.</p>
    {progress&&<p>Hiện có thể huy động <strong>{money(progress.funds)}</strong> · {progress.remaining>0?`Còn ${money(progress.remaining)} để đạt mục tiêu.`:'Đã đạt ngưỡng tài chính; cần hoàn thành đủ vòng và còn khả năng thanh toán.'}</p>}
  </div>
}
