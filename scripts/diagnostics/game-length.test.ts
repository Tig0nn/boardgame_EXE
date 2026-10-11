import test from 'node:test'
import assert from 'node:assert/strict'
import { RULES } from '../../src/data/config.ts'
import { createGame, advance, transact, fundPayment, roll } from '../../src/game/engine.ts'
import { beginSettlement } from '../../src/game/settlement.ts'
import { liquidatableFunds, saleQuote } from '../../src/game/selectors.ts'
import { applyMacroShock } from '../../src/game/market.ts'
import { businessIncome } from '../../src/game/business.ts'
import type { GameState } from '../../src/game/types.ts'
import { playDiagnostic, withHorizon } from './game-length-model.ts'

test('diagnostic horizon is process-local and restores official rules after success or failure', () => {
  assert.equal(RULES.laps, 3)
  withHorizon(6, () => assert.equal(RULES.laps, 6))
  assert.equal(RULES.laps, 3)
  assert.throws(() => withHorizon(12, () => { throw new Error('Expected test failure') }))
  assert.equal(RULES.laps, 3)
  assert.throws(() => withHorizon(0, () => undefined))
})

test('diagnostic cash baseline matches the published 5000-seed representative outcome', () => {
  const { run } = playDiagnostic('XVTL-V2-0', 'cash-heavy', 3)
  assert.equal(run.salary, 42_000_000)
  assert.equal(run.courseCost, 0)
  assert.equal(run.investmentProfit, 0)
  assert.equal(run.accountingResidual, 0)
  assert.equal(run.completedLaps, 3)
})

test('six-lap runs settle once per lap, reconcile money, and keep paired dice paths', () => {
  const cash = playDiagnostic('XVTL-V2-17', 'cash-heavy', 6)
  const business = playDiagnostic('XVTL-V2-17', 'business-heavy', 6)
  assert.equal(cash.run.completedLaps, 6)
  assert.equal(cash.run.salary, 84_000_000)
  assert.deepEqual(cash.run.path, business.run.path)
  assert.equal(business.run.accountingResidual, 0)
  assert.equal(business.state.market.normalLaps.length, 6)
})

test('deposits opened after lap three mature once at the correct START', () => withHorizon(6, () => {
  let s: GameState = { ...createGame('late-deposit', 0), lap: 4, position: 1, phase: 'event', eventId: 'bank' }
  s = transact(s, { kind: 'deposit', amount: 10_000_000, term: 2 })
  s = beginSettlement(s)
  assert.equal(s.deposits[0].status, 'active')
  s = advance(advance(s))
  s = beginSettlement({ ...s, phase: 'rolling' })
  assert.equal(s.lap, 5)
  assert.equal(s.deposits[0].status, 'matured')
  assert.equal(s.deposits[0].earnedInterest, 1_400_000)
  assert.deepEqual(beginSettlement(s), s)
  s = advance(advance(s))
  s = beginSettlement({ ...s, phase: 'rolling' })
  assert.equal(s.deposits[0].earnedInterest, 1_400_000)
  assert.equal(s.summaries.filter(summary => summary.lines.some(line => line.label.startsWith('Đáo hạn'))).length, 1)
}))

test('post-lap-three trend changes preserve upgrades and deterministic macro histories', () => withHorizon(6, () => {
  let s: GameState = { ...createGame('late-business', 0), lap: 4, position: 8, phase: 'event', eventId: 'business', scenarioId: 'growth' }
  s = transact(s, { kind: 'buy', asset: 'business', amount: 20_000_000 })
  s = { ...s, turn:s.turn+1 } // V2.1 upgrades start at a subsequent encounter.
  s = transact(s, { kind: 'upgrade', asset: 'business', amount: 5_000_000, trend: 'growth' })
  const growth = businessIncome(s)
  const changed = { ...s, lap: 5, scenarioId: 'recovery' }
  assert.equal(changed.business.upgrades.growth, 1)
  assert.ok(businessIncome(changed) < growth)
  const shock = applyMacroShock(changed, 'credit-tightening')
  assert.deepEqual(applyMacroShock(changed, 'credit-tightening'), shock)
  assert.deepEqual(applyMacroShock(shock, 'credit-tightening'), shock)
}))

