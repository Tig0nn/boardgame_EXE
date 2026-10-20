import test from 'node:test'
import assert from 'node:assert/strict'
import { EVENTS } from '../src/data/events.ts'
import { paymentOptionCopy } from '../src/components/financial-decision-copy.ts'

test('family pay now vs later is an outgoing cost; the difference comes from event amounts', () => {
  const event = EVENTS.find(e => e.id === 'family')!, original = JSON.stringify(event)
  const now = paymentOptionCopy(event, event.options[0])!, later = paymentOptionCopy(event, event.options[1])!
  assert.equal(now.label, 'Trả ngay'); assert.match(now.detail, /3\.000\.000/)
  assert.equal(later.label, 'Trả sau'); assert.match(later.detail, /0 ₫.*phải trả 3\.500\.000 ₫ khi qua ô Xuất phát/)
  assert.match(later.comparison!, /nhiều hơn trả ngay 500\.000 ₫/)
  assert.doesNotMatch(later.detail + later.comparison, /\+|START|lãi vay|phạt/)
  assert.equal(JSON.stringify(event), original)
  const changed = { ...event, options: [{ ...event.options[0], cost: 12000 }, { ...event.options[1], obligation: 17000 }] }
  assert.match(paymentOptionCopy(changed, changed.options[1])!.comparison!, /5\.000 ₫/)
})

test('repair separates current and future payment and compares their sum to full repair', () => {
  const event = EVENTS.find(e => e.id === 'repair')!, copy = paymentOptionCopy(event, event.options[1])!
  assert.match(copy.label, /một phần ngay/)
  assert.match(copy.detail, /1\.000\.000 ₫.*4\.000\.000 ₫ khi qua ô Xuất phát/)
  assert.match(copy.comparison!, /Tổng trả 5\.000\.000 ₫, nhiều hơn trả ngay 1\.000\.000 ₫/)
})

test('medical, bills and contracts use their own scheduled amounts; genuine income is untouched', () => {
  for (const id of ['medical', 'bills', 'contract']) {
    const e = EVENTS.find(e => e.id === id)!, copy = paymentOptionCopy(e, e.options[1])!
    assert.equal(copy.label, 'Trả sau'); assert.match(copy.detail, /phải trả .* khi qua ô Xuất phát/)
    assert.doesNotMatch(copy.detail, /\+|nghĩa vụ|lãi vay|phạt/i)
  }
  const bonus = EVENTS.find(e => e.id === 'bonus')!, original = bonus.options[0].detail
  assert.equal(paymentOptionCopy(bonus, bonus.options[0]), undefined)
  assert.match(original, /Tiền mặt \+/); assert.equal(bonus.options[0].detail, original)
})
