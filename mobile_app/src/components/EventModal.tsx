import { EVENTS } from '../../../src/data/events'
import { canChoose } from '../../../src/game/engine'
import { money } from '../../../src/game/format'
import type { GameState, RebalanceAction } from '../../../src/game/types'
import { Modal } from '../../../src/components/Modal'
import { MobileTradingPanel } from './MobileTradingPanel'

export function EventModal({
  game,
  onChoose,
  onTransaction,
}: {
  game: GameState
  onChoose: (id: string) => void
  onTransaction: (action: RebalanceAction) => boolean | void
}) {
  const event = EVENTS.find(e => e.id === game.eventId)!
  const trading = ['stocks', 'bonds', 'gold', 'bank', 'business'].includes(event.id)

  return (
    <Modal title={event.title}>
      <div className="event-kicker-bar">
        <span className="event-kicker-pill">Vòng {game.lap}/4 · Ô {game.position + 1}</span>
        <span className="event-cash-badge">💰 {money(game.portfolio.cash)}</span>
      </div>

      <h2 className="event-title">{event.title}</h2>
      {!trading && <p className="event-description">{event.description}</p>}

      {trading && (
        <MobileTradingPanel
          key={`${game.turn}-${game.log.length}`}
          game={game}
          compact
          onTransaction={onTransaction}
          onSkip={() => onChoose('skip')}
        />
      )}

      <div className="event-choices-stack">
        {event.options
          .filter(() => event.id !== 'stocks')
          .map(option => {
            const hasCost = !!option.cost
            const isAffordable = !hasCost || option.cost! <= game.portfolio.cash
            const shortfall = hasCost ? option.cost! - game.portfolio.cash : 0

            return (
              <button
                key={option.id}
                className="decision-card-btn"
                disabled={!canChoose(game, option.id)}
                onClick={() => onChoose(option.id)}
              >
                <div className="decision-card-top">
                  <strong className="decision-title">{option.label}</strong>
                  {hasCost && (
                    <span className="decision-cost-tag text-accent">
                      -{money(option.cost!)}
                    </span>
                  )}
                </div>

                <p className="decision-detail">{option.detail}</p>

                {hasCost && !isAffordable && (
                  <div className="decision-shortfall-alert">
                    <span>Thiếu {money(shortfall)} · Sẽ huy động ở bước sau</span>
                  </div>
                )}
              </button>
            )
          })}
      </div>
    </Modal>
  )
}
