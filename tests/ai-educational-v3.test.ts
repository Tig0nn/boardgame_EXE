import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CURATED_QUESTIONS } from '../mobile_app/src/game/curated-catalog.ts'
import { curatedQuestionCase } from './helpers/curated-natural.ts'
import { educationalCourseExample } from './helpers/educational-natural.ts'
import { createSemanticRequest, answerSemantic, validateSemanticResponse } from '../src/ai/companion/semantic-index.ts'
import { projectGameplayContext } from '../src/ai/companion/universal-index.ts'
import { presentEducationalAnswer, educationalMissing } from '../mobile_app/src/components/educational-ai-presentation.ts'
import { createCuratedBinding } from '../mobile_app/src/game/curated-ai.ts'
import { createMobileSession } from '../mobile_app/src/game/session.ts'
import { createDraftStore } from '../mobile_app/src/game/draft-store.ts'
import { createQuestionFeature } from '../src/ai/companion/question-feature.ts'
import { normalizeDraftInput } from '../src/ai/companion/draft-index.ts'

async function answer(id: string) {
  const question = CURATED_QUESTIONS.find(x => x.id === id)!, scenario = curatedQuestionCase(question)
  const request = await createSemanticRequest(scenario.context, question.text, id)
  const response = await validateSemanticResponse(await answerSemantic(request), request)
  return { question, ...scenario, response }
}
for (const question of CURATED_QUESTIONS) test(`Educational content: ${question.id}`, async () => {
  const f = await answer(question.id), before = JSON.stringify({ response: f.response, context: f.context, state: f.state })
  const display = presentEducationalAnswer(f.response, question)
  assert.equal(display.missing, false, question.id)
  assert.ok(display.lead.trim())
  assert.ok(display.paragraphs.length >= 1 && display.paragraphs.length <= 3)
  assert.notEqual(display.lead, question.text)
  assert.doesNotMatch([display.lead, ...display.paragraphs, ...display.details.map(x => x.label)].join(' '), /snapshot|canonical|\bscope\b|\bdraft\b|validator|selector|\bRNG\b/i)
  assert.ok(display.sources.length > 0 || display.rules.length > 0)
  for (const source of display.sources) {
    if (source.kind === 'entry') {
      assert.equal(f.response.gameplay?.entries[Number(source.subject)]?.amount, source.value)
      continue
    }
    const originals = source.kind === 'fact' ? f.response.gameplay?.facts : f.response.draft?.lines
    assert.ok(originals?.some(x => x.code === source.code && x.value === source.value && (!('subject' in x) || x.subject === source.subject)), JSON.stringify(source))
  }
  assert.equal(JSON.stringify({ response: f.response, context: f.context, state: f.state }), before)
})

test('Owner course example: cash/ownership/cost/boost, no invented post-purchase balance', async () => {
  const state = educationalCourseExample(), question = CURATED_QUESTIONS.find(x => x.id === 'course-cash')!
  const context = { actual: projectGameplayContext(state, { sessionEpoch: 'owner-example', revision: 0 }), draft: null }
  const request = await createSemanticRequest(context, question.text, 'owner-example')
  const response = await validateSemanticResponse(await answerSemantic(request), request), original = JSON.stringify(response)
  const display = presentEducationalAnswer(response, question), main = [display.lead, ...display.paragraphs].join(' ')
  assert.match(main, /trừ.*tiền mặt|tiền mặt.*trừ/)
  assert.ok(main.includes('42.800.000'))
  assert.match(main, /cơ bản.*đã|đã.*cơ bản/i)
  assert.match(main, /nâng cao.*chưa|chưa.*nâng cao/i)
  assert.ok(main.includes('10.000.000'))
  assert.ok(main.includes('4.000.000'))
  assert.match(main, /Xuất phát.*tiếp theo|tiếp theo.*Xuất phát/)
  assert.match(main, /không hoàn lại/)
  assert.ok(!main.includes('32.800.000'))
  assert.ok(!main.includes('6.000.000'), 'Completed basic course must not look payable again')
  assert.equal(JSON.stringify(response), original)
})

test('Bank separates principal, deferred interest, duration and liquidity', async () => {
  const f = await answer('bank-draft-cash'), display = presentEducationalAnswer(f.response, f.question), text = [display.lead, ...display.paragraphs].join(' ')
  assert.match(text, /chưa.*gửi|chưa.*xác nhận/)
  assert.match(text, /đủ kỳ hạn/)
  assert.match(text, /rút sớm.*mất lãi/)
  assert.ok(display.sources.some(x => x.code === 'cashAfter'))
})

