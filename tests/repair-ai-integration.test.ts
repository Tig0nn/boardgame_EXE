import test from 'node:test'
import assert from 'node:assert/strict'
import { createRepairAiBinding, repairAiOptIn, repairAiEligible } from '../mobile_app/src/game/repair-ai.ts'
import { createMobileSession } from '../mobile_app/src/game/session.ts'
import { createQuestionFeature, answerQuestion } from '../src/ai/companion/question-index.ts'
import { revealedRepair } from './helpers/companion.ts'

test('local opt-in is explicit and production always denies it', () => {
  assert.equal(repairAiOptIn(false, '?repairAi=1'), false)
  assert.equal(repairAiOptIn(true, ''), false)
  assert.equal(repairAiOptIn(true, '?repairAi=true'), false)
  assert.equal(repairAiOptIn(true, '?repairAi=1'), true)
})
test('binding requires eligible revealed repair and never dispatches game actions', async () => {
  const game = revealedRepair(), session = createMobileSession(game), feature = createQuestionFeature(true)
  assert.equal(repairAiEligible(game), true)
  assert.equal(repairAiEligible({ ...game, phase: 'funding' }), false)
  const binding = createRepairAiBinding(session, feature), stop = binding.subscribe(() => {})
  binding.open(); binding.edit('Sửa tạm miễn phí đúng không')
  await binding.ask()
  const view = binding.getSnapshot()
  assert.equal(view.state.status, 'answered')
  assert.equal(session.getSnapshot(), game)
  if (view.state.status === 'answered') assert.match(JSON.stringify(view.state.delivery.response), /1.000.000|4.000.000/)
  binding.close(); assert.equal(binding.getSnapshot().open, false)
  stop()
})
test('unsupported question stays honest fallback; closing clears form and output', async () => {
  const binding = createRepairAiBinding(createMobileSession(revealedRepair()), createQuestionFeature(true))
  const stop = binding.subscribe(() => {})
  binding.open(); binding.edit('Thu nhập của tôi là bao nhiêu?'); await binding.ask()
  const state = binding.getSnapshot().state
  assert.equal(state.status, 'fallback')
  if (state.status === 'fallback') assert.equal(state.delivery.response.result.reflectionQuestion, null)
  binding.close(); assert.equal(binding.getSnapshot().question, '')
  assert.equal(binding.getSnapshot().state.status, 'idle');stop()
})
for (const action of ['close','disable','unsubscribe','choose'] as const) test(`real session binding cancels pending work on ${action}`, async () => {
  const session = createMobileSession(revealedRepair()), feature = createQuestionFeature(true)
  let started!: () => void
  const ready = new Promise<void>(resolve => { started = resolve })
  const binding = createRepairAiBinding(session, feature, async () => { started(); return new Promise(() => {}) })
  const stop = binding.subscribe(() => {})
  binding.open(); binding.edit('Thanh khoản là gì?'); const pending = binding.ask(); await ready
  if (action === 'close') binding.close()
  if (action === 'disable') feature.setEnabled(false)
  if (action === 'unsubscribe') stop()
  if (action === 'choose') session.dispatch({ type: 'choose', id: 'temporary' }, session.getSnapshot())
  assert.equal(await pending, null)
  assert.equal(binding.getSnapshot().open, false)
  assert.ok(!['answered','fallback','loading'].includes(binding.getSnapshot().state.status))
  stop()
})
test('new session identity and old render tickets cannot survive replacement', async () => {
  const feature = createQuestionFeature(true), game = revealedRepair()
  const first = createRepairAiBinding(createMobileSession(game), feature), stop = first.subscribe(() => {})
  first.open();first.edit('Thanh khoản là gì?');const delivery = await first.ask();assert.ok(delivery)
  stop()
  assert.equal(delivery.isCurrent(), false)
  const next = createRepairAiBinding(createMobileSession(game), feature), end = next.subscribe(() => {})
  next.open();next.edit('Thanh khoản là gì?');const newer = await next.ask();assert.ok(newer)
  assert.notEqual(delivery.response.correlation.sessionEpoch, newer.response.correlation.sessionEpoch);end()
})
test('same-phase new immutable snapshot clears answer before React notification', async () => {
  let game = revealedRepair(), listener = () => {}
  const session = { getSnapshot: () => game, subscribe(fn: () => void) { listener = fn;return () => { listener = () => {} } } }
  const feature = createQuestionFeature(true), binding = createRepairAiBinding(session,feature,req=>answerQuestion(req,{feature}))
  const stop = binding.subscribe(() => {})
  binding.open();binding.edit('Thanh khoản là gì?');const delivery = await binding.ask();assert.ok(delivery)
  game = { ...game, portfolio: { ...game.portfolio, cash: game.portfolio.cash - 1 } };listener()
  assert.equal(binding.getSnapshot().open, false);assert.equal(delivery.isCurrent(), false);stop()
})