import test from 'node:test'
import assert from 'node:assert/strict'
import { createPlayerGame } from '../src/game/new-game.ts'
import { createMobileGame } from '../mobile_app/src/game/session.ts'
import { advance, roll } from '../src/game/engine.ts'

test('every player game gets fresh cryptographic entropy, including mobile restarts', () => {
  const seeds = Array.from({ length: 100 }, () => createPlayerGame('', 0).seed)
  assert.equal(new Set(seeds).size, 100)
  assert.ok(seeds.every(seed => /^[a-f0-9]{32}$/.test(seed)))
  assert.notEqual(createMobileGame().seed, createMobileGame().seed)
})
test('explicit developer seeds preserve full web/mobile deterministic state', () => {
  const web = createPlayerGame('developer-fixed', 20_000_000, 3)
  const mobile = createMobileGame('developer-fixed', 20_000_000, 3)
  assert.deepEqual(mobile, web)
  assert.deepEqual(roll(advance(mobile)), roll(advance(web)))
})
