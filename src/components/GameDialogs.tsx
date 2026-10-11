import { ASSETS, CATEGORIES, RULES } from '../data/config'
import { EVENTS } from '../data/events'
import { canChoose, totalWorth, victory } from '../game/engine'
import { liquidatableFunds } from '../game/selectors'
import { money, signedMoney, percent } from '../game/format'
import type { Asset, FundingSource, GameState, RebalanceAction } from '../game/types'
import { Forecast } from './Forecast'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { FundingDialog } from './FundingDialog'
import { RebalanceDialog } from './RebalanceDialog'
import { GoalChecks } from './GoalChecks'
import { TradingPanel } from './TradingPanel'
import { MarketDetails } from './MarketDetails'

export function PhaseDialog({ game, onAdvance, onChoose, onRestart, onExport, onFund, onTransaction }: { game: GameState; onAdvance: () => void; onChoose: (id: string) => void; onRestart: () => void; onExport: () => void; onFund: (source: FundingSource, amount: number, lotId?: string) => void; onTransaction: (action: RebalanceAction) => void }) {
  if (game.phase === 'funding') return <FundingDialog key={`${game.pendingPayment!.title}-${game.pendingPayment!.remaining}`} game={game} onFund={onFund} />
  if (game.phase === 'rebalancing') return <RebalanceDialog key={`rebalance-${game.lap}-${game.log.length}`} game={game} onTransaction={onTransaction} onContinue={onAdvance} />
  if (game.phase === 'forecast') return <Modal key={`forecast-${game.lap}`} title={`Dự báo vòng ${game.lap}`}>
    <span className="section-kicker">VÒNG {String(game.lap).padStart(2, '0')} / {String(game.totalLaps).padStart(2, '0')}</span><h2>Nhìn trước một bước.</h2><p className="modal-lead">Đọc nhịp thị trường trước khi bắt đầu vòng mới.</p><Forecast game={game} expanded />
    <button className="button primary full-button" onClick={onAdvance}>Bắt đầu vòng {game.lap}<Icon name="arrow" /></button>
  </Modal>
  if (game.phase === 'event') {
    const event = EVENTS.find(e => e.id === game.eventId)!
    const category = CATEGORIES[event.category]
    return <Modal key={`event-${game.turn}`} title={event.title}>
      <div className={`event-category ${event.category}`}><Icon name={category.icon} size={24} /><span>{category.label}</span></div>
      <span className="event-location">Vòng {game.lap} · Ô {game.position + 1} · Lượt {game.turn}</span>
      <h2>{event.title}</h2><p className="modal-lead">{event.description}</p>
      <div className="event-cash"><span>Tiền mặt hiện có</span><strong>{money(game.portfolio.cash)}</strong></div>
      {['stocks', 'bonds', 'gold', 'business', 'bank'].includes(event.id) && <TradingPanel key={`${game.turn}-${game.log.length}`} game={game} onTransaction={onTransaction} />}
      {game.market.appliedShocks.includes(`${game.turn}:${event.id}`) && <><MarketDetails game={game} asset="stocks" /><MarketDetails game={game} asset="gold" /><MarketDetails game={game} asset="bonds" /></>}
      <div className="event-options">{event.options.map(option => {
        const shortfall = Math.max(0, (option.cost ?? 0) - game.portfolio.cash)
        return <button key={option.id} className="decision-button" disabled={!canChoose(game, option.id)} onClick={() => onChoose(option.id)}><div><strong>{option.label}</strong><span>{option.detail}</span>
          <span>Tiền khả dụng: {money(game.portfolio.cash)} → {money(Math.max(0, game.portfolio.cash - (option.cost ?? 0)) + (option.income ?? 0))}</span>
          {shortfall > 0 && <small>Còn thiếu {money(shortfall)} · Bạn chọn nguồn thanh toán ở bước tiếp theo.</small>}
          {option.asset && <span>{ASSETS[option.asset].label}: {money(game.portfolio[option.asset])} → {money(game.portfolio[option.asset] + (option.amount ?? 0))}</span>}
          {!!option.obligation && <span>Nghĩa vụ cuối vòng: {money(game.obligations)} → {money(game.obligations + option.obligation)}</span>}
          {!!option.recurringIncomeIncrease && <><span>Thu nhập định kỳ: {money(game.recurringIncome)} → {money(game.recurringIncome + option.recurringIncomeIncrease)}/vòng</span><small>Còn {game.totalLaps - game.lap + 1} kỳ quyết toán · Tổng thu nhập tăng thêm {money(option.recurringIncomeIncrease * (game.totalLaps - game.lap + 1))}. Cân nhắc chi phí trả trước.</small></>}
          {option.asset === 'business' && <small className="business-lock">Vốn kinh doanh được khóa đến cuối màn.</small>}
        </div><Icon name="arrow" size={18} /></button>
      })}</div>
      <p className="inline-note"><Icon name="info" size={16} /> Mua tự nguyện cần đủ tiền mặt. Khi thiếu tiền trả khoản bắt buộc, bạn chọn nguồn. Khóa học chỉ mua một lần; lương tăng từ START kế tiếp.</p>
    </Modal>
  }
  if (game.phase === 'summary') {
    const summary = game.summaries.at(-1)!
    return <Modal key={`summary-${game.lap}`} title={`Quyết toán vòng ${game.lap}`}>
      <span className="section-kicker"><Icon name="check" /> HOÀN THÀNH VÒNG {game.lap}</span><h2>Một vòng, một bước xa hơn.</h2><p className="modal-lead">Dòng tiền và thị trường đã được quyết toán.</p>
      <div className="income-breakdown"><div><span>Thu nhập cơ bản</span><strong>{signedMoney(RULES.recurringIncome)}</strong></div><div><span>+ Thu nhập tăng thêm</span><strong>{signedMoney(summary.incomeTotal - RULES.recurringIncome)}</strong></div><div><span>= Tổng lương vòng</span><strong>{signedMoney(summary.incomeTotal)}</strong></div></div>
      <div className="summary-lines">{summary.lines.slice(2).map(line => <div key={line.label}><span>{line.label}</span><strong className={line.amount > 0 ? 'positive' : line.amount < 0 ? 'negative' : ''}>{signedMoney(line.amount)}</strong></div>)}</div>
      <div className="actual-rates">{(Object.keys(summary.rates) as Asset[]).map(asset => <span key={asset}>{ASSETS[asset].label}<strong className={summary.rates[asset] >= 0 ? 'positive' : 'negative'}>{percent(summary.rates[asset])}</strong></span>)}</div>
      <div className="summary-total"><span>Tài sản ròng sau vòng {game.lap}</span><strong>{money(summary.after)}</strong></div>
      {summary.fundingNotes.map((note, i) => <p className="inline-note" key={i}>{note}</p>)}
      <p className="inline-note">Thứ tự: thị trường → lương → kinh doanh → đáo hạn/coupon → nợ/nghĩa vụ → bán tại START → dự báo hoặc kết quả. Cả vòng cuối đều có quyền bán.</p>
      <GoalChecks game={game} />
      <button className="button primary full-button" onClick={onAdvance}>Mở quyền bán tại START<Icon name="arrow" /></button>
    </Modal>
  }
  if (game.phase === 'finished') {
    const worth = totalWorth(game)
    const result = victory(game)
    const won = result.won
    return <Modal title="Kết quả hành trình">
      <div className="result-icon"><Icon name={won ? 'flag' : 'leaf'} size={32} /></div><span className="section-kicker">HÀNH TRÌNH · VÒNG {game.lap}/{game.totalLaps}</span>
      <h2>{game.termination === 'insolvent' ? 'Mất khả năng thanh toán' : won ? 'Bạn đã chạm đích!' : 'Mỗi vòng là một bài học.'}</h2><p className="modal-lead">{game.termination === 'insolvent' ? `Còn thiếu ${money(game.pendingPayment?.remaining ?? 0)}, không còn nguồn tiền hợp lệ hoặc hạn mức vay.` : won ? `Bạn có thể mua món đồ ${RULES.goal / 1_000_000} triệu và còn ít nhất ${RULES.cashGoal / 1_000_000} triệu.` : 'Nguồn tiền có thể huy động chưa đủ mua món đồ và giữ khoản dự phòng sau mua.'}</p>
      <div className="result-worth"><span>TÀI SẢN RÒNG CUỐI CÙNG</span><strong>{money(worth)}</strong><small>Tiền mặt cuối cùng: {money(game.portfolio.cash)}</small></div>
      <div className="decision-preview"><span>Tổng giá trị tài sản<strong>{money(Object.entries(game.portfolio).filter(([key]) => key !== 'debt').reduce((sum, [, value]) => sum + value, 0))}</strong></span><span>Nợ vay<strong>{money(game.portfolio.debt)}</strong></span><span>Huy động hợp lệ sau phí và nợ<strong>{money(liquidatableFunds(game))}</strong></span><span>Giá món đồ<strong>{money(RULES.goal)}</strong></span><span>Còn lại sau mua giả định<strong>{money(liquidatableFunds(game) - RULES.goal)}</strong></span></div>
      <p className="inline-note">Đánh giá khả năng mua theo báo giá hiện tại; chưa tự bán tài sản hoặc trừ tiền mua. Kinh doanh chưa bán bị loại. Tiết kiệm chưa đáo hạn tính gốc rút sớm, không tính lãi chưa trả.</p>
      <GoalChecks game={game} />
      <div className="lap-results">{game.summaries.map(summary => <div key={summary.lap}><span>Vòng {summary.lap}</span><strong>{money(summary.after)}</strong></div>)}</div>
      <button className="button primary full-button" onClick={onRestart}>Chơi một hành trình mới <Icon name="refresh" /></button><button className="button secondary full-button" onClick={onExport}><Icon name="download" size={17} /> Tải nhật ký quyết định</button>
    </Modal>
  }
  return null
}

