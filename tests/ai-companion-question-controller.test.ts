import test from 'node:test'
import assert from 'node:assert/strict'
import { createQuestionController } from '../src/ai/companion/question-controller.ts'
import { createQuestionFeature } from '../src/ai/companion/question-feature.ts'
import { answerQuestion } from '../src/ai/companion/question-response.ts'
import { QuestionApiError } from '../src/ai/companion/question-errors.ts'
import { revealedRepair } from './helpers/companion.ts'
import type { QuestionRequest, QuestionResponse } from '../src/ai/companion/question-types.ts'

async function until(check: () => boolean) {
  for (let i = 0; i < 1000 && !check(); i++) await new Promise(resolve => setTimeout(resolve, 0))
  assert.ok(check(), 'Expected async stage was not reached')
}
function setup() {
  let snapshot = revealedRepair()
  return { getSnapshot: () => snapshot, change: () => { snapshot = { ...snapshot, portfolio: { ...snapshot.portfolio, cash: snapshot.portfolio.cash - 1 } } } }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
test('controller default OFF delivers nothing and never starts injected transport', async () => {
  const game = setup(); let calls = 0
  const controller = createQuestionController({ getSnapshot: game.getSnapshot, sessionEpoch: 'controller',
    transport: async () => { calls++; throw Error('must not run') } })
  assert.equal(controller.getState().status, 'disabled')
  assert.equal(await controller.ask('Thanh khoản là gì?'), null)
  assert.equal(calls, 0); controller.dispose()
})
test('controller creates fresh identity and only renders canonical current delivery', async () => {
  const game = setup(), feature = createQuestionFeature(true), requests: QuestionRequest[] = []
  const controller = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'controller',
    transport: async req => { requests.push(req); return answerQuestion(req, { feature }) } })
  const first = await controller.ask('Thanh khoản là gì?')
  assert.ok(first && first.isCurrent()); let rendered = 0
  assert.equal(first.render(() => { rendered++ }), true); assert.equal(rendered, 1)
  const second = await controller.ask('Sửa tạm có rủi ro gì?')
  assert.ok(second); assert.equal(first.isCurrent(), false)
  assert.notEqual(requests[0].requestId, requests[1].requestId)
  assert.equal(second.response.correlation.sessionEpoch, 'controller')
  assert.ok(Object.isFrozen(second.response.result)); controller.dispose()
})
test('snapshot change during async request construction prevents transport send', async () => {
  const game = setup(), feature = createQuestionFeature(true); let calls = 0
  const controller = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'build',
    transport: async req => { calls++; return answerQuestion(req, { feature }) } })
  const pending = controller.ask('Thanh khoản là gì?')
  game.change(); controller.observe()
  assert.equal(await pending, null); assert.equal(calls, 0); assert.equal(controller.getState().status, 'idle'); controller.dispose()
})
test('snapshot change in flight and out-of-order responses cannot revive old advice', async () => {
  const game = setup(), feature = createQuestionFeature(true)
  const queue: Array<{ request: QuestionRequest; result: ReturnType<typeof deferred<QuestionResponse>> }> = []
  const controller = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'flight',
    transport: async request => { const result = deferred<QuestionResponse>(); queue.push({ request, result }); return result.promise } })
  const old = controller.ask('Thanh khoản là gì?')
  await until(() => queue.length > 0)
  game.change(); controller.observe()
  const newer = controller.ask('Sửa tạm có rủi ro gì?')
  await until(() => queue.length >= 2)
  queue[1].result.resolve(await answerQuestion(queue[1].request, { feature }))
  const newDelivery = await newer; assert.ok(newDelivery && newDelivery.isCurrent())
  queue[0].result.resolve(await answerQuestion(queue[0].request, { feature }))
  assert.equal(await old, null); assert.equal(newDelivery.isCurrent(), true); controller.dispose()
})
test('actual render guard rejects state change after response, including without host observe yet', async () => {
  const game = setup(), feature = createQuestionFeature(true)
  const controller = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'render' })
  const delivery = await controller.ask('Thanh khoản là gì?'); assert.ok(delivery)
  game.change()
  let renders = 0
  assert.equal(delivery.render(() => { renders++ }), false)
  assert.equal(renders, 0); assert.equal(controller.getState().status, 'idle'); controller.dispose()
})
test('edit, close, reset/import, disable and unmount clear delivery and block deferred updates', async () => {
  for (const action of ['edit', 'close', 'reset', 'disable', 'dispose']) {
    const game = setup(), feature = createQuestionFeature(true)
    const controller = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'invalidate' })
    const delivery = await controller.ask('Thanh khoản là gì?'); assert.ok(delivery)
    if (action === 'edit') controller.editQuestion('Sửa xe tốn bao nhiêu?')
    if (action === 'close') controller.close()
    if (action === 'reset') controller.resetSession('imported')
    if (action === 'disable') feature.setEnabled(false)
    if (action === 'dispose') controller.dispose()
    assert.equal(delivery.isCurrent(), false); assert.equal(delivery.render(() => assert.fail('stale render')), false)
    assert.ok(!['answered', 'fallback'].includes(controller.getState().status))
    controller.dispose()
  }
})
test('disable while loading aborts ignored transport and reenable does not resurrect it', async () => {
  const game = setup(), feature = createQuestionFeature(true), started = deferred<void>()
  const controller = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'disable',
    transport: async () => { started.resolve(); return new Promise(() => {}) } })
  const pending = controller.ask('Thanh khoản là gì?'); await started.promise
  feature.setEnabled(false); feature.setEnabled(true)
  assert.equal(await pending, null); assert.equal(controller.getState().status, 'idle'); controller.dispose()
})
test('invalid response/errors are safe error states, not fallback; no retries', async () => {
  const game = setup(), feature = createQuestionFeature(true); let calls = 0
  const controller = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'reject',
    transport: async req => { calls++; const value = await answerQuestion(req, { feature }); return { ...value, source: 'model' } } })
  assert.equal(await controller.ask('Thanh khoản là gì?'), null)
  const state = controller.getState(); assert.equal(state.status, 'error')
  if (state.status === 'error') { assert.equal(state.error.error.code, 'INVALID_RESPONSE'); assert.doesNotMatch(JSON.stringify(state.error), /PRIVATE|model/) }
  assert.equal(calls, 1); controller.dispose()
})
test('same snapshot across imported sessions gets independent identity and unsupported stays visible', async () => {
  const game = setup(), feature = createQuestionFeature(true)
  const controller = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'before' })
  const first = await controller.ask('Thu nhập của tôi là bao nhiêu?'); assert.ok(first)
  assert.equal(controller.getState().status, 'fallback'); assert.equal(first.response.result.reflectionQuestion, null)
  controller.resetSession('after')
  const second = await controller.ask('Thanh khoản là gì?'); assert.ok(second)
  assert.notEqual(first.response.correlation.sessionEpoch, second.response.correlation.sessionEpoch)
  assert.equal(first.isCurrent(), false); controller.dispose()
})
test('custom transient failure never exposes exception text or triggers local answer', async () => {
  const game = setup(), feature = createQuestionFeature(true)
  const controller = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'errors',
    transport: async () => { throw new Error('PRIVATE_CANARY raw payload') } })
  assert.equal(await controller.ask('Thanh khoản là gì?'), null)
  const state = controller.getState(); assert.equal(state.status, 'error')
  if (state.status === 'error') { assert.equal(state.error.error.code, 'SERVICE_UNAVAILABLE'); assert.doesNotMatch(JSON.stringify(state.error), /PRIVATE_CANARY/) }
  controller.dispose()
})
test('disabled transport result latches controller gate and clears error/answer state', async () => {
  const game = setup(), feature = createQuestionFeature(true)
  const controller = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'off',
    transport: async () => { throw new QuestionApiError('QUESTION_FEATURE_DISABLED') } })
  assert.equal(await controller.ask('Thanh khoản là gì?'), null)
  assert.equal(feature.isEnabled(), false); assert.equal(controller.getState().status, 'disabled'); controller.dispose()
})

