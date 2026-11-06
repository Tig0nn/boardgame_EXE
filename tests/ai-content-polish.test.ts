import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CURATED_QUESTIONS } from '../mobile_app/src/game/curated-catalog.ts'
import { presentEducationalAnswer, educationalMissing } from '../mobile_app/src/components/educational-ai-presentation.ts'
import type { EducationalAnswer } from '../mobile_app/src/components/educational-ai-presentation.ts'
import { createSemanticRequest, answerSemantic, validateSemanticResponse } from '../src/ai/companion/semantic-index.ts'
import type { SemanticContext } from '../src/ai/companion/semantic/types.ts'
import { planCuratedQuestion } from '../mobile_app/src/game/curated-ai.ts'

const before = JSON.parse(readFileSync('docs/qa/v3-final-content-polish/BEFORE.json', 'utf8')) as { results: { id: string; question: string; after: EducationalAnswer }[] }
const contexts = JSON.parse(readFileSync('docs/qa/educational-answers-v3/BEFORE.json', 'utf8')) as { results: { id: string; context: SemanticContext }[] }
const review = JSON.parse(readFileSync('docs/qa/v3-final-content-polish/owner-review.json', 'utf8')) as { id: string; verdict: string }[]
async function render(id: string) {
  const question = CURATED_QUESTIONS.find(q => q.id === id)!, context = contexts.results.find(r => r.id === id)!.context
  const request = await createSemanticRequest(context, question.text, 'polish-' + id)
  const response = await validateSemanticResponse(await answerSemantic(request), request)
  const original = JSON.stringify(response), display = presentEducationalAnswer(response, question)
  assert.equal(JSON.stringify(response), original)
  assert.equal(display.missing, false, id)
  return { display, main: [display.lead, ...display.paragraphs].join(' '), response, question, context }
}
test('Owner matrix matches 39 IDs: 23 accepted outputs and catalog texts remain exact', async () => {
  assert.equal(review.length, 39)
  assert.equal(review.filter(r => r.verdict === 'REVISE').length, 15)
  assert.equal(review.filter(r => r.verdict === 'BLOCKED').length, 1)
  for (const row of review.filter(r => r.verdict === 'ACCEPT')) {
    const f = await render(row.id), old = before.results.find(x => x.id === row.id)!
    assert.equal(f.question.text, old.question)
    assert.deepEqual(f.display, old.after, row.id)
  }
})
test('start-summary leads with recorded income and living entry, without invented net balance', async () => {
  const f = await render('start-summary')
  assert.match(f.display.lead, /14\.000\.000.*thu nhập.*5\.000\.000.*sinh hoạt/)
  assert.doesNotMatch(f.main, /Giá trị tài sản/)
  assert.ok(f.display.sources.some(s => s.kind === 'entry' && s.value === -5_000_000))
  assert.match(f.main, /nợ.*nghĩa vụ|nghĩa vụ.*nợ/)
  assert.doesNotMatch(f.main, /9\.000\.000|số dư ròng/)
})
test('start-forecast stays about published news rather than salaries or expenses', async () => {
  const f = await render('start-forecast')
  assert.match(f.main, /biến động.*công bố/)
  assert.doesNotMatch(f.main, /thu nhập|sinh hoạt|nghĩa vụ/)
  assert.deepEqual(f.display.details, [])
})
test('stocks-price explicitly points to other validated ticker prices', async () => {
  const f = await render('stocks-price')
  assert.match(f.main, /Xem thêm dữ kiện.*mã|mã.*Xem thêm dữ kiện/)
})
test('bonds-rules prioritizes mechanism and issuer risk over a list of rates', async () => {
  const f = await render('bonds-rules')
  assert.match(f.display.lead, /[Mm]ua trái phiếu.*gốc.*lãi/)
  assert.match(f.main, /tổ chức phát hành|bên phát hành/)
  assert.ok(f.display.paragraphs.length <= 2)
  assert.doesNotMatch(f.main, /4,5%|10%/)
})
test('bonds-coupon defines interest then rates, without repeating sale conditions', async () => {
  const f = await render('bonds-coupon')
  assert.match(f.display.lead, /Coupon.*lãi.*hợp đồng.*chưa.*nhận/)
  assert.match(f.main, /An Tâm.*4,5%.*Bứt Phá.*10%/)
  assert.doesNotMatch(f.main, /bán|báo giá/)
  assert.ok(f.display.paragraphs.length <= 2)
})
test('bonds-risk answers delayed money, receivables/loss and sale eligibility, not coupon rates', async () => {
  const f = await render('bonds-risk')
  assert.match(f.display.lead, /chậm trả.*gốc.*lãi.*chưa.*tiền mặt|chậm trả.*gốc.*lãi.*chưa.*ví/)
  assert.match(f.main, /còn phải thu/)
  assert.match(f.main, /mất gốc|tổn thất/)
  assert.match(f.main, /bán.*hợp lệ|hợp lệ.*bán/)
  assert.doesNotMatch(f.main, /4,5%|10%/)
})
test('bonds-compare names each issuer rate and current credit state without ranking', async () => {
  const f = await render('bonds-compare')
  assert.match(f.display.lead, /An Tâm.*4,5%/)
  assert.match(f.main, /Bứt Phá.*10%/)
  assert.equal((f.main.match(/đang trả đúng hạn/gi) ?? []).length, 2)
  assert.match(f.main, /cao.*không.*bảo đảm/)
})
test('business-rules separates mechanism, ownership and limits in at most three short sentences', async () => {
  const f = await render('business-rules')
  assert.match(f.display.lead, /bỏ vốn mua quán.*thu nhập.*Xuất phát/)
  assert.equal(f.display.paragraphs.length, 2)
  assert.match(f.main, /nâng cấp.*lần ghé sau|[Nn]âng cấp.*lần ghé sau/)
  assert.match(f.main, /không.*hòa vốn/)
  assert.match(f.main, /không.*huy động.*bắt buộc/)
})
test('business-risk stays on capital and break-even rather than repeating ownership', async () => {
  const f = await render('business-risk')
  assert.ok(f.display.paragraphs.length <= 2)
  assert.doesNotMatch(f.main, /Bạn chưa có quán|Bạn đang có quán/)
  assert.match(f.main, /vốn|Vốn/)
  assert.match(f.main, /không.*hòa vốn/)
  assert.match(f.main, /không.*huy động.*bắt buộc/)
})
for (const id of ['course-rules', 'course-compare']) test(`${id} has separate course lines with explicit next-start timing`, async () => {
  const f = await render(id)
  assert.match(f.display.paragraphs[0], /^Khóa cơ bản.*6\.000\.000.*2\.000\.000.*Xuất phát.*kế tiếp/)
  assert.match(f.display.paragraphs[1], /^Khóa nâng cao.*10\.000\.000.*4\.000\.000.*Xuất phát.*kế tiếp/)
  assert.match(f.main, /mỗi lần ghé.*một khóa/i)
  assert.match(f.main, /không hoàn lại/)
  assert.match(f.main, /chưa phải tiền.*nhận/)
})
test('personal-rules describes each choice without the confusing initial-payment phrase', async () => {
  const f = await render('personal-rules')
  assert.match(f.display.lead, /Bạn cần chọn.*trả ngay 5\.000\.000.*hoặc.*6\.000\.000.*Xuất phát cuối vòng/)
  assert.doesNotMatch(f.main, /hoàn tất khoản đầu|thanh toán ban đầu|0 đ trước/)
  assert.match(f.main, /hoàn tất.*lựa chọn|lựa chọn.*hoàn tất/)
  assert.match(f.main, /huy động/)
})
test('personal-compare explains zero upfront naturally while preserving obligations and funding caveat', async () => {
  const f = await render('personal-compare')
  assert.match(f.display.lead, /[Tt]rả ngay.*5\.000\.000/)
  assert.match(f.main, /chưa phải chi ngay.*6\.000\.000.*Xuất phát cuối vòng/)
  assert.doesNotMatch(f.main, /0 đ trước|thanh toán ban đầu/)
  assert.match(f.main, /hoàn tất lựa chọn/)
  assert.match(f.main, /huy động/)
})
test('macro-rules uses observed before/after prices and direction, not an invented cause', async () => {
  const f = await render('macro-rules')
  assert.match(f.display.lead, /FPT.*từ 114\.222.*lên 130\.213/)
  assert.match(f.main, /không.*tiền.*ví/)
  assert.doesNotMatch(f.main, /cú sốc|do nhu cầu|do nhà đầu tư|do lãi suất/)
})
test('macro-compare asks about observed outcomes and compares at least two complete public records', async () => {
  const f = await render('macro-compare')
  assert.equal(f.question.text, 'Các tài sản đã biến động khác nhau thế nào sau sự kiện?')
  assert.equal(f.question.focus, 'general')
  assert.equal(planCuratedQuestion(f.context, f.question).allowed, true)
  assert.match(f.display.lead, /FPT.*tăng.*15\.991.*CMC.*tăng.*16\.020/)
  assert.ok(new Set(f.display.sources.filter(s => s.code === 'beforePrice').map(s => s.subject)).size >= 2)
  assert.doesNotMatch(f.main, /do nhu cầu|do nhà đầu tư|do lãi suất|vì.*tăng/)
  const response = structuredClone(f.response)
  response.gameplay!.facts = response.gameplay!.facts.filter(f => f.subject === 'overall' || f.subject === 'FPT')
  const missing = presentEducationalAnswer(response, f.question)
  assert.equal(missing.missing, true)
  assert.match(missing.lead, /hai tài sản.*trước.*sau/)
})
test('macro-risk retains no-profit guarantee without a redundant ticker example', async () => {
  const f = await render('macro-risk')
  assert.match(f.display.lead, /^Không/)
  assert.match(f.main, /lãi thực nhận/)
  assert.doesNotMatch(f.main, /FPT|15\.991|Cú sốc/)
  assert.deepEqual(f.display.details, [])
})
test('All 39 outputs are grounded and immutable; every revised ID actually changes', async () => {
  for (const row of review) {
    const f = await render(row.id)
    if (row.verdict !== 'ACCEPT') assert.notDeepEqual(f.display, before.results.find(r => r.id === row.id)!.after, row.id)
    for (const s of f.display.sources) {
      if (s.kind === 'entry') assert.equal(f.response.gameplay!.entries[Number(s.subject)].amount, s.value)
      else assert.ok((s.kind === 'fact' ? f.response.gameplay!.facts : f.response.draft!.lines).some(f => f.code === s.code && f.value === s.value && (!('subject' in f) || f.subject === s.subject)))
    }
  }
})
test('Incomplete macro evidence and missing issuer state abstain rather than inventing information', async () => {
  for (const [id, remove] of [['macro-rules', 'beforePrice'], ['macro-compare', 'observed'], ['bonds-compare', 'creditState']] as const) {
    const f = await render(id), response = structuredClone(f.response)
    response.gameplay!.facts = response.gameplay!.facts.filter(x => x.code !== remove)
    assert.equal(presentEducationalAnswer(response, f.question).missing, true, id)
  }
  assert.match(educationalMissing(CURATED_QUESTIONS.find(q => q.id === 'macro-compare')!).lead, /hai tài sản/)
})
