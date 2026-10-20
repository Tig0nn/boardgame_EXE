import test from 'node:test'
import assert from 'node:assert/strict'
import { EVENTS } from '../src/data/events.ts'
import { paymentOptionCopy as rawPaymentCopy } from '../src/components/financial-decision-copy.ts'

// Normalize typographic non-breaking spaces when asserting the copy's meaning.
function paymentOptionCopy(...args: Parameters<typeof rawPaymentCopy>) {
 const result=rawPaymentCopy(...args)
 return result && {label:result.label.replaceAll('\u00a0',' '),detail:result.detail?.replaceAll('\u00a0',' '),comparison:result.comparison?.replaceAll('\u00a0',' ')}
}
test('currency stays attached to its data-derived amount on narrow cards',()=>{
 const event=EVENTS.find(e=>e.id==='repair')!, copy=rawPaymentCopy(event,event.options[1])!
 for(const text of [copy.label,copy.detail!,copy.comparison!]){
  assert.match(text,/\u00a0₫/);assert.doesNotMatch(text,/ ₫/)
 }
})

test('family pay now vs later is an outgoing cost; the difference comes from event amounts', () => {
  const event = EVENTS.find(e => e.id === 'family')!, original = JSON.stringify(event)
  const now = paymentOptionCopy(event, event.options[0])!, later = paymentOptionCopy(event, event.options[1])!
  assert.equal(now.label, 'Trả ngay — 3.000.000 ₫'); assert.equal(now.detail, undefined)
  assert.equal(later.label, 'Trả cuối vòng — 3.500.000 ₫'); assert.equal(later.detail, undefined)
  assert.match(later.comparison!, /cao hơn 500\.000 ₫/)
  assert.doesNotMatch(later.label + later.comparison, /\+|START|lãi vay|phạt/)
  assert.equal(JSON.stringify(event), original)
  const changed = { ...event, options: [{ ...event.options[0], cost: 12000 }, { ...event.options[1], obligation: 17000 }] }
  assert.match(paymentOptionCopy(changed, changed.options[1])!.comparison!, /5\.000 ₫/)
})

test('repair separates current and future payment and compares their sum to full repair', () => {
  const event = EVENTS.find(e => e.id === 'repair')!, copy = paymentOptionCopy(event, event.options[1])!
  assert.match(copy.label, /Sửa tạm, trả sau — 5\.000\.000/)
  assert.match(copy.detail!, /Trả 1\.000\.000 ₫ ngay, 4\.000\.000 ₫ cuối vòng/)
  assert.match(copy.comparison!, /Tốn thêm 1\.000\.000 ₫ nếu trả sau/)
})

test('medical, bills and contracts use their own scheduled amounts; genuine income is untouched', () => {
  for (const id of ['medical', 'bills', 'contract']) {
    const e = EVENTS.find(e => e.id === id)!, copy = paymentOptionCopy(e, e.options[1])!
    assert.match(copy.label, /Trả cuối vòng — /); assert.equal(copy.detail, undefined)
    assert.doesNotMatch(copy.label, /\+|nghĩa vụ|lãi vay|phạt/i)
  }
  const bonus = EVENTS.find(e => e.id === 'bonus')!, original = bonus.options[0].detail
  assert.equal(paymentOptionCopy(bonus, bonus.options[0]), undefined)
  assert.match(original, /Tiền mặt \+/); assert.equal(bonus.options[0].detail, original)
})
