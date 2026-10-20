import { eventsForGame } from '../../../src/data/events'
import { canChoose } from '../../../src/game/engine'
import { money } from '../../../src/game/format'
import type { GameState, RebalanceAction } from '../../../src/game/types'
import { Modal } from '../../../src/components/Modal'
import { TradingPanel } from '../../../src/components/TradingPanel'
import { MarketSignal } from './MarketNews'
import { investmentPurchasesComplete } from '../../../src/game/encounters'
import { MACRO_EVENTS } from '../../../src/data/config'
import { EconomicEventModal } from './EconomicEventModal'
import { isMultiCourse } from '../../../src/game/rules-profile'
import { CourseChoices } from '../../../src/components/CourseChoices'
import { localizeNarrative } from '../../../src/components/glossary'
import { paymentOptionCopy } from '../../../src/components/financial-decision-copy'

export function EventModal({ game, onChoose, onTransaction, onHelp }: {
  game: GameState; onChoose: (id: string) => void; onTransaction: (action: RebalanceAction) => boolean | void; onHelp?: () => void
}) {
  if (MACRO_EVENTS.some(event => event.id === game.eventId)) return <EconomicEventModal game={game} onChoose={onChoose} onHelp={onHelp} />
  const event = eventsForGame(game).find(e => e.id === game.eventId)!
  if (event.id === 'course' && isMultiCourse(game)) return <Modal title="Đầu tư bản thân" onHelp={onHelp} className="mobile-event"><CourseChoices game={game} onChoose={onChoose} /></Modal>
  const trading = ['stocks', 'bonds', 'gold', 'bank', 'business'].includes(event.id)
  const traded = game.log.some(entry => entry.turn === game.turn && entry.kind === 'rebalancing')
  const panelOwnsSkip = event.id === 'stocks' || (['gold', 'bonds'].includes(event.id) && investmentPurchasesComplete(game))
  const title = ({ stocks: 'Cổ phiếu', bonds: 'Trái phiếu', gold: 'Vàng', business: 'Quán của bạn' } as Record<string, string>)[event.id] ?? event.title
  return <Modal title={title} onHelp={onHelp} className={`mobile-event ${['family', 'medical', 'repair', 'bills', 'contract', 'bank', 'bonds', 'gold'].includes(event.id) ? 'financial-modal' : ''}`}>
    <span className="section-kicker">VÒNG {game.lap} · Ô {game.position + 1}</span>
    <h2>{title}</h2>
    {!trading && <p>{event.id === 'living' ? 'Đến lúc chăm lo cho cuộc sống.' : event.id === 'course' ? 'Học một lần, tăng lương cho những vòng còn lại.' : event.category === 'shock' && !event.options.some(option => option.cost || option.obligation) ? 'Thị trường vừa thay đổi. Cơ hội mới đang chờ bạn!' : localizeNarrative(event.description)}</p>}
    <p className="event-cash">Tiền mặt: <strong>{money(game.portfolio.cash)}</strong></p>
    {trading && <TradingPanel key={`${game.turn}-${game.log.length}`} game={game} compact onTransaction={onTransaction} onSkip={() => onChoose('skip')}
      marketContext={(asset, symbolId) => <MarketSignal game={game} asset={asset} symbolId={symbolId} />} />}
    {event.id === 'course' && !canChoose(game, 'upgrade') && <p className="inline-note">{game.coursePurchased ? 'Bạn đã hoàn thành khóa học này.' : 'Chưa đủ tiền mặt cho khóa học.'}</p>}
    {event.options.filter(option => !panelOwnsSkip&&!(event.id==='course'&&game.coursePurchased&&option.id==='upgrade')).map(option => {
      const payment = paymentOptionCopy(event, option)
      return <button key={option.id}
      className="decision-button" disabled={!canChoose(game, option.id)} onClick={() => onChoose(option.id)}>
      <strong>{option.id === 'acknowledge'||event.id==='course'&&game.coursePurchased ? 'Tiếp tục' : option.id === 'skip' && traded ? 'Hoàn tất · Về bàn chơi' : payment?.label ?? option.label}</strong>
      {option.id !== 'skip' && option.id !== 'acknowledge' && (payment ? payment.detail && <span>{payment.detail}</span> : <span>{localizeNarrative(option.detail)}</span>)}
      {payment?.comparison && <span className="payment-comparison">{payment.comparison}</span>}
      {(option.cost ?? 0) > game.portfolio.cash && <span>Thiếu {money(option.cost! - game.portfolio.cash)} · Chọn nguồn tiền tiếp theo</span>}
    </button>})}
  </Modal>
}
