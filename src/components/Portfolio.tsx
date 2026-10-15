import { ASSETS, RULES } from '../data/config'
import { totalWorth } from '../game/engine'
import { liquidatableFunds } from '../game/selectors'
import { money } from '../game/format'
import type { GameState } from '../game/types'
import { Icon } from './Icon'
import { GoalChecks } from './GoalChecks'
import { hasBondCredit } from '../game/bond-credit'
import { BondHoldings } from './BondHoldings'

export function Portfolio({ game, compact = false }: { game: GameState; compact?: boolean }) {
  const worth = totalWorth(game)
  const funds = liquidatableFunds(game)
  const progress = Math.max(0, Math.min(100, funds / (RULES.goal + RULES.cashGoal) * 100))
  return <aside className="portfolio panel">
    <div className="panel-heading"><h2>Tài sản của bạn</h2><Icon name="wallet" /></div>
    <div className="net-worth"><span>TỔNG TÀI SẢN RÒNG</span><strong>{money(worth)}</strong><small className={worth >= RULES.startingCapital ? 'positive' : 'negative'}>{worth >= RULES.startingCapital ? '+' : ''}{money(worth - RULES.startingCapital)} <span>so với ban đầu</span></small></div>
    <div className="goal-track"><div><span>Nguồn tiền về đích {money(funds)}</span><strong>{Math.round(progress)}%</strong></div><progress max="100" value={progress} aria-label="Tiến độ huy động đủ tiền mua và dự phòng" />{compact ? <details><summary>Cách tính mục tiêu</summary><GoalChecks game={game} /></details> : <><p>Còn sau mua: {money(funds - RULES.goal)}</p><GoalChecks game={game} /></>}</div>
    <div className="asset-list">{Object.entries(ASSETS).map(([key, asset]) => {
      const amount = game.portfolio[key as keyof typeof ASSETS]
      const locked = key !== 'cash' && key !== 'savings' && amount === 0 && !game.unlockedAssets.includes(key as 'stocks' | 'bonds' | 'gold' | 'business')
      return <div key={key} className={`asset-row ${locked ? 'unowned' : ''}`}><span className={`asset-icon ${key}`}><Icon name={asset.icon} size={18} /></span><div><span>{asset.label}</span>{key === 'cash' && <small>Thanh khoản tức thì</small>}{key === 'savings' && <small>{game.deposits.filter(lot => lot.status === 'active').length} khoản chưa đáo hạn</small>}{key === 'business' && amount > 0 && <small>Chỉ bán tại ô Kinh doanh</small>}{locked && <small>Chờ cơ hội trên bàn cờ</small>}</div><strong>{locked ? '—' : money(amount)}</strong></div>
    })}</div>
    {hasBondCredit(game) && game.bondLots.length > 0 && <details><summary>Trái phiếu theo tổ chức phát hành</summary><BondHoldings game={game} /></details>}
    <div className="deposit-list">{game.deposits.filter(lot => lot.status === 'active').map(lot => <p key={lot.id}>{lot.id}: {money(lot.principal)} · {Math.round(lot.rate * 100)}% lãi game/vòng · đáo hạn START {lot.maturityLap}</p>)}</div>
    {!compact && <p className="portfolio-checkpoint">Mua đúng ô, bán tài sản tài chính tại START. Khi thiếu tiền bắt buộc, bạn chọn nguồn thanh toán.</p>}
    <div className="debt-box"><span>Nợ vay <strong>{money(game.portfolio.debt)}</strong></span><span>Nghĩa vụ cuối vòng <strong>{money(game.obligations)}</strong></span>{game.pendingPayment && <span>Khoản đang thiếu <strong>{money(game.pendingPayment.remaining)}</strong></span>}<small>Các khoản phải trả đã được trừ khỏi tài sản ròng.</small></div>
    <div className="cashflow"><h3>Khi qua START</h3><div><span>Lương định kỳ</span><strong className="positive">+{money(game.recurringIncome)}</strong></div><div><span>Còn kỳ nhận lương</span><strong>{game.phase === 'finished' ? 0 : game.totalLaps - game.lap + (game.summaries.some(summary => summary.lap === game.lap) ? 0 : 1)}</strong></div><p>Sinh hoạt {money(RULES.livingCost)} chỉ khi dừng đúng ô. Giá thay đổi tại START và khi có cú sốc kinh tế.</p></div>
  </aside>
}

