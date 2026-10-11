import test from 'node:test'
import assert from 'node:assert/strict'
import { advance, roll, decide, fundPayment, netWorth } from '../src/game/engine.ts'
import { createV23Game as createGame } from './helpers/v2_3.ts'
import { EVENTS } from '../src/data/events.ts'
import { BOARD } from '../src/data/board.ts'
import { canChoose, totalWorth } from '../src/game/engine.ts'
import { money } from '../src/game/format.ts'
import { serializeLog } from '../src/game/log.ts'
import { transact, fundingSources, borrowingAvailable } from '../src/game/transactions.ts'
import { random } from '../src/game/random.ts'
import type { GameState } from '../src/game/types.ts'

function fund(state: GameState): GameState {
  const source = fundingSources(state)[0]
  const lot = state.deposits.find(lot => lot.status === 'active')
  const amount = source === 'savings' ? lot!.principal : source === 'debt'
    ? Math.min(state.pendingPayment!.remaining, borrowingAvailable(state)) : state.portfolio[source]
  return fundPayment(state, source, amount, lot?.id)
}

test('allocation preserves starting capital and rejects invalid inputs', () => {
  const s = createGame('test', 20_000_000)
  assert.equal(s.portfolio.cash, 30_000_000)
  assert.equal(netWorth(s.portfolio), 50_000_000)
  assert.throws(() => createGame('test', -1))
  assert.throws(() => createGame('test', Number.NaN))
})

function play(seed: string) {
  let s = createGame(seed, 20_000_000)
  let steps = 0
  while (s.phase !== 'finished' && steps++ < 200) {
    if (s.phase === 'forecast' || s.phase === 'summary' || s.phase === 'rebalancing') s = advance(s)
    else if (s.phase === 'rolling') s = roll(s)
    else if (s.phase === 'funding') s = fund(s)
    else {
      const event = EVENTS.find(e => e.id === s.eventId)!
      const option = event.options.find(o => canChoose(s, o.id))!
      s = decide(s, option.id)
    }
    assert.ok(s.portfolio.cash >= 0)
    assert.ok(s.portfolio.savings >= 0)
  }
  assert.equal(s.phase, 'finished')
  assert.equal(s.summaries.length, 3)
  assert.ok(s.log.some(e => e.kind === 'decision'))
  return s
}

test('a complete three-lap game is reproducible with the same seed and decisions', () => {
  assert.deepEqual(play('saigon'), play('saigon'))
  assert.notDeepEqual(play('saigon').log, play('hanoi').log)
})

test('dice and ordinary tile events do not apply market returns', () => {
  let s = advance(createGame('no-market', 20_000_000))
  s = transact({ ...s, phase: 'event', eventId: 'stocks', position: 2 }, { kind: 'buy', asset: 'stocks', amount: 10_000_000 })
  const die = Math.floor(random(s.rng)[0] * 6) + 1
  const r = roll({ ...s, phase: 'rolling', position: 8 - die })
  assert.ok(r.dice >= 1 && r.dice <= 6)
  assert.equal(r.portfolio.stocks, s.portfolio.stocks)
  assert.equal(r.portfolio.savings, s.portfolio.savings)
  assert.equal(r.phase, 'event')
})

test('early withdrawal forfeits savings interest and records the decision', () => {
  const s = { ...advance(createGame('withdraw', 20_000_000)), phase: 'event' as const, eventId: 'medical', portfolio: { ...createGame('withdraw', 20_000_000).portfolio, cash: 0 } }
  const pending = decide(s, 'pay')
  const r = fundPayment(pending, 'savings', 20_000_000, pending.deposits[0].id)
  assert.equal(r.portfolio.cash, 15_000_000)
  assert.equal(r.portfolio.savings, 0)
  assert.equal(r.savingsEligible, false)
  assert.equal(r.log.findLast(e => e.kind === 'funding')?.lostSavingsInterest, 1_200_000)
  assert.throws(() => fundPayment(pending, 'savings', Number.NaN))
})

test('lap settlement pays salary and savings maturity before debt without fixed living costs', () => {
  let s = advance(createGame('settlement', 20_000_000))
  s = { ...s, position: 19, portfolio: { ...s.portfolio, debt: 10_000_000 } }
  s = roll(s)
  assert.equal(s.phase, 'summary')
  assert.equal(s.portfolio.cash, 54_200_000)
  assert.equal(s.portfolio.savings, 0)
  assert.equal(s.portfolio.debt, 0)
  assert.equal(netWorth(s.portfolio), 54_200_000)
  assert.equal(roll(s), s)
})

test('settlement shortfalls pause for funding without automatically borrowing', () => {
  let s = advance(createGame('shortfall', 0))
  s = { ...s, position: 19, portfolio: { ...s.portfolio, cash: 0, debt: 30_000_000 } }
  let r = roll(s)
  assert.equal(r.phase, 'funding')
  assert.equal(r.portfolio.debt, 0)
  assert.equal(r.pendingPayment?.remaining, 19_000_000)
  r = fundPayment(r, 'debt', 19_000_000)
  assert.equal(r.phase, 'summary')
  assert.equal(r.portfolio.cash, 0)
  assert.equal(r.portfolio.debt, 19_000_000)
})

