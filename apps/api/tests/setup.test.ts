import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { createB18Genesis } from '../src/services/b18.ts'
import { createSessionBody } from '../src/validation.ts'

test('B18 session setup defaults to the existing API configuration', () => {
  assert.deepEqual(createSessionBody.parse({ scenarioId: 'b18' }), {
    scenarioId: 'b18', setup: { initialSavings: 0, savingsTerm: 1 },
  })
})

test('accepts the Mobile amount range and term choices and builds canonical genesis', () => {
  for (const initialSavings of [0, 1, 10_000_000, 20_000_000, 49_999_999, 50_000_000]) {
    for (const savingsTerm of [1, 2, 3] as const) {
      const setup = { initialSavings, savingsTerm }
      assert.deepEqual(createSessionBody.parse({ scenarioId: 'b18', setup }).setup, setup)
      const { seed, snapshot, schemaVersion } = createB18Genesis(setup)
      assert.equal(schemaVersion, 7)
      assert.equal(snapshot, serializeLog(createMultiCourseGame(seed, initialSavings, savingsTerm)))
    }
  }
})

test('rejects noncanonical setup inputs without accepting client authority', () => {
  for (const setup of [
    null, [], { initialSavings: -1 }, { initialSavings: 50_000_001 }, { initialSavings: 1.5 },
    { initialSavings: '1000' }, { savingsTerm: 0 }, { savingsTerm: 4 }, { savingsTerm: '2' },
    { cash: 1 }, { seed: 'seed' }, { result: 'victory' }, { rng: 1 },
  ]) assert.equal(createSessionBody.safeParse({ scenarioId: 'b18', setup }).success, false)
})
