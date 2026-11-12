import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { restoreSavedGame } from '../../../src/game/saved-game.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { b18Scenario, createB18Genesis } from '../src/services/b18.ts'

test('V1 genesis uses the canonical B18 multi-course factory and replay envelope', () => {
  const { seed, snapshot, schemaVersion } = createB18Genesis()
  assert.match(seed, /^[a-f0-9]{32}$/)
  assert.equal(schemaVersion, 7)
  assert.notEqual(seed, createB18Genesis().seed)
  assert.equal(snapshot, serializeLog(createMultiCourseGame(seed)))
  const restored = restoreSavedGame(snapshot)
  assert.equal(restored.boardLayout, 'B18')
  assert.equal(restored.totalLaps, 4)
  assert.equal(restored.gameplayProfile, b18Scenario.gameplayProfile)
  assert.equal(restored.goalRulesVersion, b18Scenario.resultVersion)
  assert.equal(b18Scenario.tiles, 18)
  assert.equal(b18Scenario.laps, 4)
})
