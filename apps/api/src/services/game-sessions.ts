import type { Database } from '../db/client.ts'
import type { SnapshotObserver } from '../observability.ts'
import { ApiError } from '../errors.ts'
import { insertProfileIfMissing } from '../repositories/profiles.ts'
import { sessionRepository } from '../repositories/game-sessions.ts'
import { b18Scenario, createB18Genesis } from './b18.ts'
import type { B18Setup } from './b18.ts'

function checkCreationRetry(stored: B18Setup, requested: B18Setup) {
  if (stored.initialSavings !== requested.initialSavings || stored.savingsTerm !== requested.savingsTerm) {
    throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key already belongs to a different request')
  }
}

export function createGameSession(db: Database, userId: string, creationKey: string, setup: B18Setup, observer?: SnapshotObserver) {
  return db.transaction(async tx => {
    const sessions = sessionRepository(tx, observer)
    const previous = await sessions.findByCreationKey(userId, creationKey)
    if (previous) {
      checkCreationRetry(previous.setup, setup)
      return { created: false, session: previous }
    }

    const { scenarioId, version } = b18Scenario
    const scenario = await sessions.scenario(scenarioId, version)
    if (!scenario || scenario.gameplayProfile !== b18Scenario.gameplayProfile ||
        scenario.engineVersion !== b18Scenario.engineVersion || scenario.resultVersion !== b18Scenario.resultVersion ||
        scenario.tiles !== b18Scenario.tiles || scenario.laps !== b18Scenario.laps) {
      throw new Error('Stored B18 scenario differs from the engine configuration')
    }

    const genesis = createB18Genesis(setup)
    await insertProfileIfMissing(tx, userId)
    const inserted = await sessions.insert({
      userId, creationKey, scenarioId, scenarioVersion: version, seed: genesis.seed, ...setup,
    })

    if (!inserted) {
      // A concurrent retry committed first. Under READ COMMITTED this lookup sees its session.
      const session = await sessions.findByCreationKey(userId, creationKey)
      if (!session) throw new Error('Session creation retry lookup failed')
      checkCreationRetry(session.setup, setup)
      return { created: false, session }
    }

    await sessions.insertSnapshot({
      sessionId: inserted.id,
      stateVersion: inserted.stateVersion,
      schemaVersion: genesis.schemaVersion,
      payload: genesis.snapshot,
    })
    return { created: true, session: { ...inserted, ...scenario } }
  }, { isolationLevel: 'read committed' })
}
