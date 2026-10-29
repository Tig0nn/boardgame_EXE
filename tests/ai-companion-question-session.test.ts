import assert from 'node:assert/strict'
import test from 'node:test'
import { createCompanionRequest } from '../src/ai/companion/contracts.ts'
import { buildRepairContext } from '../src/ai/companion/context.ts'
import { createQuestionSession } from '../src/ai/companion/questions/session.ts'
import { revealedRepair } from './helpers/companion.ts'

async function request(id: string, revision: number) {
  const base = await createCompanionRequest(buildRepairContext(revealedRepair(), { sessionEpoch: 'session', revision }), 'compare', id)
  return { ...base, question: 'So sánh trả ngay và sửa tạm' }
}

test('same-phase context change invalidates in-flight work before the old answer can be delivered', async () => {
  const session = createQuestionSession(), req = await request('old', 1)
  const pending = session.ask(req)
  session.invalidate()
  assert.equal(await pending, null)
  const result = await session.ask(await request('new', 2))
  assert.equal(result?.correlation.stateRevision, 'session:2')
})

test('a second question supersedes the first, and cancellation does not poison later work', async () => {
  const session = createQuestionSession(), req = await request('old', 1)
  const old = session.ask(req)
  const newer = session.ask({ ...req, requestId: 'new', question: 'Thanh khoản là gì?' })
  assert.equal(await old, null)
  assert.equal((await newer)?.route.intent, 'liquidity')
  const cancelled = session.ask(req)
  session.invalidate()
  assert.equal(await cancelled, null)
  assert.ok(await session.ask(req))
})

test('invalid input remains a contract error instead of a plausible answer or cancellation', async () => {
  await assert.rejects(createQuestionSession().ask({ question: 'Thanh khoản là gì?' }))
})

test('unsupported answer remains a visible abstention, distinct from cancelled null delivery', async () => {
  const session = createQuestionSession(), req = await request('unsupported', 1)
  const answer = await session.ask({ ...req, question: 'Thu nhập của tôi là bao nhiêu?' })
  assert.ok(answer)
  assert.deepEqual(answer.route, { intent: 'unsupported', reason: 'missing-data' })
  assert.equal(answer.reflectionQuestion, null)
  assert.deepEqual(answer.evidenceRefs, [])
})