test('session reset rejects reusing any prior epoch; request IDs remain fresh across resets', async () => {
  const game = setup(), feature = createQuestionFeature(true)
  const controller = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'session-one' })
  const first = await controller.ask('Thanh khoản là gì?'); assert.ok(first)
  controller.resetSession('session-two')
  const second = await controller.ask('Thanh khoản là gì?'); assert.ok(second)
  assert.notEqual(first.response.correlation.requestId, second.response.correlation.requestId)
  assert.throws(() => controller.resetSession('session-one'), error => error.code === 'INVALID_REQUEST')
  controller.dispose()
})
test('late disabled failure from superseded work cannot turn off a newer valid request', async () => {
  const game = setup(), feature = createQuestionFeature(true)
  let rejectOld!: (error: Error) => void
  const started = deferred<void>()
  let calls = 0
  const controller = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'late-error',
    transport: async req => {
      calls++
      if (calls === 1) { started.resolve(); return new Promise((_resolve, reject) => { rejectOld = reject }) }
      return answerQuestion(req, { feature })
    } })
  const old = controller.ask('Thanh khoản là gì?'); await started.promise
  const newer = controller.ask('Sửa tạm có rủi ro gì?')
  rejectOld(new QuestionApiError('QUESTION_FEATURE_DISABLED'))
  assert.equal(await old, null)
  const delivered = await newer
  assert.ok(delivered && delivered.isCurrent()); assert.equal(feature.isEnabled(), true)
  controller.dispose()
})

