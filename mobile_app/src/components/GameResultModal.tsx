import { Modal } from '../../../src/components/Modal'
import { AICoachPanel } from '../../../src/ai/AICoachPanel'
import { liquidatableFunds, totalWorth, victory } from '../../../src/game/selectors'
import { money } from '../../../src/game/format'
import { RULES } from '../../../src/data/config'
import type { GameState } from '../../../src/game/types'

export function GameResultModal({ game, onRestart, onExport, onHelp }: {
  game: GameState; onRestart: () => void; onExport: () => void; onHelp?: () => void
}) {
  const won = victory(game).won
  return <Modal title="Kết quả hành trình" onHelp={onHelp} className="game-result">
    <span className="section-kicker">Vòng {game.lap}/{game.totalLaps}</span>
    <div className="result-medal" aria-hidden="true">{won ? '🏆' : '🌱'}</div>
    <h2>{game.termination === 'insolvent' ? 'Hẹn một hành trình mới!' : won ? 'Bạn đã chạm đích!' : 'Thêm một bước trưởng thành'}</h2>
    {game.termination === 'insolvent' && <p>Còn thiếu {money(game.pendingPayment?.remaining ?? 0)}; không còn nguồn hợp lệ.</p>}
    <div className="result-worth"><span>Nguồn tiền về đích · Sau phí & nợ</span><strong>{money(liquidatableFunds(game))}</strong></div>
    <p>{won ? 'Đủ cho ước mơ và một khoản dự phòng!' : 'Chưa đủ 90 triệu lần này. Thử một chiến lược mới nhé!'}</p>
    <button className="button primary full-button" onClick={onRestart}>Chơi hành trình mới</button>
    <details><summary>Nhìn lại hành trình</summary><AICoachPanel game={game} /></details>
    <details><summary>Chi tiết kết quả & nhật ký</summary>
      <p>Món đồ {money(RULES.goal)} · Dự phòng {money(RULES.cashGoal)}</p>
      <p>Tài sản ròng: {money(totalWorth(game))} · Tiền mặt: {money(game.portfolio.cash)}</p>
      <p>Vốn kinh doanh chưa bán và lãi tiết kiệm chưa trả không tính vào nguồn tiền về đích.</p>
      <button className="button secondary full-button" onClick={onExport}>Lưu nhật ký hành trình</button>
    </details>
  </Modal>
}
