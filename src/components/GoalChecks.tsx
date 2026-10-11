import { RULES } from '../data/config'
import { victory } from '../game/engine'
import { money } from '../game/format'
import type { GameState } from '../game/types'
import { Icon } from './Icon'

export function GoalChecks({ game }: { game?: GameState }) {
  const result = game ? victory(game) : null
  return <div className="goal-conditions" aria-label="Hai điều kiện chiến thắng">
    <div className={result?.wealth ? 'met' : ''}><Icon name={result ? result.wealth ? 'check' : 'close' : 'flag'} size={16} />{result && <span className="sr-only">{result.wealth ? 'Đạt' : 'Chưa đạt'}.</span>}<span>Đủ nguồn hợp lệ mua món đồ: <strong>{money(RULES.goal)}</strong></span></div>
    <div className={result?.liquidity ? 'met' : ''}><Icon name={result ? result.liquidity ? 'check' : 'close' : 'wallet'} size={16} />{result && <span className="sr-only">{result.liquidity ? 'Đạt' : 'Chưa đạt'}.</span>}<span>Còn sau mua: <strong>ít nhất {money(RULES.cashGoal)}</strong> · Cần huy động tổng {money(RULES.goal + RULES.cashGoal)}</span></div>
  </div>
}
