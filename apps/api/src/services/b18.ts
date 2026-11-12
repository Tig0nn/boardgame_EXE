import { z } from 'zod'
import { boardFor } from '../../../../src/data/board.ts'
import { serializeLog } from '../../../../src/game/log.ts'
import { createMultiCourseGame } from '../../../../src/game/new-game.ts'
import { MULTI_COURSE_PROFILE, MULTI_COURSE_RULES } from '../../../../src/game/rules-profile.ts'

const snapshotEnvelope = z.object({ schemaVersion: z.number().int().positive() })

export const b18Scenario = {
  scenarioId: 'b18',
  version: MULTI_COURSE_PROFILE,
  gameplayProfile: MULTI_COURSE_PROFILE,
  engineVersion: 'e30bbd034d0b014e9a9b6c40ef1a7356a2f5db8a',
  resultVersion: 'single-90m-v1',
  tiles: MULTI_COURSE_RULES.tiles,
  laps: MULTI_COURSE_RULES.laps,
} as const

export function createB18Genesis() {
  // This is the factory used by the current B18 mobile setup. Its seed is generated in Node.
  const game = createMultiCourseGame()
  if (game.boardLayout !== 'B18' || boardFor(game).length !== b18Scenario.tiles ||
      game.totalLaps !== b18Scenario.laps || game.gameplayProfile !== b18Scenario.gameplayProfile ||
      game.goalRulesVersion !== b18Scenario.resultVersion) {
    throw new Error('B18 factory differs from the registered scenario')
  }

  const snapshot = serializeLog(game)
  const { schemaVersion } = snapshotEnvelope.parse(JSON.parse(snapshot))
  return { seed: game.seed, schemaVersion, snapshot }
}
