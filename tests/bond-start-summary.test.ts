import test from 'node:test'
import assert from 'node:assert/strict'
import { createMobileGame } from '../mobile_app/src/game/session.ts'
import { buildBondStartSummary, buildStartOverview, cashTone } from '../mobile_app/src/game/start-summary.ts'
import { transact, fundPayment } from '../src/game/engine.ts'
import { settleCreditBonds, bondLotQuote } from '../src/game/bond-credit.ts'
import { beginSettlement } from '../src/game/settlement.ts'
import { syncValuations } from '../src/game/market.ts'
import { serializeLog } from '../src/game/log.ts'
import type { BondIssuerId, GameState } from '../src/game/types.ts'

function buy(game = createMobileGame('start-ux', 0), issuerId: BondIssuerId = 'an-tam', amount = 10e6) {
  return transact({ ...game, phase: 'event', eventId: 'bonds', position: 6, turn: game.turn + 1 }, { kind: 'buy', asset: 'bonds', issuerId, amount })
}
function pay(game: GameState, lap: number, status = 'performing' as 'performing' | 'delayed' | 'defaulted' | 'resolved') {
  game.lap = lap
  for (const issuer of game.bondCredit!.issuers) issuer.status = status
  settleCreditBonds(game)
  return buildBondStartSummary(game, lap)
}

