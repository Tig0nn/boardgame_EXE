import test from 'node:test'
import assert from 'node:assert/strict'
import { createMultiCourseGame } from '../src/game/new-game.ts'
import { advance, decide, fundPayment, roll, snapshot, transact } from '../src/game/engine.ts'
import { eventsForGame } from '../src/data/events.ts'
import { serializeLog } from '../src/game/log.ts'
import { replayGameLog } from '../scripts/diagnostics/replay-game-log.ts'
import { restoreSavedGame, saveGameLocally } from '../src/game/saved-game.ts'
import { boardFor } from '../src/data/board.ts'
import type { GameState } from '../src/game/types.ts'
import { createRepairDemo } from '../mobile_app/src/dev/repair-fixture.ts'
import { createMascotCoach, evaluateMascotSignals } from '../mobile_app/src/game/mascot-coach.ts'

const initial = advance(createMultiCourseGame('mascot-test'))
const at = (eventId: string): GameState => ({
  ...initial, phase: 'event', eventId, position: boardFor(initial).findIndex(tile => tile.type === eventId),
})
const gold = at('gold')
const buy = (amount: number) => transact(gold, { kind: 'buy', asset: 'gold', amount })
const withDebt = { ...initial, phase: 'rebalancing' as const, portfolio: { ...initial.portfolio, debt: 8_000_000 } }
const ids = (before: GameState | undefined, after: GameState) =>
  evaluateMascotSignals(before, after).map(signal => signal.signalId)

test('20M to 14M purchase is informational and can be opened manually', () => {
  const before = { ...gold, portfolio: { ...gold.portfolio, cash: 20_000_000 } }
  const after = transact(before, { kind: 'buy', asset: 'gold', amount: 6_000_000 })
  assert.equal(after.portfolio.cash, 14_000_000)
  assert.deepEqual(ids(before, after), ['trade-off'])
  const coach = createMascotCoach()
  coach.observe(before, after)
  coach.present('board', 0)
  assert.equal(coach.getSnapshot().open, false)
  coach.toggle()
  assert.equal(coach.getSnapshot().latest?.severity, 'informational')
  assert.equal(coach.getSnapshot().current, true)
})

test('concentration requires 65% of gross assets and recorded payments consuming most cash', () => {
  assert.deepEqual(ids(gold, buy(45_000_000)), ['trade-off'])
  const withPayments = { ...gold, obligations: 9_000_000 }
  const trade = (amount: number) => transact(withPayments, { kind: 'buy', asset: 'gold', amount })
  assert.ok(!ids(withPayments, trade(32_000_000)).includes('concentration'))
  assert.ok(ids(withPayments, trade(32_500_000)).includes('concentration'))
  const small = { ...gold, obligations: 100_000, portfolio: { ...gold.portfolio, cash: 1_000_000 } }
  const concentrated = transact(small, { kind: 'buy', asset: 'gold', amount: 900_000 })
  assert.ok(!ids(small, concentrated).includes('concentration'))
})

test('liquidity compares the remaining cash with known payments after a purchase', () => {
  assert.ok(!ids(gold, buy(30_000_000)).includes('liquidity'))
  const before = { ...gold, obligations: 15_500_000, portfolio: { ...gold.portfolio, cash: 20_000_000 } }
  const after = transact(before, { kind: 'buy', asset: 'gold', amount: 6_000_000 })
  const coach = createMascotCoach()
  coach.observe(before, after)
  coach.present('board', 0)
  assert.equal(coach.getSnapshot().open, false)
  coach.toggle()
  const signal = coach.getSnapshot().latest!
  assert.equal(signal.signalId, 'liquidity')
  assert.equal(signal.evidence.uncovered, 1_500_000)
  assert.match(signal.message, /1\.500\.000 ₫/)
  assert.ok(!ids(after, { ...after, turn: after.turn + 1 }).includes('liquidity'))
})

test('debt pressure compares outstanding principal with cash and labels evidence', () => {
  const before = { ...withDebt, portfolio: { ...withDebt.portfolio, cash: 12_000_000 } }
  const after = { ...before, portfolio: { ...before.portfolio, cash: 8_000_000 } }
  const signal = evaluateMascotSignals(before, after)[0]
  assert.equal(signal.signalId, 'debt')
  assert.equal(signal.evidence.debt, 8_000_000)
  assert.ok(!ids(after, { ...after, turn: after.turn + 1 }).includes('debt'))
})

