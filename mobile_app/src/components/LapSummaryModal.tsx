import { Modal } from '../../../src/components/Modal'
import { money, signedMoney } from '../../../src/game/format'
import type { GameState } from '../../../src/game/types'
import { buildBondStartSummary, buildStartOverview, cashTone } from '../game/start-summary'
import { BondStartCards, BondStartDetails } from './BondStartSummary'
import { CompactForecastReality } from './MarketNews'
import '../start-summary.css'
import { GoalChecks } from '../../../src/components/GoalChecks'

export function LapSummaryModal({ game, onContinue, onHelp }: { game: GameState; onContinue: () => void; onHelp?: () => void }) {
  const summary = game.summaries.at(-1)!
  const issuers = buildBondStartSummary(game, summary.lap)
  const overview = buildStartOverview(game, summary.lap)
  return <Modal title={`Khép lại vòng ${summary.lap}`} onHelp={onHelp} className="start-summary">
    <div className="start-scroll">
      <span className="section-kicker">START · {summary.lap}/{game.totalLaps}</span>
      <h2>Khép lại vòng {summary.lap}</h2>
      {overview ? <section className="start-overview" aria-label="Tiền thực nhận và đã chi tại START">
        <div className="start-totals"><div><span>Tiền đã nhận</span><strong className={cashTone(overview.received)}>{signedMoney(overview.received)}</strong></div>
          <div><span>Tiền đã chi</span><strong className={cashTone(-overview.paid)}>{signedMoney(-overview.paid)}</strong></div></div>
        <dl className="start-money-rows">
          <div><dt>Lương</dt><dd className={cashTone(overview.salary)}>{signedMoney(overview.salary)}</dd></div>
          {overview.courseIncrease > 0 && <div><dt>Tăng lương từ khóa học</dt><dd className="positive">{signedMoney(overview.courseIncrease)}</dd></div>}
          {(overview.businessRelevant || overview.businessCash !== 0) && <div><dt>Kinh doanh · dòng tiền</dt><dd className={cashTone(overview.businessCash)}>{signedMoney(overview.businessCash)}</dd></div>}
          {overview.savingsReceived > 0 && <div><dt>Tiết kiệm đáo hạn · gốc + lãi</dt><dd className="positive">{signedMoney(overview.savingsReceived)}</dd></div>}
          {overview.bondReceived > 0 && <div><dt>Trái phiếu · đã nhận</dt><dd className="positive">{signedMoney(overview.bondReceived)}</dd></div>}
          {overview.livingPaid !== null && <div><dt>Chi phí sinh hoạt</dt><dd className={cashTone(-overview.livingPaid)}>{signedMoney(-overview.livingPaid)}</dd></div>}
          {overview.fundingReceived > 0 && <div><dt>Tiền huy động · gồm cả vay nếu có</dt><dd className="positive">{signedMoney(overview.fundingReceived)}</dd></div>}
        </dl>
        <p className="start-cash-balance">Tiền mặt hiện có <strong>{money(overview.cashAfter)}</strong></p>
        <p className="start-caption">Đã xử lý các khoản chi tại START.{overview.debtAfter > 0 ? ` Còn nợ ${money(overview.debtAfter)}.` : ''}</p>
      </section> : <p className="start-caption">Chưa đủ dữ liệu dòng tiền. Xem chi tiết giao dịch bên dưới.</p>}
      <BondStartCards issuers={issuers} />
      <details><summary>Tiến độ tới 90 triệu</summary><GoalChecks game={game}/></details>
      <CompactForecastReality game={game} lap={summary.lap} />
      <BondStartDetails issuers={issuers} />
      <details className="start-details start-raw"><summary>Chi tiết giao dịch</summary>
        <p className="start-caption">Bản ghi quyết toán gốc; mỗi dòng giữ nguyên số tiền của engine. Dòng 0 ₫ có thể là ghi chú về khoản chờ hoặc mất, không phải tiền đã nhận.</p>
        <div className="summary-lines">{summary.lines.map((line, i) => <div key={i}>
          <span>{line.label}</span><strong className={cashTone(line.amount)}>{signedMoney(line.amount)}</strong>
        </div>)}</div>
        <p>Tài sản ròng sau quyết toán: <strong>{money(summary.after)}</strong></p>
        {summary.fundingNotes.map((note, i) => <p key={i}>{note}</p>)}
      </details>
    </div>
    <footer className="start-actions"><button className="button primary full-button" onClick={onContinue}>Ghé ví tại START →</button></footer>
  </Modal>
}
