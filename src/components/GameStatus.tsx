import { goalProgress } from '../game/selectors'
import { money } from '../game/format'
import type { GameState } from '../game/types'

export function GameStatus({ game }: { game: GameState }) {
  const {funds,target} = goalProgress(game)
  return <section className="game-status" aria-label="Tình hình tài chính">
    <div className="status-cash"><span>Tiền mặt</span><strong>{money(game.portfolio.cash)}</strong></div>
    <div className="status-funds"><span>Huy động hợp lệ</span><strong>{money(funds)}</strong></div>
    <div className="status-goal"><span>Mục tiêu <b>{money(target)}</b></span><progress value={Math.max(0,funds)} max={target} aria-label="Tiến độ mục tiêu 90 triệu" /><small>Giá trị huy động sau phí, nợ và nghĩa vụ · Vòng {game.lap}/{game.totalLaps}</small></div>
  </section>
}
