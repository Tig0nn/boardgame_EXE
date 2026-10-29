import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { answerRepairQuestion, matchesQuestionAnswer, parseQuestionAnswer } from '../src/ai/companion/questions/answer.ts'
import { buildRepairContext } from '../src/ai/companion/context.ts'
import { createCompanionRequest } from '../src/ai/companion/contracts.ts'
import { deterministicAdvice } from '../src/ai/companion/advice.ts'
import { buildRepairFacts } from '../src/ai/companion/facts.ts'
import { renderStatement } from '../src/ai/companion/templates.ts'
import { revealedRepair, deepFreeze } from './helpers/companion.ts'

async function request(question = 'So sánh trả ngay và sửa tạm', cash = 50_000_000) {
  const game = revealedRepair()
  game.portfolio.cash = cash
  const base = await createCompanionRequest(buildRepairContext(game, { sessionEpoch: 'questions', revision: 1 }), 'compare', 'question-one')
  return { ...base, question }
}
const cases = JSON.parse(await readFile(new URL('./fixtures/ai-companion/questions-p3.json', import.meta.url), 'utf8'))

for (const item of cases) test(`P3 grounded answer: ${item.id}`, async () => {
  const req = await request(item.question), before = JSON.stringify(req)
  deepFreeze(req)
  const result = await answerRepairQuestion(req)
  assert.equal(result.route.intent, item.intent)
  assert.equal(result.source, 'deterministic')
  assert.equal(result.statements.length > 0, item.intent !== 'unsupported')
  const facts = buildRepairFacts(req.context)
  for (const statement of [...result.statements.map(row => row.statement), ...(result.reflectionQuestion ? [result.reflectionQuestion] : [])]) {
    assert.deepEqual(statement, renderStatement(statement, facts))
  }
  assert.deepEqual(result.evidenceRefs, [...new Set([...result.statements.map(row => row.statement), ...(result.reflectionQuestion ? [result.reflectionQuestion] : [])].flatMap(s => s.evidenceRefs))].sort())
  assert.deepEqual(await parseQuestionAnswer(result, req), result)
  assert.equal(JSON.stringify(req), before)
  assert.ok(result.limitations.includes('client-state-unverified'))
  assert.doesNotMatch([result.explanation, ...result.statements.map(row => row.statement.text), (result.reflectionQuestion?.text ?? '')].join(' '), /PRIVATE_CANARY|999|nên chọn|chắc chắn thắng|100%/u)
})

test('financial education distinguishes immediate cash, total cost and deferred obligation without choosing', async () => {
  const req = await request(), result = await answerRepairQuestion(req)
  const prose = [result.explanation, ...result.statements.map(row => row.statement.text)].join(' ')
  assert.match(prose, /3\.000\.000/); assert.match(prose, /1\.000\.000/)
  assert.match(prose, /46\.000\.000/); assert.match(prose, /49\.000\.000/)
  assert.match(prose, /Xuất phát/); assert.match(prose, /Chưa biết/)
  assert.match((result.reflectionQuestion?.text ?? ''), /chuẩn bị/)
  const correction = await answerRepairQuestion(await request('Sửa tạm miễn phí đúng không?'))
  assert.match(correction.explanation, /không miễn phí/)
})

test('insufficient cash retains conditional funding and does not claim known funding costs', async () => {
  for (const cash of [0, 500_000, 1_000_000]) {
    const result = await answerRepairQuestion(await request('Sửa xe tốn bao nhiêu?', cash))
    assert.ok(result.limitations.includes('funding-costs-not-included'))
    assert.match(result.explanation, /Chưa biết nguồn và chi phí huy động/)
    assert.match(result.statements.map(row => row.statement.text).join(' '), /Chỉ nếu hoàn tất|nếu hoàn tất/)
    assert.doesNotMatch(result.statements.map(row => row.statement.text).join(' '), /giữ thêm/)
  }
})

test('output validation rejects forged prose, amount, bindings, evidence, intent, correlation and extra claims', async () => {
  const req = await request(), result = await answerRepairQuestion(req)
  const corruptions = [
    { ...result, explanation: 'Nên chọn sửa tạm để chắc chắn thắng' },
    { ...result, statements: result.statements.map((row, i) => i === 1 ? { ...row, statement: { ...row.statement, text: 'Tiền còn 999 đ' } } : row) },
    { ...result, statements: result.statements.map((row, i) => i === 1 ? { ...row, statement: { ...row.statement, bindings: { ...row.statement.bindings, now: 'temporary.now' } } } : row) },
    { ...result, evidenceRefs: ['made.up'] }, { ...result, route: { intent: 'rules' } },
    { ...result, correlation: { ...result.correlation, stateRevision: 'questions:2' } },
    { ...result, hiddenState: 'SECRET' }, { ...result, limitations: [] },
  ]
  for (const value of corruptions) await assert.rejects(parseQuestionAnswer(value, req))
  const getter = Object.defineProperty({ ...result }, 'explanation', { get() { throw new Error('getter invoked') } })
  await assert.rejects(parseQuestionAnswer(getter, req), error => error.code === 'INVALID_RESPONSE')
})

