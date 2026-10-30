import { RoundChallengeModal } from './RoundChallengeModal'
import { exportLog } from '../../../src/exportLog'
import type { GameState } from '../../../src/game/types'
import type { MobileCommand } from '../game/session'
import type { RepairAiSession } from '../game/repair-ai'
import { PHASE_UI } from '../game/session'
import { EventModal } from './EventModal'
import { FundingDialog } from './FundingDialog'
import { LapSummaryModal } from './LapSummaryModal'
import { RebalanceModal } from './RebalanceModal'
import { GameResultModal } from './GameResultModal'

export function GamePhase({ game, session, send, onRestart, onHome, onHelp, onDismissResult }: {
  game: GameState;
  session?: RepairAiSession;
  send: (command: MobileCommand) => boolean;
  onRestart: () => void;
  onHome?: () => void;
  onHelp?: () => void;
  onDismissResult?: () => void;
}) {
  switch (PHASE_UI[game.phase]) {
    case 'forecast': return <RoundChallengeModal game={game} onConfirm={() => send({ type: 'advance' })} onHelp={onHelp} />
    case 'event': return <EventModal game={game} session={session} onHelp={onHelp} onChoose={id => send({ type: 'choose', id })} onTransaction={action => send({ type: 'trade', action })} />
    case 'funding': return <FundingDialog key={game.log.length} game={game} compact onHelp={onHelp} onFund={(source, amount, lotId) => send({ type: 'fund', source, amount, lotId })} />
    case 'start-summary': return <LapSummaryModal game={game} onHelp={onHelp} onContinue={() => send({ type: 'advance' })} />
    case 'rebalancing': return <RebalanceModal key={game.log.length} game={game} compact onHelp={onHelp} onTransaction={action => send({ type: 'trade', action })} onContinue={() => send({ type: 'advance' })} />
    case 'finished': return <GameResultModal game={game} onHelp={onHelp} onRestart={onRestart} onHome={onHome} onClose={onDismissResult} onExport={() => exportLog(game)} />
    default: return null
  }
}