test('trade-off uses new accepted log entries for purchases, deposits and sales', () => {
  const bought = buy(2_000_000)
  const bank = at('bank')
  const deposited = transact(bank, { kind: 'deposit', amount: 3_000_000, term: 2 })
  const checkpoint = { ...bought, phase: 'rebalancing' as const }
  const sold = transact(checkpoint, { kind: 'sell', asset: 'gold', amount: 1_000_000 })
  for (const [before, after] of [[gold, bought], [bank, deposited], [checkpoint, sold]]) {
    const signal = evaluateMascotSignals(before, after).find(item => item.signalId === 'trade-off')
    assert.ok(signal)
    assert.equal(signal.evidence.cashDelta, after.portfolio.cash - before.portfolio.cash)
  }
  assert.deepEqual(ids(gold, { ...bought, log: gold.log }), [])
})

test('repayment reports reduced principal separately from cash cost', () => {
  const repaid = transact(withDebt, { kind: 'repay', amount: 2_000_000 })
  const signals = evaluateMascotSignals(withDebt, repaid)
  assert.equal(signals[0].signalId, 'progress')
  assert.equal(signals[0].evidence.debtReduced, 2_000_000)
  assert.ok(signals[0].message.includes('2.000.000 ₫'))
  assert.ok(signals.some(signal => signal.signalId === 'trade-off'))
})

test('absent or invalid facts, unchanged revisions, and unrelated sessions are quiet', () => {
  const bought = buy(2_000_000)
  assert.deepEqual(ids(undefined, bought), [])
  assert.deepEqual(ids(bought, bought), [])
  assert.deepEqual(ids(gold, { ...bought, seed: 'another-session' }), [])
  assert.deepEqual(ids(gold, { ...bought, portfolio: { ...bought.portfolio, cash: NaN } }), [])
})

test('board opens only on demand and the same panel can be dismissed and reopened', () => {
  const coach = createMascotCoach()
  const bought = buy(3_000_000)
  coach.observe(gold, bought)
  coach.present('board', 0)
  assert.equal(coach.getSnapshot().open, false)
  coach.toggle()
  assert.equal(coach.getSnapshot().latest?.explanation?.topic, 'buy')
  assert.equal(coach.getSnapshot().open, true)
  coach.dismiss()
  coach.toggle()
  assert.equal(coach.getSnapshot().open, true)
  coach.present(null, 10)
  assert.equal(coach.getSnapshot().open, false)
  assert.equal(coach.getSnapshot().latest, null)
  coach.present('board', 20)
  assert.equal(coach.getSnapshot().open, false)
})

test('repayment waits through rebalance and forecast, then appears in summary', () => {
  const coach = createMascotCoach()
  const small = transact(withDebt, { kind: 'repay', amount: 500_000 })
  const large = transact(small, { kind: 'repay', amount: 2_000_000 })
  coach.observe(withDebt, small)
  coach.observe(small, large)
  coach.present('board', 1_000)
  coach.toggle()
  assert.equal(coach.getSnapshot().latest, null)
  const forecast = advance(large)
  coach.observe(large, forecast)
  coach.present(null, 100_000)
  const rolling = advance(forecast)
  coach.observe(forecast, rolling)
  coach.present('board', 101_000)
  assert.equal(coach.getSnapshot().open, false)
  assert.equal(coach.getSnapshot().latest?.evidence.debtReduced, 2_000_000)
  const atStart = { ...rolling, position: boardFor(rolling).length - 1 }
  const summary = roll(atStart)
  coach.observe(atStart, summary)
  coach.present('summary', 105_000)
  assert.equal(coach.getSnapshot().surface, 'summary')
  assert.equal(coach.getSnapshot().open, true)
  assert.equal(coach.getSnapshot().latest?.signalId, 'progress')
  coach.dismiss()
  coach.present(null, 106_000)
  coach.present('summary', 107_000)
  assert.equal(coach.getSnapshot().open, false)
})

test('finished games support a manual summary panel after the final transition', () => {
  const rebalance = { ...initial, phase: 'rebalancing' as const, lap: initial.totalLaps }
  const finished = advance(rebalance)
  assert.equal(finished.phase, 'finished')
  const coach = createMascotCoach()
  coach.observe(rebalance, finished)
  coach.present('summary', 100_000)
  assert.equal(coach.getSnapshot().open, false)
  coach.toggle()
  assert.equal(coach.getSnapshot().surface, 'summary')
  assert.equal(coach.getSnapshot().open, true)
  coach.dismiss()
  assert.equal(coach.getSnapshot().open, false)
})

test('reload and replacement sessions start quiet after manual reopen and dismiss', () => {
  const bought = buy(2_000_000)
  const coach = createMascotCoach()
  coach.observe(gold, bought)
  coach.present('board', 0)
  coach.dismiss()
  assert.equal(coach.getSnapshot().open, false)
  coach.toggle()
  assert.equal(coach.getSnapshot().open, true)
  coach.dismiss()
  assert.equal(coach.getSnapshot().open, false)
  const reloaded = createMascotCoach()
  reloaded.observe(bought, bought)
  reloaded.present('board', 120_000)
  assert.equal(reloaded.getSnapshot().latest, null)
  assert.equal(reloaded.getSnapshot().open, false)
  assert.equal(createMascotCoach().getSnapshot().latest, null)
})

