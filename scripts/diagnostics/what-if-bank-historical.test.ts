import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { serializeLog } from '../../src/game/log.ts'
import { saveGameLocally, restoreSavedGame } from '../../src/game/saved-game.ts'
import { snapshot } from '../../src/game/state.ts'
import { createMobileSession } from '../../mobile_app/src/game/session.ts'
import { replayGameLog } from './replay-game-log.ts'
import { historicalBankProof, transcriptDigest } from './what-if-bank-historical.ts'

const path = 'docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz'
const source = () => JSON.parse(gunzipSync(readFileSync(path)).toString('utf8'))
const request = (data: ReturnType<typeof source>, sequence = 40, mode: 'ex-post' | 'ex-ante' = 'ex-post') =>
  ({ sequence, mode, expectedDigest: transcriptDigest(data) })
function noNumbers(result: ReturnType<typeof historicalBankProof>) {
  assert.notEqual(result.status, 'supported')
  assert.equal('difference' in result, false)
  assert.equal('actualNetCash' in result, false)
  assert.equal('alternativeNetCash' in result, false)
  assert.equal('branches' in result, false)
}

test('archived browser skip is explicit Actual; prefix, action and completed checkpoint match history', () => {
  const data = source(), frozen = JSON.stringify(data)
  const r = historicalBankProof(data, request(data))
  assert.equal(r.status, 'supported')
  if (r.status !== 'supported') throw Error('Unexpected proof status')
  assert.equal(r.identity.sequence, 40)
  assert.equal(r.identity.turn, 11)
  assert.equal(r.identity.lap, 2)
  assert.equal(r.identity.eventId, 'bank')
  assert.equal(r.identity.decisionId, 'skip')
  assert.equal(r.principal, 5_000_000)
  assert.equal(r.actualNetCash, 59_957_175)
  assert.equal(r.alternativeNetCash, 60_157_175)
  assert.equal(r.difference, 200_000)
  assert.equal(r.liquidBuffer.actual, 48_865_994)
  assert.equal(r.liquidBuffer.alternative, 43_865_994)
  assert.equal(r.checkpoint.lap, 2)
  assert.equal(r.checkpoint.turn, 12)
  assert.equal(r.checkpoint.dice, 5)
  assert.equal(r.proof.actualMatchesHistory, true)
  assert.equal(r.proof.exogenousEqual, true)
  assert.equal(r.proof.continuationActions, 1)
  for (const s of [r.before, r.branches.actual, r.branches.alternative]) {
    assert.deepEqual(snapshot(replayGameLog(JSON.parse(serializeLog(s)))), snapshot(s))
  }
  assert.equal(JSON.stringify(data), frozen)
})

test('ex-ante returns only known tradeoffs; no future cash, realized interest or dice', () => {
  const data = source(), r = historicalBankProof(data, request(data, 40, 'ex-ante'))
  assert.equal(r.status, 'ex-ante')
  noNumbers(r)
  assert.equal('realizedInterest' in r, false)
  assert.equal('checkpoint' in r, false)
  if (r.status !== 'ex-ante') throw Error('Unexpected proof status')
  assert.equal(r.known.principal, 5_000_000)
  assert.equal(r.known.rate, .04)
  assert.equal(r.known.cashIfDeposit, 43_865_994)
})

test('incomplete actual history cannot use seed to reveal a future result', () => {
  const data = source(), good = historicalBankProof(data, request(data))
  if (good.status !== 'supported') throw Error(good.status)
  const afterChoice = JSON.parse(serializeLog(good.afterActual))
  const r = historicalBankProof(afterChoice, request(afterChoice))
  noNumbers(r)
  assert.equal(r.status, 'blocked')
  assert.equal(r.reason, 'checkpoint-not-recorded')
  const before = JSON.parse(serializeLog(good.before))
  const missing = historicalBankProof(before, request(before))
  noNumbers(missing)
  assert.equal(missing.reason, 'actual-decision-missing')
  const early = historicalBankProof(afterChoice, request(afterChoice, 40, 'ex-ante'))
  assert.equal(early.status, 'ex-ante')
  if (early.status === 'ex-ante') assert.deepEqual(early.known,
    (historicalBankProof(data, request(data, 40, 'ex-ante')) as typeof early).known)
})

