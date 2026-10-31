import test from 'node:test'
import assert from 'node:assert/strict'
import { simulateRepairWhatIf, repairWhatIfEligible } from '../src/game/what-if.ts'
import { createRepairDemo } from '../mobile_app/src/dev/repair-fixture.ts'
import { createMobileSession } from '../mobile_app/src/game/session.ts'
import { decide, advance, roll } from '../src/game/engine.ts'
import { snapshot } from '../src/game/state.ts'
import { saveGameLocally, restoreSavedGame } from '../src/game/saved-game.ts'
import { deepFreeze } from './helpers/companion.ts'

for (const choice of ['full', 'temporary'] as const) {
  test(`both branches use engine truth; actual=${choice}; input, RNG and logs unchanged`, () => {
    const before = deepFreeze(createRepairDemo()), serialized = JSON.stringify(before)
    const result = simulateRepairWhatIf(before, choice)!
    assert.ok(result)
    assert.equal(result.cashBefore, 50_000_000)
    for (const outcome of [result.actual, result.alternative]) {
      const engine = decide(before, outcome.choice), entry = engine.log.at(-1)!
      assert.equal(engine.rng, before.rng)
      assert.equal(outcome.cashAfter, engine.portfolio.cash)
      assert.equal(outcome.paidNow, entry.expensePaid)
      assert.equal(outcome.obligationAdded, entry.obligationCreated)
      assert.equal(outcome.status, 'paid')
      assert.equal(outcome.totalCommitted, outcome.choice === 'full' ? 4_000_000 : 5_000_000)
      assert.equal(outcome.cashAfter, outcome.choice === 'full' ? 46_000_000 : 49_000_000)
      assert.equal(outcome.obligationAdded, outcome.choice === 'full' ? 0 : 4_000_000)
    }
    assert.equal(result.temporaryExtraCost, 1_000_000)
    assert.equal(result.temporaryCashKept, 3_000_000)
    assert.equal(JSON.stringify(before), serialized)
    assert.doesNotMatch(JSON.stringify(result), /rng|seed|market|log|scenario|forecast/)
    assert.equal(Object.isFrozen(result), true)
    assert.equal(Object.isFrozen(result.actual), true)
  })
}

test('shortfall never implies full payment or already-created deferred rights', () => {
  const result = simulateRepairWhatIf(createRepairDemo(49_500_000), 'full')!
  assert.equal(result.actual.status, 'funding-required')
  assert.equal(result.actual.cashAfter, 0)
  assert.equal(result.actual.paidNow, 500_000)
  assert.equal(result.actual.fundingRemaining, 3_500_000)
  assert.equal(result.alternative.fundingRemaining, 500_000)
  assert.equal(result.alternative.obligationAdded, 0)
  assert.equal(result.alternative.obligationOnCompletion, 4_000_000)
  assert.equal(result.alternative.totalCommitted, 5_000_000)
})

test('affordable actual and unfunded alternative stay distinct', () => {
  const result = simulateRepairWhatIf(createRepairDemo(48_000_000), 'temporary')!
  assert.equal(result.actual.status, 'paid')
  assert.equal(result.actual.cashAfter, 1_000_000)
  assert.equal(result.alternative.status, 'funding-required')
  assert.equal(result.alternative.paidNow, 2_000_000)
  assert.equal(result.alternative.fundingRemaining, 2_000_000)
})

test('only revealed supported repair is eligible; invalid values and decisions fail closed', () => {
  const before = createRepairDemo()
  assert.equal(repairWhatIfEligible(before), true)
  for (const changed of [
    { ...before, phase: 'rolling' as const }, { ...before, eventId: 'medical' },
    { ...before, lap: 0 }, { ...before, lap: 5 }, { ...before, log: [] },
    { ...before, gameplayProfile: 'core-mvp-b18-v1' as const },
    { ...before, portfolio: { ...before.portfolio, cash: NaN } },
    { ...before, portfolio: { ...before.portfolio, cash: -1 } },
  ]) assert.equal(simulateRepairWhatIf(changed, 'full'), null)
  assert.equal(simulateRepairWhatIf(before, 'skip'), null)
})

test('session captures only an accepted choice, discards review on next action/new/restore', () => {
  const before = createRepairDemo(), session = createMobileSession(before, { whatIf: true })
  assert.equal(session.getRepairWhatIf(), null)
  assert.equal(session.dispatch({ type: 'choose', id: 'temporary' }, structuredClone(before)), false)
  assert.equal(session.getRepairWhatIf(), null)
  assert.equal(session.dispatch({ type: 'choose', id: 'temporary' }, before), true)
  assert.equal(session.getRepairWhatIf()!.actual.choice, 'temporary')
  assert.deepEqual(snapshot(session.getSnapshot()), snapshot(decide(before, 'temporary')))
  const paid = session.getSnapshot(), review = session.getRepairWhatIf()
  assert.equal(session.dispatch({ type: 'advance' }, paid), false)
  assert.equal(session.getRepairWhatIf(), review)
  assert.equal(createMobileSession(before).getRepairWhatIf(), null)
  let saved = ''
  assert.ok(saveGameLocally(paid, { setItem(_key, value) { saved = value } }))
  const restored = createMobileSession(restoreSavedGame(saved), { whatIf: true })
  assert.equal(restored.getRepairWhatIf(), null)
  assert.equal(session.dispatch({ type: 'roll' }, paid), true)
  assert.equal(session.getRepairWhatIf(), null)
  assert.equal(session.dispatch({ type: 'choose', id: 'full' }, before), false)
  assert.equal(session.getRepairWhatIf(), null)
})

test('session feature is default OFF, including no simulation artifact after a real choice', () => {
  const before = createRepairDemo(), session = createMobileSession(before)
  assert.equal(session.dispatch({ type: 'choose', id: 'full' }, before), true)
  assert.equal(session.getRepairWhatIf(), null)
  assert.equal(session.getSnapshot().portfolio.cash, 46_000_000)
})

test('development fixture is a valid, reproducible natural replay prefix at each allocation', () => {
  for (const savings of [0, 48_000_000, 49_500_000]) {
    const fixture = createRepairDemo(savings)
    assert.equal(fixture.log.map(entry => entry.kind).join(','), 'setup,roll,encounter')
    let text = ''
    assert.ok(saveGameLocally(fixture, { setItem(_key, value) { text = value } }))
    const restored = restoreSavedGame(text)
    assert.deepEqual(snapshot(restored), snapshot(fixture))
    assert.equal(fixture.eventId, 'repair')
    // Simulating does not move the live game's future roll.
    const control = roll(decide(fixture, 'full'))
    simulateRepairWhatIf(fixture, 'full')
    assert.deepEqual(roll(decide(fixture, 'full')), control)
    assert.equal(advance(fixture), fixture)
  }
})