test('injected transport cannot retarget the immutable trusted request used for validation', async () => {
  const { createQuestionRequest } = await import('../src/ai/companion/question-contract.ts')
  const game = setup(), feature = createQuestionFeature(true)
  const controller = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'retarget',
    transport: async req => {
      assert.ok(Object.isFrozen(req) && Object.isFrozen(req.context))
      const changed = await createQuestionRequest(req.context, { sessionEpoch: req.sessionEpoch, revision: req.revision }, 'Sửa tạm có rủi ro gì?', req.requestId)
      try { Object.assign(req, changed) } catch { /* Expected immutable boundary. */ }
      return answerQuestion(changed, { feature })
    } })
  assert.equal(await controller.ask('Thanh khoản là gì?'), null)
  const state = controller.getState(); assert.equal(state.status, 'error')
  if (state.status === 'error') assert.equal(state.error.error.code, 'INVALID_RESPONSE')
  controller.dispose()
})
test('forged disabled transport error cannot globally disable the feature', async () => {
  const { QuestionTransportError } = await import('../src/ai/companion/question-transport.ts')
  const { questionErrorResponse } = await import('../src/ai/companion/question-errors.ts')
  const game = setup(), feature = createQuestionFeature(true)
  const controller = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'forged-disable',
    transport: async req => {
      const error = questionErrorResponse('QUESTION_FEATURE_DISABLED', req)
      error.correlation.requestId = 'different'
      throw new QuestionTransportError(error)
    } })
  assert.equal(await controller.ask('Thanh khoản là gì?'), null)
  assert.equal(feature.isEnabled(), true)
  const state = controller.getState(); assert.equal(state.status, 'error')
  if (state.status === 'error') assert.equal(state.error.error.code, 'INVALID_RESPONSE')
  controller.dispose()
})
test('ask establishes identity before notifying loading; reentrant close cannot be overwritten', async () => {
  const game = setup(), feature = createQuestionFeature(true)
  const controller = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'notify-close' })
  const states: string[] = []
  let armed = false
  controller.subscribe(state => {
    if (!armed) return
    states.push(state.status)
    if (state.status === 'loading') controller.close()
  })
  armed = true
  assert.equal(await controller.ask('Thanh khoản là gì?'), null)
  assert.equal(states[0], 'loading')
  assert.equal(controller.getState().status, 'idle'); controller.dispose()
})
test('reentrant newer ask from loading wins and outer call never adopts its identity', async () => {
  const game = setup(), feature = createQuestionFeature(true)
  const controller = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'notify-new' })
  let armed = false, newer: ReturnType<typeof controller.ask> | undefined
  controller.subscribe(state => {
    if (armed && state.status === 'loading') { armed = false; newer = controller.ask('Sửa tạm có rủi ro gì?') }
  })
  armed = true
  assert.equal(await controller.ask('Thanh khoản là gì?'), null)
  assert.ok(newer)
  const delivery = await newer
  assert.ok(delivery && delivery.isCurrent())
  assert.equal(delivery.response.result.status, 'answered')
  if (delivery.response.result.status === 'answered') assert.equal(delivery.response.result.intent, 'risk')
  controller.dispose()
})

