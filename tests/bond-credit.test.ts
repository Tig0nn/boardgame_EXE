import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, decide, fundPayment, transact } from '../src/game/engine.ts'
import { fundSource, fundingSources, resolveInsolvency } from '../src/game/transactions.ts'
import { liquidatableFunds, saleQuote } from '../src/game/selectors.ts'
import { applyMacroShock, updateNormalMarket } from '../src/game/market.ts'
import { beginSettlement, continueSettlement } from '../src/game/settlement.ts'
import { snapshot, copyState } from '../src/game/state.ts'
import { initializeBondCredit, bondRulesForGame, bondLotQuote, settleCreditBonds } from '../src/game/bond-credit.ts'
import type { BondIssuerId, GameState } from '../src/game/types.ts'
import { playBondGame } from '../scripts/diagnostics/bond-credit-model.ts'
import { replayGameLog } from '../scripts/diagnostics/replay-game-log.ts'
import { serializeLog } from '../src/game/log.ts'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

function current(seed = 'bond-v25'): GameState {
  return createGame(seed, 0, 1, 'experimental-b', undefined, 'v2.4-customer-preferences', 'v2.4-atomic-investments', 'vn-v1', 'v2.5-credit-risk')
}
function encounter(s = current()): GameState { return { ...s, position: 6, phase: 'event', eventId: 'bonds', turn: s.turn + 1 } }

test('bond version defaults to historical; V2.5 is explicit and has its own deterministic RNG', () => {
  const old = createGame('bond-v25', 0, 1, 'experimental-b')
  const game = current()
  assert.equal(bondRulesForGame(old), 'v2.4-single-issuer')
  assert.equal(old.bondCredit, undefined)
  assert.equal(game.bondRulesVersion, 'v2.5-credit-risk')
  assert.deepEqual(game.bondCredit, initializeBondCredit(game.seed))
  assert.equal(game.rng, old.rng)
  assert.deepEqual(game.market, createGame(game.seed, 0, 1, 'experimental-b', undefined, 'v2.4-customer-preferences', 'v2.4-atomic-investments', 'vn-v1').market)
  assert.throws(() => bondRulesForGame({ bondRulesVersion: 'invalid' as never }))
})

for (const issuerId of ['an-tam', 'but-pha'] as BondIssuerId[]) test(`buy ${issuerId}: one atomic lot, contractual amounts separate, no RNG draw`, () => {
  const s = encounter()
  const bought = transact(s, { kind: 'buy', asset: 'bonds', issuerId, amount: 1_234_567 })
  const lot = bought.bondLots[0]
  assert.equal(lot.credit?.issuerId, issuerId)
  assert.equal(lot.credit?.purchasePrice, 100_000)
  assert.equal(lot.credit?.originalFace, 1_234_567)
  assert.equal(lot.credit?.costBasis, 1_234_567)
  assert.equal(lot.credit?.principalPaid, 0)
  assert.equal(lot.credit?.outstandingCoupon, 0)
  assert.equal(lot.maturityLap, 2)
  assert.equal(bought.phase, 'rolling')
  assert.equal(bought.portfolio.cash, s.portfolio.cash - 1_234_567)
  assert.deepEqual(bought.bondCredit, s.bondCredit)
  assert.equal(bought.rng, s.rng)
  assert.equal(bondLotQuote(bought, lot.id).net, 1_234_567 - Math.round(1_234_567 * .015))
  assert.throws(() => transact({ ...bought, phase: 'event', eventId: 'bonds' }, { kind: 'buy', asset: 'bonds', issuerId, amount: 1 }))
  const copy = copyState(bought)
  copy.bondLots[0].credit!.outstandingCoupon = 10
  copy.bondCredit!.issuers[0].stress = 2
  assert.equal(bought.bondLots[0].credit!.outstandingCoupon, 0)
  assert.equal(bought.bondCredit!.issuers[0].stress, 0)
  const snap = snapshot(bought)
  snap.bondCredit!.issuers[0].stress = 2
  assert.equal(bought.bondCredit!.issuers[0].stress, 0)
})

test('invalid issuer, distressed issuer or amount leaves state untouched and opportunity available', () => {
  const s = encounter(), original = JSON.stringify(s)
  for (const amount of [0, -1, .5, NaN, Infinity, 50_000_001]) assert.throws(() => transact(s, { kind: 'buy', asset: 'bonds', issuerId: 'an-tam', amount }))
  for (const issuerId of [undefined, 'invalid' as never]) assert.throws(() => transact(s, { kind: 'buy', asset: 'bonds', issuerId, amount: 1_000_000 }))
  assert.equal(JSON.stringify(s), original)
  const distressed = copyState(s)
  distressed.bondCredit!.issuers[0].status = 'delayed'
  assert.throws(() => transact(distressed, { kind: 'buy', asset: 'bonds', issuerId: 'an-tam', amount: 1_000_000 }))
  assert.equal(transact(s, { kind: 'buy', asset: 'bonds', issuerId: 'but-pha', amount: 1_000_000 }).phase, 'rolling')
})

