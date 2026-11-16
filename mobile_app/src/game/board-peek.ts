import { boardFor } from '../../../src/data/board.ts'
import type { GameState } from '../../../src/game/types.ts'
import { movementPath } from './session.ts'

export type PeekState = Parameters<typeof boardFor>[0] & Pick<GameState, 'position' | 'phase' | 'lap' | 'totalLaps' | 'pendingLanding'> & {
  pendingPayment?: Pick<NonNullable<GameState['pendingPayment']>, 'origin'> | null
}

export function boardPeek(state: PeekState) {
  const board = boardFor(state)
  const atStart = state.phase === 'summary' || state.phase === 'rebalancing' || state.pendingPayment?.origin === 'settlement'
  const current = atStart ? 0 : state.position
  const landing = state.pendingLanding && !(atStart && state.lap === state.totalLaps) ? state.position : null
  const finalLap = state.lap + Number(atStart) >= state.totalLaps
  const canRoll = state.phase !== 'finished' && !(atStart && state.lap === state.totalLaps)
  const destinations = canRoll ? Array.from({ length: 6 }, (_, index) => {
    const dice = index + 1
    const path = movementPath({ ...state, position: landing ?? current }, { dice })
    return { dice, tile: board[finalLap && path.includes(0) ? 0 : path.at(-1)!] }
  }) : []
  return { board, current, landing, destinations }
}
