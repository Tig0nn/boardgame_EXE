import test from 'node:test'
import assert from 'node:assert/strict'
import { createMockTransport, createRevisionTracker, matchesAdvice } from '../src/ai/companion/client.ts'
import { buildRepairContext } from '../src/ai/companion/context.ts'
import { createCompanionRequest, parseCompanionError } from '../src/ai/companion/contracts.ts'
import { errorResponse } from '../src/ai/companion/errors.ts'
import { revealedRepair } from './helpers/companion.ts'

async function makeRequest() {
  return createCompanionRequest(buildRepairContext(revealedRepair(), { sessionEpoch: 'client', revision: 1 }), 'compare', 'request-one')
}

test('offline mock success, fallback and rejection use honest provenance and one contract', async () => {
  const request = await makeRequest(), signal = new AbortController().signal
  const result = await createMockTransport()(request, signal)
  assert.equal(result.source, 'mock'); assert.equal(matchesAdvice(result, request, request), true)
  assert.equal((await createMockTransport({ scenario: 'fallback' })(request, signal)).source, 'deterministic')
  const rejected = await createMockTransport({ candidate: { text: 'Profit 100%' } })(request, signal)
  assert.equal(rejected.source, 'deterministic'); assert.equal(rejected.fallbackReason, 'output-rejected')
})

test('mock error envelopes are validated and sanitized', async () => {
  const request = await makeRequest(), signal = new AbortController().signal
  for (const scenario of ['rate-limited', 'unavailable'] as const) {
    await assert.rejects(createMockTransport({ scenario })(request, signal), error => {
      const response = parseCompanionError(error.response)
      assert.ok(response.error.retryable)
      return true
    })
  }
  const error = errorResponse('RATE_LIMITED', request, 30_000)
  assert.deepEqual(parseCompanionError(error), error)
  assert.throws(() => parseCompanionError({ ...error, internalStack: 'CANARY' }))
  assert.throws(() => parseCompanionError({ ...error, error: { ...error.error, message: 'PRIVATE_CANARY' } }))
})

test('pre-abort, abort while loading and mock timeout settle promptly', async () => {
  const request = await makeRequest(), controller = new AbortController()
  controller.abort()
  await assert.rejects(createMockTransport()(request, controller.signal), { name: 'AbortError' })
  const active = new AbortController()
  const pending = createMockTransport({ delayMs: 1000 })(request, active.signal)
  active.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  await assert.rejects(createMockTransport({ scenario: 'timeout' })(request, new AbortController().signal), { name: 'TimeoutError' })
})

test('same-phase snapshot changes and a later request prevent old responses from rendering', async () => {
  const game = revealedRepair(), tracker = createRevisionTracker('client')
  assert.equal(tracker.observe(game).revision, 0)
  assert.equal(tracker.observe(game).revision, 0)
  const oldRequest = await createCompanionRequest(buildRepairContext(game, tracker.observe(game)), 'compare', 'old')
  const response = await createMockTransport()(oldRequest, new AbortController().signal)
  const newerGame = { ...game, portfolio: { ...game.portfolio, cash: game.portfolio.cash - 1 } }
  const newer = await createCompanionRequest(buildRepairContext(newerGame, tracker.observe(newerGame)), 'compare', 'new')
  assert.equal(newer.context.decision.stateRevision, 'client:1')
  assert.equal(matchesAdvice(response, oldRequest, newer), false)
  assert.equal(matchesAdvice(response, newer, newer), false)
  assert.equal(matchesAdvice(response, oldRequest, { ...oldRequest, mode: 'guide' }), false)
})
