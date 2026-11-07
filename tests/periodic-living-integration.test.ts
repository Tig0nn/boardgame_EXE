import test from 'node:test'
import assert from 'node:assert/strict'
import { createMobileGame, createMobileSession } from '../mobile_app/src/game/session.ts'
import { livingPresentation } from '../mobile_app/src/game/living-presentation.ts'
import { buildStartOverview, cashTone } from '../mobile_app/src/game/start-summary.ts'
import { marketBulletin, roundMarketReview } from '../mobile_app/src/game/market-news.ts'
import { buildEconomicEventImpact } from '../mobile_app/src/game/economic-event.ts'
import { advance, decide, fundPayment, transact } from '../src/game/engine.ts'
import { beginSettlement } from '../src/game/settlement.ts'
import { applyMacroShock } from '../src/game/market.ts'
import { boardFor } from '../src/data/board.ts'
import { EVENTS } from '../src/data/events.ts'
import { serializeLog } from '../src/game/log.ts'
import { replayGameLog } from '../scripts/diagnostics/replay-game-log.ts'
import { bondStrategyStep } from '../scripts/diagnostics/bond-credit-model.ts'

test('Mobile new games explicitly opt into candidate; historical help remains on-landing', () => {
  const game = createMobileGame('candidate-default', 0)
  assert.equal(game.livingExpenseRulesVersion, 'v2.6-periodic-start')
  assert.equal(livingPresentation(game).periodic, true)
  assert.match(livingPresentation(game).text, /7 triệu/)
  assert.match(livingPresentation().text, /5 triệu/,'new B18 setup help uses its explicit new default')
  assert.equal(livingPresentation({}).periodic, false)
  assert.match(livingPresentation({}).text, /4 hoặc 15/)
})
for (const [position, asset] of [[3, 'stocks'], [14, 'gold']] as const) test(`replacement tile ${position + 1} opens ${asset} with atomic purchase`, () => {
  const s = { ...createMobileGame('tile', 0), position, phase: 'event' as const, eventId: asset, turn: 1 }
  assert.equal(boardFor(s)[position].type, asset)
  const next = transact(s, { kind: 'buy', asset, amount: 1e6, symbolId: s.market.stocks[0].id })
  assert.equal(next.phase, 'rolling'); assert.equal(next.portfolio.cash, 49e6)
  assert.throws(() => transact(next, { kind: 'buy', asset, amount: 1e6 }))
})
for (const id of ['medical', 'repair', 'family']) test(`personal ${id} keeps immediate/deferred costs independent of living`, () => {
  for (const option of EVENTS.find(e => e.id === id)!.options) {
    const base = { ...createMobileGame('personal', 0), phase: 'event' as const, eventId: id, position: 7 }
    const next = decide(base, option.id)
    assert.equal(next.portfolio.cash, base.portfolio.cash - (option.cost ?? 0))
    assert.equal(next.obligations, option.obligation ?? 0)
    assert.equal(next.rng, base.rng)
  }
  const board = boardFor(createMobileGame('personal', 0))
  assert.equal(board[7].type, 'personal'); assert.equal(board[17].type, 'personal')
})
test('START overview includes living once and reconciles actual received and paid cash', () => {
  const s = beginSettlement(createMobileGame('overview', 20e6, 1)), view = buildStartOverview(s, 1)!
  assert.equal(view.livingPaid, 7e6); assert.equal(view.paid, 7e6)
  assert.equal(view.received, 34.8e6)
  assert.equal(view.received - view.paid, view.cashAfter - view.cashBefore)
  assert.equal(cashTone(-view.livingPaid!), 'negative'); assert.equal(cashTone(0), 'neutral')
})
test('funded living overview counts cash consumed and funding expense exactly once', () => {
  const base = createMobileGame('funded-view', 0); base.recurringIncome = 0; base.portfolio.cash = 2e6
  const s = fundPayment(beginSettlement(base), 'debt', 5e6), view = buildStartOverview(s, 1)!
  assert.equal(view.livingPaid, 7e6); assert.equal(view.paid, 7e6); assert.equal(view.fundingReceived, 5e6)
  assert.equal(view.received - view.paid, -2e6)
})
test('rapid summary and wallet commands only advance phase, never deduct cash', () => {
  const s = beginSettlement(createMobileGame('tap-living', 0)), session = createMobileSession(s)
  assert.equal(session.dispatch({ type: 'advance' }, s), true)
  assert.equal(session.dispatch({ type: 'advance' }, s), false)
  assert.equal(session.getSnapshot().portfolio.cash, s.portfolio.cash)
  const wallet = session.getSnapshot(); session.dispatch({ type: 'advance' }, wallet)
  assert.equal(session.dispatch({ type: 'advance' }, wallet), false)
  assert.equal(session.getSnapshot().portfolio.cash, s.portfolio.cash)
})
test('economic shock still applies once; periodic deduction does not leak future News', () => {
  const base = { ...createMobileGame('shock-living', 0), phase: 'event' as const, eventId: 'credit-tightening', position: 5, turn: 1 }
  const bulletin = marketBulletin(base)
  const shock = applyMacroShock(base, 'credit-tightening'), impact = buildEconomicEventImpact(shock)
  assert.ok(impact)
  const repeat = applyMacroShock(shock, 'credit-tightening')
  assert.deepEqual(repeat.market, shock.market)
  assert.deepEqual(marketBulletin(base), bulletin)
  assert.equal(roundMarketReview(base).settled, false)
  const after = beginSettlement(decide(shock, 'acknowledge'))
  assert.equal(after.market.appliedShocks.length, 1)
  assert.equal(buildStartOverview(after, 1)!.livingPaid, 7e6)
})
for (const seed of ['periodic-replay-0', 'BOND-V25-59', 'periodic-replay-2']) test(`complete four-lap candidate has exact deterministic replay: ${seed}`, () => {
  let s = createMobileGame(seed, 20e6, 3)
  for (let step = 0; s.phase !== 'finished' && step < 400; step++) s = bondStrategyStep(s, 'balanced')
  assert.equal(s.termination, 'completed'); assert.equal(s.summaries.length, 4)
  assert.equal(s.log.filter(e => e.kind === 'schedule' && e.title === 'Chi phí sinh hoạt').length, 4)
  const data = JSON.parse(serializeLog(s))
  assert.deepEqual(JSON.parse(JSON.stringify(replayGameLog(data))), data.state)
  for (const edit of ['amount', 'board', 'snapshot']) {
    const bad = structuredClone(data)
    if (edit === 'amount') bad.livingExpenseConfig.amount = 5e6
    if (edit === 'board') bad.board[3].type = 'living'
    if (edit === 'snapshot') delete bad.entries[0].before.boardRevision
    assert.throws(() => replayGameLog(bad))
  }
  assert.equal(advance(s), s)
})
