import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseCompanionRequest, parseCompanionError, deterministicAdvice, parseCompanionSuccess, renderMockAdvice } from '../src/ai/companion/index.ts'

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/ai-companion/golden-v1.json', import.meta.url), 'utf8'))
for (const fixture of fixtures.examples) test(`golden v1 ${fixture.name}: runtime-compatible request and exact response`, async () => {
  const request = await parseCompanionRequest(fixture.request)
  assert.deepEqual(await deterministicAdvice(request), fixture.fallback)
  assert.deepEqual(await parseCompanionSuccess(fixture.fallback, request), fixture.fallback)
  if (fixture.success) {
    assert.deepEqual(await renderMockAdvice(request, fixture.candidate), fixture.success)
    assert.deepEqual(await parseCompanionSuccess(fixture.success, request), fixture.success)
  }
})
test('golden errors and rejected candidate fixtures remain compatible without regenerating files', async () => {
  for (const error of Object.values(fixtures.errors)) assert.deepEqual(parseCompanionError(error), error)
  const request = fixtures.examples.find(example => example.name === 'compare').request
  for (const fixture of fixtures.invalidCandidates) await assert.rejects(renderMockAdvice(request, fixture.candidate))
})
