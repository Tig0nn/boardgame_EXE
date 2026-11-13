import { restoreSavedGame } from '../../../../src/game/saved-game.ts'
import type { Database } from '../db/client.ts'
import { ApiError, notFound } from '../errors.ts'
import { sessionRepository } from '../repositories/game-sessions.ts'
import { b18Scenario } from './b18.ts'
import { publicB18State } from './b18-actions.ts'

type SessionIdentity = {
  scenarioId: string
  scenarioVersion: string
  engineVersion: string
  resultVersion: string
  gameplayProfile: string
  tiles: number
  laps: number
  seed: string
}

type StoredSnapshot = { schemaVersion: number; payload: string }

export function assertSupportedB18(session: SessionIdentity) {
  if (session.scenarioId !== b18Scenario.scenarioId || session.scenarioVersion !== b18Scenario.version ||
      session.engineVersion !== b18Scenario.engineVersion || session.resultVersion !== b18Scenario.resultVersion ||
      session.gameplayProfile !== b18Scenario.gameplayProfile || session.tiles !== b18Scenario.tiles ||
      session.laps !== b18Scenario.laps) {
    throw new ApiError(409, 'SCENARIO_UNSUPPORTED', 'Session scenario is not supported by this API')
  }
}

export function restoreB18State(session: SessionIdentity, saved: StoredSnapshot | null | undefined) {
  if (!saved || saved.schemaVersion !== 7) throw new Error('B18 snapshot missing or unsupported')
  const game = restoreSavedGame(saved.payload)
  if (game.seed !== session.seed || game.gameplayProfile !== session.gameplayProfile ||
      game.goalRulesVersion !== session.resultVersion || game.boardLayout !== 'B18' || game.totalLaps !== session.laps) {
    throw new Error('B18 snapshot metadata differs from its session')
  }
  return game
}

export async function readGameState(db: Database, userId: string, sessionId: string) {
  const row = await sessionRepository(db).findWithState(userId, sessionId)
  if (!row) throw notFound()

  const { seed, snapshot, result, ...session } = row
  const identity = { ...session, seed }
  assertSupportedB18(identity)
  const game = restoreB18State(identity, snapshot)
  if ((session.status === 'completed') !== (game.phase === 'finished') ||
      (game.phase === 'finished') !== !!result) {
    throw new Error('Session, snapshot and result disagree')
  }

  return {
    session,
    state: publicB18State(game, session.status === 'active'),
    result: result ? { outcome: result.outcome, lawfulProceedsVnd: String(result.lawfulProceedsVnd) } : null,
  }
}
