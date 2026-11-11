import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { advance, decide, transact } from '../../../../src/game/engine.ts'
import { serializeLog } from '../../../../src/game/log.ts'
import { saveGameLocally } from '../../../../src/game/saved-game.ts'
import { WorkBudget } from '../endgame-whatif-contract.ts'
import { parseHistory } from '../endgame-whatif-identity.ts'
import { applyRecorded, replayHistory } from '../endgame-whatif-replay.ts'
import { createDecisionReplay, listDecisionChoices } from './decision-replay.ts'
import type { WhatIfDecision } from './orchestrator.ts'

const fixture = (name: string) => gunzipSync(readFileSync(`docs/playtests/core-mvp-b18-multi-course/${name}.json.gz`)).toString()
const options = () => ({ maxMilliseconds: 30_000 })
const c1 = fixture('browser-390-trades')
const bank = (sequence: number, turn: number): WhatIfDecision => ({ kind: 'bank', decisionId: `bank:${sequence}`, alternativeId: 'deposit-one-start', lap: 2, turn })
const noNumbers = (result: object) => {
  for (const key of ['comparison', 'actual', 'alternative', 'delta']) assert.equal(key in result, false)
}

/** Derive new histories exclusively through native transitions from a replayed prefix. */
async function changedHistory(change: 'course' | 'partial-sale') {
  const source = parseHistory(c1), work = new WorkBudget(options())
  const sequence = change === 'course' ? 37 : 84
  const verified = await replayHistory(source, work, sequence)
  assert(verified.before)
  let state = verified.before
  for (const command of verified.commands.filter(entry => entry.sequence >= sequence)) {
    for (let i = 0; state.phase !== command.before.phase || state.lap !== command.before.lap; i++) {
      assert(i < 4)
      const next = advance(state)
      assert.notEqual(next, state)
      state = next
    }
    if (change === 'course' && command.sequence === 37) state = decide(state, 'skip')
    else if (change === 'course' && command.sequence === 54) state = decide(state, 'course-basic')
    else if (change === 'partial-sale' && command.sequence === 84) {
      state = transact(state, { ...command.action!, amount: Math.floor(state.portfolio.gold / 2) })
    } else state = applyRecorded(state, command, work)
  }
  while (state.phase !== 'finished') state = advance(state)
  return serializeLog(state)
}

test('Bank enumerates both verified skips in C1, including tile6, and replays each exact alternative through START4', async () => {
  const catalog = await listDecisionChoices(c1, 'bank', options())
  assert.deepEqual(catalog, [bank(28, 7), bank(40, 11)])
  for (const selection of catalog) {
    const session = await createDecisionReplay(c1, selection, options()), result = session.result
    assert.equal(result.status, 'supported-final')
    assert.deepEqual([result.comparison.delta.cash, result.comparison.delta.totalWorth, result.comparison.delta.liquidatableFunds], [200_000, 200_000, 200_000])
    session.dispose()
    noNumbers(session.result)
  }
})

test('new Course skip-to-basic slice uses native wages and independent terminal replay on two decisions', async () => {
  const text = fixture('frozen-holdout-diversified-roi')
  const catalog = await listDecisionChoices(text, 'course', options())
  assert.deepEqual(catalog.map(entry => entry.decisionId), ['course:49', 'course:72'])
  for (const [index, choice] of catalog.entries()) {
    const session = await createDecisionReplay(text, choice, options()), result = session.result
    assert.equal(result.status, 'supported-final')
    assert.equal(result.comparison.delta.cash, [-2_000_000, -4_000_000][index])
    assert.equal(result.comparison.delta.recurringIncome, 2_000_000)
    assert.equal(result.comparison.proof.actualReplay && result.comparison.proof.alternativeReplay, true)
    session.dispose()
  }
})

test('duplicate recorded Course purchase needs explicit follow-up, rejects stale/concurrent input, then reconstructs one branch', async () => {
  const text = await changedHistory('course')
  const choice: WhatIfDecision = { kind: 'course', decisionId: 'course:37', alternativeId: 'course-basic', lap: 2, turn: 10 }
  const catalog = await listDecisionChoices(text, 'course', options())
  const selected = catalog.find(entry => entry.decisionId === choice.decisionId)!
  assert(selected)
  const session = await createDecisionReplay(text, selected, options()), pending = session.result
  assert.equal(pending.status, 'needs-followup')
  assert.equal(pending.followUp.sequence, 54)
  noNumbers(pending)
  assert.equal((await session.resume({ id: 'stale', optionId: 'skip' }, options())).status, 'blocked')
  assert.deepEqual(session.result, pending)
  const input = { id: pending.followUp.id, optionId: 'skip' }
  const abort = new AbortController()
  abort.abort()
  assert.equal((await session.resume(input, { signal: abort.signal })).status, 'cancelled')
  assert.deepEqual(session.result, pending)
  const first = session.resume(input, options()), second = await session.resume(input, options())
  assert.equal(second.status, 'blocked')
  const exposed = await first
  assert.equal(exposed.status, 'supported-final')
  assert.equal((await session.resume(input, options())).status, 'blocked')
  exposed.comparison.actual.cash = 0
  assert.notDeepEqual(session.result, exposed)
  session.dispose()
})

test('Bank history with a legal partial Gold sale retains that native action and supports the comparison', async () => {
  const text = await changedHistory('partial-sale')
  const source = parseHistory(text), partial = source.entries[83]
  assert(partial.action!.amount < partial.before.portfolio.gold)
  // This sale is after the selected Bank fork, so the paired continuation must retain a legal partial sale.
  const session = await createDecisionReplay(text, bank(28, 7), options()), result = session.result
  assert.equal(result.status, 'supported-final')
  assert.equal(result.comparison.delta.cash, 200_000)
  session.dispose()
})

test('official snapshot and packed save remain byte-identical across a genuine Bank analysis', async () => {
  const source = parseHistory(c1), before = JSON.stringify(source.state)
  let saved = '', after = ''
  assert(saveGameLocally(source.state, { setItem: (_key, value) => { saved = value } }))
  const session = await createDecisionReplay(serializeLog(source.state), bank(28, 7), options())
  assert.equal(session.result.status, 'supported-final')
  assert.equal(JSON.stringify(source.state), before)
  assert(saveGameLocally(source.state, { setItem: (_key, value) => { after = value } }))
  assert.equal(after, saved)
  session.dispose()
})

test('invalid/tampered history, alternative, work budget and cancellation publish no metrics', async () => {
  const abort = new AbortController()
  abort.abort()
  for (const [text, choice, work] of [
    [c1, { ...bank(28, 7), alternativeId: 'skip' }, options()],
    [c1, { ...bank(28, 7), lap: 3 }, options()],
    ['{broken', bank(28, 7), options()],
    [c1.replace('B18-UI-TRADES', 'tampered'), bank(28, 7), options()],
    [c1, bank(28, 7), { maxSteps: 1 }],
    [c1, bank(28, 7), { signal: abort.signal }],
  ] as const) {
    const session = await createDecisionReplay(text, choice, work)
    noNumbers(session.result)
    assert(['blocked', 'cancelled'].includes(session.result.status))
    session.dispose()
  }
})
