import type { Database } from '../db/client.ts'
import { insertProfileIfMissing } from '../repositories/profiles.ts'
import { sessionRepository } from '../repositories/game-sessions.ts'
import { b18Scenario, createB18Genesis } from './b18.ts'

export function createGameSession(db: Database, userId: string, creationKey: string) {
  return db.transaction(async tx => {
    const sessions = sessionRepository(tx)
    const previous = await sessions.findByCreationKey(userId, creationKey)
    if (previous) return { created: false, session: previous }

    const { scenarioId, version } = b18Scenario
    const scenario = await sessions.scenario(scenarioId, version)
    if (!scenario || scenario.gameplayProfile !== b18Scenario.gameplayProfile ||
        scenario.engineVersion !== b18Scenario.engineVersion || scenario.resultVersion !== b18Scenario.resultVersion ||
        scenario.tiles !== b18Scenario.tiles || scenario.laps !== b18Scenario.laps) {
      throw new Error('Stored B18 scenario differs from the engine configuration')
    }

    const genesis = createB18Genesis()
    await insertProfileIfMissing(tx, userId)
    const inserted = await sessions.insert({
      userId, creationKey, scenarioId, scenarioVersion: version, seed: genesis.seed,
    })

    if (!inserted) {
      // A concurrent retry committed first. Under READ COMMITTED this lookup sees its session.
      const session = await sessions.findByCreationKey(userId, creationKey)
      if (!session) throw new Error('Session creation retry lookup failed')
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
