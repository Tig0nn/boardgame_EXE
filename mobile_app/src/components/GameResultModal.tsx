import { FinancialTerm } from '../../../src/components/FinancialTerm'
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
    <div className="result-worth"><span><FinancialTerm term="proceeds">Nguồn tiền về đích</FinancialTerm> · Sau phí & nợ</span><strong>{money(funds)}</strong>
      <progress max="100" value={progress} aria-label="Tiến độ nguồn tiền về đích" />
      <div className="result-progress-labels"><span>{Math.round(progress)}% mục tiêu</span><span>{money(target)}</span></div>
    </div>
    <p>{won ? 'Đã hoàn thành đủ ô Xuất phát và đạt mục tiêu.' : game.termination === 'insolvent' ? 'Hành trình dừng vì không còn nguồn thanh toán.' : `Còn ${money(Math.max(0, target - funds))} để đạt mục tiêu.`}</p>
    <FinancialReview game={game} />
    <button className="button primary full-button" onClick={onRestart}>Chơi hành trình mới</button>
    <details><summary>AI Coach · Tùy chọn</summary><AICoachPanel game={game} /></details>
    <details><summary>Chi tiết kết quả & nhật ký</summary>
      <p>Nguồn tiền về đích gồm tiền mặt, gốc tiết kiệm rút được và tiền bán tài sản tài chính theo giá hiện tại sau phí, trừ nợ và khoản phải trả. Đây là cách tính mục tiêu; trò chơi không tự bán tài sản.</p>
      <p><FinancialTerm term="netWorth" />: {money(totalWorth(game))} · Tiền mặt: {money(game.portfolio.cash)}</p>
      <p>Vốn kinh doanh chưa bán và lãi tiết kiệm chưa trả không tính vào nguồn tiền về đích.</p>
      {hasBondCredit(game) && <p><FinancialTerm term="coupon" /> và gốc đang chờ trả không được cộng thêm. Trái phiếu chỉ tính tiền có thể bán nhận sau phí; khoản mà bên phát hành không trả được nợ không có giá bán.</p>}
      <button className="button secondary full-button" onClick={onExport}>Lưu nhật ký hành trình</button>
    </details>
  </Modal>
}
