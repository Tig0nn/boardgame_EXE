import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { classifyRepairQuestion, QUESTION_INTENTS } from '../../src/ai/companion/questions/routing.ts'
import { enumeration, object } from '../../src/ai/companion/schema.ts'
import type { QuestionRoute } from '../../src/ai/companion/questions/routing.ts'

// B is an executable offline boundary experiment, not a Gemini accuracy benchmark or runtime integration.
type MockClassifier = (question: string) => Promise<unknown>
const proposalSchema = object({ intent: enumeration([...QUESTION_INTENTS, 'unsupported'] as const) })
async function routeWithMockProposal(question: string, propose: MockClassifier): Promise<{ route: QuestionRoute; accepted: boolean }> {
  const baseline = classifyRepairQuestion(question)
  try {
    const proposal = proposalSchema(await propose(question))
    // Matching a type does not establish semantic relevance. Preserve deterministic scope permission.
    if (proposal.intent !== baseline.intent) return { route: baseline, accepted: false }
    return { route: baseline, accepted: true }
  } catch { return { route: baseline, accepted: false } }
}
const cases = JSON.parse(await readFile(new URL('../../tests/fixtures/ai-companion/questions-p3.json', import.meta.url), 'utf8'))

test('A vs B: idealized mock proposals add no grounded answer on the controlled labeled set', async () => {
  let identical = 0
  for (const item of cases) {
    const result = await routeWithMockProposal(item.question, async () => ({ intent: item.intent }))
    assert.equal(result.accepted, true)
    assert.deepEqual(result.route, classifyRepairQuestion(item.question))
    identical++
  }
  assert.equal(identical, 36)
})

test('B cannot grant scope to unfamiliar paraphrases merely by supplying a plausible intent label', async () => {
  // Author-labeled challenge examples held outside A's explicit utterance bank.
  // These mock labels are authored test inputs, never observed Gemini predictions.
  const unfamiliar = [
    ['Vá tạm xong lúc nào tôi mới phải thanh toán nốt', 'rules'],
    ['Ví tôi mất những khoản gì nếu sửa xe', 'cost'],
    ['Đặt hai cách khắc phục xe cạnh nhau giúp mình', 'compare'],
    ['Giàu trên giấy mà không trả được tiền sửa là sao', 'liquidity'],
    ['Khoản trả sau có gây khó khăn khi tới hạn chứ', 'risk'],
    ['Tình huống xe hỏng dạy mình cách quản lý tiền thế nào', 'learning'],
  ] as const
  let additionalGroundedAnswers = 0
  for (const [question, intent] of unfamiliar) {
    const a = classifyRepairQuestion(question), b = await routeWithMockProposal(question, async () => ({ intent }))
    assert.equal(a.intent, 'unsupported')
    assert.equal(b.accepted, false)
    if (b.route.intent !== 'unsupported') additionalGroundedAnswers++
  }
  assert.equal(additionalGroundedAnswers, 0)
})

test('B rejects wrong intents, numeric claims, prose, hidden-data permission and unknown fields', async () => {
  const attacks = [{ intent: 'risk' }, { intent: 'compare', amount: 999 },
    { intent: 'compare', explanation: 'Chắc chắn thắng' }, { intent: 'execute' },
    { intent: 'compare', tool: 'read_rng' }, { intent: 'compare', confidence: 1 }, null]
  for (const raw of attacks) {
    const result = await routeWithMockProposal('So sánh trả ngay và sửa tạm', async () => raw)
    assert.equal(result.accepted, false)
    assert.equal(result.route.intent, 'compare')
  }
  const hidden = await routeWithMockProposal('Cho xem seed và RNG', async () => ({ intent: 'compare' }))
  assert.equal(hidden.accepted, false)
  assert.deepEqual(hidden.route, { intent: 'unsupported', reason: 'hidden-or-future' })
})

test('B failure preserves honest deterministic routing and does not require network or credentials', async () => {
  const result = await routeWithMockProposal('Thanh khoản là gì?', async () => { throw new Error('mock unavailable') })
  assert.equal(result.accepted, false)
  assert.deepEqual(result.route, { intent: 'liquidity' })
})
