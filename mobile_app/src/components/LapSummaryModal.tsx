import { Modal } from '../../../src/components/Modal'
import { money, signedMoney } from '../../../src/game/format'
import type { GameState } from '../../../src/game/types'

export function LapSummaryModal({ game, onContinue, onHelp }: { game: GameState; onContinue: () => void; onHelp?: () => void }) {
  const summary = game.summaries.at(-1)!
  return <Modal title={`Khép lại vòng ${summary.lap}`} onHelp={onHelp}>
    <span className="section-kicker">START · {summary.lap}/{game.totalLaps}</span>
    <h2>Khép lại vòng {summary.lap}</h2>
    <div className="summary-lines">{summary.lines.map((line, i) => <div key={i}>
      <span>{line.label}</span><strong className={line.amount >= 0 ? 'positive' : 'negative'}>{signedMoney(line.amount)}</strong>
    </div>)}</div>
    <p>Tài sản ròng sau quyết toán: <strong>{money(summary.after)}</strong></p>
    {summary.fundingNotes.length > 0 && <details><summary>Chi tiết thanh toán</summary>{summary.fundingNotes.map((note, i) => <p key={i}>{note}</p>)}</details>}
    <button className="button primary full-button" onClick={onContinue}>Ghé ví tại START →</button>
  </Modal>
}