test('abort-listener close wins over the outer superseding ask', { timeout: 2000 }, async () => {
  const game = setup(), feature = createQuestionFeature(true), started = deferred<void>()
  let calls = 0
  const controller: ReturnType<typeof createQuestionController> = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'abort-close',
    transport: async (_req, signal) => {
      calls++; signal.addEventListener('abort', () => controller.close(), { once: true }); started.resolve()
      return new Promise(() => {})
    } })
  const old = controller.ask('Thanh khoản là gì?'); await started.promise
  const outer = controller.ask('Sửa xe tốn bao nhiêu?')
  assert.equal(await outer, null); assert.equal(await old, null)
  assert.equal(calls, 1); assert.equal(controller.getState().status, 'idle'); controller.dispose()
})
test('newer ask inside abort listener wins without being adopted by the outer call', { timeout: 2000 }, async () => {
  const game = setup(), feature = createQuestionFeature(true), started = deferred<void>()
  let calls = 0, newer: ReturnType<ReturnType<typeof createQuestionController>['ask']> | undefined
  const controller: ReturnType<typeof createQuestionController> = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'abort-new',
    transport: async (req, signal) => {
      calls++
      if (calls === 1) {
        signal.addEventListener('abort', () => { newer = controller.ask('Sửa tạm có rủi ro gì?') }, { once: true })
        started.resolve(); return new Promise(() => {})
      }
      return answerQuestion(req, { feature })
    } })
  const old = controller.ask('Thanh khoản là gì?'); await started.promise
  const outer = controller.ask('Sửa xe tốn bao nhiêu?')
  assert.equal(await outer, null); assert.equal(await old, null); assert.ok(newer)
  const delivery = await newer; assert.ok(delivery && delivery.isCurrent())
  if (delivery.response.result.status === 'answered') assert.equal(delivery.response.result.intent, 'risk')
  assert.equal(calls, 2); controller.dispose()
})
test('closing never allows its own abort callback to restart answering', { timeout: 2000 }, async () => {
  const game = setup(), feature = createQuestionFeature(true), started = deferred<void>()
  let restarted: ReturnType<ReturnType<typeof createQuestionController>['ask']> | undefined
  const controller: ReturnType<typeof createQuestionController> = createQuestionController({ getSnapshot: game.getSnapshot, feature, sessionEpoch: 'close-no-restart',
    transport: async (_req, signal) => {
      signal.addEventListener('abort', () => { restarted = controller.ask('Sửa xe tốn bao nhiêu?') }, { once: true })
      started.resolve(); return new Promise(() => {})
    } })
  const old = controller.ask('Thanh khoản là gì?'); await started.promise
  controller.close()
  assert.equal(await old, null); assert.equal(await restarted, null)
  assert.equal(controller.getState().status, 'idle'); controller.dispose()
})
