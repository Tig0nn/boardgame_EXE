import type { Database } from '../db/client.ts'
import { ApiError } from '../errors.ts'
import type { BusinessQuoteRequest } from '../validation.ts'
import { quoteB18Business } from './b18-business.ts'
import { loadGameState } from './game-state.ts'

export async function quoteGameBusiness(db: Database, userId: string, sessionId: string, request: BusinessQuoteRequest) {
  const { session, game } = await loadGameState(db, userId, sessionId)
  if (session.status !== 'active') throw new ApiError(409, 'SESSION_NOT_ACTIVE', 'Game session is not active')
  if (session.stateVersion !== request.expectedStateVersion) {
    throw new ApiError(409, 'STATE_VERSION_CONFLICT', 'Expected state version does not match the current session')
  }
  const quote = quoteB18Business(game, request.payload)
  if (!quote) throw new ApiError(422, 'ACTION_NOT_ALLOWED', 'Business action is not allowed in the current game state')
  return { sessionId, stateVersion: session.stateVersion, payload: request.payload, quote }
}
