import { Modal } from '../../../src/components/Modal'
import { money, signedMoney } from '../../../src/game/format'
import type { GameState } from '../../../src/game/types'

export function LapSummaryModal({ game, onContinue }: { game: GameState; onContinue: () => void }) {
  const summary = game.summaries.at(-1)!
  return <Modal title={`Quyết toán vòng ${summary.lap}`}>
    <span className="section-kicker">START · {summary.lap}/{game.totalLaps}</span>
    <h2>Quyết toán vòng {summary.lap}</h2>
    <div className="summary-lines">{summary.lines.map((line, i) => <div key={i}>
      <span>{line.label}</span><strong>{signedMoney(line.amount)}</strong>
    </div>)}</div>
    <p>Tài sản ròng sau quyết toán: <strong>{money(summary.after)}</strong></p>
    {summary.fundingNotes.map((note, i) => <p key={i}>{note}</p>)}
    <button className="button primary full-button" onClick={onContinue}>Mở quyền bán tại START</button>
  </Modal>
}