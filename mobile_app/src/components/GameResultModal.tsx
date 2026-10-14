import { Modal } from '../../../src/components/Modal'
import { AICoachPanel } from '../../../src/ai/AICoachPanel'
import { liquidatableFunds, totalWorth, victory } from '../../../src/game/selectors'
import { money } from '../../../src/game/format'
import { RULES } from '../../../src/data/config'
import type { GameState } from '../../../src/game/types'

export function GameResultModal({
  game,
  onRestart,
  onExport,
}: {
  game: GameState
  onRestart: () => void
  onExport: () => void
}) {
  const won = victory(game).won
  const funds = liquidatableFunds(game)
  const target = RULES.goal + RULES.cashGoal
  const progressPercent = Math.min(Math.round((funds / target) * 100), 100)

  const isBankrupt = game.termination === 'insolvent'

  return (
    <Modal title="Kết Quả Cuộc Đua Tài Chính">
      <div className="result-hero-box">
        <span className="result-badge">Hoàn Thành 4 Vòng</span>
        <h2 className={`result-title ${won ? 'text-success' : isBankrupt ? 'text-danger' : 'text-accent'}`}>
          {isBankrupt ? 'Cạn Kiệt Thanh Khoản ⚠️' : won ? 'Chiến Thắng Vẻ Vang! 🏆' : 'Chưa Đạt Mục Tiêu 🎯'}
        </h2>
        <p className="result-subtitle">
          {won
            ? 'Chúc mừng! Bạn đã hoàn thành xuất sắc mục tiêu tài chính tự chủ.'
            : isBankrupt
            ? 'Bạn không còn đủ nguồn tiền mặt hay tài sản để chi trả các khoản bắt buộc.'
            : 'Bạn đã hoàn thành 4 vòng, hãy xem phân tích của AI để tối ưu hóa chiến lược.'}
        </p>
      </div>

      <div className="result-score-card">
        <div className="result-score-top">
          <span className="lbl">Tổng Nguồn Tiền Thực Thu</span>
          <strong className={`val ${won ? 'text-success' : 'text-primary'}`}>
            {money(funds)}
          </strong>
        </div>

        <div className="result-progress-track">
          <div
            className={`result-progress-fill ${won ? 'bg-success' : 'bg-primary'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="result-progress-labels">
          <span>Tiến độ: {progressPercent}%</span>
          <span>Mục tiêu: {money(target)}</span>
        </div>
      </div>

      <div className="result-stats-row">
        <div className="stat-pill">
          <span>Tài sản ròng:</span>
          <strong>{money(totalWorth(game))}</strong>
        </div>
        <div className="stat-pill">
          <span>Tiền mặt cuối:</span>
          <strong>{money(game.portfolio.cash)}</strong>
        </div>
      </div>

      <div className="result-ai-coach-section">
        <AICoachPanel game={game} />
      </div>

      <div className="result-actions-stack">
        <button className="button primary full-button" onClick={onRestart}>
          Bắt Đầu Hành Trình Mới 🚀
        </button>
        <button className="button secondary full-button" onClick={onExport}>
          Tải Xuất Nhật Ký Ván Đấu (JSON)
        </button>
      </div>
    </Modal>
  )
}