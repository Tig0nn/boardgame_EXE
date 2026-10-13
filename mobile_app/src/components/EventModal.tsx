import { EVENTS } from '../../../src/data/events'
import { canChoose } from '../../../src/game/engine'
import { money } from '../../../src/game/format'
import type { GameState, RebalanceAction } from '../../../src/game/types'
import { Modal } from '../../../src/components/Modal'
import { TradingPanel } from '../../../src/components/TradingPanel'

export function EventModal({ game, onChoose, onTransaction }: {
  game: GameState; onChoose: (id: string) => void; onTransaction: (action: RebalanceAction) => void
}) {
  const event = EVENTS.find(e => e.id === game.eventId)!
  const trading = ['stocks', 'bonds', 'gold', 'bank', 'business'].includes(event.id)
  return <Modal title={event.title}>
    <span className="section-kicker">Vòng {game.lap} · Ô {game.position + 1} · Lượt {game.turn}</span>
    <h2>{event.title}</h2>
    {!trading && <p>{event.description}</p>}
    <p className="event-cash">Tiền mặt: <strong>{money(game.portfolio.cash)}</strong></p>
    {trading && <TradingPanel key={`${game.turn}-${game.log.length}`} game={game} compact onTransaction={onTransaction} onSkip={() => onChoose('skip')} />}
    {event.options.filter(() => event.id !== 'stocks').map(option => <button key={option.id}
      className="decision-button" disabled={!canChoose(game, option.id)} onClick={() => onChoose(option.id)}>
      <strong>{option.label}</strong><span>{option.detail}</span>
      {!!option.cost && <span>Cần trả {money(option.cost)} · Tiền mặt dùng trước {money(Math.min(option.cost, game.portfolio.cash))}</span>}
      {(option.cost ?? 0) > game.portfolio.cash && <span>Còn thiếu {money(option.cost! - game.portfolio.cash)} · Chọn nguồn ở bước tiếp theo</span>}
    </button>)}
  </Modal>
}