test('sixth-lap debt is capitalized once and terminal proceeds use lawful quotes', () => withHorizon(6, () => {
  let s = createGame('late-debt', 0)
  s = { ...s, lap: 6, portfolio: { ...s.portfolio, cash: 0 }, obligations: 20_000_000 }
  s = beginSettlement(s)
  assert.equal(s.pendingPayment!.remaining, 6_000_000)
  s = fundPayment(s, 'debt', 6_000_000)
  assert.equal(s.portfolio.debt, 6_600_000)
  assert.deepEqual(beginSettlement(s), s)
  s = advance(advance(s))
  assert.equal(s.phase, 'finished')
  assert.equal(liquidatableFunds(s), s.portfolio.cash + saleQuote(s, 'stocks').net + saleQuote(s, 'bonds').net + saleQuote(s, 'gold').net - 6_600_000)
}))

test('final sixth-lap overshoot discards its destination while earlier overshoot resolves once', () => withHorizon(6, () => {
  let initial = createGame('overshoot-length', 0)
  for (let index = 0; roll({ ...initial, phase: 'rolling' }).dice === 1; index++) {
    initial = createGame(`overshoot-length-${index}`, 0)
  }
  for (const lap of [5, 6]) {
    let s = roll({ ...initial, lap, position: 19, phase: 'rolling' })
    assert.ok(s.dice > 1)
    assert.equal(s.phase, 'summary')
    const position = s.position
    s = advance(advance(s))
    if (lap === 6) {
      assert.equal(s.phase, 'finished'); assert.equal(s.pendingLanding, false); assert.equal(s.position, 0)
    } else {
      s = advance(s)
      assert.equal(s.phase, 'event'); assert.equal(s.position, position); assert.equal(s.pendingLanding, false)
      assert.equal(s.summaries.length, 1)
    }
  }
}))

test('twelve-lap replay is deterministic and does not persist experimental horizon', () => {
  const a = playDiagnostic('XVTL-V2-21', 'saving-heavy', 12)
  const b = playDiagnostic('XVTL-V2-21', 'saving-heavy', 12)
  assert.deepEqual(a.run, b.run)
  assert.equal(a.run.completedLaps, 12)
  assert.equal(a.run.accountingResidual, 0)
  assert.equal(RULES.laps, 3)
})

test('savings control excludes course spending and uses the same legal seeded path', () => {
  const control = playDiagnostic('XVTL-V2-0', 'saving-no-course', 5)
  const saving = playDiagnostic('XVTL-V2-0', 'saving-heavy', 5)
  assert.equal(control.run.courseCost, 0)
  assert.equal(control.run.courseSalary, 0)
  assert.equal(control.run.salary, 70_000_000)
  assert.deepEqual(control.run.path, saving.run.path)
  assert.equal(control.run.accountingResidual, 0)
})

test('bonds bought after lap three receive coupons and principal exactly once', () => withHorizon(6, () => {
  let s: GameState = { ...createGame('late-bond', 0), lap: 4, position: 6, phase: 'event', eventId: 'bonds' }
  s = transact(s, { kind: 'buy', asset: 'bonds', amount: 8_000_000 })
  s = beginSettlement(s)
  assert.equal(s.bondLots[0].lastCouponLap, 4)
  assert.equal(s.bondLots[0].status, 'active')
  assert.equal(s.summaries[0].lines.find(line => line.label.startsWith('Coupon'))!.amount, 400_000)
  s = advance(advance(s))
  s = beginSettlement({ ...s, phase: 'rolling' })
  assert.equal(s.bondLots[0].status, 'matured')
  assert.equal(s.summaries[1].lines.find(line => line.label.startsWith('Hoàn gốc'))!.amount, 8_000_000)
  assert.deepEqual(beginSettlement(s), s)
  s = advance(advance(s))
  s = beginSettlement({ ...s, phase: 'rolling' })
  assert.equal(s.summaries[2].lines.filter(line => /Coupon|Hoàn gốc/.test(line.label)).length, 0)
}))
