import { FinancialTerm } from './FinancialTerm'
import { ASSETS, RULES } from '../data/config'
import { totalWorth } from '../game/engine'
import { liquidatableFunds, goalProgress } from '../game/selectors'
import { hasPeriodicLiving, livingCostForGame } from '../game/living-expenses'
import { money } from '../game/format'
import type { GameState } from '../game/types'
import { Icon } from './Icon'
import { GoalChecks } from './GoalChecks'
import { hasBondCredit } from '../game/bond-credit'
import { BondHoldings } from './BondHoldings'
import { investmentLotLabel, maturityLabel, savingsPeriodExplanation } from './player-language'
import './Portfolio.css'

export function Portfolio({ game, compact = false }: { game: GameState; compact?: boolean }) {
  const worth = totalWorth(game)
  const funds = liquidatableFunds(game)
  const progress = goalProgress(game).percent
  const activeDeposits = game.deposits.filter(lot => lot.status === 'active')
  const remainingSalaryReceipts = game.phase === 'finished' ? 0 : game.totalLaps - game.lap + (game.summaries.some(summary => summary.lap === game.lap) ? 0 : 1)
  return <aside className="portfolio panel">
    <div className="panel-heading"><h2>Tài sản của bạn</h2><Icon name="wallet" /></div>
    <div className="net-worth"><span><FinancialTerm term="netWorth">TỔNG TÀI SẢN RÒNG</FinancialTerm></span><strong>{money(worth)}</strong><small className={worth >= RULES.startingCapital ? 'positive' : 'negative'}>{worth >= RULES.startingCapital ? '+' : ''}{money(worth - RULES.startingCapital)} <span>so với ban đầu</span></small></div>
    <div className="goal-track"><div className="goal-track-summary"><span>Nguồn tiền về đích {money(funds)}</span><strong>{Math.round(progress)}%</strong></div><progress max="100" value={progress} aria-label="Tiến độ tích lũy 90 triệu" />{compact ? <details><summary>Cách tính mục tiêu</summary><GoalChecks game={game} /></details> : <><p>Còn tới mục tiêu: {money(goalProgress(game).remaining)}</p><GoalChecks game={game} /></>}</div>
    <div className="asset-list">{Object.entries(ASSETS).map(([key, asset]) => {
      const amount = game.portfolio[key as keyof typeof ASSETS]
      const locked = key !== 'cash' && key !== 'savings' && amount === 0 && !game.unlockedAssets.includes(key as 'stocks' | 'bonds' | 'gold' | 'business')
      return <div key={key} className={`asset-row ${locked ? 'unowned' : ''}`}><span className={`asset-icon ${key}`}><Icon name={asset.icon} size={18} /></span><div><span>{asset.label}</span>{key === 'cash' && <small>Tiền mặt dùng ngay</small>}{key === 'savings' && <small>{game.deposits.filter(lot => lot.status === 'active').length} khoản chưa đáo hạn</small>}{key === 'business' && amount > 0 && <small>Chỉ bán tại ô Kinh doanh</small>}{locked && <small>Chờ cơ hội trên bàn cờ</small>}</div><strong>{locked ? '—' : money(amount)}</strong></div>
    })}</div>
    {hasBondCredit(game) && game.bondLots.length > 0 && <details><summary>Trái phiếu theo tổ chức phát hành</summary><BondHoldings game={game} /></details>}
    <div className="deposit-list">{activeDeposits.map(lot => <article className="deposit-card" key={lot.id}>
      <h3>{investmentLotLabel('savings', lot.id)}</h3>
      <dl><div><dt>Tiền gốc</dt><dd>{money(lot.principal)}</dd></div><div><dt>Lãi suất</dt><dd>{Math.round(lot.rate * 100)}% mỗi kỳ</dd></div></dl>
      <p>{maturityLabel(lot.maturityLap)}</p>
    </article>)}{activeDeposits.length > 0 && <p className="savings-period-note">{savingsPeriodExplanation}</p>}</div>
    {!compact && <p className="portfolio-checkpoint">Mua/bán tại ô tài chính theo phiên bản ván; vẫn bán tại ô Xuất phát. Khi thiếu tiền bắt buộc, bạn chọn nguồn thanh toán.</p>}
    <div className="debt-box"><span>Nợ vay <strong>{money(game.portfolio.debt)}</strong></span><span>Nghĩa vụ cuối vòng <strong>{money(game.obligations)}</strong></span>{game.pendingPayment && <span>Khoản đang thiếu <strong>{money(game.pendingPayment.remaining)}</strong></span>}<small>Các khoản phải trả đã được trừ khỏi tài sản ròng.</small></div>
    <div className="cashflow"><h3>Khi qua ô Xuất phát</h3><dl><div><dt>Lương định kỳ</dt><dd className="positive">+{money(game.recurringIncome)}</dd></div></dl><p className="salary-remaining">Còn <strong>{remainingSalaryReceipts}</strong> lần nhận lương.</p><p>Sinh hoạt {money(livingCostForGame(game))} {hasPeriodicLiving(game) ? 'mỗi lần hoàn thành vòng qua ô Xuất phát' : 'khi dừng đúng ô'}. Giá thay đổi khi qua ô Xuất phát và khi có cú sốc kinh tế.</p></div>
  </aside>
}

