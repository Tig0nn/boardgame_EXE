import { test } from 'node:test'
import assert from 'node:assert/strict'
import { betaEnabled } from '../mobile_app/src/game/beta-feature.ts'
import { createMvpMobileGame, createMobileSession } from '../mobile_app/src/game/session.ts'
import { createSemanticBinding } from '../mobile_app/src/game/semantic-ai.ts'
import { createQuestionFeature } from '../src/ai/companion/question-feature.ts'
import { createDraftStore } from '../mobile_app/src/game/draft-store.ts'
import { naturalBetaEncounter } from './helpers/beta-natural.ts'
import { normalizeDraftInput } from '../src/ai/companion/draft-index.ts'
import { purchasePreview } from '../src/game/selectors.ts'
import { serializeLog } from '../src/game/log.ts'
import { restoreSavedGame } from '../src/game/saved-game.ts'
import { answerSemantic } from '../src/ai/companion/semantic-index.ts'

test('Beta is off for production, including an explicit query opt-in', () => {
  assert.equal(betaEnabled(false, 'production', 'production', '?aiBeta=1'), false)
  assert.equal(betaEnabled(false, 'beta', 'production', '?aiBeta=1'), false)
  assert.equal(betaEnabled(true, 'development', undefined, '?aiBeta=1'), true)
  assert.equal(betaEnabled(false, 'production', 'preview', '?aiBeta=1', '1'), true)
  assert.equal(betaEnabled(true, 'development', undefined, ''), false)
})

test('Beta uses the active session and never mutates gameplay or save data', async () => {
  const game = createMvpMobileGame('beta-live', 10_000_000, 2)
  const before = JSON.stringify(game)
  const session = createMobileSession(game)
  // Deliberately expose only the read interface to the AI.
  const binding = createSemanticBinding({ getSnapshot: session.getSnapshot, subscribe: session.subscribe }, createQuestionFeature(true), createDraftStore(), () => {})
  const stop = binding.subscribe(() => {})
  const response = await binding.ask('Tiền mặt hiện tại của tôi là bao nhiêu?')
  assert.ok(response)
  assert.equal(response.sessionEpoch, binding.getSnapshot().context?.actual.sessionEpoch)
  assert.equal(JSON.stringify(session.getSnapshot()), before)
  assert.equal(binding.getSnapshot().isCurrent(), true)
  session.dispatch({ type: 'advance' }, game)
  assert.equal(binding.getSnapshot().response, null)
  assert.equal(binding.getSnapshot().isCurrent(), false)
  stop()
})

test('Beta observes natural bank draft and invalidates amount/term against canonical quote', async () => {
  const game = naturalBetaEncounter('bank'), before = JSON.stringify(game)
  const session = createMobileSession(game), store = createDraftStore()
  const binding = createSemanticBinding(session, createQuestionFeature(true), store, () => {})
  const stop = binding.subscribe(() => {})
  store.publish('bank', game, normalizeDraftInput({ form: 'bank', operation: 'deposit', amount: 2_000_000, term: 1 }))
  const response = await binding.ask('Gửi khoản này thì ví tôi còn bao nhiêu?')
  assert.ok(response?.draft)
  assert.equal(binding.getSnapshot().context?.draft?.preview.lines.find(x => x.code === 'cashAfter')?.value, purchasePreview(game, 2_000_000).cashAfter)
  store.publish('bank', game, normalizeDraftInput({ form: 'bank', operation: 'deposit', amount: 3_000_000, term: 2 }))
  assert.equal(binding.getSnapshot().response, null)
  assert.equal(JSON.stringify(game), before)
  stop()
})

for (const action of ['restart', 'import', 'resume'] as const) test(`Pending Beta answer cannot cross ${action} session identity`, async () => {
  const game = createMvpMobileGame('beta-identity', 0, 1)
  const session = createMobileSession(game)
  let release!: (value: unknown) => void, ready!: () => void
  const entered = new Promise<void>(resolve => { ready = resolve })
  const old = createSemanticBinding(session, createQuestionFeature(true), null, () => {}, async request => {
    const raw = await answerSemantic(request)
    ready()
    return new Promise(resolve => { release = () => resolve(raw) })
  })
  const stop = old.subscribe(() => {})
  const pending = old.ask('Tiền mặt hiện tại là bao nhiêu?')
  await entered
  const oldEpoch = old.getSnapshot().context?.actual.sessionEpoch
  stop()
  const nextGame = action === 'restart' ? createMvpMobileGame('beta-new', 0, 1) : restoreSavedGame(serializeLog(game))
  const next = createSemanticBinding(createMobileSession(nextGame), createQuestionFeature(true), null, () => {})
  const stopNext = next.subscribe(() => {})
  assert.notEqual(next.getSnapshot().context?.actual.sessionEpoch, oldEpoch)
  release(null)
  assert.equal(await pending, null)
  assert.equal(old.getSnapshot().response, null)
  assert.equal(next.getSnapshot().response, null)
  stopNext()
})