test('Credit risk and delayed obligations remain explicit, not hidden in details', async () => {
  for (const id of ['bonds-rules', 'bonds-coupon', 'bonds-risk', 'bonds-compare']) {
    const f = await answer(id), d = presentEducationalAnswer(f.response, f.question), text = [d.lead, ...d.paragraphs].join(' ')
    assert.match(text, /chậm trả|mất vốn|mất gốc/)
    assert.match(text, /không.*bảo đảm|không.*chắc chắn/)
  }
  const f = await answer('personal-cost'), d = presentEducationalAnswer(f.response, f.question), text = [d.lead, ...d.paragraphs].join(' ')
  assert.match(text, /trả ngay/i)
  assert.match(text, /cuối vòng|Xuất phát/)
  assert.match(text, /hoàn tất|trả xong/)
})

test('Course answers retain the one-course-per-visit limit in the main explanation', async () => {
  for (const id of ['course-rules', 'course-compare', 'course-risk', 'course-cash']) {
    const f = await answer(id), d = presentEducationalAnswer(f.response, f.question)
    assert.match([d.lead, ...d.paragraphs].join(' '), /mỗi lần ghé.*một khóa/i)
  }
})

test('Comparison and missing evidence abstain with specific requirements', async () => {
  const f = await answer('course-compare')
  const response = structuredClone(f.response)
  response.gameplay!.facts = response.gameplay!.facts.filter(x => x.subject !== 'advanced')
  const d = presentEducationalAnswer(response, f.question)
  assert.equal(d.missing, true)
  assert.match(d.lead, /cơ bản.*nâng cao/)
  const missing = educationalMissing(CURATED_QUESTIONS.find(x => x.id === 'gold-sale')!, 'draft-missing')
  assert.match(missing.lead, /Bán/)
  assert.doesNotMatch(missing.lead, /draft|snapshot|canonical/i)
})

test('Missing-context explanations name the financial evidence needed, not just a generic error', () => {
  for (const [id, needed] of [
    ['bank-rules', /lãi suất|kỳ hạn/], ['stocks-rules', /giá|tài sản/], ['gold-rules', /giá|vàng/],
    ['bonds-rules', /lãi|tín dụng/], ['business-rules', /vốn|thu nhập/], ['personal-rules', /trả ngay|nghĩa vụ/], ['start-summary', /Xuất phát/],
  ] as const) {
    assert.match(educationalMissing(CURATED_QUESTIONS.find(q => q.id === id)!, 'domain-unavailable').lead, needed)
  }
})

test('No rule evidence means no invented explanation', async () => {
  const f = await answer('course-risk'), response = structuredClone(f.response)
  response.gameplay!.explanation = 'Thông tin chưa đầy đủ.'
  const display = presentEducationalAnswer(response, f.question)
  assert.equal(display.missing, true)
  assert.deepEqual(display.sources, [])
})

test('An unreviewed question ID is not silently given another question’s explanation', async () => {
  const f = await answer('finance-cash')
  const display = presentEducationalAnswer(f.response, { ...f.question, id: 'unreviewed-question' })
  assert.equal(display.missing, true)
  assert.deepEqual(display.sources, [])
})

test('Presentation cannot keep an old response after question, draft or session subscription ends', async () => {
  const f = await answer('bank-draft-cash'), session = createMobileSession(f.state), store = createDraftStore()
  const binding = createCuratedBinding(session, createQuestionFeature(true), store), stop = binding.subscribe(() => {})
  store.publish('bank', f.state, normalizeDraftInput({ form: 'bank', operation: 'deposit', amount: 2_000_000, term: 1 }))
  binding.selectCategory('bank'); binding.selectQuestion('bank-draft-cash')
  assert.ok(await binding.ask())
  store.publish('bank', f.state, normalizeDraftInput({ form: 'bank', operation: 'deposit', amount: 3_000_000, term: 2 }))
  assert.equal(binding.getSnapshot().semantic.response, null)
  binding.selectQuestion('bank-rules')
  assert.equal(binding.getSnapshot().semantic.response, null)
  stop()
  assert.equal(binding.getSnapshot().semantic.isCurrent(), false)
})
