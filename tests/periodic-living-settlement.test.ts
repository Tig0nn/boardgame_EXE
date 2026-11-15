import test from 'node:test'
import assert from 'node:assert/strict'
import { advance, createGame, decide, fundPayment, transact, victory } from '../src/game/engine.ts'
import { beginSettlement, continueSettlement } from '../src/game/settlement.ts'
import { fundingSources } from '../src/game/transactions.ts'
import { businessIncome } from '../src/game/business.ts'
import { ECONOMY, RULES } from '../src/data/config.ts'

const create = (savings = 0) => createGame('periodic-settlement', savings, 3, 'experimental-b', undefined,
  'v2.4-customer-preferences', 'v2.4-atomic-investments', 'vn-v1', 'v2.5-credit-risk', 'v2.6-periodic-start')
const bills = (s: ReturnType<typeof create>) => s.log.filter(e => e.title === 'Chi phí sinh hoạt' && e.kind === 'schedule')

test('setup charges nothing; first START pays 7M after salary', () => {
  const game = create()
  assert.equal(game.portfolio.cash, 50e6); assert.equal(bills(game).length, 0)
  const settled = beginSettlement(game)
  assert.equal(settled.portfolio.cash, 57e6)
  assert.equal(bills(settled)[0].cashDelta, -7e6)
  assert.equal(bills(settled)[0].expensePaid, 7e6)
})
test('START summary, wallet and next forecast cannot repeat the deduction', () => {
  const s = beginSettlement(create())
  assert.equal(beginSettlement(s), s); assert.equal(continueSettlement(s), s)
  const next = advance(advance(s))
  assert.equal(next.portfolio.cash, s.portfolio.cash); assert.equal(bills(next).length, 1)
})
test('four completed checkpoints pay exactly 28M', () => {
  let s = create()
  for (let lap = 1; lap <= 4; lap++) { s = beginSettlement({ ...s, lap }); s = advance(advance(s)) }
  assert.equal(s.termination, 'completed'); assert.equal(bills(s).length, 4)
  assert.equal(bills(s).reduce((sum, e) => sum + e.expensePaid, 0), 28e6)
  assert.equal(s.portfolio.cash, 78e6)
})
// Defensive state-machine fixtures: legal V2.4 salary is >=14M, so living
// funding cannot naturally occur with a 7M charge before debt/obligations.
test('insufficient-cash fixture pauses after advancing the living cursor', () => {
  const s = beginSettlement({ ...create(), portfolio: { ...create().portfolio, cash: 2e6 }, recurringIncome: 0 })
  assert.equal(s.phase, 'funding'); assert.equal(s.pendingPayment?.title, 'Chi phí sinh hoạt')
  assert.equal(s.pendingPayment?.remaining, 5e6); assert.equal(s.portfolio.cash, 0)
  assert.equal(s.settlement?.step, 5)
  assert.equal(continueSettlement(s), s)
})
test('partial then complete funding resumes once; subsequent debt uses pre-START debt', () => {
  let s = beginSettlement({ ...create(), portfolio: { ...create().portfolio, cash: 2e6 }, recurringIncome: 0 })
  s = fundPayment(s, 'debt', 2e6)
  assert.equal(s.pendingPayment?.remaining, 3e6)
  s = fundPayment(s, 'debt', 3e6)
  assert.equal(s.phase, 'summary'); assert.equal(s.portfolio.debt, 5e6)
  assert.equal(bills(s).length, 1); assert.equal(s.portfolio.cash, 0)
})
test('funding can withdraw full savings without Business emergency liquidation', () => {
  const base = create(10e6)
  base.portfolio.cash = 0; base.recurringIncome = 0
  let s = beginSettlement(base)
  assert.ok(fundingSources(s).includes('savings'))
  assert.ok(!fundingSources(s).includes('business' as never))
  assert.throws(() => fundPayment(s, 'business' as never, 1))
  s = fundPayment(s, 'savings', 10e6, 'deposit-1')
  assert.equal(s.phase, 'summary'); assert.equal(s.portfolio.cash, 3e6)
  assert.equal(s.deposits[0].status, 'withdrawn'); assert.equal(bills(s).length, 1)
})
test('exhausted legitimate funding ends insolvent and cannot collect later laps', () => {
  const base = create(); base.portfolio.cash = 0; base.recurringIncome = 0; base.borrowingLimit = 0
  const s = beginSettlement(base)
  assert.equal(s.termination, 'insolvent'); assert.equal(s.portfolio.cash, 0)
  assert.equal(bills(s).length, 1); assert.equal(bills(s)[0].expensePaid, 0)
  assert.equal(beginSettlement(s), s); assert.equal(continueSettlement(s), s)
  assert.equal(victory(s).won, false)
})
test('savings maturity precedes living expense, and course increase is unchanged', () => {
  let s = create(20e6)
  s = decide({ ...s, phase: 'event', eventId: 'course', position: 4 }, 'upgrade')
  s = beginSettlement({ ...s, lap: 3 })
  assert.equal(s.recurringIncome, 17e6)
  assert.equal(s.deposits[0].earnedInterest, 3.6e6)
  assert.equal(s.portfolio.cash, 30e6 - 6e6 + 17e6 + 23.6e6 - 7e6)
})
test('Business operating income precedes living expense and remains identical', () => {
  let s = create()
  s = transact({ ...s, phase: 'event', eventId: 'business', position: 8, turn: 1 }, { kind: 'buy', asset: 'business', amount: ECONOMY.business.cost })
  const income = businessIncome(s)
  s = beginSettlement(s)
  assert.equal(income, 3e6); assert.equal(s.portfolio.cash, 30e6 + 14e6 + income - 7e6)
})
test('debt and deferred obligations follow living and retain their original amounts', () => {
  const base = create(); base.portfolio.debt = 10e6; base.obligations = 6e6
  const s = beginSettlement(base)
  assert.equal(s.portfolio.cash, 50e6 + 14e6 - 7e6 - 11e6 - 6e6)
  assert.equal(s.portfolio.debt, 0); assert.equal(s.obligations, 0)
  assert.deepEqual(s.log.filter(e => e.kind === 'schedule').map(e => e.title),
    ['Nhận lương', 'Dòng tiền kinh doanh', 'Đáo hạn và coupon', 'Chi phí sinh hoạt', 'Nợ đến hạn', 'Nghĩa vụ đến hạn'])
  assert.equal(s.log.find(e => e.title === 'Nợ đến hạn')?.debtInterestPaid, 10e6 * RULES.debtRate)
})
test('final living charge is paid before victory', () => {
  const base = create(); base.lap = 4; base.portfolio.cash = 80e6
  const s = beginSettlement(base)
  assert.equal(s.portfolio.cash, 87e6); assert.equal(victory(advance(advance(s))).won, false)
})
test('historical missing and explicit on-landing policies have no periodic payment', () => {
  for (const version of [undefined, 'v2.4-on-landing'] as const) {
    const s = beginSettlement(createGame('old', 0, 1, 'experimental-b', undefined, undefined, undefined, undefined, undefined, version))
    assert.equal(s.portfolio.cash, 64e6); assert.equal(bills(s).length, 0)
  }
})