test('funding uses current due amounts and confirmed loan principal', () => {
  const repair = createRepairDemo(49_500_000)
  const due = decide(repair, 'full')
  const liquidity = evaluateMascotSignals(repair, due)[0]
  assert.equal(liquidity.signalId, 'liquidity')
  assert.equal(liquidity.evidence.pending, 3_500_000)
  const paid = fundPayment(due, 'debt', 3_500_000)
  const [pressure, trade] = evaluateMascotSignals(due, paid)
  assert.equal(pressure.signalId, 'debt')
  assert.equal(pressure.evidence.debt, 3_500_000)
  assert.equal(trade.signalId, 'trade-off')
})

test('settlement can move the player closer to the goal', () => {
  const beforeStart = { ...initial, position: boardFor(initial).length - 1 }
  const settled = roll(beforeStart)
  assert.equal(settled.phase, 'summary')
  const progress = evaluateMascotSignals(beforeStart, settled).find(signal => signal.signalId === 'progress')
  assert.ok(progress)
  assert.equal(progress.evidence.improvement, settled.portfolio.cash - beforeStart.portfolio.cash)
})

test('evaluating confirmed actions leaves engine state unchanged', () => {
  const bought = buy(2_000_000)
  const before = JSON.stringify([gold, bought])
  createMascotCoach().observe(gold, bought)
  assert.equal(JSON.stringify([gold, bought]), before)
})

test('funding warning is recorded during a decision and released as history after resolving it', () => {
  const coach = createMascotCoach()
  const repair = createRepairDemo(49_500_000)
  const due = decide(repair, 'full')
  coach.observe(repair, due)
  coach.present('board', 0)
  coach.toggle()
  assert.equal(coach.getSnapshot().surface, null)
  assert.equal(coach.getSnapshot().latest, null)
  const paid = fundPayment(due, 'savings', due.deposits.find(lot => lot.status === 'active')!.principal)
  coach.observe(due, paid)
  coach.present('board', 100_000)
  assert.equal(coach.getSnapshot().open, false)
  coach.toggle()
  assert.equal(coach.getSnapshot().latest?.signalId, 'liquidity')
  assert.equal(coach.getSnapshot().current, false)
})

test('summary opens with the strongest recorded signal', () => {
  const coach = createMascotCoach()
  const due = { ...gold, obligations: gold.portfolio.cash + 2_000_000 }
  const summary = { ...due, phase: 'summary' as const, obligations: gold.portfolio.cash + 1_000_000 }
  coach.observe(gold, due)
  coach.observe(due, summary)
  coach.present('summary', 100_000)
  assert.equal(coach.getSnapshot().open, true)
  assert.equal(coach.getSnapshot().latest?.evidence.uncovered, 1_000_000)
  assert.equal(coach.getSnapshot().current, true)
  const rebalancing = { ...summary, phase: 'rebalancing' as const }
  coach.observe(summary, rebalancing)
  assert.equal(coach.getSnapshot().open, false)
  assert.equal(coach.getSnapshot().latest, null)
})
const goldWith20M = { ...gold, portfolio: { ...gold.portfolio, cash: 20_000_000 } }
const buyAll = (game = goldWith20M) => transact(game, { kind: 'buy', asset: 'gold', amount: 20_000_000 })

test('an accepted gold buy exhausting 20M records a warning with exact engine facts', () => {
  const after = buyAll()
  const serialized = JSON.stringify([goldWith20M, after])
  const [warning] = evaluateMascotSignals(goldWith20M, after)
  assert.equal(warning.signalId, 'cash-exhaustion')
  assert.equal(warning.severity, 'warning')
  assert.match(warning.message, /hết tiền mặt để mua vàng/)
  assert.deepEqual(warning.explanation, { version: 1, topic: 'cash-exhaustion',
    facts: { asset: 'gold', cashBefore: 20_000_000, amount: 20_000_000, cash: 0, knownPayments: 0 } })
  assert.equal(JSON.stringify([goldWith20M, after]), serialized)

  // A cash change without an appended official buy is not a warning.
  assert.deepEqual(ids(goldWith20M, { ...after, log: goldWith20M.log }), [])
  const almostAll = transact(goldWith20M, { kind: 'buy', asset: 'gold', amount: 19_500_000 })
  assert.equal(evaluateMascotSignals(goldWith20M, almostAll)[0].signalId, 'cash-exhaustion')
  const belowMinimum = { ...gold, portfolio: { ...gold.portfolio, cash: 1_500_000 } }
  const smallBuy = transact(belowMinimum, { kind: 'buy', asset: 'gold', amount: 1_500_000 })
  assert.deepEqual(ids(belowMinimum, smallBuy), ['trade-off'])
})

