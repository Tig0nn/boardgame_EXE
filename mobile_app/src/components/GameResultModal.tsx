import { Modal } from '../../../src/components/Modal'
import { AICoachPanel } from '../../../src/ai/AICoachPanel'
import { goalProgress, totalWorth, victory } from '../../../src/game/selectors'
import { money } from '../../../src/game/format'
import type { GameState } from '../../../src/game/types'
import { FinancialReview } from '../../../src/components/FinancialReview'
import { hasBondCredit } from '../../../src/game/bond-credit'

export function GameResultModal({ game, onRestart, onExport, onHelp }: {
  game: GameState; onRestart: () => void; onExport: () => void; onHelp?: () => void
}) {
  const won = victory(game).won
  const {funds,target,percent:progress}=goalProgress(game)
  return <Modal title="Kết quả hành trình" onHelp={onHelp} className="game-result">
    <span className="section-kicker">Vòng {game.lap}/{game.totalLaps}</span>
    <div className="result-medal" aria-hidden="true">{won ? '🏆' : '🌱'}</div>
    <h2>{game.termination === 'insolvent' ? 'Hẹn một hành trình mới!' : won ? 'Bạn đã chạm đích!' : 'Thêm một bước trưởng thành'}</h2>
    {game.termination === 'insolvent' && <p>Còn thiếu {money(game.pendingPayment?.remaining ?? 0)}; không còn nguồn hợp lệ.</p>}
    <div className="result-worth"><span>Nguồn tiền về đích · Sau phí & nợ</span><strong>{money(funds)}</strong>
      <progress max="100" value={progress} aria-label="Tiến độ nguồn tiền về đích" />
      <div className="result-progress-labels"><span>{Math.round(progress)}% mục tiêu</span><span>{money(target)}</span></div>
    </div>
    <p>{won ? 'Đã hoàn thành đủ START và đạt mục tiêu.' : game.termination === 'insolvent' ? 'Hành trình dừng vì không còn nguồn thanh toán.' : `Còn ${money(Math.max(0, target - funds))} để đạt mục tiêu.`}</p>
    <FinancialReview game={game} />
    <button className="button primary full-button" onClick={onRestart}>Chơi hành trình mới</button>
    <details><summary>AI Coach · Tùy chọn</summary><AICoachPanel game={game} /></details>
    <details><summary>Chi tiết kết quả & nhật ký</summary>
      <p>Giá trị huy động hợp lệ là tiền mặt + gốc tiết kiệm rút được + giá bán tài sản tài chính sau phí, trừ nợ và khoản phải trả.</p>
      <p>Tài sản ròng: {money(totalWorth(game))} · Tiền mặt: {money(game.portfolio.cash)}</p>
      <p>Vốn kinh doanh chưa bán và lãi tiết kiệm chưa trả không tính vào nguồn tiền về đích.</p>
      {hasBondCredit(game) && <p>Coupon và gốc đang chờ trả không được cộng thêm. Trái phiếu chỉ tính giá bán khả dụng sau phí; khoản vỡ nợ không có giá bán.</p>}
      <button className="button secondary full-button" onClick={onExport}>Lưu nhật ký hành trình</button>
    </details>
  </Modal>
}
