import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { PassThrough } from 'node:stream'
import { createQuestionHandler } from '../src/ai/companion/server/question-handler.ts'
import { createQuestionFeature } from '../src/ai/companion/question-feature.ts'
import { parseQuestionError } from '../src/ai/companion/question-errors.ts'
import { parseQuestionResponse } from '../src/ai/companion/question-response.ts'
import { questionRequest } from './helpers/question.ts'

async function serve(handler = createQuestionHandler()) {
  const server = createServer(handler)
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const address = server.address(); assert.ok(address && typeof address !== 'string')
  return { url: `http://127.0.0.1:${address.port}/api/ai-companion-question`, close: () => new Promise<void>((resolve, reject) => {
    server.closeAllConnections(); server.close(error => error ? reject(error) : resolve())
  }) }
}
async function post(url: string, body: unknown, headers = { 'content-type': 'application/json' }) {
  return fetch(url, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })
}
test('question handler default OFF returns closed nonretryable disabled error; method stays strict', async () => {
  const app = await serve()
  try {
    const response = await post(app.url, await questionRequest())
    assert.equal(response.status, 503)
    const error = parseQuestionError(await response.json(), undefined, 503)
    assert.equal(error.error.code, 'QUESTION_FEATURE_DISABLED'); assert.equal(error.error.retryable, false)
    const get = await fetch(app.url)
    assert.equal(get.status, 405); assert.equal(get.headers.get('allow'), 'POST')
    assert.equal(parseQuestionError(await get.json(), undefined, 405).error.code, 'METHOD_NOT_ALLOWED')
  } finally { await app.close() }
})
test('enabled loopback handler returns canonical public answered/fallback with safe bounded headers', async () => {
  const feature = createQuestionFeature(true), app = await serve(createQuestionHandler({ feature }))
  try {
    for (const question of ['Thanh khoản là gì?', 'So sánh trả ngay và sửa tạm', 'Thu nhập của tôi là bao nhiêu?']) {
      const req = await questionRequest(question), response = await post(app.url, req), body = await response.json()
      assert.equal(response.status, 200)
      assert.deepEqual(await parseQuestionResponse(body, req, { feature }), body)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
      assert.equal(response.headers.get('access-control-allow-origin'), null)
      assert.ok(new TextEncoder().encode(JSON.stringify(body)).byteLength <= 12288)
    }
  } finally { await app.close() }
})
test('question ingress rejects shape, hidden data, versions, digests, body and encoding safely', async () => {
  const feature = createQuestionFeature(true), app = await serve(createQuestionHandler({ feature, rateLimit: { maxRequests: 30, windowMs: 60_000 } }))
  const req = await questionRequest()
  try {
    for (const [body, headers, code, status] of [
      ['{', undefined, 'INVALID_JSON', 400], [' '.repeat(8193), undefined, 'PAYLOAD_TOO_LARGE', 413],
      ['{}', { 'content-type': 'text/plain' }, 'INVALID_REQUEST', 400],
      ['{}', { 'content-type': 'application/json', 'content-encoding': 'gzip' }, 'INVALID_REQUEST', 400],
      [{ ...req, seed: 'PRIVATE_CANARY' }, undefined, 'INVALID_REQUEST', 400],
      [{ ...req, questionApiVersion: 2 }, undefined, 'UNSUPPORTED_VERSION', 409],
      [{ ...req, revision: 2 }, undefined, 'CONTEXT_MISMATCH', 409],
      [{ ...req, questionDigest: 'sha256:' + '0'.repeat(64) }, undefined, 'CONTEXT_MISMATCH', 409],
      [{ ...req, context: { ...req.context, options: [] } }, undefined, 'INVALID_OPTIONS', 422],
    ] as const) {
      const response = await post(app.url, body, headers), parsed = parseQuestionError(await response.json(), undefined, status)
      assert.equal(response.status, status); assert.equal(parsed.error.code, code)
      assert.doesNotMatch(JSON.stringify(parsed), /PRIVATE_CANARY|stack|question":/)
    }
  } finally { await app.close() }
})
test('process-local rate limit is bounded and disabled status takes priority over retry', async () => {
  const feature = createQuestionFeature(true), app = await serve(createQuestionHandler({ feature, rateLimit: { maxRequests: 1, windowMs: 1000 } }))
  try {
    const req = await questionRequest()
    assert.equal((await post(app.url, req)).status, 200)
    const rate = await post(app.url, req)
    assert.equal(rate.status, 429); assert.ok(rate.headers.get('retry-after'))
    assert.equal(parseQuestionError(await rate.json(), undefined, 429).error.code, 'RATE_LIMITED')
    feature.setEnabled(false)
    const disabled = await post(app.url, req)
    assert.equal(parseQuestionError(await disabled.json(), undefined, 503).error.code, 'QUESTION_FEATURE_DISABLED')
  } finally { await app.close() }
})
async function synthetic(options = {}, body?: unknown) {
  const req = Object.assign(new PassThrough(), { method: 'POST', headers: { 'content-type': 'application/json' }, socket: { remoteAddress: 'test' }, body })
  const res = Object.assign(new PassThrough(), { statusCode: 200, setHeader() {} })
  let raw = ''; res.on('data', chunk => { raw += chunk })
  const pending = createQuestionHandler(options)(req, res)
  return { req, res, pending, result: () => JSON.parse(raw) }
}
test('request deadline and dynamic disable terminate pending raw ingress', async () => {
  const feature = createQuestionFeature(true)
  const timeout = await synthetic({ feature, requestTimeoutMs: 20 })
  await timeout.pending
  assert.equal(parseQuestionError(timeout.result(), undefined, 503).error.code, 'SERVICE_UNAVAILABLE')
  const disabled = await synthetic({ feature })
  feature.setEnabled(false); await disabled.pending
  assert.equal(parseQuestionError(disabled.result(), undefined, 503).error.code, 'QUESTION_FEATURE_DISABLED')
})
test('preparsed object ingress fails closed instead of bypassing byte limit', async () => {
  const feature = createQuestionFeature(true), app = await synthetic({ feature }, await questionRequest())
  await app.pending
  assert.equal(parseQuestionError(app.result(), undefined, 400).error.code, 'INVALID_REQUEST')
})

test('chunked oversize and invalid UTF-8 ingress cannot bypass body validation', async () => {
  const feature = createQuestionFeature(true), chunked = await synthetic({ feature })
  chunked.req.write(' '.repeat(4096)); chunked.req.write(' '.repeat(4097)); chunked.req.end()
  await chunked.pending
  assert.equal(parseQuestionError(chunked.result(), undefined, 413).error.code, 'PAYLOAD_TOO_LARGE')
  const utf8 = await synthetic({ feature }, Buffer.from([0xc3, 0x28]))
  await utf8.pending
  assert.equal(parseQuestionError(utf8.result(), undefined, 400).error.code, 'INVALID_JSON')
})
test('unexpected exception text stays private and aborted connections clean request listeners', async () => {
  const feature = createQuestionFeature(true)
  const req = Object.assign(new PassThrough(), { method: 'POST', headers: { 'content-type': 'application/json' }, socket: { remoteAddress: 'test' } })
  Object.defineProperty(req, 'body', { get() { throw new Error('PRIVATE_CANARY stack secrets') } })
  const res = Object.assign(new PassThrough(), { statusCode: 200, setHeader() {} })
  let raw = ''; res.on('data', chunk => { raw += chunk })
  await createQuestionHandler({ feature })(req, res)
  assert.doesNotMatch(raw, /PRIVATE_CANARY|stack|secrets/)
  assert.equal(parseQuestionError(JSON.parse(raw), undefined, 503).error.code, 'SERVICE_UNAVAILABLE')
  const aborted = await synthetic({ feature })
  aborted.res.destroy()
  await aborted.pending
  assert.equal(aborted.req.listenerCount('data'), 0)
})
