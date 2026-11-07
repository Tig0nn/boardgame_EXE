import test from 'node:test'
import assert from 'node:assert/strict'
import { FINANCIAL_TERMS, annotateTerms, localizeNarrative, tooltipPosition } from '../src/components/glossary.ts'

test('glossary covers the eleven agreed terms and keeps financial distinctions explicit', () => {
  for (const id of ['coupon','issuer','rating','spread','liquidity','funding','maturity','default','payback','faceValue','start']) {
    assert.ok(FINANCIAL_TERMS[id as keyof typeof FINANCIAL_TERMS].definition)
  }
  assert.match(FINANCIAL_TERMS.coupon.definition, /có thể chậm trả/)
  assert.match(FINANCIAL_TERMS.spread.definition, /tách biệt phí/)
  assert.match(FINANCIAL_TERMS.rating.definition, /không phải xếp hạng thực tế/)
  assert.match(FINANCIAL_TERMS.proceeds.definition, /Không tính quán chưa bán/)
})

test('annotation preserves selector text exactly, including numbers, symbols and unsafe markup', () => {
  const text = 'Lãi trái phiếu tùy tổ chức phát hành · Có thể chậm trả hoặc mất vốn <script> 4,5% / ABC'
  const parts = annotateTerms(text)
  assert.equal(parts.map(p => p.text).join(''), text)
  assert.deepEqual(parts.filter(p => p.term).map(p => p.term), ['coupon','issuer'])
  assert.deepEqual(annotateTerms('ABC issuerId couponRate 33de122'), [{ text: 'ABC issuerId couponRate 33de122' }])
  assert.equal(annotateTerms('Mệnh giá và mệnh giá').filter(p => p.term).length, 1)
})

test('historical narrative translation is presentation only and does not rewrite technical fields', () => {
  const original = Object.freeze({ consequence: 'Coupon 450.000 ₫; issuer An Tâm; spread 3%; ABC', couponRate: .045 })
  assert.equal(localizeNarrative(original.consequence), 'Tiền lãi trái phiếu định kỳ 450.000 ₫; tổ chức phát hành An Tâm; chênh lệch giá mua và bán 3%; ABC')
  assert.equal(original.consequence, 'Coupon 450.000 ₫; issuer An Tâm; spread 3%; ABC')
  assert.equal(localizeNarrative('issuerId couponRate businessRulesVersion ABC'), 'issuerId couponRate businessRulesVersion ABC')
  assert.equal(localizeNarrative('FPT CMG VCB TCB HPG BMP XV-MAY Vietcombank Techcombank'), 'FPT CMG VCB TCB HPG BMP XV-MAY Vietcombank Techcombank')
})

test('tooltip stays within 320px viewport and avoids visible trading actions', () => {
  const actions = [{ top: 480, bottom: 532 }, { top: 540, bottom: 592 }]
  const p = tooltipPosition({ left: 280, top: 450, bottom: 475 }, 320, 640, 150, actions)
  assert.ok(p.left >= 8 && p.left + p.width <= 312)
  assert.ok(p.top >= 8 && p.top + p.maxHeight <= 632)
  assert.ok(actions.every(a => p.top + p.maxHeight <= a.top - 8 || p.top >= a.bottom + 8))
})