test('optional investment without cash is rejected and skip snapshots remain independent', () => {
  let s = advance(createGame('choices', 50_000_000))
  s = { ...s, phase: 'event', eventId: 'stocks', position: 2 }
  const saved = JSON.stringify(s)
  assert.throws(() => transact(s, { kind: 'buy', asset: 'stocks', amount: 10_000_000 }))
  assert.equal(JSON.stringify(s), saved)
  const r = decide(s, 'skip')
  assert.equal(r.phase, 'rolling')
  assert.deepEqual(r.log.at(-1)?.before.portfolio, s.portfolio)
  assert.notEqual(r.log.at(-1)?.before.portfolio, s.portfolio)
})

test('board has 20 unique perimeter positions and all four event categories', () => {
  assert.equal(BOARD.length, 20)
  assert.equal(new Set(BOARD.map(t => `${t.row},${t.col}`)).size, 20)
  assert.equal(new Set(BOARD.map(t => t.category)).size, 4)
  assert.equal(new Set(EVENTS.map(event => event.id)).size, EVENTS.length)
  assert.ok(!EVENTS.some(event => ['equipment', 'job'].includes(event.id)))
})

test('crossing start preserves overshoot and requires forecast before landing event', () => {
  let s = advance(createGame('overshoot', 20_000_000))
  s = roll({ ...s, position: 19 })
  const nextPosition = s.position
  assert.equal(s.phase, 'summary')
  s = advance(s)
  assert.equal(s.phase, 'rebalancing')
  s = advance(s)
  assert.equal(s.lap, 2)
  assert.equal(s.phase, 'forecast')
  assert.equal(s.position, nextPosition)
  s = advance(s)
  assert.equal(s.phase, nextPosition === 0 ? 'rolling' : 'event')
  assert.equal(s.summaries.length, 1)
})

test('final crossing ends after third settlement without a fourth forecast or event', () => {
  let s = advance(createGame('final', 20_000_000))
  s = roll({ ...s, lap: 3, position: 19 })
  const p = { ...s.portfolio }
  s = advance(s)
  assert.equal(s.phase, 'rebalancing')
  s = advance(s)
  assert.equal(s.phase, 'finished')
  assert.equal(s.lap, 3)
  assert.equal(s.eventId, null)
  assert.deepEqual(s.portfolio, p)
  assert.equal(advance(s), s)
})

test('deferred expenses reduce net worth immediately and are settled once', () => {
  let s = advance(createGame('defer', 0))
  s = decide({ ...s, phase: 'event', eventId: 'medical' }, 'defer')
  assert.equal(s.portfolio.cash, 50_000_000)
  assert.equal(totalWorth(s), 44_000_000)
  const settled = roll({ ...s, position: 19 })
  assert.equal(settled.portfolio.cash, 58_000_000)
  assert.equal(settled.obligations, 0)
  assert.equal(totalWorth(settled), 58_000_000)
})

test('every sample event has an affordable choice even with zero liquidity', () => {
  const state = advance(createGame('poor', 50_000_000))
  for (const event of EVENTS) {
    const s = { ...state, phase: 'event' as const, eventId: event.id }
    const option = event.options.find(o => canChoose(s, o.id))
    assert.ok(option, event.id)
    const next = decide(s, option.id)
    assert.ok(next.portfolio.cash >= 0)
    assert.ok(next.phase === 'rolling' || next.phase === 'funding')
    assert.equal(next.log.at(-1)?.eventId, event.id)
  }
})

test('VND formatting normalizes negative zero', () => {
  assert.equal(money(-0), '0 ₫')
})

test('SAIGON-2026 replay terminates with the updated financial rules', () => {
  assert.equal(play('SAIGON-2026').phase, 'finished')
  assert.ok(Number.isFinite(totalWorth(play('SAIGON-2026'))))
})

test('exported JSON retains the seed and independent financial decision snapshots', () => {
  const game = play('SAIGON-2026')
  const exported = JSON.parse(serializeLog(game))
  assert.equal(exported.seed, 'SAIGON-2026')
  assert.equal(exported.finalPhase, 'finished')
  assert.equal(exported.summaries.length, 3)
  assert.deepEqual(exported.entries, JSON.parse(JSON.stringify(game.log)))
  const decision = exported.entries.find((e: { kind: string }) => e.kind === 'decision')
  assert.ok(decision.decisionId)
  assert.ok(decision.before.scenarioId)
  assert.equal(decision.before.phase, 'event')
  assert.ok(exported.entries.filter((e: { kind: string }) => e.kind === 'decision').every((e: { before: object; after: object; consequence: string; decision: string }) => e.before && e.after && e.consequence && e.decision))
})