test('known shortfall takes priority and is the only warning in the 20M to 0 fixture with obligations', () => {
  const before = { ...goldWith20M, obligations: 3_500_000 }
  const after = buyAll(before)
  const warnings = evaluateMascotSignals(before, after).filter(signal => signal.severity === 'warning')
  assert.deepEqual(warnings.map(signal => signal.signalId), ['liquidity'])
  assert.equal(warnings[0].evidence.uncovered, 3_500_000)
  const coach = createMascotCoach()
  coach.observe(before, after)
  coach.present('board', 0)
  assert.equal(coach.getSnapshot().latest?.signalId, 'liquidity')
  assert.equal(coach.getSnapshot().open, true)
})

test('cash exhaustion waits while a decision is open and opens only once after reaching the board', () => {
  const rolling = buyAll()
  const stillInDecision = { ...rolling, phase: 'event' as const, eventId: 'gold' }
  const coach = createMascotCoach()
  coach.observe(goldWith20M, stillInDecision)
  coach.present('board', 1)
  assert.equal(coach.getSnapshot().surface, null)
  assert.equal(coach.getSnapshot().latest, null)
  coach.observe(stillInDecision, rolling)
  coach.present('board', 2)
  assert.equal(coach.getSnapshot().latest?.signalId, 'cash-exhaustion')
  assert.equal(coach.getSnapshot().open, true)
  coach.dismiss()
  coach.present(null, 3)
  coach.present('board', 4)
  assert.equal(coach.getSnapshot().open, false)
  coach.toggle()
  assert.equal(coach.getSnapshot().open, true)
  const summary = { ...rolling, phase: 'summary' as const }
  coach.observe(rolling, summary)
  coach.present('summary', 120_000)
  assert.equal(coach.getSnapshot().open, false)
})

test('a cooldown-blocked warning stays available for summary', () => {
  const after = buyAll()
  const coach = createMascotCoach()
  coach.observe(goldWith20M, after)
  coach.present('board', 0)
  coach.dismiss()
  const nextBuy = { ...goldWith20M, turn: goldWith20M.turn + 1 }
  const nextAfter = buyAll(nextBuy)
  coach.observe(after, nextBuy)
  coach.observe(nextBuy, nextAfter)
  coach.present('board', 5000)
  assert.equal(coach.getSnapshot().open, false)
  const summary = { ...nextAfter, phase: 'summary' as const }
  coach.observe(nextAfter, summary)
  coach.present('summary', 90_001)
  assert.equal(coach.getSnapshot().latest?.signalId, 'cash-exhaustion')
  assert.equal(coach.getSnapshot().open, true)
})

test('an all-in gold purchase warns after restoring a legacy save, and replay stays quiet', () => {
  let before = advance(createMultiCourseGame('mascot-quality-0', 30_000_000, 1))
  for (let turn = 0; turn <= 5; turn++) {
    before = roll(before)
    if (turn === 5) break
    const event = eventsForGame(before).find(item => item.id === before.eventId)!
    before = decide(before, (event.options.find(option => option.id === 'skip') ?? event.options[0]).id)
  }
  assert.equal(before.eventId, 'gold')
  assert.equal(before.portfolio.cash, 20_000_000)
  let packedBefore = ''
  assert(saveGameLocally(before, { setItem(_key, value) { packedBefore = value } }))
  const legacySave = JSON.parse(packedBefore)
  legacySave.state.mascotMuted = true
  const legacyBefore = restoreSavedGame(JSON.stringify(legacySave))
  const legacyAfter = buyAll(legacyBefore)
  const after = buyAll(before)
  assert.deepEqual(legacyAfter.portfolio, after.portfolio)
  const coach = createMascotCoach()
  coach.observe(legacyBefore, legacyAfter)
  coach.present('board', 0)
  assert.equal(coach.getSnapshot().open, true)
  assert.equal(coach.getSnapshot().latest?.signalId, 'cash-exhaustion')
  let saved = ''
  assert(saveGameLocally(after, { setItem(_key, value) { saved = value } }))
  const restored = restoreSavedGame(saved)!
  assert.equal(restored.portfolio.cash, 0)
  assert.deepEqual(snapshot(replayGameLog(JSON.parse(serializeLog(restored)))), snapshot(restored))
  const restarted = createMascotCoach()
  restarted.observe(restored, restored)
  restarted.present('board', 0)
  assert.equal(restarted.getSnapshot().latest, null)
  assert.equal(restarted.getSnapshot().open, false)
})
