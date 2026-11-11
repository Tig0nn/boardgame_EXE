import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeRepairWhatIf } from '../src/game/what-if-analysis.ts'
import { simulateRepairWhatIf } from '../src/game/what-if.ts'
import { createRepairDemo } from '../mobile_app/src/dev/repair-fixture.ts'
import { deepFreeze } from './helpers/companion.ts'

for (const choice of ['full', 'temporary'] as const) {
  for (const cash of [50_000_000, 10_000_000, 4_000_000, 2_000_000, 500_000]) {
    test(`analysis uses verifiable sources without mutation: ${choice}, cash=${cash}`, () => {
      const state = deepFreeze(createRepairDemo(50_000_000 - cash))
      const serialized = JSON.stringify(state)
      const comparison = deepFreeze(simulateRepairWhatIf(state, choice)!)
      const dto = JSON.stringify(comparison)
      const analysis = analyzeRepairWhatIf(comparison)
      assert.equal(analysis.status, 'complete')
      assert.equal(analysis.sections.length, 4)
      assert.equal(new Set(analysis.sections.map(s => s.text)).size, 4)
      for (const section of analysis.sections) {
        assert.ok(section.evidence.length > 0)
        for (const ref of section.evidence) assert.ok(analysis.facts[ref], ref)
      }
      assert.equal(analysis.facts['cash.before'].value, cash)
      assert.equal(analysis.facts['actual.paid'].value, comparison.actual.paidNow)
      assert.equal(analysis.facts['actual.obligation'].value, comparison.actual.obligationAdded)
      for (const [key, outcome] of [['actual', comparison.actual], ['alternative', comparison.alternative]] as const) {
        assert.equal(analysis.facts[`${key}.cash`].value, outcome.cashAfter)
        assert.equal(analysis.facts[`${key}.funding`].value, outcome.fundingRemaining)
        assert.equal(analysis.facts[`${key}.cost`].value, outcome.totalCommitted)
        assert.equal(analysis.facts[`${key}.conditional`].value, outcome.obligationOnCompletion)
        assert.equal(analysis.facts[`reserve.${key}`].value, outcome.cashAfter
          - comparison.context!.existingObligations - comparison.context!.livingAtStart
          - comparison.context!.debtPrincipal - comparison.context!.debtInterestAtStart - outcome.obligationOnCompletion)
      }
      assert.equal(JSON.stringify(state), serialized)
      assert.equal(JSON.stringify(comparison), dto)
    })
  }
}

test('50M distinguishes affordability, reserve comparison, cost and unsupported future benefit', () => {
  const analysis = analyzeRepairWhatIf(simulateRepairWhatIf(createRepairDemo(), 'full')!)
  assert.match(analysis.sections[0].text, /đủ tiền mặt.*không cần huy động/)
  assert.match(analysis.sections[1].text, /3.000.000.*4.000.000.*1.000.000/)
  assert.match(analysis.sections[2].text, /không phải dự báo/)
  assert.match(analysis.sections[3].text, /chưa có bằng chứng.*lợi nhuận|chưa có bằng chứng.*tránh/)
})

test('low cash changes reasoning to access and funding rather than price-only recommendation', () => {
  const analysis = analyzeRepairWhatIf(simulateRepairWhatIf(createRepairDemo(48_000_000), 'temporary')!)
  assert.match(analysis.sections[1].text, /chưa thể hoàn tất.*2.000.000/)
  assert.match(analysis.sections[3].text, /nguồn tiền.*phí|phí.*nguồn tiền/)
  const both = analyzeRepairWhatIf(simulateRepairWhatIf(createRepairDemo(49_500_000), 'full')!)
  assert.match(both.sections[0].text, /chưa hoàn tất/)
  assert.match(both.sections[1].text, /vẫn cần huy động/)
})

