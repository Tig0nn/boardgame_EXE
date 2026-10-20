import { courseChoices } from '../game/courses'
import { money, signedMoney } from '../game/format'
import type { GameState } from '../game/types'
import './course-choices.css'
import { FinancialTerm } from './FinancialTerm'

// The same body is used by Desktop and Mobile; game decisions remain in the engine.
export function CourseChoices({ game, onChoose }: { game: GameState; onChoose: (id: string) => void }) {
  const choices = courseChoices(game)
  if (choices.every(c => c.owned)) return <section className="course-choices" aria-label="Đầu tư bản thân">
    <h2>Đã hoàn thành cả hai khóa</h2><p>Lương hiện tại: <strong>{money(game.recurringIncome)} / lần qua ô Xuất phát</strong>.</p>
    <button className="button primary full-button" onClick={() => onChoose('skip')}>Tiếp tục</button>
  </section>
  return <section className="course-choices" aria-label="Đầu tư bản thân">
    <span className="section-kicker">VÒNG {game.lap} · Ô {game.position + 1}</span>
    <h2>Đầu tư bản thân</h2>
    <p className="course-intro">Hai khóa độc lập · Mỗi lần ghé mua một khóa bằng tiền mặt.</p>
    <p>Tiền mặt: <strong>{money(game.portfolio.cash)}</strong></p>
    <div className="course-card-list">{choices.map(c => <article className="course-card" key={c.id} aria-labelledby={`course-${c.id}-name`}>
      <div className="course-card-heading"><h3 id={`course-${c.id}-name`}>{c.name}</h3><span className={`course-status ${c.owned ? 'learned' : c.canBuy ? '' : 'unavailable'}`}>{c.owned ? 'Đã học' : c.canBuy ? 'Chưa học' : 'Không đủ tiền'}</span></div>
      <dl><div><dt>Học phí</dt><dd>{money(c.cost)}</dd></div><div><dt>Lương tăng / lần qua ô Xuất phát</dt><dd>+{money(c.boost)}</dd></div></dl>
      <details className="course-projection"><summary>Xem thu nhập còn lại</summary>
        <dl><div><dt>Số lần qua ô Xuất phát còn lại</dt><dd>{c.remainingStarts}</dd></div><div><dt>Thu nhập thêm còn có thể nhận</dt><dd>{money(c.nominalIncome)}</dd></div>
        <div className="course-net"><dt>Thu nhập còn lại − học phí</dt><dd>{signedMoney(c.netAfterFee)}</dd></div></dl>
        <p className="course-note"><FinancialTerm term="payback" />: cần {Math.ceil(c.cost/c.boost)} lần qua ô Xuất phát nhận lương thêm để bù học phí theo phép tính danh nghĩa.</p>
        <p className="course-note">Tính danh nghĩa nếu đi đủ số lần qua ô Xuất phát còn lại; chưa cộng lương đã nhận hay chi phí cơ hội/bất ngờ. Đây không phải lợi nhuận bảo đảm hoặc khuyến nghị chọn khóa.</p>
      </details>
      <button className="button primary full-button" disabled={!c.canBuy} onClick={() => onChoose(`course-${c.id}`)}>{c.owned ? 'Đã hoàn thành' : `Mua ${c.name.toLowerCase()}`}</button>
    </article>)}</div>
    <p className="course-note">Không vay mới để học. Lương tăng từ lần qua ô Xuất phát kế tiếp; học phí không hoàn lại.</p>
    <button className="button secondary full-button course-skip" onClick={() => onChoose('skip')}>Bỏ qua</button>
  </section>
}
