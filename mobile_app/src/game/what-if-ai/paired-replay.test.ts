import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { transact } from '../../../../src/game/engine.ts'
import { serializeLog } from '../../../../src/game/log.ts'
import { WorkBudget } from '../endgame-whatif-contract.ts'
import { stepGoldPair, finishGoldPair, goldPairReason } from '../endgame-whatif-gold-reconcile.ts'
import { parseHistory } from '../endgame-whatif-identity.ts'
import { replayHistory } from '../endgame-whatif-replay.ts'
import { pairReason, stepRecordedPair } from '../endgame-whatif-paired.ts'

// Characterize the existing Gold caller before extracting its paired replay implementation.
const history = parseHistory(gunzipSync(readFileSync('docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz')).toString())
let captured: ReturnType<typeof replayHistory> | undefined
async function sale() {
  captured ??= replayHistory(history, new WorkBudget(), 25)
  const replay = await captured
  assert(replay.before)
  return { actual: structuredClone(replay.before), entry: history.entries[24] }
}
const stats = () => ({ externalCheckpoints: 0, advances: 0 })

test('legacy pair retains the exact full sale and does not mutate either branch', async () => {
  const { actual, entry } = await sale(), alternative = structuredClone(actual)
  const before = serializeLog(actual)
  const result = stepGoldPair(actual, alternative, entry, history.entries, new WorkBudget(), stats())
  assert.equal(result.ok, true)
  assert.equal(result.actual.log.at(-1)?.action?.amount, entry.action?.amount)
  assert.equal(result.actual.goldUnits, 0)
  assert.deepEqual(result.actual, result.alternative)
  assert.equal(serializeLog(actual), before)
  assert.equal(serializeLog(alternative), before)
})

test('legacy Gold refuses a partial sale before applying either branch', async () => {
  const { actual } = await sale()
  const partial = transact(actual, { kind: 'sell', asset: 'gold', amount: Math.floor(actual.portfolio.gold / 2), completeEncounter: true })
  const entry = partial.log.at(-1)!, counters = stats()
  const result = stepGoldPair(actual, structuredClone(actual), entry, partial.log, new WorkBudget(), counters)
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.reason, 'partial-gold-sale-unsupported')
  assert.equal(result.boundary, 'before-command')
  assert.equal(result.actualCandidate, undefined)
  assert.equal(counters.externalCheckpoints, 1)
  const shared = stepRecordedPair(actual, structuredClone(actual), entry, partial.log, new WorkBudget(), stats())
  assert.equal(shared.ok, true)
  assert.equal(shared.actual.goldUnits, shared.alternative.goldUnits)
  assert(shared.actual.goldUnits > 0)
})

test('illegal recorded sale preserves the stopped alternative and exposes no result metrics', async () => {
  const { actual, entry } = await sale(), alternative = structuredClone(actual)
  alternative.portfolio.gold = 0
  alternative.goldUnits = 0
  alternative.goldCostBasis = 0
  const before = serializeLog(alternative)
  const result = stepGoldPair(actual, alternative, entry, history.entries, new WorkBudget(), stats())
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.reason, 'illegal-recorded-action')
  assert.equal(result.boundary, 'before-command')
  assert.equal(result.alternativeUnchanged, true)
  assert(result.actualCandidate)
  assert.equal(serializeLog(alternative), before)
  assert.equal('delta' in result, false)
})

for (const field of ['rng', 'turn', 'market', 'funding', 'insolvent', 'terminal'] as const) {
  test('legacy pair rejects ' + field + ' before executing another command', async () => {
    const { actual, entry } = await sale(), alternative = structuredClone(actual)
    const expected = field === 'funding' ? 'unsupported-funding-context'
      : field === 'insolvent' ? 'early-insolvency' : field === 'terminal' ? 'early-terminal' : 'exogenous-or-context-mismatch'
    if (field === 'rng') alternative.rng++
    if (field === 'turn') alternative.turn++
    if (field === 'market') alternative.market.gold.currentPrice++
    if (field === 'funding') alternative.phase = 'funding'
    if (field === 'insolvent') alternative.termination = 'insolvent'
    if (field === 'terminal') alternative.phase = 'finished'
    assert.equal(goldPairReason(actual, alternative), expected)
    assert.equal(pairReason(actual, alternative), expected)
    const result = stepGoldPair(actual, alternative, entry, history.entries, new WorkBudget(), stats())
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, expected)
    const shared = stepRecordedPair(actual, alternative, entry, history.entries, new WorkBudget(), stats())
    assert.equal(shared.ok, false)
    if (!shared.ok) assert.equal(shared.reason, expected)
  })
}

test('legacy step preserves cancellation, time budget, and advance budget rejection', async () => {
  const { actual, entry } = await sale(), abort = new AbortController()
  abort.abort()
  assert.throws(() => stepGoldPair(actual, actual, entry, history.entries, new WorkBudget({ signal: abort.signal }), stats()), /cancelled/)
  const work = new WorkBudget()
  Object.defineProperty(work, 'deadline', { value: Date.now() - 1 })
  assert.throws(() => stepGoldPair(actual, actual, entry, history.entries, work, stats()), /time-budget/)
  const result = finishGoldPair(actual, actual, new WorkBudget(), { externalCheckpoints: 0, advances: 200 })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.reason, 'gold-final-advance-budget')
})
