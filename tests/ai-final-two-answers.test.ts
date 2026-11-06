import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CURATED_QUESTIONS } from '../mobile_app/src/game/curated-catalog.ts'
import { presentEducationalAnswer } from '../mobile_app/src/components/educational-ai-presentation.ts'
import type { EducationalAnswer } from '../mobile_app/src/components/educational-ai-presentation.ts'
import { createSemanticRequest, answerSemantic, validateSemanticResponse } from '../src/ai/companion/semantic-index.ts'
import type { SemanticContext } from '../src/ai/companion/semantic/types.ts'
import { naturalCuratedState } from './helpers/curated-natural.ts'
import { projectGameplayContext } from '../src/ai/companion/universal-index.ts'

const baseline = JSON.parse(readFileSync('docs/qa/v3-final-two-answers/BEFORE.json', 'utf8')) as { results: { id: string; question: string; context: SemanticContext; after: EducationalAnswer }[] }
async function render(id: string, context = baseline.results.find(r => r.id === id)!.context) {
  const question = CURATED_QUESTIONS.find(q => q.id === id)!
  const request = await createSemanticRequest(context, question.text, 'final-two-test-' + id)
  const response = await validateSemanticResponse(await answerSemantic(request), request)
  const original = JSON.stringify({ response, context }), display = presentEducationalAnswer(response, question)
  assert.equal(JSON.stringify({ response, context }), original)
  return { question, response, display, request }
}
test('Final review: other 37 outputs and every catalog question remain identical', async () => {
  let unchanged = 0
  for (const old of baseline.results) {
    const f = await render(old.id)
    assert.equal(f.question.text, old.question)
    if (['personal-rules', 'macro-compare'].includes(old.id)) continue
    assert.deepEqual(f.display, old.after, old.id); unchanged++
  }
  assert.equal(unchanged, 37)
})
test('personal-rules puts both current eligible payment amounts in the lead', async () => {
  const f = await render('personal-rules')
  assert.equal(f.display.missing, false)
  assert.match(f.display.lead, /trả ngay 5\.000\.000.*hoặc.*chưa trả lúc này.*6\.000\.000.*Xuất phát cuối vòng/)
  assert.match(f.display.paragraphs.join(' '), /chỉ.*nghĩa vụ.*hoàn tất lựa chọn/)
  assert.match(f.display.paragraphs.join(' '), /huy động.*chi phí|chi phí.*huy động/)
  assert.doesNotMatch(f.display.lead, /Xem thêm|Mỗi phương án/)
  for (const [code, subject] of [['immediate', 'pay'], ['future', 'pay'], ['immediate', 'defer'], ['future', 'defer']]) assert.ok(f.display.sources.some(s => s.code === code && s.subject === subject))
})
test('personal-rules refuses partial or ineligible alternatives instead of inventing an option', async () => {
  const f = await render('personal-rules')
  for (const code of ['immediate', 'future']) {
    const r = structuredClone(f.response)
    r.gameplay!.facts = r.gameplay!.facts.filter(x => !(x.code === code && x.subject === 'defer'))
    assert.equal(presentEducationalAnswer(r, f.question).missing, true)
  }
  const r = structuredClone(f.response)
  r.gameplay!.actions = r.gameplay!.actions.filter(a => a !== 'defer')
  assert.equal(presentEducationalAnswer(r, f.question).missing, true)
})
test('personal-rules binds another current event rather than hardcoding the medical amounts', async () => {
  const state = naturalCuratedState('repair'), context = { actual: projectGameplayContext(state, { sessionEpoch: 'repair-final', revision: 0 }), draft: null }
  const f = await render('personal-rules', context)
  assert.equal(f.display.missing, false)
  assert.match(f.display.lead, /sửa ngay|Sửa ngay/)
  assert.match(f.display.lead, /sửa tạm|Sửa tạm/)
  for (const fact of f.response.gameplay!.facts.filter(x => ['immediate', 'future'].includes(x.code))) assert.ok(f.display.sources.some(s => s.code === fact.code && s.subject === fact.subject && s.value === fact.value))
})
test('macro-compare represents rising stocks and falling gold from the same observed event', async () => {
  const f = await render('macro-compare')
  assert.equal(f.display.missing, false)
  assert.match(f.display.lead, /FPT.*tăng.*15\.991.*CMC.*tăng.*16\.020.*[Vv]àng.*giảm.*50\.211/)
  assert.match(f.display.lead, /mỗi đơn vị/)
  assert.match(f.display.paragraphs.join(' '), /tăng.*giảm|cùng chiều/)
  assert.doesNotMatch([f.display.lead, ...f.display.paragraphs].join(' '), /mạnh hơn|tốt hơn|lợi nhuận cao hơn|do nhu cầu|do nhà đầu tư|do lãi suất/)
})
test('macro-compare does not invent a declining example in an all-increasing subset', async () => {
  const f = await render('macro-compare'), r = structuredClone(f.response)
  const rising = new Set(r.gameplay!.facts.filter(x => x.code === 'change' && x.value > 0).map(x => x.subject))
  r.gameplay!.facts = r.gameplay!.facts.filter(x => x.subject === 'overall' || rising.has(x.subject))
  const d = presentEducationalAnswer(r, f.question)
  assert.equal(d.missing, false)
  assert.doesNotMatch(d.lead, /giảm|Vàng/)
  assert.match(d.paragraphs.join(' '), /đều tăng|cùng chiều tăng/)
})
test('macro-compare excludes zero-price records from examples and displayed market prices', async () => {
  const f = await render('macro-compare')
  const zero = new Set(f.response.gameplay!.facts.filter(x => x.code === 'price' && x.value === 0).map(x => x.subject))
  assert.ok(zero.size > 0, 'Frozen event includes an unavailable issuer at zero')
  for (const subject of zero) {
    assert.ok(!f.display.sources.some(s => ['beforePrice', 'price', 'change'].includes(s.code) && s.subject === subject))
    assert.ok(!f.display.details.some(d => d.key.endsWith(':' + subject)))
  }
})
test('macro-compare retains observed-event and two-complete-record gates', async () => {
  const f = await render('macro-compare')
  for (const remove of ['observed', 'beforePrice', 'price', 'change']) {
    const r = structuredClone(f.response)
    r.gameplay!.facts = r.gameplay!.facts.filter(x => x.code !== remove)
    assert.equal(presentEducationalAnswer(r, f.question).missing, true, remove)
  }
  const r = structuredClone(f.response)
  r.gameplay!.facts = r.gameplay!.facts.filter(x => x.subject === 'overall' || x.subject === 'FPT' || x.subject === 'but-pha')
  assert.equal(presentEducationalAnswer(r, f.question).missing, true, 'A second zero-price asset is insufficient')
})
test('Two changed outputs retain exact source values and canonical validation still rejects tampering', async () => {
  for (const id of ['personal-rules', 'macro-compare']) {
    const f = await render(id)
    for (const s of f.display.sources) assert.ok(f.response.gameplay!.facts.some(x => x.code === s.code && x.subject === s.subject && x.value === s.value))
    const tampered = structuredClone(f.response)
    tampered.gameplay!.facts[0].value++
    await assert.rejects(() => validateSemanticResponse(tampered, f.request))
  }
})
