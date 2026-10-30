import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRepairContext } from '../src/ai/companion/context.ts'
import { createQuestionRequest, parseQuestionRequest, questionDigest } from '../src/ai/companion/question-contract.ts'
import { revealedRepair } from './helpers/companion.ts'

async function request(question = 'So sánh trả ngay và sửa tạm') {
  return createQuestionRequest(buildRepairContext(revealedRepair(), { sessionEpoch: 'wire', revision: 1 }),
    { sessionEpoch: 'wire', revision: 1 }, question, 'wire:question:1')
}
test('closed question request roundtrips and hashes exact raw text, not routed normalization', async () => {
  const a = await request('Thanh khoản là gì?'), b = await request('THANH KHOAN LA GI???')
  assert.deepEqual(await parseQuestionRequest(JSON.stringify(a)), a)
  assert.notEqual(a.questionDigest, b.questionDigest)
  assert.equal(await questionDigest(a.question), a.questionDigest)
})
test('question request rejects wrong shape, size, profile, quotes and identity/checksum mismatches', async () => {
  const req = await request()
  for (const [value, code] of [
    [{ ...req, seed: 'PRIVATE_CANARY' }, 'INVALID_REQUEST'],
    [{ ...req, questionApiVersion: 2 }, 'UNSUPPORTED_VERSION'],
    [{ ...req, questionPolicyVersion: 'other' }, 'UNSUPPORTED_VERSION'],
    [{ ...req, locale: 'en-US' }, 'INVALID_REQUEST'],
    [{ ...req, sessionEpoch: 'different' }, 'CONTEXT_MISMATCH'],
    [{ ...req, revision: 2 }, 'CONTEXT_MISMATCH'],
    [{ ...req, revision: -1 }, 'INVALID_REQUEST'],
    [{ ...req, questionDigest: 'sha256:' + '0'.repeat(64) }, 'CONTEXT_MISMATCH'],
    [{ ...req, questionDigest: 'bad' }, 'INVALID_REQUEST'],
    [{ ...req, contextDigest: 'sha256:' + '0'.repeat(64) }, 'CONTEXT_MISMATCH'],
    [{ ...req, context: { ...req.context, options: [] } }, 'INVALID_OPTIONS'],
    [{ ...req, context: { ...req.context, log: [] } }, 'INVALID_REQUEST'],
    [{ ...req, question: 'x'.repeat(401) }, 'INVALID_REQUEST'],
    ['{', 'INVALID_JSON'], [' '.repeat(8193), 'PAYLOAD_TOO_LARGE'],
  ] as const) await assert.rejects(parseQuestionRequest(value), error => error.code === code)
})
test('question request requires nonblank, control-free, well-formed Unicode within400 code units', async () => {
  for (const value of ['', ' ', '\ud800', '\udc00', 'x\ud800y', '\ud800\ud800', '\ud83d\ude00\udc00', 'x\u0000']) {
    await assert.rejects(request(value), error => error.code === 'INVALID_REQUEST')
  }
  assert.ok(await request('😀'.repeat(200)))
  await assert.rejects(request('😀'.repeat(201)))
})
test('request parser detaches all fields before awaits; inherited/getter/symbol fields are rejected', async () => {
  const req = await request(), before = structuredClone(req), pending = parseQuestionRequest(req)
  req.question = 'changed'
  req.context.financial.cashVnd = 0
  assert.deepEqual(await pending, before)
  const getter = Object.defineProperty({ ...before }, 'question', { get() { throw new Error('getter invoked') } })
  await assert.rejects(parseQuestionRequest(getter))
  await assert.rejects(parseQuestionRequest({ ...before, [Symbol('extra')]: 'bad' }))
})
