import type { Database } from '../db/client.ts'
import { ApiError } from '../errors.ts'
import type { SnapshotObserver } from '../observability.ts'
import type { TradePayload } from '../validation.ts'
import { quoteB18Trade } from './b18-trading.ts'
import { loadGameState } from './game-state.ts'

export async function quoteGameTrade(db: Database, userId: string, sessionId: string, expectedStateVersion: number, payload: TradePayload,
  observer?: SnapshotObserver) {
  const { session, game } = await loadGameState(db, userId, sessionId, observer)
  if (session.status !== 'active') throw new ApiError(409, 'SESSION_NOT_ACTIVE', 'Game session is not active')
  if (session.stateVersion !== expectedStateVersion) {
    throw new ApiError(409, 'STATE_VERSION_CONFLICT', 'Expected state version does not match the current session')
  }
  const quote = quoteB18Trade(game, payload)
  if (!quote) throw new ApiError(422, 'ACTION_NOT_ALLOWED', 'Trade is not allowed in the current game state')
  return { sessionId, stateVersion: session.stateVersion, payload, quote }
}
