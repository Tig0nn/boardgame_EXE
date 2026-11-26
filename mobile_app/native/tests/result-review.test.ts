import assert from 'node:assert/strict'
import test from 'node:test'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { evaluateFinancialHealth } from '../../../src/game/financial-health.ts'
import { financialReview } from '../../../src/components/financial-review.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { decide } from '../../../src/game/engine.ts'
import { fromLocal } from '../src/arena-model.ts'
import { resultReview } from '../src/result-review.ts'

test('native local reports preserve the Web evaluator score, grade, four pillars and recorded facts', () => {
  const initial = createMultiCourseGame('native-result-health', 0, 1)
  const fixtures = [
    initial,
    { ...initial, portfolio: { ...initial.portfolio, cash: 95_000_000 } },
    { ...initial, portfolio: { ...initial.portfolio, cash: 2_000_000, debt: 10_000_000 } },
    { ...initial, portfolio: { ...initial.portfolio, cash: 25_000_000, stocks: 30_000_000, bonds: 25_000_000, gold: 15_000_000 }, ownedCourses: ['skills-1'] },
  ]
  for (const game of fixtures) {
    const before = serializeLog(game)
    const arena = fromLocal(game)
    const official = structuredClone(arena.result)
    const review = resultReview(arena)
    assert.equal(review.source, 'local')
    assert.deepEqual(review.health, evaluateFinancialHealth(game))
    assert.deepEqual(review.facts, financialReview(game))
    assert.equal(Object.keys(review.health!.pillarScores).length, 4)
    assert.equal(serializeLog(game), before)
    assert.deepEqual(arena.result, official)
  }
})

test('score and grade boundary fixtures remain identical to the Web from D through S', () => {
  const base = createMultiCourseGame('native-result-grades', 0, 1)
  const fixtures = [
    { cash: 50_000_000, assets: false, course: false, grade: 'D', score: 55 },
    { cash: 60_000_000, assets: false, course: false, grade: 'C', score: 60 },
    { cash: 80_000_000, assets: false, course: false, grade: 'B', score: 70 },
    { cash: 95_000_000, assets: true, course: false, grade: 'S', score: 95 },
    { cash: 95_000_000, assets: false, course: true, grade: 'A', score: 80 },
  ]
  for (const fixture of fixtures) {
    const game = { ...base, ownedCourses: fixture.course ? ['skills-1'] : [], portfolio: { ...base.portfolio,
      cash: fixture.cash, savings: fixture.assets ? 1_000_000 : 0, stocks: fixture.assets ? 1_000_000 : 0,
      bonds: fixture.assets ? 1_000_000 : 0, gold: fixture.assets ? 1_000_000 : 0 } }
    const report = resultReview(fromLocal(game)).health!
    assert.equal(report.grade, fixture.grade)
    assert.equal(report.overallScore, fixture.score)
    assert.deepEqual(report, evaluateFinancialHealth(game))
  }
})

test('online result never evaluates a portfolio as a full GameState or invents historical totals', () => {
  const arena = fromLocal(createMultiCourseGame('online-result-evidence', 0, 1))
  delete arena.local
  arena.result = { outcome: 'defeat', lawfulProceedsVnd: '84000000' }
  arena.journal = [{ sequence: 2, lap: 1, kind: 'decision', title: 'Quyết định đã lưu', decision: 'Bỏ qua', consequence: 'Giữ tiền mặt' }]
  const before = JSON.stringify(arena)
  const review = resultReview(arena)
  assert.equal(review.source, 'server')
  assert.equal(review.health, null)
  assert.deepEqual(review.facts, [])
  assert.deepEqual(review.decisions, arena.journal)
  assert.match(review.limitation!, /chưa đủ dữ liệu.*điểm/i)
  assert.equal(JSON.stringify(arena), before)
})

test('an engine-confirmed insolvency keeps its official proceeds and obligations during review', () => {
  const initial = createMultiCourseGame('result-insolvency', 0, 1)
  const game = decide({ ...initial, phase: 'event', eventId: 'medical', borrowingLimit: 0,
    portfolio: { ...initial.portfolio, cash: 0 } }, 'pay')
  assert.equal(game.termination, 'insolvent')
  const before = serializeLog(game)
  const arena = fromLocal(game)
  const official = structuredClone(arena.result)
  assert.equal(official?.outcome, 'insolvent')
  const review = resultReview(arena)
  assert.deepEqual(review.health, evaluateFinancialHealth(game))
  assert.deepEqual(review.facts, financialReview(game))
  assert.deepEqual(arena.result, official)
  assert.equal(serializeLog(game), before)
})
