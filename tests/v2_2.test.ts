import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, transact, decide, fundPayment, snapshot } from '../src/game/engine.ts'
import { beginSettlement } from '../src/game/settlement.ts'
import { liquidatableFunds, lostInterestOnWithdrawal } from '../src/game/selectors.ts'
import { serializeLog } from '../src/game/log.ts'
import { ECONOMY, RULES } from '../src/data/config.ts'
import type { GameModeId, GameState, Term } from '../src/game/types.ts'
import { readFileSync } from 'node:fs'
import { replayGameLog } from '../scripts/diagnostics/replay-game-log.ts'

function bank(s: GameState, lap = s.lap): GameState { return { ...s, lap, phase: 'event', position: 1, eventId: 'bank' } }
for (const mode of ['original', 'experimental-a', 'experimental-b'] as GameModeId[]) {
  for (const term of [1, 2, 3] as Term[]) test(`V2.2 ${mode}: term ${term} uses simple interest and matures once`, () => {
    const rate = (mode === 'experimental-b' ? { 1: .04, 2: .05, 3: .06 } : { 1: .06, 2: .07, 3: .08 })[term]
    let s = createGame('rates', 10_000_000, term, mode)
    assert.equal(s.deposits[0].rate, rate)
    assert.equal(s.savingsProfile?.rates[term], rate)
    for (let lap = 1; lap <= term; lap++) {
      s = beginSettlement({ ...s, lap, phase: 'rolling', position: 0 })
      assert.equal(s.deposits[0].status, lap === term ? 'matured' : 'active')
      assert.equal(beginSettlement(s), s)
    }
    assert.equal(s.deposits[0].earnedInterest, Math.round(10_000_000 * rate * term))
    assert.equal(s.portfolio.cash, 50_000_000 + term * 14_000_000 + Math.round(10_000_000 * rate * term))
  })
}
test('V2.2 independently priced lots retain their timing through JSON continuation', () => {
  let s = createGame('lots', 10_000_000, 3, 'experimental-b')
  s = transact(bank(s), { kind: 'deposit', amount: 5_000_000, term: 1 })
  s = beginSettlement({ ...s, phase: 'rolling', position: 0 })
  assert.equal(s.deposits[1].earnedInterest, 200_000)
  s = transact(bank(JSON.parse(JSON.stringify(s)), 2), { kind: 'deposit', amount: 8_000_000, term: 2 })
  s = beginSettlement({ ...s, phase: 'rolling', position: 0 })
  assert.deepEqual(s.deposits.map(l => l.status), ['active', 'matured', 'active'])
  s = beginSettlement({ ...s, lap: 3, phase: 'rolling', position: 0 })
  assert.deepEqual(s.deposits.map(l => l.earnedInterest), [1_800_000, 200_000, 800_000])
  assert.deepEqual(s.deposits.map(l => l.maturityLap), [3, 1, 3])
})
test('V2.2 emergency withdrawal forfeits the lot interest once and still requires the whole lot', () => {
  const initial = createGame('withdraw', 40_000_000, 3, 'experimental-b')
  let s = decide({ ...initial, portfolio: { ...initial.portfolio, cash: 1_000_000 }, phase: 'event', eventId: 'medical' }, 'pay')
  assert.equal(s.pendingPayment?.remaining, 4_000_000)
  assert.equal(lostInterestOnWithdrawal(s), 7_200_000)
  assert.throws(() => fundPayment(s, 'savings', 4_000_000, 'deposit-1'), /toàn bộ/)
  s = fundPayment(JSON.parse(JSON.stringify(s)), 'savings', 40_000_000, 'deposit-1')
  assert.equal(s.portfolio.cash, 36_000_000)
  assert.equal(s.deposits[0].status, 'withdrawn')
  assert.equal(s.log.filter(e => e.kind === 'funding')[0].lostSavingsInterest, 7_200_000)
  assert.equal(lostInterestOnWithdrawal(s), 0)
})
test('V2.2 terminal lawful proceeds include active principal, never unearned interest', () => {
  let s = bank(createGame('terminal', 0, 1, 'experimental-b'), 4)
  s = transact(s, { kind: 'deposit', amount: 10_000_000, term: 3 })
  s = beginSettlement({ ...s, phase: 'rolling', position: 0 })
  assert.equal(s.deposits[0].status, 'active')
  assert.equal(s.deposits[0].earnedInterest, 0)
  assert.equal(liquidatableFunds(s), 64_000_000)
})
test('V2.2 profiles are isolated from global config, other games, snapshots and JSON logs', () => {
  const before = JSON.stringify({ RULES, ECONOMY })
  const a = createGame('isolation', 10_000_000, 3, 'experimental-a')
  const b = createGame('isolation', 10_000_000, 3, 'experimental-b')
  const captured = snapshot(b)
  b.savingsProfile!.rates[3] = .99
  assert.equal(captured.savingsProfile?.rates[3], .06)
  assert.equal(a.savingsProfile?.rates[3], .08)
  const next = createGame('isolation', 10_000_000, 3, 'experimental-b')
  const data = JSON.parse(serializeLog(next))
  assert.equal(data.schemaVersion, 5)
  assert.equal(data.savingsProfile.id, 'v2.2-c20')
  assert.equal(data.state.savingsProfile.rates[3], .06)
  assert.equal(data.financialConfig.ECONOMY.savingsRates[3], .06)
  assert.equal(JSON.stringify({ RULES, ECONOMY }), before)
})
test('V2.1 state without a profile keeps legacy rates for new lots even on C20', () => {
  const legacy = createGame('legacy', 10_000_000, 3, 'experimental-b', 'v2.1-standard')
  assert.equal(legacy.deposits[0].rate, .08)
  delete legacy.savingsProfile
  const s = transact(bank(JSON.parse(JSON.stringify(legacy))), { kind: 'deposit', amount: 5_000_000, term: 2 })
  assert.equal(s.deposits[1].rate, .07)
  assert.equal(JSON.parse(serializeLog(s)).savingsProfile.id, 'v2.1-standard')
})

for (const file of ['original-log.json', 'a-log.json', 'b-log.json']) test(`Historical V2.1 ${file} replays every financial snapshot using legacy profile`, () => {
  const data = JSON.parse(readFileSync(`docs/playtests/${file}`, 'utf8'))
  const replay = replayGameLog(data)
  assert.equal(liquidatableFunds(replay), data.finalResult.lawfulProceeds)
  assert.equal(replay.savingsProfile?.id, 'v2.1-standard')
})

test('V2.2 schema5 seeded replay preserves profile and all snapshots, including an in-progress export', () => {
  const state = createGame('profile-replay', 30_000_000, 3, 'experimental-b')
  const restored = replayGameLog(JSON.parse(serializeLog(state)))
  assert.deepEqual(restored, state)
})

test('V2.1 C20 state can be re-exported as schema5 without changing any historical finances', () => {
  const data = JSON.parse(readFileSync('docs/playtests/b-log.json', 'utf8'))
  const exported = JSON.parse(serializeLog(data.state))
  assert.equal(exported.schemaVersion, 5)
  assert.equal(exported.savingsProfile.id, 'v2.1-standard')
  assert.equal(exported.entries[0].after.savingsProfile.rates[3], .08)
  assert.equal(exported.finalResult.lawfulProceeds, data.finalResult.lawfulProceeds)
  const replay = replayGameLog(exported)
  assert.deepEqual(JSON.parse(JSON.stringify(replay)), exported.state)
})
