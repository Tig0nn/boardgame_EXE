import { Modal } from '../../../src/components/Modal'
import { money, signedMoney } from '../../../src/game/format'
import type { GameState } from '../../../src/game/types'

export function LapSummaryModal({
  game,
  onContinue,
}: {
  game: GameState
  onContinue: () => void
}) {
  const summary = game.summaries.at(-1)!

  return (
    <Modal title={`Trạm START · Vòng ${summary.lap}`}>
      <div className="lap-summary-header">
        <span className="lap-badge">Cột Mốc Vòng {summary.lap}/{game.totalLaps}</span>
        <h2 className="lap-title">Trạm Nghỉ START 🏁</h2>
        <p className="lap-subtitle">Tổng kết dòng tiền và thu nhập của bạn trong vòng vừa qua</p>
      </div>

      <div className="lap-summary-card">
        <div className="summary-lines">
          {summary.lines.map((line, i) => (
            <div key={i} className="summary-line-item">
              <span className="line-lbl">{line.label}</span>
              <strong
                className={`line-val ${
                  line.amount > 0 ? 'text-success' : line.amount < 0 ? 'text-danger' : ''
                }`}
              >
                {signedMoney(line.amount)}
              </strong>
            </div>
          ))}
        </div>

        <div className="summary-total-bar">
          <span>Tổng giá trị sau quyết toán:</span>
          <strong className="text-primary">{money(summary.after)}</strong>
        </div>
      </div>

      {summary.fundingNotes.length > 0 && (
        <div className="funding-notes-box">
          {summary.fundingNotes.map((note, i) => (
            <p key={i} className="funding-note-text">
              📌 {note}
            </p>
          ))}
        </div>
      )}

      <button className="button primary full-button mt-3" onClick={onContinue}>
        Vào Phiên Tái Cơ Cấu Danh Mục ➔
      </button>
    </Modal>
  )
}