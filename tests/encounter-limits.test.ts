import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { advance, createGame, decide, roll, transact, snapshot } from '../src/game/engine.ts'
import { copyState } from '../src/game/state.ts'
import { serializeLog } from '../src/game/log.ts'
import { businessIncome } from '../src/game/business.ts'
import { EVENTS } from '../src/data/events.ts'
import { replayGameLog } from '../scripts/diagnostics/replay-game-log.ts'
import type { GameState } from '../src/game/types.ts'

const deposit = { kind: 'deposit' as const, amount: 1_000_000, term: 1 as const }
const upgrade = { kind: 'upgrade' as const, asset: 'business' as const, amount: 5_000_000, trend: 'growth' }
function bank(s = createGame('limits', 0, 1, 'experimental-b')): GameState {
  return { ...s, phase: 'event', eventId: 'bank', position: 1 }
}
function business(): GameState {
  return transact({ ...createGame('limits-business', 0, 1, 'experimental-b'), phase: 'event', eventId: 'business', position: 8, turn: 1, scenarioId: 'growth' }, { kind: 'buy', asset: 'business', amount: 20_000_000 })
}

test('Bank deposit atomically completes and records once; direct duplicate cannot reopen encounter', () => {
  const initial = bank()
  const before = JSON.stringify(initial)
  const one = transact(initial, deposit)
  assert.equal(one.phase, 'rolling')
  assert.equal(one.eventId, null)
  assert.equal(one.log.length, initial.log.length + 1)
  assert.equal(one.deposits.length, 1)
  assert.equal(one.portfolio.cash, 49_000_000)
  assert.equal(one.rng, initial.rng)
  assert.equal(one.turn, initial.turn)
  assert.throws(() => transact(one, deposit))
  assert.throws(() => transact(bank(JSON.parse(JSON.stringify(one))), deposit), /một khoản/)
  assert.equal(JSON.stringify(initial), before)
  for (const amount of [0, -1, 0.5, NaN, 50_000_001]) assert.throws(() => transact(initial, { ...deposit, amount }))
  assert.deepEqual(decide(one, 'skip'), one)
})

test('later Bank encounters retain independent existing lots, rates and maturities', () => {
  const initial = bank(createGame('lots', 2_000_000, 3, 'experimental-b'))
  const one = transact(initial, deposit)
  const two = transact(bank({ ...one, turn: one.turn + 1, lap: 2 }), { ...deposit, term: 2 })
  const three = transact(bank({ ...two, turn: two.turn + 1, lap: 3 }), { ...deposit, term: 3 })
  assert.deepEqual(three.deposits.slice(0, 2), one.deposits)
  assert.deepEqual(three.deposits.map(l => [l.principal, l.rate, l.startLap, l.maturityLap]), [
    [2_000_000, .06, 1, 3], [1_000_000, .04, 1, 1], [1_000_000, .05, 2, 3], [1_000_000, .06, 3, 5],
  ])
  assert.equal(three.portfolio.cash, 45_000_000)
})

test('one business upgrade per later encounter, including JSON continuation and duplicate calls', () => {
  const bought = business()
  assert.throws(() => transact(bought, upgrade))
  const one = transact({ ...bought, turn: 2 }, upgrade)
  const before = JSON.stringify(one)
  assert.equal(businessIncome(one), 4_700_000)
  assert.throws(() => transact(one, upgrade), /một lần/)
  assert.throws(() => transact(JSON.parse(JSON.stringify(one)), { ...upgrade, trend: 'recovery' }), /một lần/)
  assert.equal(JSON.stringify(one), before)
  const two = transact({ ...one, turn: 3 }, upgrade)
  assert.equal(businessIncome(two), 6_400_000)
  assert.equal(two.portfolio.cash, 20_000_000)
  assert.equal(two.business.upgrades.growth, 2)
  // Selling after the single upgrade stays available at the same Business tile.
  const sold = transact(one, { kind: 'sell', asset: 'business', amount: one.portfolio.business })
  assert.equal(sold.portfolio.cash, 41_500_000)
  const rebought = transact(sold, { kind: 'buy', asset: 'business', amount: 20_000_000 })
  assert.throws(() => transact(rebought, upgrade))
  assert.throws(() => transact({ ...two, turn: 4, business: { ...two.business, upgrades: { growth: 6 } } }, upgrade))
})

test('legacy encounter rules retain multiple deposits/upgrades without changing V2.3 income version', () => {
  const initial = bank(createGame('legacy-limits', 0, 1, 'experimental-b', undefined, 'v2.3-fixed-income', 'legacy-multi-action'))
  const two = transact(transact(initial, deposit), { ...deposit, term: 3 })
  assert.equal(two.phase, 'event')
  assert.equal(two.deposits.length, 2)
  const owned = { ...business(), encounterRulesVersion: 'legacy-multi-action' as const, turn: 2 }
  assert.equal(businessIncome(transact(transact(owned, upgrade), upgrade)), 6_400_000)
  delete owned.encounterRulesVersion
  assert.equal(businessIncome(transact(transact(owned, upgrade), upgrade)), 6_400_000)
})