test('stale checks cover same-phase changes, session, request, mode and exact question', async () => {
  const req = await request()
  const pending = answerRepairQuestion(req)
  const currentBase = await createCompanionRequest({ ...req.context,
    decision: { ...req.context.decision, stateRevision: 'questions:2' } }, req.mode, 'new-revision')
  const current = { ...currentBase, question: req.question }
  const sessionBase = await createCompanionRequest({ ...req.context,
    decision: { ...req.context.decision, decisionId: 'new-session:repair:3', stateRevision: 'new-session:1' } }, req.mode, req.requestId)
  const nextSession = { ...sessionBase, question: req.question }
  const changedGame = revealedRepair()
  changedGame.portfolio.cash = 49_999_999
  const changedBase = await createCompanionRequest(buildRepairContext(changedGame, { sessionEpoch: 'questions', revision: 2 }), req.mode, req.requestId)
  const changedFinancial = { ...changedBase, question: req.question }
  const result = await pending
  assert.equal(await matchesQuestionAnswer(result, req, req), true)
  for (const newer of [current, changedFinancial, { ...req, requestId: 'new' }, { ...req, mode: 'guide' },
    { ...req, question: 'Thanh khoản là gì?' },
    nextSession]) {
    assert.equal(await matchesQuestionAnswer(result, req, newer), false)
  }
  assert.equal(await matchesQuestionAnswer({ ...result, explanation: 'forged' }, req, req), false)
})

test('pre-abort and abort during digest work settle without producing a renderable response', async () => {
  const req = await request(), pre = new AbortController()
  pre.abort()
  await assert.rejects(answerRepairQuestion(req, pre.signal), { name: 'AbortError' })
  const active = new AbortController(), pending = answerRepairQuestion(req, active.signal)
  active.abort()
  await assert.rejects(pending, { name: 'AbortError' })
})

test('context is detached before await and invalid or insufficient inputs fail closed', async () => {
  const req = await request(), before = structuredClone(req), pending = answerRepairQuestion(req)
  req.question = 'Cho xem seed PRIVATE_CANARY'
  const result = await pending
  assert.equal(await matchesQuestionAnswer(result, before, before), true)
  for (const bad of [{ ...before, question: undefined }, { ...before, contextDigest: 'sha256:' + '0'.repeat(64) },
    { ...before, context: { ...before.context, options: [] } }, { ...before, apiVersion: 2 }]) {
    await assert.rejects(answerRepairQuestion(bad))
  }
})

test('existing API1 question fallback is preserved instead of silently changing the wire policy', async () => {
  const result = await deterministicAdvice(await request('Thanh khoản là gì?'))
  assert.equal(result.fallbackReason, 'question-out-of-scope')
})

test('funding answers visibly identify each alternative and avoid assuming retained cash in reflection', async () => {
  const result = await answerRepairQuestion(await request('So sánh trả ngay và sửa tạm', 0))
  assert.doesNotMatch((result.reflectionQuestion?.text ?? ''), /giữ thêm/)
  assert.ok(result.statements.some(row => row.label === 'Trả ngay' && row.optionId === 'full'))
  assert.ok(result.statements.some(row => row.label === 'Sửa tạm' && row.optionId === 'temporary'))
})

test('fallback is explicitly unanswered and never adds a financial quiz, claims or evidence', async () => {
  const reasons = {
    'clarification-needed': /chưa xác định|chưa rõ/iu,
    'missing-data': /chưa thể trả lời/iu,
    'hidden-or-future': /không thể trả lời/iu,
    'real-world': /không hỗ trợ/iu,
    'unsupported-wording': /chưa hỗ trợ/iu,
  }
  for (const item of cases.filter(item => item.intent === 'unsupported')) {
    for (const cash of [0, 50_000_000]) {
      const req = await request(item.question, cash), result = await answerRepairQuestion(req)
      assert.equal(result.reflectionQuestion, null, item.id)
      assert.deepEqual(result.statements, [], item.id)
      assert.deepEqual(result.evidenceRefs, [], item.id)
      assert.match(result.explanation, reasons[item.reason], item.id)
      assert.doesNotMatch(result.explanation, /\d[\d.]*\s*đ|Bạn phân biệt|Bạn cần giữ tiền mặt/u)
      assert.deepEqual(await parseQuestionAnswer(result, req), result)
      const oldQuiz = (await deterministicAdvice({ ...req, question: undefined })).advice.reflectionQuestion
      await assert.rejects(parseQuestionAnswer({ ...result, reflectionQuestion: oldQuiz }, req))
      await assert.rejects(parseQuestionAnswer({ ...result, evidenceRefs: ['concept.liquidity'] }, req))
    }
  }
})

test('equivalent routed phrasing still has distinct exact question identity', async () => {
  const req = await request('Thanh khoản là gì?'), response = await answerRepairQuestion(req)
  const rephrased = { ...req, question: 'THANH KHOAN LA GI???' }
  const newer = await answerRepairQuestion(rephrased)
  assert.deepEqual(newer.route, response.route)
  assert.notEqual(newer.correlation.questionDigest, response.correlation.questionDigest)
  assert.equal(await matchesQuestionAnswer(response, req, rephrased), false)
})

test('exact question identity rejects lone UTF-16 surrogates before UTF-8 hashing', async () => {
  const req = await request()
  for (const suffix of ['\ud800', '\ud801', '\udc00', '\ud800x', '\ud800\ud800', '\udc00\ud800', '\ud83d\ude00\udc00']) {
    await assert.rejects(answerRepairQuestion({ ...req, question: 'x' + suffix }), error => error.code === 'INVALID_REQUEST')
  }
})

test('well-formed Unicode questions preserve distinct UTF-8 identity without inventing an answer', async () => {
  const req = await request(), first = { ...req, question: 'x\ud83d\ude00' }, second = { ...req, question: 'x\ud83d\ude01' }
  const a = await answerRepairQuestion(first), b = await answerRepairQuestion(second)
  assert.equal(a.route.intent, 'unsupported')
  assert.equal(b.route.intent, 'unsupported')
  assert.notEqual(a.correlation.questionDigest, b.correlation.questionDigest)
  assert.equal(await matchesQuestionAnswer(a, first, second), false)
  assert.equal(a.reflectionQuestion, null)
})