test('START with no bonds or no requested historical snapshot has no issuer cards', () => {
  const game = createMobileGame('none', 0)
  assert.deepEqual(buildBondStartSummary(game, 1), [])
  assert.deepEqual(buildBondStartSummary(buy(game), 2), [])
})
test('one lot and multiple lots aggregate rounded actual coupon once per issuer', () => {
  const game = buy(buy(undefined, 'an-tam', 1_234_567), 'an-tam', 2_345_678)
  const [a] = pay(game, 1)
  assert.equal(a.lots.length, 2)
  assert.equal(a.couponPaid, 55_556 + 105_556)
  assert.equal(a.principalPaid, 0)
  assert.equal(a.outstandingCoupon + a.outstandingPrincipal, 0)
  assert.equal(a.status, 'paid')
  assert.equal(a.couponPaid, a.lots.reduce((sum, lot) => sum + lot.couponPaid, 0))
})
test('A and B payment totals remain independent', () => {
  const game = buy(buy(), 'but-pha', 5e6)
  const [a, b] = pay(game, 1)
  assert.equal(a.couponPaid, 450_000)
  assert.equal(b.couponPaid, 500_000)
  assert.notEqual(a.id, b.id)
})
test('coupon and principal delays are claims, cure receives arrears once without repeating past START flows', () => {
  const game = buy(undefined, 'but-pha')
  const first = pay(game, 1, 'delayed')[0]
  assert.equal(first.couponPaid, 0); assert.equal(first.outstandingCoupon, 1e6)
  assert.equal(first.principalLost + first.couponLost, 0)
  const second = pay(game, 2, 'delayed')[0]
  assert.equal(second.outstandingCoupon, 2e6); assert.equal(second.outstandingPrincipal, 10e6)
  assert.equal(second.principalPaid, 0); assert.equal(second.status, 'delayed')
  const cure = pay(game, 3)[0]
  assert.equal(cure.couponDue, 0); assert.equal(cure.couponPaid, 2e6)
  assert.equal(cure.principalPaid, 10e6); assert.equal(cure.status, 'cured')
  assert.equal(cure.outstandingCoupon + cure.outstandingPrincipal, 0)
  assert.deepEqual(pay(game, 4), [])
})
test('default writes down only recognized losses and leaves recovery claim outside cash', () => {
  const game = buy(undefined, 'but-pha')
  const row = pay(game, 1, 'defaulted')[0]
  assert.equal(row.principalLost, 5e6); assert.equal(row.couponLost, 1e6)
  assert.equal(row.outstandingPrincipal, 5e6)
  assert.equal(row.principalPaid + row.couponPaid, 0)
  assert.equal(row.status, 'loss')
  const recovered = pay(game, 2, 'resolved')[0]
  assert.equal(recovered.principalPaid, 5e6)
  assert.equal(recovered.outstandingPrincipal, 0)
  assert.equal(recovered.newLoss, 0)
  assert.equal(recovered.principalLost, 5e6)
  assert.equal(recovered.lots[0].principalPaid, 5e6)
  assert.deepEqual(pay(game, 3, 'resolved'), [])
})
test('partial sale transfers rights; fully sold issuer with no current activity is omitted', () => {
  let game = buy()
  game = transact({ ...game, phase: 'rebalancing' }, { kind: 'sell', asset: 'bonds', lotId: 'bond-1', amount: 5e6 })
  assert.equal(pay(game, 1)[0].couponPaid, 225_000)
  game = transact({ ...game, phase: 'rebalancing' }, { kind: 'sell', asset: 'bonds', lotId: 'bond-1', amount: bondLotQuote(game, 'bond-1').gross })
  game.lap = 2
  assert.deepEqual(buildBondStartSummary(game, 2), [])
})
test('settled snapshots freeze outstanding claims for requested lap, without mutation/RNG/log changes', () => {
  let game = buy()
  game = beginSettlement(game)
  const before = serializeLog(game), rng = game.rng, creditRng = game.bondCredit!.rng
  const expected = buildBondStartSummary(game, 1)
  for (let n = 0; n < 5; n++) { buildStartOverview(game, 1); assert.deepEqual(buildBondStartSummary(game, 1), expected) }
  assert.equal(serializeLog(game), before); assert.equal(game.rng, rng); assert.equal(game.bondCredit!.rng, creditRng)
  game.bondLots[0].credit!.outstandingCoupon = 999
  game.lap = 2
  assert.deepEqual(buildBondStartSummary(game, 1), expected)
})
test('overview reconciles actual receipts/payments to cash, not mark-to-market worth', () => {
  const game = beginSettlement(buy())
  const overview = buildStartOverview(game, 1)!
  assert.equal(overview.salary, 14e6)
  assert.equal(overview.courseIncrease, 0)
  assert.equal(overview.bondReceived, 450_000)
  assert.equal(overview.received - overview.paid, overview.cashAfter - overview.cashBefore)
  assert.equal(overview.received, 14_450_000)
})
test('funded outgoing payments, deposit maturity and terminal noncash debt interest reconcile', () => {
  let game = buy()
  game.portfolio.cash = 0; game.portfolio.debt = 30e6; game.lap = 4
  game.market.normalLaps = [4] // already updated: verify fallback schedule boundary too
  syncValuations(game)
  game = beginSettlement(game)
  assert.equal(game.phase, 'funding')
  while (game.pendingPayment) game = fundPayment(game, 'debt', game.pendingPayment.remaining)
  const overview = buildStartOverview(game, 4)!
  assert.ok(overview.fundingReceived > 0); assert.equal(overview.paid, 33e6)
  assert.equal(overview.received - overview.paid, overview.cashAfter - overview.cashBefore)
  assert.ok(game.portfolio.debt > overview.fundingReceived) // accrued final interest isn't cash paid
  let savings = createMobileGame('deposit', 20e6, 1)
  savings = beginSettlement(savings)
  const saved = buildStartOverview(savings, 1)!
  assert.equal(saved.savingsReceived, savings.deposits[0].principal + savings.deposits[0].earnedInterest)
})
test('zero cash is neutral; receivable status is not a signed cash receipt', () => {
  assert.equal(cashTone(0), 'neutral'); assert.equal(cashTone(1), 'positive'); assert.equal(cashTone(-1), 'negative')
})
test('historical V2.4 has no credit cards but keeps actual legacy bond receipts', () => {
  let game = createMobileGame('legacy-start', 0, 1, 'v2.4-single-issuer')
  game = transact({ ...game, phase: 'event', eventId: 'bonds', position: 6, turn: 1 }, { kind: 'buy', asset: 'bonds', amount: 10e6 })
  game = beginSettlement(game)
  assert.deepEqual(buildBondStartSummary(game, 1), [])
  assert.equal(buildStartOverview(game, 1)!.bondReceived, 500_000)
})
