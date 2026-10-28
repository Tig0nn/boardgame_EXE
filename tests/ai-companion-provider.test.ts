import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createGeminiProvider, MAX_PROVIDER_BYTES, MAX_CANDIDATE_BYTES } from '../src/ai/companion/server/gemini.ts'
import { ProviderFailure } from '../src/ai/companion/server/provider.ts'
import { buildRepairFacts } from '../src/ai/companion/facts.ts'

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/ai-companion/golden-v1.json', import.meta.url), 'utf8'))
const example = fixtures.examples.find(example => example.name === 'compare')
const input = { plan: example.candidate, factIds: Object.keys(buildRepairFacts(example.request.context)).sort() }
const signal = () => new AbortController().signal
const config = { enabled: true, provenance: 'mock' as const, model: 'gemini-mock-only', apiKey: 'mock-only-not-a-credential' }
const envelope = (text = JSON.stringify(input.plan), finishReason = 'STOP') =>
  JSON.stringify({ candidates: [{ finishReason, content: { parts: [{ text }] } }] })
const json = (body = envelope(), status = 200) => new Response(body, { status, headers: { 'content-type': 'application/json' } })

test('Gemini transport is disabled by default; no implicit fetch, env, credentials or live opt-in', async () => {
  let calls = 0
  const transport: typeof fetch = async () => { calls++; return json() }
  for (const options of [
    { ...config, enabled: false, fetch: transport },
    { ...config, apiKey: undefined, fetch: transport },
    { ...config, model: undefined, fetch: transport },
    { ...config, fetch: undefined },
    { ...config, provenance: 'live' as const, fetch: transport },
    { ...config, model: 'gemini-x/../../escape', fetch: transport },
  ]) await assert.rejects(createGeminiProvider(options).generate(input, signal()), ProviderFailure)
  assert.equal(calls, 0)
})

test('injected Gemini mock sends only the closed teaching plan with constrained JSON output', async () => {
  let calls = 0
  const provider = createGeminiProvider({ ...config, fetch: async (url, init) => {
    calls++
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-mock-only:generateContent')
    assert.equal(init?.method, 'POST')
    assert.equal(new Headers(init?.headers).get('x-goog-api-key'), config.apiKey)
    assert.equal(init?.redirect, 'error')
    assert.ok(init?.signal instanceof AbortSignal)
    const payload = JSON.parse(String(init?.body))
    assert.equal(payload.generationConfig.candidateCount, 1)
    assert.equal(payload.generationConfig.maxOutputTokens, 2048)
    assert.equal(payload.generationConfig.responseFormat.text.mimeType, 'APPLICATION_JSON')
    assert.equal(payload.generationConfig.responseFormat.text.schema.additionalProperties, false)
    assert.ok(!String(init?.body).includes('cashVnd'))
    assert.ok(!String(init?.body).includes(example.request.contextDigest))
    assert.ok(!String(init?.body).includes(config.apiKey))
    assert.deepEqual(Object.keys(payload).sort(), ['contents', 'generationConfig'])
    return json()
  } })
  assert.deepEqual(await provider.generate(input, signal()), input.plan)
  assert.equal(provider.provenance, 'mock')
  assert.equal(calls, 1)
})

test('mocked 429/5xx/network errors are sanitized and never retried', async () => {
  for (const status of [429, 500, 503]) {
    let calls = 0
    const provider = createGeminiProvider({ ...config, fetch: async () => { calls++; return json('private error', status) } })
    await assert.rejects(provider.generate(input, signal()), (error: ProviderFailure) => {
      assert.equal(error.reason, 'provider-unavailable')
      assert.equal(error.message, 'provider-unavailable')
      return true
    })
    assert.equal(calls, 1)
  }
  const provider = createGeminiProvider({ ...config, fetch: async () => { throw new Error('sensitive error') } })
  await assert.rejects(provider.generate(input, signal()), { message: 'provider-unavailable' })
})

test('provider envelope/candidate bytes are bounded before JSON parse, including chunked output', async () => {
  for (const body of ['{', '{}', envelope('{'), envelope(JSON.stringify(input.plan), 'MAX_TOKENS'),
    ' '.repeat(MAX_PROVIDER_BYTES + 1), envelope(' '.repeat(MAX_CANDIDATE_BYTES + 1))]) {
    const provider = createGeminiProvider({ ...config, fetch: async () => json(body) })
    await assert.rejects(provider.generate(input, signal()), { message: 'output-rejected' })
  }
  let cancelled = false
  const oversized = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array(MAX_PROVIDER_BYTES)); controller.enqueue(new Uint8Array(1)) },
    cancel() { cancelled = true },
  })
  const provider = createGeminiProvider({ ...config, fetch: async () => new Response(oversized, { headers: { 'content-type': 'application/json' } }) })
  await assert.rejects(provider.generate(input, signal()), { message: 'output-rejected' })
  assert.equal(cancelled, true)
})

test('abort reaches injected fetch and no request starts after pre-cancellation', async () => {
  const controller = new AbortController()
  controller.abort()
  let calls = 0
  const provider = createGeminiProvider({ ...config, fetch: async () => { calls++; return json() } })
  await assert.rejects(provider.generate(input, controller.signal))
  assert.equal(calls, 0)
})