test('existing obligations alter reserve conclusion, not merely substituted numbers', () => {
  const state = createRepairDemo(40_000_000)
  const without = analyzeRepairWhatIf(simulateRepairWhatIf(state, 'full')!)
  const withObligations = analyzeRepairWhatIf(simulateRepairWhatIf({ ...state, obligations: 8_000_000 }, 'full')!)
  assert.notEqual(without.sections[2].id, withObligations.sections[2].id)
  assert.notEqual(without.sections[3].id, withObligations.sections[3].id)
  assert.match(withObligations.sections[2].text, /chưa đủ.*nghĩa vụ cũ/)
  assert.equal(withObligations.facts['context.obligations'].value, 8_000_000)
  assert.equal(withObligations.facts['reserve.actual'].value, 6_000_000 - 8_000_000 - Number(withObligations.facts['context.living'].value))
})

test('missing context is explicit; conflicting or invalid numbers suppress financial conclusions', () => {
  const comparison = simulateRepairWhatIf(createRepairDemo(), 'full')!
  const missing = analyzeRepairWhatIf({ ...comparison, context: undefined })
  assert.equal(missing.status, 'limited')
  assert.match(missing.sections[2].text, /thiếu.*nghĩa vụ/)
  for (const invalid of [
    { ...comparison, cashBefore: NaN },
    { ...comparison, actual: { ...comparison.actual, paidNow: 1 } },
    { ...comparison, alternative: { ...comparison.alternative, choice: 'full' as const } },
    { ...comparison, temporaryCashKept: 999 },
    { ...comparison, context: { ...comparison.context!, existingObligations: -1 } },
    { ...comparison, context: { ...comparison.context!, debtPrincipal: Infinity } },
    { ...comparison, context: { ...comparison.context!, savingsPrincipal: undefined as unknown as number } },
    { ...comparison, actual: { ...comparison.actual, status: 'funding-required' as const } },
  ]) {
    const analysis = analyzeRepairWhatIf(invalid)
    assert.equal(analysis.status, 'invalid')
    assert.equal(analysis.sections.length, 1)
    assert.doesNotMatch(analysis.sections[0].text, /nên chọn|có lợi hơn/)
  }
})

test('cash boundary changes which branch covers known costs even when both can pay repair', () => {
  const result = analyzeRepairWhatIf(simulateRepairWhatIf(createRepairDemo(40_500_000), 'full')!)
  assert.equal(result.sections[2].id, 'reserve-alternative-shortfall')
  assert.equal(result.facts['reserve.actual'].value, 500_000)
  assert.equal(result.facts['reserve.alternative'].value, -500_000)
  assert.match(result.sections[2].text, /phương án khác thiếu.*dù trả được sửa xe ngay/)
})

test('known debt and interest affect coverage; savings are not treated as immediately spendable cash', () => {
  const state = createRepairDemo(40_000_000)
  const comparison = simulateRepairWhatIf({ ...state, portfolio: { ...state.portfolio, debt: 2_000_000 } }, 'full')!
  const result = analyzeRepairWhatIf(comparison)
  assert.equal(result.sections[2].id, 'reserve-shortfall')
  assert.ok(Number(result.facts['context.interest'].value) > 0)
  assert.match(result.sections[2].text, /đã gồm gốc và lãi/)
  const low = analyzeRepairWhatIf(simulateRepairWhatIf(createRepairDemo(49_500_000), 'full')!)
  assert.match(low.sections[0].text, /gốc tiết kiệm.*không coi.*cash/)
})

test('insolvent branch does not imply affordable or financeable repair', () => {
  const state = createRepairDemo()
  const bankrupt = { ...state, borrowingLimit: 0, portfolio: { ...state.portfolio, cash: 500_000 } }
  const comparison = simulateRepairWhatIf(bankrupt, 'temporary')!
  assert.equal(comparison.actual.status, 'insolvent')
  const result = analyzeRepairWhatIf(comparison)
  assert.equal(result.status, 'complete')
  assert.match(result.sections[0].text, /chưa hoàn tất/)
  assert.match(result.sections[0].text, /không còn nguồn thanh toán hợp lệ/)
  assert.doesNotMatch(result.sections[0].text, /đủ tiền mặt để trả ngay/)
})
