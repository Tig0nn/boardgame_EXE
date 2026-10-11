import { RULES } from '../data/config'
import { liquidatableFunds } from '../game/selectors'
import { money } from '../game/format'
import type { GameState } from '../game/types'

export function GameStatus({ game }: { game: GameState }) {
  const funds = liquidatableFunds(game)
  return <section className="game-status" aria-label="Tình hình tài chính">
    <div className="status-cash"><span>Tiền mặt</span><strong>{money(game.portfolio.cash)}</strong></div>
    <div className="status-funds"><span>Huy động hợp lệ</span><strong>{money(funds)}</strong></div>
    <div className="status-goal"><span>Mục tiêu <b>{money(RULES.goal + RULES.cashGoal)}</b></span><progress value={funds} max={RULES.goal + RULES.cashGoal} aria-label="Tiến độ mục tiêu 90 triệu" /><small>Sau phí và nợ · Mua món đồ 80 triệu + giữ 10 triệu</small></div>
  </section>
}
