import { isDeepStrictEqual } from 'node:util'
import { serializeLog } from '../../../../src/game/log.ts'
import type { GameState } from '../../../../src/game/types.ts'
import type { Database } from '../db/client.ts'
import { ApiError, notFound } from '../errors.ts'
import { actionRepository } from '../repositories/game-actions.ts'
import { sessionRepository } from '../repositories/game-sessions.ts'
import type { GameActionRequest } from '../validation.ts'
import { assertSupportedB18, restoreB18State } from './game-state.ts'
import { officialB18Result, publicB18State, transitionB18 } from './b18-actions.ts'

function actionResponse(sessionId: string, stateVersion: number, game: GameState) {
  return {
    sessionId,
    stateVersion,
    state: publicB18State(game),
    result: officialB18Result(game),
  }
}

export function executeGameAction(db: Database, userId: string, sessionId: string, key: string, request: GameActionRequest) {
  return db.transaction(async tx => {
    const sessions = sessionRepository(tx)
    const session = await sessions.lockOwned(userId, sessionId)
    if (!session) throw notFound()
    assertSupportedB18(session)

    const repository = actionRepository(tx)
    const loadState = async (version: number) => restoreB18State(session, await repository.snapshot(session.id, version))

    const previous = await repository.findByKey(session.id, key)
    if (previous) {
      // JSONB may reorder payload fields. Sequence is the post-action state version.
      if (previous.actionType !== request.actionId || previous.sequence - 1 !== request.expectedStateVersion ||
          !isDeepStrictEqual(previous.payload, request.payload)) {
        throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key already belongs to a different request')
      }
      return actionResponse(session.id, previous.sequence, await loadState(previous.sequence))
    }

    if (session.status !== 'active') throw new ApiError(409, 'SESSION_NOT_ACTIVE', 'Game session is not active')
    if (session.stateVersion !== request.expectedStateVersion) {
      throw new ApiError(409, 'STATE_VERSION_CONFLICT', 'Expected state version does not match the current session')
    }

    const game = await loadState(session.stateVersion)
    if (game.phase === 'finished') throw new Error('Active session has a finished snapshot')
    const next = transitionB18(game, request)
    if (next === game) throw new ApiError(422, 'ACTION_NOT_ALLOWED', 'Action is not allowed in the current game state')

    const version = session.stateVersion + 1
    const response = actionResponse(session.id, version, next)
    const metadata = { engineVersion: session.engineVersion, resultVersion: session.resultVersion }
    await repository.insertAction({
      sessionId: session.id, sequence: version, idempotencyKey: key,
      actionType: request.actionId, payload: request.payload, ...metadata,
    })
    await sessions.insertSnapshot({
      sessionId: session.id, stateVersion: version, schemaVersion: 7, payload: serializeLog(next),
    })
    await repository.updateSession(session.id, version, response.result ? 'completed' : 'active')
    if (response.result) {
      await repository.insertResult({
        sessionId: session.id, stateVersion: version, outcome: response.result.outcome,
        lawfulProceedsVnd: BigInt(response.result.lawfulProceedsVnd), ...metadata,
      })
    }

    return response
  }, { isolationLevel: 'read committed' })
}