test('credit market is independent, idempotent, macro stress public, stock/gold/dice RNG unchanged', () => {
  const s = current('isolation')
  const legacy = { ...copyState(s), bondRulesVersion: 'v2.4-single-issuer' as const, bondCredit: undefined }
  const now = updateNormalMarket(s), old = updateNormalMarket(legacy)
  assert.equal(now.rng, old.rng)
  assert.deepEqual(now.market.stocks, old.market.stocks)
  assert.deepEqual(now.market.gold, old.market.gold)
  assert.deepEqual(now.business, old.business)
  assert.equal(now.bondCredit!.processedLaps.length, 1)
  assert.notEqual(now.bondCredit!.issuers[0].currentPrice, now.bondCredit!.issuers[1].currentPrice)
  assert.deepEqual(updateNormalMarket(now), now)
  const shock = applyMacroShock(s, 'credit-tightening')
  assert.equal(shock.bondCredit!.issuers[0].stress, 1)
  assert.equal(shock.bondCredit!.rng, s.bondCredit!.rng)
  assert.deepEqual(applyMacroShock(shock, 'credit-tightening'), shock)
  assert.equal(s.bondCredit!.issuers[0].stress, 0)
})

function holding(issuerId: BondIssuerId = 'an-tam') {
  return transact(encounter(), { kind: 'buy', asset: 'bonds', issuerId, amount: 10_000_000 })
}
test('performing two-START contract pays coupons and face once; no cash from repeated settlement', () => {
  const s = holding(), cash = s.portfolio.cash
  settleCreditBonds(s)
  assert.equal(s.portfolio.cash, cash + 450_000)
  settleCreditBonds(s)
  assert.equal(s.portfolio.cash, cash + 450_000)
  s.lap = 2; settleCreditBonds(s)
  assert.equal(s.portfolio.cash, cash + 900_000 + 10_000_000)
  assert.equal(s.bondLots[0].credit!.principalPaid, 10_000_000)
  assert.equal(s.bondLots[0].principal, 0)
  assert.equal(s.bondLots[0].status, 'matured')
  s.lap = 3; settleCreditBonds(s)
  assert.equal(s.portfolio.cash, cash + 10_900_000)
})
test('delayed coupons and principal are claims; cure after maturity pays arrears without extra coupons', () => {
  const s = holding('but-pha'), cash = s.portfolio.cash, credit = s.bondLots[0].credit!
  s.bondCredit!.issuers[1].status = 'delayed'
  settleCreditBonds(s)
  assert.equal(credit.outstandingCoupon, 1_000_000)
  assert.equal(s.portfolio.cash, cash)
  s.lap = 2; settleCreditBonds(s)
  assert.equal(credit.outstandingCoupon, 2_000_000)
  assert.equal(credit.outstandingPrincipal, 10_000_000)
  assert.equal(s.portfolio.cash, cash)
  s.lap = 3; s.bondCredit!.issuers[1].status = 'performing'; settleCreditBonds(s)
  assert.equal(s.portfolio.cash, cash + 12_000_000)
  assert.equal(credit.outstandingCoupon, 0)
  assert.equal(credit.history[2].couponDue, 0)
  assert.equal(credit.paymentStatus, 'resolved')
})
test('partial default writes down immediately; recovery next START only, never twice', () => {
  const s = holding('but-pha'), cash = s.portfolio.cash, credit = s.bondLots[0].credit!
  const issuer = s.bondCredit!.issuers[1]
  issuer.status = 'defaulted'; issuer.defaultLap = 1
  settleCreditBonds(s)
  assert.equal(s.portfolio.cash, cash)
  assert.equal(credit.couponLost, 1_000_000)
  assert.equal(credit.principalLost, 5_000_000)
  assert.equal(credit.outstandingPrincipal, 5_000_000)
  assert.equal(s.bondLots[0].principal, 5_000_000)
  assert.equal(bondLotQuote(s, s.bondLots[0].id).net, 0)
  settleCreditBonds(s)
  s.lap = 2; issuer.status = 'resolved'; settleCreditBonds(s)
  assert.equal(credit.principalPaid, 5_000_000)
  assert.equal(s.portfolio.cash, cash + 5_000_000)
  assert.equal(credit.principalPaid + credit.principalLost + s.bondLots[0].principal + credit.soldPrincipal, credit.originalFace)
  s.lap = 3; settleCreditBonds(s)
  assert.equal(s.portfolio.cash, cash + 5_000_000)
})
test('START cursor and lap guards protect coupon, market and salary on reentry', () => {
  const s = beginSettlement(holding())
  assert.deepEqual(beginSettlement(s), s)
  assert.deepEqual(continueSettlement(s), s)
  assert.equal(s.bondCredit!.processedLaps.length, 1)
  assert.equal(s.bondLots[0].credit!.history.length, 1)
})

