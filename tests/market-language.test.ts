import test from 'node:test'
import assert from 'node:assert/strict'
import { issuerPressureChange, issuerPressureDetails } from '../mobile_app/src/components/market-language.ts'

test('issuer pressure copy distinguishes direction without presenting player debt or a safe rating', () => {
  assert.equal(issuerPressureChange(0, 1), 'Áp lực tài chính tăng')
  assert.equal(issuerPressureChange(2, 1), 'Áp lực tài chính giảm')
  assert.equal(issuerPressureChange(0, 0), 'Áp lực tài chính không thay đổi')
  assert.equal(issuerPressureChange(2, 2), 'Áp lực tài chính không thay đổi')
  assert.equal(issuerPressureChange(Number.NaN, 1), 'Chưa đủ dữ liệu về áp lực tài chính')
  assert.equal(issuerPressureChange(0, 3), 'Chưa đủ dữ liệu về áp lực tài chính')
  assert.doesNotMatch(issuerPressureChange(0, 0), /0\/2|an toàn|nợ của bạn/)
})

test('technical pressure scale names the issuer, explains both limits and is not a default event', () => {
  const text = issuerPressureDetails(0, 1)
  assert.match(text, /bên phát hành/)
  assert.match(text, /0\/2 → 1\/2/)
  assert.match(text, /0 là thấp nhất, 2 là cao nhất/)
  assert.match(text, /Mức 0 vẫn có thể chậm trả hoặc mất vốn/)
  assert.match(text, /không phải nợ của bạn/)
  assert.match(text, /không tự xác nhận đã chậm trả/)
  assert.doesNotMatch(issuerPressureDetails(-1, 2), /-1\/2/)
})
