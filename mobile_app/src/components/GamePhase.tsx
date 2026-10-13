import { Forecast } from '../../../src/components/Forecast'
import { Modal } from '../../../src/components/Modal'
import { exportLog } from '../../../src/exportLog'
import type { GameState } from '../../../src/game/types'
import type { MobileCommand } from '../game/session'
import { PHASE_UI } from '../game/session'
import { EventModal } from './EventModal'
import { FundingDialog } from './FundingDialog'
import { LapSummaryModal } from './LapSummaryModal'
import { RebalanceModal } from './RebalanceModal'
import { GameResultModal } from './GameResultModal'

export function GamePhase({ game, send, onRestart }: {
  game: GameState; send: (command: MobileCommand) => void; onRestart: () => void
}) {
  switch (PHASE_UI[game.phase]) {
    case 'forecast': return <Modal title={`Dự báo vòng ${game.lap}`}>
      <h2>Dự báo vòng {game.lap}</h2><Forecast game={game} />
      <button className="button primary full-button" onClick={() => send({ type: 'advance' })}>Bắt đầu vòng {game.lap}</button>
    </Modal>
    case 'event': return <EventModal game={game} onChoose={id => send({ type: 'choose', id })} onTransaction={action => send({ type: 'trade', action })} />
    case 'funding': return <FundingDialog key={game.log.length} game={game} onFund={(source, amount, lotId) => send({ type: 'fund', source, amount, lotId })} />
    case 'start-summary': return <LapSummaryModal game={game} onContinue={() => send({ type: 'advance' })} />
    case 'rebalancing': return <RebalanceModal key={game.log.length} game={game} onTransaction={action => send({ type: 'trade', action })} onContinue={() => send({ type: 'advance' })} />
    case 'finished': return <GameResultModal game={game} onRestart={onRestart} onExport={() => exportLog(game)} />
    default: return null
  }
}