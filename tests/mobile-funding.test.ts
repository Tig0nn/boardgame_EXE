import test from 'node:test'
import assert from 'node:assert/strict'
import { createMobileGame, createMobileSession } from '../mobile_app/src/game/session.ts'
import { beginSettlement } from '../src/game/settlement.ts'
import { transact, fundingSources } from '../src/game/transactions.ts'
import { saleQuote } from '../src/game/selectors.ts'
import type { GameState } from '../src/game/types.ts'

function living(s: GameState): GameState {
  return { ...s, phase: 'event', position: 3, eventId: 'living', portfolio: { ...s.portfolio, cash: 2_000_000 } }
}
test('mobile 7M payment consumes 2M, pauses for 5M, accepts several sources and rejects repeat taps', () => {
  let s = createMobileGame('funding', 3_000_000, 3)
  s = transact({ ...s, phase: 'event', position: 9, eventId: 'gold' }, { kind: 'buy', asset: 'gold', amount: 2_000_000 })
  const session = createMobileSession(living(s))
  session.dispatch({ type: 'choose', id: 'pay' }, session.getSnapshot())
  const paused = session.getSnapshot()
  assert.equal(paused.portfolio.cash, 0)
  assert.equal(paused.pendingPayment?.total, 7_000_000)
  assert.equal(paused.pendingPayment?.remaining, 5_000_000)
  assert.equal(session.dispatch({ type: 'roll' }, paused), false)
  assert.equal(fundingSources(paused).includes('business' as never), false)
  assert.throws(() => session.dispatch({ type: 'fund', source: 'savings', amount: 1_000_000, lotId: s.deposits[0].id }, paused))
  session.dispatch({ type: 'fund', source: 'savings', amount: 3_000_000, lotId: s.deposits[0].id }, paused)
  assert.equal(session.dispatch({ type: 'fund', source: 'savings', amount: 3_000_000 }, paused), false)
  let current = session.getSnapshot()
  assert.equal(current.pendingPayment?.remaining, 2_000_000)
  assert.equal(current.log.at(-1)?.lostSavingsInterest, 540_000)
  const quote = saleQuote(current, 'gold', 2_000_000)
  assert.deepEqual(quote, { gross: 2_000_000, spread: 60_000, fee: 19_400, net: 1_920_600 })
  session.dispatch({ type: 'fund', source: 'gold', amount: 2_000_000 }, current)
  current = session.getSnapshot()
  assert.equal(current.pendingPayment?.remaining, 79_400)
  assert.throws(() => session.dispatch({ type: 'fund', source: 'debt', amount: 79_401 }, current))
  session.dispatch({ type: 'fund', source: 'debt', amount: 79_400 }, current)
  current = session.getSnapshot()
  assert.equal(current.phase, 'rolling')
  assert.equal(current.pendingPayment, null)
  assert.equal(current.portfolio.cash, 0)
  assert.equal(current.portfolio.debt, 79_400)
  const start = beginSettlement(current)
  assert.equal(start.log.find(e => e.title === 'Nợ đến hạn')?.debtInterestPaid, 7_940)
  assert.equal(start.portfolio.cash, 14_000_000 - 79_400 - 7_940)
  assert.deepEqual(beginSettlement(start), start)
})

test('whole-lot withdrawal keeps surplus cash and leaves other savings lots independent', () => {
  let s = createMobileGame('lots', 8_000_000, 3)
  s = transact({ ...s, phase: 'event', position: 1, eventId: 'bank', turn: 2 }, { kind: 'deposit', amount: 4_000_000, term: 1 })
  const session = createMobileSession(living(s))
  session.dispatch({ type: 'choose', id: 'pay' }, session.getSnapshot())
  session.dispatch({ type: 'fund', source: 'savings', amount: 8_000_000, lotId: 'deposit-1' }, session.getSnapshot())
  const current = session.getSnapshot()
  assert.equal(current.portfolio.cash, 3_000_000)
  assert.equal(current.deposits[0].status, 'withdrawn')
  assert.equal(current.deposits[1].status, 'active')
  assert.equal(current.portfolio.savings, 4_000_000)
  assert.equal(current.log.find(e => e.kind === 'funding')?.lostSavingsInterest, 1_440_000)
  const matured = beginSettlement(current)
  assert.equal(matured.deposits[1].status, 'matured')
  assert.equal(matured.portfolio.cash, 3_000_000 + 14_000_000 + 4_160_000)
  assert.equal(matured.deposits.length, 2, 'no automatic reinvestment')
})

for (const asset of ['stocks', 'bonds'] as const) test(`mobile ${asset} funding uses official net fees`, () => {
  const s = createMobileGame(`fees-${asset}`, 0)
  const bought = transact({ ...s, phase: 'event', position: asset === 'stocks' ? 2 : 6, eventId: asset },
    { kind: 'buy', asset, amount: 6_000_000, completeEncounter: asset === 'stocks' })
  const session = createMobileSession(living(bought))
  session.dispatch({ type: 'choose', id: 'pay' }, session.getSnapshot())
  const quote = saleQuote(session.getSnapshot(), asset, 6_000_000)
  session.dispatch({ type: 'fund', source: asset, amount: 6_000_000 }, session.getSnapshot())
  assert.equal(session.getSnapshot().portfolio.cash, quote.net - 5_000_000)
  assert.equal(session.getSnapshot().phase, 'rolling')
})

test('mobile exhausts valid sources before insolvency; business cannot fund emergency payments', () => {
  const s = createMobileGame('insolvent', 0)
  const business = transact({ ...s, phase: 'event', position: 8, eventId: 'business' }, { kind: 'buy', asset: 'business', amount: 20_000_000 })
  const session = createMobileSession({ ...living(business), portfolio: { ...business.portfolio, cash: 2_000_000, debt: 28_000_000 } })
  session.dispatch({ type: 'choose', id: 'pay' }, session.getSnapshot())
  assert.equal(session.getSnapshot().phase, 'funding')
  session.dispatch({ type: 'fund', source: 'debt', amount: 2_000_000 }, session.getSnapshot())
  assert.equal(session.getSnapshot().termination, 'insolvent')
  assert.equal(session.getSnapshot().pendingPayment?.remaining, 3_000_000)
  assert.equal(session.getSnapshot().portfolio.debt, 30_000_000)
  assert.equal(session.getSnapshot().portfolio.cash, 0)
  assert.equal(session.getSnapshot().business.capital, 20_000_000)
})
