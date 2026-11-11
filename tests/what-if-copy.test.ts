import test from 'node:test'
import assert from 'node:assert/strict'
import { compactRepairCopy } from '../mobile_app/src/components/what-if-copy.ts'
import { analyzeRepairWhatIf } from '../src/game/what-if-analysis.ts'
import { simulateRepairWhatIf } from '../src/game/what-if.ts'
import { createRepairDemo } from '../mobile_app/src/dev/repair-fixture.ts'

test('demo copy explains deltas without changing actual/alternative or analysis facts', () => {
  for (const choice of ['full', 'temporary'] as const) {
    const comparison = simulateRepairWhatIf(createRepairDemo(), choice)!
    const analysis = analyzeRepairWhatIf(comparison)
    const before = JSON.stringify({ comparison, analysis })
    const copy = compactRepairCopy(comparison, analysis)
    assert.match(copy.quick.join(' '), /3.000.000.*1.000.000/)
    assert.ok(copy.insights.length <= 4)
    assert.ok(copy.insights.every(s => analysis.sections.some(original => original.id === s.id)))
    assert.match(copy.insights.map(s => s.text).join(' '), /Chưa có bằng chứng/)
    assert.equal(JSON.stringify({ comparison, analysis }), before)
  }
})

test('unfunded alternative keeps funding limits instead of presenting a normal cash trade-off', () => {
  const comparison = simulateRepairWhatIf(createRepairDemo(48_000_000), 'temporary')!
  const copy = compactRepairCopy(comparison, analyzeRepairWhatIf(comparison))
  assert.match(copy.quick.join(' '), /chưa trả đủ.*tiền mặt/)
  assert.doesNotMatch(copy.quick.join(' '), /giữ thêm/)
  assert.match(copy.insights.map(s => s.text).join(' '), /phí.*lãi/i)
})

test('reserve warning survives compact presentation without predicting insolvency', () => {
  const comparison = simulateRepairWhatIf(createRepairDemo(40_500_000), 'full')!
  const copy = compactRepairCopy(comparison, analyzeRepairWhatIf(comparison))
  assert.match(copy.insights.map(s => s.text).join(' '), /500.000/)
  assert.match(copy.insights.map(s => s.text).join(' '), /không.*dự báo|không.*mất khả năng/)
})

test('missing and inconsistent context retain limits in compact UI', () => {
  const comparison = simulateRepairWhatIf(createRepairDemo(), 'full')!
  const limited = { ...comparison, context: undefined }
  assert.match(compactRepairCopy(limited, analyzeRepairWhatIf(limited)).insights.map(s => s.text).join(' '), /Thiếu.*nghĩa vụ/)
  const invalid = { ...comparison, temporaryExtraCost: 0 }
  const copy = compactRepairCopy(invalid, analyzeRepairWhatIf(invalid))
  assert.doesNotMatch(copy.quick.join(' '), /giữ thêm|phù hợp|ưu tiên/)
})
