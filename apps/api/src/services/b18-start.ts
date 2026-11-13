import type { GameState } from '../../../../src/game/types.ts'
import { b18RebalancingSales } from './b18-trading.ts'

export function publicStartState(game: GameState, active: boolean, canRepay: boolean) {
  const summary = game.summaries.find(item => item.lap === game.lap) ?? null
  const settlementStatus = game.settlement
    ? game.phase === 'finished' ? 'interrupted' : 'awaitingFunding'
    : summary ? 'completed' : 'pending'

  return {
    lap: game.lap,
    settlementStatus,
    summary,
    finalCheckpoint: game.lap === game.totalLaps &&
      (game.settlement !== null || summary !== null),
    canFinishRebalancing: active && game.phase === 'rebalancing',
    canRepay,
    sales: active ? b18RebalancingSales(game) : [],
  }
}
