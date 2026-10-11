import assert from 'node:assert/strict'
import { test } from 'node:test'
import { playDiagnostic } from './game-length-model.ts'
import { experiments, playMechanics } from './mechanics-model.ts'
import { ECONOMY, RULES } from '../../src/data/config.ts'
import { numericMetrics } from './mechanics-statistics.ts'

test('explicit C20 mode is audited using C20 encounters, with identical cash result to A20', () => {
  const a = playDiagnostic('XVTL-V2-6', 'cash-heavy', 4)
  const baselineLaps = RULES.laps
  const b = playDiagnostic('XVTL-V2-6', 'cash-heavy', 4, { mode: 'experimental-b',
    choose: (_s, preferred) => { assert.equal(RULES.laps, baselineLaps); return preferred } })
  assert.equal(b.state.boardLayout, 'C20')
  assert.equal(b.run.funds, a.run.funds)
  assert.equal(b.run.visits.business, b.state.log.filter(e => e.kind === 'encounter' && e.eventId === 'business').length)
  assert.notEqual(b.run.visits.business, a.run.visits.business)
})

test('versioned rate policies never mutate config; all focused policies reconcile and replay exactly', () => {
  const original = JSON.stringify({ RULES, ECONOMY })
  assert.equal(JSON.stringify({ RULES, ECONOMY }), original)
  for (const id of experiments) {
    const first = playMechanics('XVTL-V2-6', id)
    assert.equal(first.run.accountingResidual, 0)
    assert.equal(first.state.totalLaps, 4)
    assert.deepEqual(first, playMechanics('XVTL-V2-6', id))
  }
  assert.equal(JSON.stringify({ RULES, ECONOMY }), original)
})

test('default hooks preserve every historical run field; policy can override initial allocation', () => {
  const normal = playDiagnostic('XVTL-V2-0', 'saving-heavy', 4)
  assert.deepEqual(playDiagnostic('XVTL-V2-0', 'saving-heavy', 4, {}).run, normal.run)
  const changed = playDiagnostic('XVTL-V2-0', 'cash-heavy', 4, { initialSavings: 20_000_000, initialTerm: 1 })
  assert.equal(changed.state.deposits[0].principal, 20_000_000)
  assert.equal(changed.run.savingsInterest, 1_200_000)
  assert.equal(changed.run.accountingResidual, 0)
})

test('conditional diagnostic metrics exclude null and do not depend on the first seed', () => {
  const metrics = numericMetrics([{ purchaseLap: null, realized: null }, { purchaseLap: 2, realized: -5 }, { purchaseLap: 1, realized: 10 }])
  assert.equal(metrics.purchaseLap!.n, 2)
  assert.equal(metrics.purchaseLap!.mean, 1.5)
  assert.equal(metrics.realized!.mean, 2.5)
})
