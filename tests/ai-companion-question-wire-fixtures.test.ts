import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createQuestionFeature } from '../src/ai/companion/question-feature.ts'
import { parseQuestionRequest } from '../src/ai/companion/question-contract.ts'
import { answerQuestion, parseQuestionResponse } from '../src/ai/companion/question-response.ts'
import { parseQuestionError } from '../src/ai/companion/question-errors.ts'
const fixture = JSON.parse(await readFile(new URL('./fixtures/ai-companion/question-wire-v1.json', import.meta.url), 'utf8'))
for (const example of fixture.examples) test(`frozen question wire: ${example.name}`, async () => {
  const feature = createQuestionFeature(true), request = await parseQuestionRequest(example.request)
  assert.deepEqual(await answerQuestion(request, { feature }), example.response)
  assert.deepEqual(await parseQuestionResponse(example.response, request, { feature }), example.response)
})
test('frozen question errors preserve disabled/nonretryable vs transient/rate-limited semantics', () => {
  assert.equal(parseQuestionError(fixture.errors.disabled, undefined, 503).error.retryable, false)
  assert.equal(parseQuestionError(fixture.errors.unavailable, fixture.examples[0].request, 503).error.retryable, true)
  assert.equal(parseQuestionError(fixture.errors.rateLimited, fixture.examples[0].request, 429).error.retryAfterMs, 1000)
})

for (const item of fixture.invalidRequests) test(`negative question request fixture: ${item.name}`, async () => {
  const request = { ...structuredClone(fixture.examples[0].request), ...item.patch }
  await assert.rejects(parseQuestionRequest(request), error => error.code === item.errorCode)
})
for (const item of fixture.invalidResponses) test(`negative question response fixture: ${item.name}`, async () => {
  const example = fixture.examples.find(item => item.name === 'compare'), response = structuredClone(example.response)
  let target = response
  for (const key of item.path.slice(0, -1)) target = target[key]
  target[item.path.at(-1)] = item.value
  await assert.rejects(parseQuestionResponse(response, example.request, { feature: createQuestionFeature(true) }),
    error => error.code === 'INVALID_RESPONSE')
})
