import test from 'node:test'
import assert from 'node:assert/strict'
import { hasSeenTutorial, rememberTutorial, TUTORIAL_STORAGE_KEY } from '../mobile_app/src/game/onboarding.ts'

test('a fresh device sees the tutorial; completing or skipping it persists across visits', () => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  assert.equal(hasSeenTutorial(storage), false)
  assert.equal(rememberTutorial(storage), true)
  assert.equal(hasSeenTutorial(storage), true)
  assert.deepEqual([...values], [[TUTORIAL_STORAGE_KEY, 'seen']])
})

test('unavailable or blocked browser storage never prevents playing', () => {
  const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('quota') } }
  assert.equal(hasSeenTutorial(blocked), false)
  assert.equal(rememberTutorial(blocked), false)
  assert.equal(hasSeenTutorial(null), false)
  assert.equal(rememberTutorial(null), false)
})

test('unrecognized tutorial markers are treated as first visits without changing other storage', () => {
  const values = new Map([['game-preference', 'keep'], [TUTORIAL_STORAGE_KEY, 'partial']])
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  assert.equal(hasSeenTutorial(storage), false)
  rememberTutorial(storage)
  assert.equal(values.get('game-preference'), 'keep')
  assert.equal(values.size, 2)
})
