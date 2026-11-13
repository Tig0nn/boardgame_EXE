import type { Database } from '../db/client.ts'
import { ApiError } from '../errors.ts'
import type { SnapshotObserver } from '../observability.ts'
import type { BankQuoteRequest } from '../validation.ts'
import { quoteB18Bank } from './b18-bank.ts'
import { loadGameState } from './game-state.ts'

export async function quoteGameBank(db: Database, userId: string, sessionId: string, request: BankQuoteRequest, observer?: SnapshotObserver) {
  const { session, game } = await loadGameState(db, userId, sessionId, observer)
  if (session.status !== 'active') throw new ApiError(409, 'SESSION_NOT_ACTIVE', 'Game session is not active')
  if (session.stateVersion !== request.expectedStateVersion) {
    throw new ApiError(409, 'STATE_VERSION_CONFLICT', 'Expected state version does not match the current session')
  }
  const quote = quoteB18Bank(game, request)
  if (!quote) throw new ApiError(422, 'ACTION_NOT_ALLOWED', 'Bank action is not allowed in the current game state')
  return { sessionId, stateVersion: session.stateVersion, actionId: request.actionId, payload: request.payload, quote }
}
