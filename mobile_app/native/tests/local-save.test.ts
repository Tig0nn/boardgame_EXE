import assert from 'node:assert/strict'
import test from 'node:test'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { restoreSavedGame } from '../../../src/game/saved-game.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { createLocalSaveQueue } from '../src/local-save.ts'

test('a fresh B18 save survives cold restore before the first action', async () => {
  const game = createMultiCourseGame('fresh-local', 0, 1)
  let stored = ''
  await createLocalSaveQueue(async payload => { stored = payload })(game)
  assert.equal(JSON.parse(stored).schemaVersion, 7)
  assert.deepEqual(JSON.parse(serializeLog(restoreSavedGame(stored))), JSON.parse(serializeLog(game)))
})

test('writes across screen mounts finish in order and the newest game wins', async () => {
  const first = createMultiCourseGame('old-screen', 0, 1)
  const next = createMultiCourseGame('new-screen', 0, 1)
  let release: () => void = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  let stored = ''
  let writes = 0
  const save = createLocalSaveQueue(async payload => {
    if (++writes === 1) await gate
    stored = payload
  })
  const leaving = save(first)
  const entering = save(next)
  await Promise.resolve()
  assert.equal(stored, '')
  release()
  await leaving
  await entering
  assert.equal(restoreSavedGame(stored).seed, next.seed)
})

test('a failed storage write is reported and a retry can persist the exact state', async () => {
  const game = createMultiCourseGame('retry-local', 0, 1)
  let writes = 0
  let stored = ''
  const save = createLocalSaveQueue(async payload => {
    if (++writes === 1) throw new Error('fixture storage failure')
    stored = payload
  })
  await assert.rejects(save(game), /fixture storage failure/)
  await save(game)
  assert.deepEqual(JSON.parse(serializeLog(restoreSavedGame(stored))), JSON.parse(serializeLog(game)))
})
