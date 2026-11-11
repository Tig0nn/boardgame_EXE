import assert from 'node:assert/strict'
import test from 'node:test'
import { groundedExplanation, blockedExplanation, verifiedSalaryChanges } from './grounded-explanation.ts'

test('mixed verified deltas expose the trade-off and confirmed follow-ups without invented causal events', () => {
  const text = groundedExplanation({ cash: -1_234_567, totalWorth: 2321, liquidatableFunds: -10048 })
  assert.match(text, /−1\.234\.567|-1\.234\.567/)
  assert.match(text, /\+2\.321/)
  assert.match(text, /khác chiều/)
  assert.match(text, /tài sản ròng tăng trong khi tiền mặt, tiền có thể thu về giảm/)
  assert(!/giá.*tăng|cổ tức|thị trường.*tăng|lạm phát/.test(text))
  assert.match(blockedExplanation('continuation:51:bond-lot-origin-mismatch'), /nguồn mua gốc/)
  assert.match(blockedExplanation('continuation:51:illegal-recorded-action'), /hành động.*không còn hợp lệ/)
  assert(!blockedExplanation('SECRET_INTERNAL_ERROR').includes('SECRET'))
})

test('course salary evidence names only changed START credits from matched replay laps', () => {
  const actual = [{ lap: 2, base: 14_000_000, courseBoost: 0 }, { lap: 3, base: 14_000_000, courseBoost: 2_000_000 }]
  const alternative = [{ lap: 3, base: 14_000_000, courseBoost: 2_000_000 }, { lap: 2, base: 14_000_000, courseBoost: 2_000_000 }]
  assert.deepEqual(verifiedSalaryChanges(actual, alternative), ['Vòng 2 tại START: khoản tăng lương từ khóa học cao hơn 2.000.000 ₫.'])
  assert.deepEqual(verifiedSalaryChanges(actual, [{ lap: 4, base: 0, courseBoost: 4_000_000 }]), [])
})