test('no inferred skip, wrong boundary and actual deposit are rejected', () => {
  const data = source()
  for (const sequence of [39, 28, 999]) noNumbers(historicalBankProof(data, request(data, sequence)))
  const deposit = JSON.parse(gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/frozen-holdout-diversified-roi.json.gz')).toString())
  const r = historicalBankProof(deposit, request(deposit, 4))
  noNumbers(r)
  assert.equal(r.reason, 'actual-not-bank-skip')
})

test('transcript/action/snapshot/metadata tampering and ambiguous identity fail closed', () => {
  for (const mutate of [
    (d: ReturnType<typeof source>) => { d.entries[39].decisionId = 'deposit' },
    (d: ReturnType<typeof source>) => { d.entries[39].eventId = 'gold' },
    (d: ReturnType<typeof source>) => { d.entries[39].before.portfolio.cash++ },
    (d: ReturnType<typeof source>) => { d.entries[40].after.dice = 1 },
    (d: ReturnType<typeof source>) => { d.entries[39].sequence = 39 },
    (d: ReturnType<typeof source>) => { d.state.seed = 'different-game' },
    (d: ReturnType<typeof source>) => { d.entries.splice(39, 1) },
    (d: ReturnType<typeof source>) => { d.financialConfig.ECONOMY.goldSpread = 99 },
  ]) {
    const data = source(); mutate(data); data.state.log = structuredClone(data.entries)
    noNumbers(historicalBankProof(data, request(data)))
  }
})

test('stale fingerprint rejects another valid history, not only corrupt data', () => {
  const data = source(), expected = request(data)
  const other = JSON.parse(gunzipSync(readFileSync('docs/playtests/b18-beginner-ux/after/browser-desktop-defeat.json.gz')).toString())
  const r = historicalBankProof(other, expected)
  noNumbers(r)
  assert.equal(r.reason, 'stale-transcript')
})

test('packed local save roundtrip preserves explicit decision and historical opportunity proof', () => {
  const data = source(); let packed = ''
  assert(saveGameLocally(data.state, { setItem(_key, value) { packed = value } }))
  const restored = restoreSavedGame(packed)
  const replay = JSON.parse(serializeLog(restored))
  const r = historicalBankProof(replay, request(replay))
  assert.equal(r.status, 'supported')
  if (r.status === 'supported') assert.equal(r.difference, 200_000)
})

test('a second archived last-bank skip uses its own recorded wealth, not G3 demo amounts', () => {
  const data = JSON.parse(gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/frozen-screen-cash-roi.json.gz')).toString())
  const r = historicalBankProof(data, request(data, 36))
  assert.equal(r.status, 'supported')
  if (r.status !== 'supported') throw Error('Unexpected proof status')
  assert.equal(r.liquidBuffer.actual, 45_000_000)
  assert.equal(r.difference, 200_000)
  assert.equal(r.checkpoint.lap, 2)
  assert.notEqual(r.actualNetCash, 59_000_000)
})

test('post-checkpoint actions are not copied into the counterfactual', () => {
  const data = source(), r = historicalBankProof(data, request(data))
  assert.equal(r.status, 'supported')
  if (r.status !== 'supported') throw Error('Unexpected proof status')
  assert(data.entries.length > r.checkpoint.sequence)
  assert.equal(r.branches.actual.log.length, r.checkpoint.sequence)
  assert.equal(r.branches.alternative.log.length, r.checkpoint.sequence) // maturity is one line inside the existing settlement schedule
  assert.equal(r.branches.actual.summaries.length, r.before.summaries.length + 1)
  assert.equal(r.branches.alternative.summaries.length, r.before.summaries.length + 1)
})

test('unsupported schema and missing explicit record return BLOCKED with no opportunity amount', () => {
  for (const schemaVersion of [4, 5, 6, 8]) {
    const data = source(); data.schemaVersion = schemaVersion
    const r = historicalBankProof(data, request(data))
    noNumbers(r)
    assert.equal(r.reason, 'identity-or-version-unsupported')
  }
  const data = source(); delete data.entries[39].decisionId
  data.state.log = structuredClone(data.entries)
  const r = historicalBankProof(data, request(data))
  noNumbers(r)
  assert.equal(r.reason, 'actual-not-bank-skip')
})

test('existing session revision guard rejects stale or cross-session snapshots without schema changes', () => {
  const data = source(), r = historicalBankProof(data, request(data))
  assert.equal(r.status, 'supported')
  if (r.status !== 'supported') throw Error('Expected supported proof')
  const first = createMobileSession(structuredClone(r.before))
  const second = createMobileSession(structuredClone(r.before))
  const oldSnapshot = first.getSnapshot()
  assert.equal(second.dispatch({ type: 'choose', id: 'skip' }, oldSnapshot), false)
  assert.equal(first.dispatch({ type: 'choose', id: 'skip' }, oldSnapshot), true)
  assert.equal(first.dispatch({ type: 'roll' }, oldSnapshot), false)
  assert.equal(Object.hasOwn(data.state, 'sessionId'), false)
  assert.equal(Object.hasOwn(data.state, 'gameId'), false)
})
