import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { serializeLog } from '../../../src/game/log.ts'
import { createCoreMvpGame, createMultiCourseGame, createPlayerGame } from '../../../src/game/new-game.ts'
import type { GameState, Term } from '../../../src/game/types.ts'
import { transitionB18 } from '../src/services/b18-actions.ts'
import { createWhatIfSnapshotDigester } from '../src/services/what-if-digest.ts'
import { gameActionBody } from '../src/validation.ts'

type Fixture = {
  seed: string
  setup: { initialSavings: number; savingsTerm: Term }
  actions: { sequence: number; action_type: string; payload: Record<string, unknown> }[]
  hashes: { state_version: number; schema_version: number; sha256: string; bytes: number }[]
}
const fixture: Fixture = JSON.parse(await readFile(new URL('./fixtures/android-b18-history.json', import.meta.url), 'utf8'))
const digestText = (text: string) => createHash('sha256').update(text).digest('hex')
const memoryLimit = 4 * 1024 * 1024

function assertReleased(digester: ReturnType<typeof createWhatIfSnapshotDigester>) {
  assert.equal(digester.retainedBytes, 0, 'fragments must be released after every digest')
  assert.ok(digester.peakRetainedBytes >= 0 && digester.peakRetainedBytes <= memoryLimit,
    'peak retained fragments must respect the 4 MiB admission limit')
}

function history() {
  const states = [createMultiCourseGame(fixture.seed, fixture.setup.initialSavings, fixture.setup.savingsTerm)]
  for (const entry of fixture.actions) {
    const command = gameActionBody.parse({ actionId: entry.action_type, expectedStateVersion: entry.sequence - 1, payload: entry.payload })
    const next = transitionB18(states.at(-1)!, command)
    assert.notEqual(next, states.at(-1), 'fixture action must progress: ' + entry.sequence)
    states.push(next)
  }
  return states
}

function freezeGraph(value: unknown, seen = new WeakSet<object>()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  for (const child of Object.values(value)) freezeGraph(child, seen)
  Object.freeze(value)
}

test('What-if digest preserves all 61 Android schema-7 canonical byte hashes', { timeout: 60_000 }, () => {
  const states = history()
  const digester = createWhatIfSnapshotDigester()
  assert.equal(states.length, 61)
  for (const [version, game] of states.entries()) {
    const canonical = serializeLog(game)
    const pin = fixture.hashes[version]
    assert.equal(pin.state_version, version)
    assert.equal(pin.schema_version, 7)
    assert.equal(Buffer.byteLength(canonical), pin.bytes, 'canonical bytes at version ' + version)
    assert.equal(digestText(canonical), pin.sha256, 'fixture hash at version ' + version)
    assert.equal(digester.digest(game), pin.sha256, 'optimized hash at version ' + version)
    assertReleased(digester)
  }
})

test('final and fork states keep independent exact digests in one request', () => {
  const states = history()
  const digester = createWhatIfSnapshotDigester()
  assert.equal(digester.digest(states[60]), fixture.hashes[60].sha256)
  assertReleased(digester)
  assert.equal(digester.digest(states[52]), fixture.hashes[52].sha256)
  assertReleased(digester)
  assert.notEqual(fixture.hashes[52].sha256, fixture.hashes[60].sha256)
  assert.equal(digester.digest(states[60]), fixture.hashes[60].sha256)
  assertReleased(digester)
})

test('digest never returns stale proof after financial, nested market, or journal changes', () => {
  const game = history()[60]
  const digester = createWhatIfSnapshotDigester()
  let previous = digester.digest(game)
  const mutations: ((state: GameState) => void)[] = [
    state => { state.portfolio.cash += 1 },
    state => { state.market.stocks[0].name += ' · cập nhật' },
    state => { state.market.gold.priceHistory[0].priceAfter += 1 },
    state => { state.log[0].consequence += ' Kiểm tra nhật ký.' },
    state => { state.log[0].before.market.bond.currentPrice += 1 },
  ]
  for (const mutate of mutations) {
    mutate(game)
    const expected = digestText(serializeLog(game))
    assert.notEqual(expected, previous)
    assert.equal(digester.digest(game), expected)
    assertReleased(digester)
    assert.equal(createWhatIfSnapshotDigester().digest(game), expected)
    previous = expected
  }
})

test('fragment serialization preserves Vietnamese, escapes, non-BMP and lone-surrogate bytes', () => {
  const game = history()[52]
  const text = 'Tiết kiệm 🦊 ☕ 💰 "trích dẫn" \\ xuống dòng\n\r\t\b\f \u0000 \u2028\u2029 \ud800 \udfff'
  game.market.stocks[0].name = text
  game.market.appliedShocks.push(text)
  game.log[0].title = text
  game.log[0].consequence = text
  const before = structuredClone(game)
  const expected = digestText(serializeLog(game))
  assert.equal(createWhatIfSnapshotDigester().digest(game), expected)
  assert.deepEqual(game, before)
})

test('marker-looking player text is hashed literally and never expanded as a market fragment', () => {
  const game = createMultiCourseGame('literal-marker-content', 0, 1)
  const text = '@what-if-market:0@ @what-if-market:999@ 🦊 Tiếng Việt\n' +
    '        "market": "@what-if-market:0@",\n' +
    '  "market": "@what-if-market:999@"\n' +
    '\\n  \\"market\\": \\"@what-if-market:1@\\"\u2028\u2029\ud800'
  game.market.stocks[0].name = text
  game.market.appliedShocks.push(text)
  assert.ok(game.log.length > 0)
  game.log[0].title = text
  game.log[0].consequence = text
  const canonical = serializeLog(game)
  const digester = createWhatIfSnapshotDigester()
  assert.equal(digester.digest(game), digestText(canonical))
  assert.equal(serializeLog(game), canonical)
  assert.ok(digester.peakRetainedBytes > 0, 'exercise actual dictionary admission')
  assertReleased(digester)
})

test('digest accepts frozen canonical graphs without injecting toJSON or mutating official state', () => {
  const game = history()[60]
  const expected = fixture.hashes[60].sha256
  freezeGraph(game)
  const digester = createWhatIfSnapshotDigester()
  assert.equal(digester.digest(game), expected)
  assertReleased(digester)
  assert.equal(Object.hasOwn(game, 'toJSON'), false)
  assert.equal(Object.hasOwn(game.market, 'toJSON'), false)
  assert.ok(game.log.every(entry => !Object.hasOwn(entry.before, 'toJSON') && !Object.hasOwn(entry.before.market, 'toJSON')))
  assert.equal(digestText(serializeLog(game)), expected)
})

test('large poorly compressible fragments stay within the request memory admission limit', () => {
  const game = createMultiCourseGame('bounded-private-fragments', 0, 1)
  game.market.stocks[0].name = randomBytes(2 * 1024 * 1024).toString('base64')
  const digester = createWhatIfSnapshotDigester()
  assert.equal(digester.digest(game), digestText(serializeLog(game)))
  assertReleased(digester)
})

test('legacy canonical profiles retain their original schema and digest', () => {
  const digester = createWhatIfSnapshotDigester()
  for (const game of [createCoreMvpGame('frozen-schema-6', 0, 1), createPlayerGame('frozen-schema-5', 0, 1)]) {
    assert.equal(digester.digest(game), digestText(serializeLog(game)))
    assertReleased(digester)
  }
})