test('pre-limit V2.3 browser log with multiple upgrades replays and re-exports unchanged', () => {
  const data = JSON.parse(gunzipSync(readFileSync('docs/playtests/business-v2_3/browser-game-log.json.gz')).toString())
  assert.equal(data.businessRulesVersion, 'v2.3-fixed-income')
  assert.ok(data.entries.some((e: { decisionId: string; turn: number }, i: number) => e.decisionId === 'upgrade-business' && data.entries.slice(0, i).some((p: { decisionId: string; turn: number }) => p.turn === e.turn && p.decisionId === e.decisionId)))
  replayGameLog(data)
  replayGameLog(JSON.parse(serializeLog(data.state)))
})

test('historical multi-deposit encounter replays with explicit or missing encounter metadata', () => {
  let s = createGame('XVTL-V2-6', 0, 1, 'experimental-b', undefined, 'v2.2-trend-shock', 'legacy-multi-action')
  for (let guard = 0; s.eventId !== 'bank' && guard < 80; guard++) {
    if (s.phase === 'rolling') s = roll(s)
    else if (s.phase === 'event') {
      const event = EVENTS.find(e => e.id === s.eventId)!
      s = decide(s, event.options.find(o => o.id === 'skip')?.id ?? event.options[0].id)
    } else s = advance(s)
  }
  assert.equal(s.eventId, 'bank')
  s = transact(transact(s, deposit), { ...deposit, term: 3 })
  const data = JSON.parse(serializeLog(s))
  assert.deepEqual(replayGameLog(data), s)
  const historical = JSON.parse(JSON.stringify(data, (key, value) => key === 'encounterRulesVersion' ? undefined : value))
  replayGameLog(historical)
  replayGameLog(JSON.parse(serializeLog(historical.state)))
})

test('invalid encounter version and conflicting exported metadata fail closed', () => {
  assert.throws(() => createGame('invalid', 0, 1, 'experimental-b', undefined, 'v2.3-fixed-income', 'unknown' as 'v2.3-single-action'))
  const data = JSON.parse(serializeLog(createGame('metadata', 0, 1, 'experimental-b')))
  data.encounterRulesVersion = 'legacy-multi-action'
  assert.throws(() => replayGameLog(data), /metadata must agree/)
})

test('direct callers cannot bypass encounter limits using an unrelated optional asset', () => {
  const one = transact(bank(), { ...deposit, asset: 'stocks' })
  assert.throws(() => transact(bank(one), deposit), /một khoản/)
  const upgraded = transact({ ...business(), turn: 2 }, { ...upgrade, asset: 'stocks' })
  assert.throws(() => transact(upgraded, upgrade), /một lần/)
})

test('new Bank atomic and stock atomic actions replay exactly with explicit encounter version', () => {
  let s = createGame('XVTL-V2-6', 0, 1, 'experimental-b')
  let banks = 0; let stocks = 0
  for (let guard = 0; s.phase !== 'finished' && guard < 180; guard++) {
    if (s.phase === 'rolling') s = roll(s)
    else if (s.phase === 'event' && s.eventId === 'bank') { s = transact(s, deposit); banks++ }
    else if (s.phase === 'event' && s.eventId === 'stocks') {
      s = transact(s, { kind: 'buy', asset: 'stocks', amount: 1_000_000, completeEncounter: true }); stocks++
      assert.throws(() => transact(s, { kind: 'buy', asset: 'stocks', amount: 1_000_000, completeEncounter: true }))
    } else if (s.phase === 'event') {
      const event = EVENTS.find(e => e.id === s.eventId)!
      s = decide(s, event.options.find(o => o.id === 'skip')?.id ?? event.options[0].id)
    } else s = advance(s)
  }
  assert.equal(s.termination, 'completed')
  assert.ok(banks > 1 && stocks > 0)
  assert.equal(s.encounterRulesVersion, 'v2.3-single-action')
  assert.equal(snapshot(s).encounterRulesVersion, s.encounterRulesVersion)
  assert.equal(copyState(s).encounterRulesVersion, s.encounterRulesVersion)
  const data = JSON.parse(serializeLog(s))
  assert.equal(data.encounterRulesVersion, s.encounterRulesVersion)
  assert.deepEqual(replayGameLog(data), s)
  for (const entry of s.log.filter(e => e.decisionId === 'deposit-bank')) {
    assert.equal(entry.after.phase, 'rolling')
    assert.ok(!s.log.some(e => e.turn === entry.turn && e.decisionId === 'skip'))
  }
})
