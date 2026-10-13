import { Modal } from '../../../src/components/Modal'
import { AICoachPanel } from '../../../src/ai/AICoachPanel'
import { liquidatableFunds, totalWorth, victory } from '../../../src/game/selectors'
import { money } from '../../../src/game/format'
import { RULES } from '../../../src/data/config'
import type { GameState } from '../../../src/game/types'

export function GameResultModal({ game, onRestart, onExport }: {
  game: GameState; onRestart: () => void; onExport: () => void
}) {
  const won = victory(game).won
  return <Modal title="Kết quả hành trình">
    <span className="section-kicker">Vòng {game.lap}/{game.totalLaps}</span>
    <h2>{game.termination === 'insolvent' ? 'Mất khả năng thanh toán' : won ? 'Bạn đã chạm đích!' : 'Chưa đạt mục tiêu'}</h2>
    {game.termination === 'insolvent' && <p>Còn thiếu {money(game.pendingPayment?.remaining ?? 0)}; không còn nguồn hợp lệ.</p>}
    <div className="result-worth"><span>Huy động hợp lệ sau phí và nợ</span><strong>{money(liquidatableFunds(game))}</strong></div>
    <p>Mua món đồ {money(RULES.goal)} · Dự phòng {money(RULES.cashGoal)}</p>
    <p>Tài sản ròng: {money(totalWorth(game))} · Tiền mặt: {money(game.portfolio.cash)}</p>
    <p>Vốn kinh doanh chưa bán và lãi tiết kiệm chưa trả không tính vào nguồn huy động.</p>
    <AICoachPanel game={game} />
    <button className="button secondary full-button" onClick={onExport}>Tải nhật ký JSON</button>
    <button className="button primary full-button" onClick={onRestart}>Chơi hành trình mới</button>
  </Modal>
}