test('partial sale affects only selected issuer/lot and transfers arrears without creating coupon cash', () => {
  let s = holding()
  s = transact(encounter(s), { kind: 'buy', asset: 'bonds', issuerId: 'but-pha', amount: 8_000_000 })
  s.bondCredit!.issuers[0].status = 'delayed'
  settleCreditBonds(s)
  const other = structuredClone(s.bondLots[1]), cash = s.portfolio.cash
  s.phase = 'rebalancing'
  const sold = transact(s, { kind: 'sell', asset: 'bonds', lotId: 'bond-1', amount: 4_000_000 })
  assert.deepEqual(sold.bondLots[1], other)
  assert.equal(sold.portfolio.cash, cash + 3_940_000)
  assert.equal(sold.bondLots[0].principal, 6_000_000)
  assert.equal(sold.bondLots[0].credit!.outstandingCoupon, 270_000)
  assert.equal(sold.bondLots[0].credit!.transferredCoupon, 180_000)
  assert.equal(sold.bondLots[0].credit!.costBasis, 6_000_000)
  assert.throws(() => transact(s, { kind: 'sell', asset: 'bonds', amount: 1_000_000 }))
  const complete = transact(sold, { kind: 'sell', asset: 'bonds', lotId: 'bond-1', amount: bondLotQuote(sold, 'bond-1').gross })
  assert.equal(complete.bondLots[0].status, 'sold')
  assert.equal(complete.bondLots[0].principal, 0)
  assert.equal(complete.bondLots[0].credit!.outstandingCoupon, 0)
})
test('default claims are unavailable for funding and victory; executable sales use per-lot fees', () => {
  const s = holding(), issuer = s.bondCredit!.issuers[0]
  issuer.status = 'defaulted'; issuer.defaultLap = 1
  settleCreditBonds(s)
  assert.equal(liquidatableFunds(s), s.portfolio.cash)
  assert.equal(saleQuote(s, 'bonds').net, 0)
  assert.ok(!fundingSources(s).includes('bonds'))
  assert.throws(() => transact({ ...s, phase: 'rebalancing' }, { kind: 'sell', asset: 'bonds', lotId: 'bond-1', amount: 1 }))
  const active = holding('but-pha')
  active.portfolio.cash = 0; active.phase = 'funding'
  active.pendingPayment = { origin: 'settlement', title: 'Nghĩa vụ', total: 1_000_000, remaining: 1_000_000 }
  const funded = fundSource(active, 'bonds', 2_000_000, 'bond-1')
  assert.equal(funded.pendingPayment!.remaining, 0)
  assert.equal(funded.portfolio.cash, 970_000)
  assert.equal(funded.bondLots[0].principal, 8_000_000)
  assert.equal(funded.log.at(-1)!.fundingLotId, 'bond-1')
})
test('hundreds of deterministic fractional sales conserve principal and accrued coupon rights', () => {
  for (let index = 1; index <= 200; index++) {
    const s = holding('but-pha'); s.phase = 'rebalancing'
    s.bondCredit!.issuers[1].status = 'delayed'; settleCreditBonds(s)
    s.bondCredit!.issuers[1].currentPrice = 45_001 + index * 111
    const gross = bondLotQuote(s, 'bond-1').gross
    const sold = transact(s, { kind: 'sell', asset: 'bonds', lotId: 'bond-1', amount: Math.floor(gross * index / 201) })
    const lot = sold.bondLots[0], c = lot.credit!
    assert.equal(c.originalFace, lot.principal + c.soldPrincipal + c.principalPaid + c.principalLost)
    assert.equal(c.history.reduce((n, h) => n + h.couponDue, 0), c.outstandingCoupon + c.transferredCoupon + c.couponLost + c.history.reduce((n, h) => n + h.couponPaid, 0))
    assert.ok(lot.principal >= 0 && c.outstandingPrincipal >= 0 && c.outstandingCoupon >= 0)
  }
})

