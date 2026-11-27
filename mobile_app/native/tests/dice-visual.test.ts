import assert from 'node:assert/strict'
import test from 'node:test'
import { diceFaces, diceRotation, pipPositions } from '../src/dice-visual.ts'

test('3D die presents the canonical value on top and opposite faces sum to seven', () => {
  for (let value = 1; value <= 6; value++) {
    const faces = diceFaces(value)!
    assert.equal(faces.top, value)
    assert.equal(faces.top + faces.bottom, 7)
    assert.equal(faces.front + faces.back, 7)
    assert.equal(faces.right + faces.left, 7)
    assert.deepEqual(Object.values(faces).toSorted(), [1, 2, 3, 4, 5, 6])
    assert.equal(pipPositions(value).length, value)
    assert.ok(pipPositions(value).every(([x, y]) => Math.abs(x) <= .56 && Math.abs(y) <= .6))
  }
})

test('unavailable or invalid dice values never invent a visible result', () => {
  for (const value of [0, -1, 7, 1.5, NaN, Infinity]) {
    assert.equal(diceFaces(value), null)
    assert.deepEqual(pipPositions(value), [])
  }
})

test('visual tumble settles to the same orientation without RNG or changing the value', () => {
  assert.deepEqual(diceRotation(1), [0, 0, 0])
  assert.deepEqual(diceRotation(2), [0, 0, 0])
  assert.notDeepEqual(diceRotation(.5), diceRotation(0))
  for (const step of [0, .2, .5, .9, 1]) assert.ok(diceRotation(step).every(Number.isFinite))
})
