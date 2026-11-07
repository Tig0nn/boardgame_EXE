import test from 'node:test'
import assert from 'node:assert/strict'
import { playSavingsPolicy, researchAction, strategies } from '../scripts/diagnostics/savings-lot-policy.ts'
import { createPlayerGame } from '../src/game/new-game.ts'
import { snapshot, transact } from '../src/game/engine.ts'

test('research Policy B restricts only the decision policy; production still accepts a second lot', () => {
  const s = { ...createPlayerGame('research', 10e6, 3), phase: 'event' as const, position: 1, eventId: 'bank' }
  assert.equal(researchAction(s, 'reserve-saver', 'B'), null)
  assert.ok(researchAction(s, 'reserve-saver', 'A'))
  assert.equal(transact(s, { kind: 'deposit', amount: 5e6, term: 2 }).deposits.length, 2)
})
test('simulation compaction preserves all financial states, metrics and dice paths', () => {
  for (const strategy of strategies) for (const policy of ['A', 'B'] as const) for (let i = 0; i < 8; i++) {
    const full = playSavingsPolicy(`verify-compaction-${i}`, strategy, policy, 20e6, false)
    const compact = playSavingsPolicy(`verify-compaction-${i}`, strategy, policy, 20e6)
    assert.deepEqual(snapshot(compact.state), snapshot(full.state))
    assert.deepEqual(compact.state.summaries, full.state.summaries)
    assert.deepEqual(compact.metrics, full.metrics)
    assert.equal(compact.path, full.path)
    if (policy === 'B') assert.ok(full.state.log.every(e => e.after.deposits.filter(l => l.status === 'active').length <= 1))
  }
})
