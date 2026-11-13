import assert from 'node:assert/strict'
import { test } from 'node:test'
import { boardFor } from '../../../src/data/board.ts'
import { decide, fundPayment } from '../../../src/game/engine.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { publicB18State, transitionB18 } from '../src/services/b18-actions.ts'
import { gameActionBody } from '../src/validation.ts'

const parse = (actionId: string, payload: object) => gameActionBody.parse({ actionId, payload, expectedStateVersion: 0 })

test('validates canonical funding inputs and event option IDs', () => {
  for (const optionId of ['pay', 'full', 'course-basic', 'course-advanced']) {
    assert.equal(parse('choose', { optionId }).actionId, 'choose')
  }
  for (const payload of [
    { source: 'savings', amount: 1 }, { source: 'savings', amount: 1, lotId: 'deposit-1' },
    { source: 'stocks', amount: 1 }, { source: 'gold', amount: 1 },
    { source: 'bonds', amount: 1, lotId: 'bond-1' }, { source: 'debt', amount: 1 },
  ]) {
    assert.equal(parse('fund', payload).actionId, 'fund')
  }
  for (const payload of [
    { source: 'business', amount: 1 }, { source: 'debt', amount: 0 }, { source: 'debt', amount: 1.1 },
    { source: 'debt', amount: Number.MAX_SAFE_INTEGER + 1 }, { source: 'debt', amount: '1' },
    { source: 'debt', amount: 1, lotId: 'deposit-1' }, { source: 'bonds', amount: 1 },
    { source: 'gold', amount: 1, net: 1 }, { source: 'savings', amount: 1, lotId: '' },
  ]) {
    assert.throws(() => parse('fund', payload))
  }
  assert.throws(() => parse('choose', { optionId: 'course-made-up' }))
})

test('course affordability and partial funding match the engine', () => {
  const genesis = createMultiCourseGame('funding-unit', 49_000_000, 3)
  const course = { ...genesis, phase: 'event' as const, eventId: 'course', position: boardFor(genesis).findIndex(tile => tile.type === 'course') }
  assert.equal(transitionB18(course, parse('choose', { optionId: 'course-basic' })), course)
  assert.deepEqual(publicB18State(course).options.map(option => option.id), ['skip'])

  const personal = { ...genesis, phase: 'event' as const, eventId: 'medical', position: boardFor(genesis).findIndex(tile => tile.type === 'personal') }
  const funding = transitionB18(personal, parse('choose', { optionId: 'pay' }))
  assert.deepEqual(funding, decide(personal, 'pay'))
  assert.deepEqual(publicB18State(funding).fundingOptions, [
    { source: 'savings', lotId: 'deposit-1', minAmount: 49_000_000, maxAmount: 49_000_000 },
    { source: 'debt', minAmount: 1, maxAmount: 4_000_000 },
  ])
  assert.equal(transitionB18(funding, parse('fund', { source: 'debt', amount: 4_000_001 })), funding)
  const next = transitionB18(funding, parse('fund', { source: 'debt', amount: 1_000_000 }))
  assert.deepEqual(next, fundPayment(funding, 'debt', 1_000_000))
  assert.equal(next.pendingPayment?.remaining, 3_000_000)
})
