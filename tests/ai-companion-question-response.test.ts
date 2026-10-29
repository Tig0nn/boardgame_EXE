import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createQuestionFeature, runQuestionFeature } from '../src/ai/companion/question-feature.ts'
import { answerQuestion, parseQuestionResponse } from '../src/ai/companion/question-response.ts'
import { parseQuestionError, questionErrorResponse } from '../src/ai/companion/question-errors.ts'
import { questionRequest } from './helpers/question.ts'
const policy = JSON.parse(await readFile(new URL('./fixtures/ai-companion/question-policy-v1.json', import.meta.url), 'utf8'))
const p3 = JSON.parse(await readFile(new URL('./fixtures/ai-companion/questions-p3.json', import.meta.url), 'utf8'))

for (const item of policy.supported) test(`public answered: ${item.question}`, async () => {
  const feature = createQuestionFeature(true), req = await questionRequest(item.question)
  const result = await answerQuestion(req, { feature })
  assert.equal(result.questionPolicyVersion, 'b18-repair-question.v1')
  assert.equal(result.result.status, 'answered')
  if (result.result.status === 'answered') assert.equal(result.result.intent, item.intent)
  assert.equal(result.source, 'deterministic')
  assert.equal(result.correlation.questionDigest, req.questionDigest)
  assert.ok(!('policy' in result) && !('route' in result))
  assert.deepEqual(await parseQuestionResponse(result, req, { feature }), result)
})
for (const item of p3.filter(item => item.intent === 'unsupported')) test(`public fallback: ${item.id}`, async () => {
  const feature = createQuestionFeature(true), req = await questionRequest(item.question), response = await answerQuestion(req, { feature })
  assert.equal(response.result.status, 'fallback')
  if (response.result.status === 'fallback') assert.equal(response.result.reason, item.reason)
  assert.equal(response.result.reflectionQuestion, null)
  assert.deepEqual(response.result.statements, [])
  assert.deepEqual(response.result.evidenceRefs, [])
  assert.doesNotMatch(JSON.stringify(response.result), /PRIVATE_CANARY|999/)
})
test('public parser rejects amount, evidence, roles, correlation, policy, provenance, extra keys and private envelope', async () => {
  const feature = createQuestionFeature(true), req = await questionRequest(), good = await answerQuestion(req, { feature })
  for (const mutate of [
    r => { r.result.statements[1].statement.text = 'Còn999đ' },
    r => { r.result.statements[1].statement.bindings.now = 'temporary.now' },
    r => { r.result.evidenceRefs = ['fake'] }, r => { r.result.reflectionQuestion = null },
    r => { r.questionPolicyVersion = 'other' }, r => { r.source = 'model' },
    r => { r.correlation.revision++ }, r => { r.correlation.questionDigest = 'sha256:' + '0'.repeat(64) },
    r => { r.result.statements[1].optionId = 'temporary' }, r => { r.hidden = 'CANARY' },
  ]) {
    const forged = structuredClone(good); mutate(forged)
    await assert.rejects(parseQuestionResponse(forged, req, { feature }), error => error.code === 'INVALID_RESPONSE')
  }
  await assert.rejects(parseQuestionResponse({ policy: 'repair-questions.p3-internal' }, req, { feature }))
})
test('feature defaults OFF and disabling invalidates local work even after re-enabling', async () => {
  const req = await questionRequest(), feature = createQuestionFeature()
  await assert.rejects(answerQuestion(req, { feature }), error => error.code === 'QUESTION_FEATURE_DISABLED')
  await assert.rejects(answerQuestion(req), error => error.code === 'QUESTION_FEATURE_DISABLED')
  feature.setEnabled(true)
  const pending = answerQuestion(req, { feature })
  feature.setEnabled(false); feature.setEnabled(true)
  await assert.rejects(pending, error => error.code === 'QUESTION_FEATURE_DISABLED')
  assert.ok(await answerQuestion(req, { feature }))
})
test('feature gate settles when injected work ignores cancellation', async () => {
  const feature = createQuestionFeature(true)
  const pending = runQuestionFeature(feature, undefined, async () => new Promise(() => {}))
  feature.setEnabled(false)
  await assert.rejects(pending, error => error.code === 'QUESTION_FEATURE_DISABLED')
})
test('closed errors reject raw messages, invalid retry, identity and HTTP-status mismatches', async () => {
  const req = await questionRequest(), good = questionErrorResponse('RATE_LIMITED', req, 100)
  assert.deepEqual(parseQuestionError(good, req, 429), good)
  for (const bad of [{ ...good, extra: 'raw' }, { ...good, error: { ...good.error, message: 'PRIVATE' } },
    { ...good, error: { ...good.error, code: 'QUESTION_FEATURE_DISABLED' } }]) assert.throws(() => parseQuestionError(bad, req, 429))
  assert.throws(() => parseQuestionError(good, req, 503))
})
