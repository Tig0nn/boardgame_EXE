import test from 'node:test'
import assert from 'node:assert/strict'
import { createQuestionFeature } from '../src/ai/companion/question-feature.ts'
import { createLocalQuestionTransport, createRemoteQuestionTransport, createMockQuestionTransport } from '../src/ai/companion/question-transport.ts'
import { answerQuestion } from '../src/ai/companion/question-response.ts'
import { questionErrorResponse } from '../src/ai/companion/question-errors.ts'
import { questionRequest } from './helpers/question.ts'

test('disabled shared gate prevents remote sends and local/mock answers', async () => {
  let calls = 0
  const feature = createQuestionFeature(), req = await questionRequest(), signal = new AbortController().signal
  const fetcher: typeof fetch = async () => { calls++; throw Error('must not run') }
  for (const transport of [createRemoteQuestionTransport({ feature, fetch: fetcher }),
    createLocalQuestionTransport({ feature }), createMockQuestionTransport({ feature })]) {
    await assert.rejects(transport(req, signal), error => error.code === 'QUESTION_FEATURE_DISABLED')
  }
  assert.equal(calls, 0)
})
test('remote transport posts only approved wire data and validates complete canonical response', async () => {
  const feature = createQuestionFeature(true), req = await questionRequest()
  let calls = 0
  const remote = createRemoteQuestionTransport({ feature, fetch: async (url, init) => {
    calls++; assert.equal(url, '/api/ai-companion-question'); assert.equal(init?.method, 'POST')
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error')
    assert.deepEqual(JSON.parse(String(init?.body)), req)
    return Response.json(await answerQuestion(req, { feature }))
  } })
  assert.deepEqual(await remote(req, new AbortController().signal), await answerQuestion(req, { feature }))
  assert.equal(calls, 1)
})
test('server disabled error latches shared gate OFF and cannot fall back locally', async () => {
  const feature = createQuestionFeature(true), req = await questionRequest()
  const remote = createRemoteQuestionTransport({ feature, fetch: async () =>
    Response.json(questionErrorResponse('QUESTION_FEATURE_DISABLED'), { status: 503 }) })
  await assert.rejects(remote(req, new AbortController().signal), error => error.code === 'QUESTION_FEATURE_DISABLED')
  assert.equal(feature.isEnabled(), false)
  await assert.rejects(createLocalQuestionTransport({ feature })(req, new AbortController().signal))
})
test('transient unavailable remains distinct, safe and never automatically retries or invokes local mode', async () => {
  let calls = 0
  const feature = createQuestionFeature(true), req = await questionRequest()
  const remote = createRemoteQuestionTransport({ feature, fetch: async () => {
    calls++; return Response.json(questionErrorResponse('SERVICE_UNAVAILABLE'), { status: 503 })
  } })
  await assert.rejects(remote(req, new AbortController().signal), error => error.code === 'SERVICE_UNAVAILABLE')
  assert.equal(calls, 1); assert.equal(feature.isEnabled(), true)
})
test('remote rejects forged claims, error text, mismatch status, size, content-type and malformed body', async () => {
  const feature = createQuestionFeature(true), req = await questionRequest(), good = await answerQuestion(req, { feature })
  const forged = structuredClone(good); forged.result.explanation = 'PRIVATE_CANARY amount999'
  for (const response of [
    Response.json(forged), new Response('{', { headers: { 'content-type': 'application/json' } }),
    new Response('x'.repeat(12289), { headers: { 'content-type': 'application/json' } }),
    new Response('{}', { headers: { 'content-type': 'text/html' } }),
    Response.json({ ...questionErrorResponse('SERVICE_UNAVAILABLE'), raw: 'PRIVATE_CANARY' }, { status: 503 }),
    Response.json(questionErrorResponse('RATE_LIMITED', undefined, 100), { status: 503 }),
    new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '12289' } }),
  ]) {
    const remote = createRemoteQuestionTransport({ feature, fetch: async () => response })
    await assert.rejects(remote(req, new AbortController().signal), error => error.code === 'INVALID_RESPONSE')
  }
})
test('deadline and caller cancellation settle even when injected fetch ignores signal', async () => {
  const feature = createQuestionFeature(true), req = await questionRequest()
  const remote = createRemoteQuestionTransport({ feature, timeoutMs: 20, fetch: async () => new Promise(() => {}) })
  await assert.rejects(remote(req, new AbortController().signal), error => error.code === 'SERVICE_UNAVAILABLE')
  const controller = new AbortController(), pending = remote(req, controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
})
test('disable cancels remote loading and mock delay; re-enable does not revive old work', async () => {
  const feature = createQuestionFeature(true), req = await questionRequest()
  const pending = createMockQuestionTransport({ feature, delayMs: 1000 })(req, new AbortController().signal)
  feature.setEnabled(false); feature.setEnabled(true)
  await assert.rejects(pending, error => error.code === 'QUESTION_FEATURE_DISABLED')
})

test('abort at body-completion boundary prevents stale disabled side effect', async () => {
  const feature = createQuestionFeature(true), req = await questionRequest(), controller = new AbortController()
  const response = Response.json(questionErrorResponse('QUESTION_FEATURE_DISABLED'), { status: 503 })
  const reader = response.body!.getReader()
  Object.defineProperty(response, 'body', { value: { getReader: () => ({
    read: () => reader.read(), cancel: () => reader.cancel(),
    releaseLock: () => { reader.releaseLock(); controller.abort() },
  }) } })
  const remote = createRemoteQuestionTransport({ feature, fetch: async () => response })
  await assert.rejects(remote(req, controller.signal), { name: 'AbortError' })
  await Promise.resolve()
  assert.equal(feature.isEnabled(), true)
})
