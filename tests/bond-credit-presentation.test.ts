import test from 'node:test'
import assert from 'node:assert/strict'
import { createMobileGame, createMobileSession } from '../mobile_app/src/game/session.ts'
import { createGame, transact } from '../src/game/engine.ts'
import { playBondGame } from '../scripts/diagnostics/bond-credit-model.ts'
import { creditRoundReview, investmentSignal, marketBulletin } from '../mobile_app/src/game/market-news.ts'
import { buildCoachFacts } from '../src/ai/facts.ts'
import { validateCoachFacts } from '../src/ai/schema.ts'

test('new player sessions select Bond V2.5 explicitly; stored historical sessions keep original bond version', () => {
  const s = createMobileGame('player-v25', 0)
  assert.equal(s.bondRulesVersion, 'v2.5-credit-risk')
  const old = createGame('old-player', 0, 1, 'experimental-b')
  assert.equal(createMobileSession(old).getSnapshot().bondRulesVersion, undefined)
})
test('public news/cards never reveal future or draw RNG; insufficient data stays explicit', () => {
  const s = createGame('news-v25', 0, 1, 'experimental-b', undefined, 'v2.4-customer-preferences', 'v2.4-atomic-investments', 'vn-v1', 'v2.5-credit-risk')
  const before = JSON.stringify(s)
  for (let index = 0; index < 20; index++) {
    assert.match(marketBulletin(s).assets[1].characteristic, /issuer/)
    assert.match(investmentSignal(s, 'bonds', 'but-pha').label, /Bứt Phá/)
    assert.ok(creditRoundReview(s, 1).every(item => !item.available && item.returnRate === null))
  }
  assert.equal(JSON.stringify(s), before)
})
test('START credit review reports only that lap, separating due/paid/claims/loss from price returns', () => {
  const s = playBondGame('BOND-V25-1', 'issuer-b')
  const review = creditRoundReview(s, 1)
  const end = s.log.findLast(e => e.kind === 'settlement' && e.after.lap === 1)!.after
  for (const item of review) {
    const histories = end.bondLots.filter(lot => lot.credit!.issuerId === item.id).flatMap(lot => lot.credit!.history.filter(h => h.lap === 1))
    assert.equal(item.couponPaid, histories.reduce((n, h) => n + h.couponPaid, 0))
    assert.equal(item.principalLost, histories.reduce((n, h) => n + h.principalLost, 0))
    assert.equal(item.ratingAfter, end.bondCredit!.issuers.find(issuer => issuer.id === item.id)!.rating)
  }
})
test('AI facts include grounded credit outcomes and purchase warning, fit existing size/schema limits', () => {
  const s = playBondGame('BOND-V25-1', 'issuer-b')
  const facts = buildCoachFacts(s), bytes = new TextEncoder().encode(JSON.stringify(facts)).length
  assert.ok(facts.evidence.some(e => e.kind === 'bond-credit'))
  assert.ok(facts.evidence.some(e => e.kind === 'bond-choice' && e.fact.includes('Hạng B')))
  assert.ok(facts.evidence.every(e => e.fact.length <= 500))
  assert.ok(facts.evidence.length <= 8 && bytes <= 10240)
  assert.equal(validateCoachFacts(facts, bytes).valid, true)
  const old = { ...createGame('old-coach', 0), phase: 'finished' as const, termination: 'completed' as const }
  assert.ok(buildCoachFacts(old).evidence.every(e => !e.kind.startsWith('bond-')))
})
test('V2.5 rapid Mobile bond taps are atomic across different issuer choices', () => {
  const s = { ...createMobileGame('tap-v25', 0), phase: 'event' as const, position: 6, eventId: 'bonds', turn: 1 }
  const session = createMobileSession(s)
  assert.equal(session.dispatch({ type: 'trade', action: { kind: 'buy', asset: 'bonds', issuerId: 'an-tam', amount: 1_000_000 } }, s), true)
  assert.equal(session.dispatch({ type: 'trade', action: { kind: 'buy', asset: 'bonds', issuerId: 'but-pha', amount: 1_000_000 } }, s), false)
  assert.equal(session.getSnapshot().bondLots.length, 1)
  assert.throws(() => transact({ ...session.getSnapshot(), phase: 'event', eventId: 'bonds' }, { kind: 'buy', asset: 'bonds', issuerId: 'but-pha', amount: 1 }))
})
