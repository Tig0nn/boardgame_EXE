import { localizeNarrative } from './glossary'
import { GlossaryText } from './FinancialTerm'
import { ASSETS, CATEGORIES } from '../data/config'
import { eventsForGame } from '../data/events'
import { canChoose, totalWorth, victory } from '../game/engine'
import { liquidatableFunds } from '../game/selectors'
import { money, signedMoney, percent } from '../game/format'
import type { Asset, FundingSource, GameState, RebalanceAction } from '../game/types'
import { rulesForGame } from '../game/rules-profile'
import { Forecast } from './Forecast'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { FundingDialog } from './FundingDialog'
import { RebalanceDialog } from './RebalanceDialog'
import { GoalChecks } from './GoalChecks'
import { TradingPanel } from './TradingPanel'
import { MarketDetails } from './MarketDetails'
import { investmentPurchasesComplete } from '../game/encounters'
import { FinancialReview } from './FinancialReview'
import { isMultiCourse } from '../game/rules-profile'
import { CourseChoices } from './CourseChoices'
import { paymentOptionCopy } from './financial-decision-copy'

export function PhaseDialog({ game, onAdvance, onChoose, onRestart, onExport, onFund, onTransaction }: { game: GameState; onAdvance: () => void; onChoose: (id: string) => void; onRestart: () => void; onExport: () => void; onFund: (source: FundingSource, amount: number, lotId?: string) => void; onTransaction: (action: RebalanceAction) => void }) {
  if (game.phase === 'funding') return <FundingDialog key={`${game.pendingPayment!.title}-${game.pendingPayment!.remaining}`} game={game} onFund={onFund} />
  if (game.phase === 'rebalancing') return <RebalanceDialog key={`rebalance-${game.lap}-${game.log.length}`} game={game} onTransaction={onTransaction} onContinue={onAdvance} />
  if (game.phase === 'forecast') return <Modal key={`forecast-${game.lap}`} title={`Dự báo vòng ${game.lap}`}>
    <span className="section-kicker">VÒNG {String(game.lap).padStart(2, '0')} / {String(game.totalLaps).padStart(2, '0')}</span><h2>Nhìn trước một bước.</h2><p className="modal-lead">Đọc nhịp thị trường trước khi bắt đầu vòng mới.</p><Forecast game={game} expanded />
    <button className="button primary full-button" onClick={onAdvance}>Bắt đầu vòng {game.lap}<Icon name="arrow" /></button>
  </Modal>
  if (game.phase === 'event') {
    const event = eventsForGame(game).find(e => e.id === game.eventId)!
    if (event.id === 'course' && isMultiCourse(game)) return <Modal key={`course-${game.turn}`} title="Đầu tư bản thân" wide><CourseChoices game={game} onChoose={onChoose} /></Modal>
    const category = CATEGORIES[event.category]
    const traded = game.log.some(entry => entry.turn === game.turn && entry.kind === 'rebalancing')
    const panelOwnsSkip = event.id === 'stocks' || (['gold', 'bonds'].includes(event.id) && investmentPurchasesComplete(game))
    return <Modal key={`event-${game.turn}`} title={localizeNarrative(event.title)} className={event.id === 'stocks' ? 'stock-modal' : event.id === 'business' && game.businessRulesVersion === 'v2.4-customer-preferences' ? 'business-modal' : ''}>
      <div className={`event-category ${event.category}`}><Icon name={category.icon} size={24} /><span>{category.label}</span></div>
      <span className="event-location">Vòng {game.lap} · Ô {game.position + 1} · Lượt {game.turn}</span>
      <h2>{localizeNarrative(event.title)}</h2><p className="modal-lead">{event.id === 'stocks' ? 'Cơ hội tự nguyện · Chọn mã và số tiền mua.' : event.id === 'business' && game.businessRulesVersion === 'v2.4-customer-preferences' ? 'Cơ hội tự nguyện · Phát triển quán qua từng lần gặp ô.' : localizeNarrative(event.description)}</p>
      <div className="event-cash"><span>Tiền mặt hiện có</span><strong>{money(game.portfolio.cash)}</strong></div>
      {['stocks', 'bonds', 'gold', 'business', 'bank'].includes(event.id) && <TradingPanel key={`${game.turn}-${game.log.length}`} game={game} onTransaction={onTransaction} onSkip={() => onChoose('skip')} />}
      {game.market.appliedShocks.includes(`${game.turn}:${event.id}`) && <details className="trade-details"><summary>Báo giá sau cú sốc</summary><MarketDetails game={game} asset="stocks" /><MarketDetails game={game} asset="gold" /><MarketDetails game={game} asset="bonds" /></details>}
      <div className="event-options">{event.options.filter(option => !panelOwnsSkip && !(event.id === 'course' && game.coursePurchased && option.id === 'upgrade')).map(option => {
        const shortfall = Math.max(0, (option.cost ?? 0) - game.portfolio.cash)
        const payment = paymentOptionCopy(event, option)
        return <button key={option.id} className="decision-button" disabled={!canChoose(game, option.id)} onClick={() => onChoose(option.id)}><div><strong>{option.id === 'skip' && traded ? 'Hoàn tất · Về bàn chơi' : payment?.label ?? localizeNarrative(option.label)}</strong>{payment ? payment.detail && <span>{payment.detail}</span> : <span>{option.id === 'skip' && traded ? 'Giữ các giao dịch đã thực hiện và tiếp tục gieo xúc xắc.' : localizeNarrative(option.detail)}</span>}
          {payment?.comparison && <span>{payment.comparison}</span>}
          <span>Tiền khả dụng: {money(game.portfolio.cash)} → {money(Math.max(0, game.portfolio.cash - (option.cost ?? 0)) + (option.income ?? 0))}</span>
          {shortfall > 0 && <small>Còn thiếu {money(shortfall)} · Bạn chọn nguồn thanh toán ở bước tiếp theo.</small>}
          {option.asset && <span>{ASSETS[option.asset].label}: {money(game.portfolio[option.asset])} → {money(game.portfolio[option.asset] + (option.amount ?? 0))}</span>}
          {!!option.obligation && !payment && <span>Khoản hẹn trả cuối vòng: {money(game.obligations)} → {money(game.obligations + option.obligation)}</span>}
          {!!option.recurringIncomeIncrease && <><span>Thu nhập định kỳ: {money(game.recurringIncome)} → {money(game.recurringIncome + option.recurringIncomeIncrease)}/vòng</span><small>Còn {game.totalLaps - game.lap + 1} kỳ quyết toán · Tổng thu nhập tăng thêm {money(option.recurringIncomeIncrease * (game.totalLaps - game.lap + 1))}. Cân nhắc chi phí trả trước.</small></>}
          {option.asset === 'business' && <small className="business-lock">Chỉ bán cơ sở tại ô Kinh doanh; vốn chưa bán không tính vào mục tiêu.</small>}
        </div><Icon name="arrow" size={18} /></button>
      })}</div>
      {event.id === 'course' && <p className="inline-note">{game.coursePurchased ? 'Bạn đã học khóa này; không mua lại. Chọn bỏ qua để tiếp tục.' : game.portfolio.cash < rulesForGame(game).courseCost! ? 'Chưa đủ tiền mặt trả học phí; có thể bỏ qua. Học phí không hoàn lại.' : 'Học tự nguyện, chỉ mua một lần. Lương tăng từ lần qua ô Xuất phát kế tiếp; học phí không hoàn lại.'}</p>}
      {['living', 'medical', 'repair', 'family', 'bills', 'contract'].includes(event.id) && <p className="inline-note">Khoản bắt buộc. Thiếu tiền mặt? Chọn nguồn thanh toán ở bước tiếp theo.</p>}
    </Modal>
  }
  if (game.phase === 'summary') {
    const summary = game.summaries.at(-1)!
    return <Modal key={`summary-${game.lap}`} title={`Quyết toán vòng ${game.lap}`}>
      <span className="section-kicker"><Icon name="check" /> HOÀN THÀNH VÒNG {game.lap}</span><h2>Một vòng, một bước xa hơn.</h2><p className="modal-lead">Dòng tiền và thị trường đã được quyết toán.</p>
      <div className="income-breakdown"><div><span>Thu nhập cơ bản</span><strong>{signedMoney(rulesForGame(game).recurringIncome)}</strong></div><div><span>+ Thu nhập tăng thêm</span><strong>{signedMoney(summary.incomeTotal - rulesForGame(game).recurringIncome)}</strong></div><div><span>= Tổng lương vòng</span><strong>{signedMoney(summary.incomeTotal)}</strong></div></div>
      <div className="summary-lines">{summary.lines.slice(2).map(line => <div key={line.label}><span><GlossaryText text={localizeNarrative(line.label)} /></span><strong className={line.amount > 0 ? 'positive' : line.amount < 0 ? 'negative' : ''}>{signedMoney(line.amount)}</strong></div>)}</div>
      <div className="actual-rates">{(Object.keys(summary.rates) as Asset[]).map(asset => <span key={asset}>{ASSETS[asset].label}<strong className={summary.rates[asset] >= 0 ? 'positive' : 'negative'}>{percent(summary.rates[asset])}</strong></span>)}</div>
      <div className="summary-total"><span>Tài sản ròng sau vòng {game.lap}</span><strong>{money(summary.after)}</strong></div>
      {summary.fundingNotes.map((note, i) => <p className="inline-note" key={i}>{localizeNarrative(note)}</p>)}
      <p className="inline-note">Thứ tự: thị trường → lương → kinh doanh → đáo hạn/lãi trái phiếu định kỳ → nợ/nghĩa vụ → bán tại ô Xuất phát → dự báo hoặc kết quả. Cả vòng cuối đều có quyền bán.</p>
      <GoalChecks game={game} />
      <button className="button primary full-button" onClick={onAdvance}>Mở quyền bán tại ô Xuất phát<Icon name="arrow" /></button>
    </Modal>
  }
  if (game.phase === 'finished') {
    const worth = totalWorth(game)
    const result = victory(game)
    const won = result.won
    return <Modal title="Kết quả hành trình">
      <div className="result-icon"><Icon name={won ? 'flag' : 'leaf'} size={32} /></div><span className="section-kicker">HÀNH TRÌNH · VÒNG {game.lap}/{game.totalLaps}</span>
      <h2>{game.termination === 'insolvent' ? 'Mất khả năng thanh toán' : won ? 'Bạn đã chạm đích!' : 'Mỗi vòng là một bài học.'}</h2><p className="modal-lead">{game.termination === 'insolvent' ? `Còn thiếu ${money(game.pendingPayment?.remaining ?? 0)}, không còn nguồn tiền hợp lệ hoặc hạn mức vay.` : won ? 'Bạn đã tích lũy đủ 90 triệu huy động hợp lệ sau khi hoàn thành đủ vòng.' : 'Nguồn tiền có thể huy động chưa đủ 90 triệu.'}</p>
      <div className="result-worth"><span>HUY ĐỘNG HỢP LỆ CUỐI VÁN</span><strong>{money(liquidatableFunds(game))}</strong><small>Mục tiêu: 90 triệu · Sau phí và nợ</small><small>Tài sản ròng: {money(worth)}</small><small>Tiền mặt: {money(game.portfolio.cash)}</small></div>
      <FinancialReview game={game} /><details><summary>Chi tiết nguồn tiền về đích</summary><div className="decision-preview"><span>Tổng giá trị tài sản<strong>{money(Object.entries(game.portfolio).filter(([key]) => key !== 'debt').reduce((sum, [, value]) => sum + value, 0))}</strong></span><span>Nợ vay<strong>{money(game.portfolio.debt)}</strong></span><span>Huy động hợp lệ sau phí và nợ<strong>{money(liquidatableFunds(game))}</strong></span><span>Mục tiêu duy nhất<strong>90.000.000 ₫</strong></span></div>
      <p className="inline-note">Xét giá trị huy động hợp lệ theo báo giá hiện tại, không tự thanh lý tài sản. Kinh doanh chưa bán bị loại. Tiết kiệm chưa đáo hạn tính gốc rút sớm, không tính lãi chưa trả.</p>
      <GoalChecks game={game} /></details>
      <div className="lap-results">{game.summaries.map(summary => <div key={summary.lap}><span>Vòng {summary.lap}</span><strong>{money(summary.after)}</strong></div>)}</div>
      <button className="button primary full-button" onClick={onRestart}>Chơi một hành trình mới <Icon name="refresh" /></button><button className="button secondary full-button" onClick={onExport}><Icon name="download" size={17} /> Tải nhật ký quyết định</button>
    </Modal>
  }
  return null
}

