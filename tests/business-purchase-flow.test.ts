import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createGame, transact, decide } from '../src/game/engine.ts'
import { businessIncome } from '../src/game/business.ts'
import { replayGameLog } from '../scripts/diagnostics/replay-game-log.ts'
import type { GameState } from '../src/game/types.ts'

const buy = { kind: 'buy' as const, asset: 'business' as const, amount: 20_000_000 }
function encounter(s = createGame('purchase-flow', 0, 1, 'experimental-b')): GameState {
  return { ...s, phase: 'event', eventId: 'business', position: 8, turn: s.turn || 1 }
}
test('business purchase records once and atomically returns to rolling, with no Skip or RNG draw', () => {
  const initial = encounter()
  const before = JSON.stringify(initial)
  const bought = transact(initial, buy)
  assert.equal(bought.phase, 'rolling')
  assert.equal(bought.eventId, null)
  assert.equal(bought.portfolio.cash, 30_000_000)
  assert.equal(bought.portfolio.business, 14_000_000)
  assert.equal(bought.rng, initial.rng)
  assert.equal(bought.turn, initial.turn)
  assert.equal(bought.position, initial.position)
  assert.equal(bought.log.length, initial.log.length + 1)
  assert.equal(bought.log.at(-1)?.decisionId, 'buy-business')
  assert.deepEqual(decide(bought, 'skip'), bought)
  assert.throws(() => transact(bought, buy))
  assert.throws(() => transact(encounter(bought), buy))
  assert.equal(JSON.stringify(initial), before)
})
test('new purchase encounter rejects sale/upgrade even if reopened directly or after JSON continuation', () => {
  const bought = transact(encounter(), buy)
  for (const s of [bought, encounter(bought), encounter(JSON.parse(JSON.stringify(bought)))]) {
    assert.throws(() => transact(s, { kind: 'sell', asset: 'business', amount: s.portfolio.business }))
    assert.throws(() => transact(s, { kind: 'upgrade', asset: 'business', amount: 5_000_000, trend: s.scenarioId }))
  }
})
test('later Business encounter allows one upgrade and then sale at the original quote', () => {
  const bought = transact(encounter(), buy)
  const later = encounter({ ...bought, turn: bought.turn + 1 })
  const upgraded = transact(later, { kind: 'upgrade', asset: 'business', amount: 5_000_000, customerPreferenceId: later.customerPreferenceId })
  assert.equal(businessIncome(upgraded), 4_700_000)
  assert.throws(() => transact(upgraded, { kind: 'upgrade', amount: 5_000_000, customerPreferenceId: later.customerPreferenceId }))
  const sold = transact(upgraded, { kind: 'sell', asset: 'business', amount: upgraded.portfolio.business })
  assert.equal(sold.portfolio.cash, 41_500_000)
  assert.equal(sold.business.capital, 0)
})
test('V2.3 purchase/sale in one encounter remains valid and the historical browser log replays', () => {
  const initial = encounter(createGame('legacy-purchase', 0, 1, 'experimental-b', undefined, 'v2.3-fixed-income', 'v2.3-single-action'))
  const bought = transact(initial, buy)
  assert.equal(bought.phase, 'event')
  assert.equal(transact(bought, { kind: 'sell', asset: 'business', amount: bought.portfolio.business }).portfolio.cash, 44_000_000)
  const historical = JSON.parse(gunzipSync(readFileSync('docs/playtests/encounter-limits-v2_3/browser-game-log.json.gz')).toString())
  replayGameLog(historical)
})