test('mandatory living funding composes savings, stocks, gold, partial Bond sale and capped debt', () => {
  let s = createGame('combined-credit', 3_000_000, 3, 'experimental-b', undefined, 'v2.4-customer-preferences', 'v2.4-atomic-investments', 'vn-v1', 'v2.5-credit-risk')
  for (const [asset, position] of [['stocks', 2], ['gold', 9], ['bonds', 6]] as const) s = transact({ ...s, position, eventId: asset, phase: 'event', turn: s.turn + 1 }, { kind: 'buy', asset, amount: 1_000_000, issuerId: 'an-tam' })
  s = decide({ ...s, phase: 'event', position: 3, eventId: 'living', portfolio: { ...s.portfolio, cash: 2_000_000 } }, 'pay')
  s = fundPayment(s, 'savings', 3_000_000, 'deposit-1')
  s = fundPayment(s, 'stocks', 1_000_000)
  s = fundPayment(s, 'gold', 1_000_000)
  s = fundPayment(s, 'bonds', 25_000, 'bond-1')
  assert.equal(s.pendingPayment!.remaining, 25_075)
  assert.throws(() => fundPayment(s, 'debt', 25_076))
  s = fundPayment(s, 'debt', 25_075)
  assert.equal(s.phase, 'rolling')
  assert.equal(s.portfolio.cash, 0)
  assert.equal(s.portfolio.debt, 25_075)
  assert.equal(s.bondLots[0].principal, 975_000)
})
test('settlement pause after credit cash cannot duplicate outcomes or payments when debt funding resumes', () => {
  const initial = holding()
  initial.portfolio.debt = 60_000_000; initial.portfolio.cash = 0
  const paused = beginSettlement(initial)
  assert.equal(paused.phase, 'funding')
  assert.equal(paused.bondLots[0].credit!.history.length, 1)
  assert.equal(paused.bondCredit!.processedLaps.length, 1)
  const coupon = paused.bondLots[0].credit!.history[0].couponPaid
  let resumed = fundPayment(paused, 'bonds', bondLotQuote(paused, 'bond-1').gross, 'bond-1')
  if (resumed.phase === 'funding') resumed = fundPayment(resumed, 'debt', Math.min(30_000_000, resumed.pendingPayment!.remaining))
  assert.equal(resumed.bondLots[0].credit!.history.length, 1)
  assert.equal(resumed.bondLots[0].credit!.history[0].couponPaid, coupon)
  assert.equal(resumed.bondCredit!.processedLaps.length, 1)
  assert.equal(resumed.log.filter(e => e.title === 'Nhận lương').length, 1)
})

test('unpaid default claims cannot prevent insolvency or be valued as full face at game end', () => {
  const s = holding('but-pha')
  s.bondCredit!.issuers[1].status = 'defaulted'; s.bondCredit!.issuers[1].defaultLap = 1
  settleCreditBonds(s)
  s.portfolio.cash = 0; s.portfolio.debt = 30_000_000; s.phase = 'funding'
  s.pendingPayment = { origin: 'settlement', title: 'Nghĩa vụ', total: 1_000_000, remaining: 1_000_000 }
  assert.equal(resolveInsolvency(s).termination, 'insolvent')
  assert.equal(liquidatableFunds(s), -31_000_000)
  const late = transact({ ...current('last-lap'), lap: 4, phase: 'event', position: 6, eventId: 'bonds', turn: 1 }, { kind: 'buy', asset: 'bonds', issuerId: 'an-tam', amount: 10_000_000 })
  settleCreditBonds(late)
  assert.equal(late.bondLots[0].maturityLap, 5)
  assert.equal(late.bondLots[0].principal, 10_000_000)
  assert.equal(late.bondLots[0].credit!.principalPaid, 0)
  assert.equal(liquidatableFunds(late), late.portfolio.cash + 9_850_000)
})

for (const strategy of ['issuer-a', 'issuer-b', 'mixed-bonds', 'liquidity', 'balanced'] as const) test(`V2.5 four-lap complete state replay: ${strategy}`, () => {
  const s = playBondGame('bond-replay-1', strategy)
  assert.equal(s.summaries.length, 4)
  assert.deepEqual(replayGameLog(JSON.parse(serializeLog(s))), s)
})
test('V2.5 replay rejects a misdeclared credit configuration instead of silently accepting new rates', () => {
  const data = JSON.parse(serializeLog(current('config-audit')))
  data.bondCreditConfig[0].coupon = .9
  assert.throws(() => replayGameLog(data), /Bond credit parameters/)
})
for (const path of [
  'encounter-limits-v2_3/browser-game-log.json.gz', 'economic-news-v1/browser-game-log.json.gz',
  'atomic-investments-v24/historical-multi-purchase.json.gz', 'atomic-investments-v24/browser-game-log.json.gz',
]) test(`historical full-state replay unchanged: ${path}`, () => {
  const data = JSON.parse(gunzipSync(readFileSync(`docs/playtests/${path}`)).toString())
  // JSON persistence canonicalizes -0 to 0; replay already checks every saved snapshot.
  assert.deepEqual(JSON.parse(JSON.stringify(replayGameLog(data))), data.state)
  assert.equal(data.state.bondRulesVersion, undefined)
})
