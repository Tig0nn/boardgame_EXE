import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMultiCourseGame } from '../src/game/new-game.ts'
import { evaluateTradeOff, evaluateFinancialHealth, SAFE_EMERGENCY_BUFFER } from '../src/game/financial-health.ts'

test('Financial Health: evaluateTradeOff calculates safety buffer correctly', () => {
  assert.equal(SAFE_EMERGENCY_BUFFER, 10_000_000)
  const game = createMultiCourseGame('test-seed', 0, 1)
  // Initial cash is 50M
  assert.equal(game.portfolio.cash, 50_000_000)

  // Investing 16M leaves 34M -> safe
  const previewSafe = evaluateTradeOff(game, 16_000_000, 'bonds')
  assert.equal(previewSafe.cashAfter, 34_000_000)
  assert.equal(previewSafe.bufferStatus, 'safe')
  assert.equal(previewSafe.warningMessage, undefined)

  // Investing 42M leaves 8M -> warning
  const previewWarning = evaluateTradeOff(game, 42_000_000, 'business')
  assert.equal(previewWarning.cashAfter, 8_000_000)
  assert.equal(previewWarning.bufferStatus, 'warning')
  assert.match(previewWarning.warningMessage || '', /dưới 10M/)

  // Investing 48M leaves 2M -> danger
  const previewDanger = evaluateTradeOff(game, 48_000_000, 'stocks')
  assert.equal(previewDanger.cashAfter, 2_000_000)
  assert.equal(previewDanger.bufferStatus, 'danger')
  assert.match(previewDanger.warningMessage || '', /nguy cấp/)
})

test('Financial Health: evaluateFinancialHealth scores 4 pillars and generates key moments', () => {
  const game = createMultiCourseGame('test-seed-2', 0, 1)
  
  // Starting game report
  const initialReport = evaluateFinancialHealth(game)
  assert.ok(initialReport.overallScore >= 0 && initialReport.overallScore <= 100)
  assert.ok(['S', 'A', 'B', 'C', 'D'].includes(initialReport.grade))
  assert.ok(initialReport.pillarScores.cashflowScore <= 25)
  assert.ok(initialReport.pillarScores.diversificationScore <= 25)
  assert.ok(initialReport.pillarScores.growthScore <= 25)
  assert.ok(initialReport.pillarScores.riskControlScore <= 25)

  // Simulate a winning scenario: 95M funds
  const wonGame = {
    ...game,
    portfolio: {
      ...game.portfolio,
      cash: 25_000_000,
      stocks: 30_000_000,
      bonds: 25_000_000,
      gold: 15_000_000,
      debt: 0,
    },
    ownedCourses: ['skills-1'],
    phase: 'finished' as const,
    termination: 'completed' as const,
    summaries: [{ lap: 1 }, { lap: 2 }, { lap: 3 }, { lap: 4 }] as unknown as typeof game.summaries,
  }
  const wonReport = evaluateFinancialHealth(wonGame)
  assert.ok(wonReport.overallScore >= 80)
  assert.ok(wonReport.grade === 'S' || wonReport.grade === 'A')
  assert.equal(wonReport.keyTurningPoints.some(p => p.title.includes('Đầu Tư Bản Thân')), true)
})
