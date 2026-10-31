import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, snapshot } from '../src/game/engine.ts'
import { boardFor } from '../src/data/board.ts'
import { serializeLog } from '../src/game/log.ts'

const candidate = () => createGame('living-version', 0, 1, 'experimental-b', undefined,
  'v2.4-customer-preferences', 'v2.4-atomic-investments', 'vn-v1', 'v2.5-credit-risk', 'v2.6-periodic-start')

test('metadata absence retains historical C20 and no new snapshot keys', () => {
  const game = createGame('legacy', 0, 1, 'experimental-b')
  assert.equal(boardFor(game)[3].type, 'living')
  assert.equal(boardFor(game)[14].type, 'living')
  assert.ok(!('livingExpenseRulesVersion' in snapshot(game)))
  assert.ok(!('boardRevision' in snapshot(game)))
})
test('candidate A replaces only tiles 4 and 15 on versioned C20', () => {
  const game = candidate(), board = boardFor(game)
  const old = boardFor(createGame('legacy', 0, 1, 'experimental-b'))
  assert.equal(board.length, 20)
  assert.equal(board[3].type, 'stocks'); assert.equal(board[14].type, 'gold')
  assert.deepEqual(board.filter((_, i) => i !== 3 && i !== 14), old.filter((_, i) => i !== 3 && i !== 14))
  assert.equal(game.boardRevision, 'c20-v2.6-a')
})
test('new rule and board metadata survive every snapshot and export', () => {
  const game = candidate(), data = JSON.parse(serializeLog(game))
  assert.equal(data.livingExpenseRulesVersion, 'v2.6-periodic-start')
  assert.equal(data.boardRevision, 'c20-v2.6-a')
  for (const value of [snapshot(game), data.state, ...data.entries.flatMap((e: { before: unknown; after: unknown }) => [e.before, e.after])]) {
    assert.equal(value.livingExpenseRulesVersion, 'v2.6-periodic-start')
    assert.equal(value.boardRevision, 'c20-v2.6-a')
  }
})
test('unknown policy and incompatible A20 candidate are rejected', () => {
  assert.throws(() => createGame('bad', 0, 1, 'experimental-b', undefined, undefined, undefined, undefined, undefined, 'unknown' as never))
  assert.throws(() => createGame('bad', 0, 1, 'original', undefined, undefined, undefined, undefined, undefined, 'v2.6-periodic-start'))
})
