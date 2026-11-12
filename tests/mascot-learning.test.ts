import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import type { IncomingMessage } from 'node:http'
import { PassThrough } from 'node:stream'
import { createGeminiLearningProvider, createHostedLearningHandler, createLearningHandler, mockLearningProvider } from '../src/ai/mascot/learning-server.ts'
import type { LearningProvider } from '../src/ai/mascot/learning-server.ts'
import { composeLearningAnswer, deduplicateLearningIds, fallbackLearning, learningCards, offlineLearning, readLearningContext, readLearningIds, readLearningQuestion, readLearningReply, resolveLearningReply, LEARNING_BODY_LIMIT, LEARNING_ENDPOINT } from '../src/ai/mascot/learning.ts'
import type { LearningContext } from '../src/ai/mascot/learning.ts'
import { createRepairDemo } from '../mobile_app/src/dev/repair-fixture.ts'
import { projectLearningContext } from '../mobile_app/src/game/mascot-learning-context.ts'
import { advance, decide, roll, transact } from '../src/game/engine.ts'
import { createMultiCourseGame } from '../src/game/new-game.ts'
import { eventsForGame } from '../src/data/events.ts'
import { serializeLog } from '../src/game/log.ts'
import { saveGameLocally } from '../src/game/saved-game.ts'

const context: LearningContext = { cash: 0, obligations: 0, lap: 2, scenario: 'growth', result: null, gold: null, entries: [
  { id: 15, lap: 2, kind: 'buy', asset: 'gold', event: null, choice: null, amount: 20_000_000, before: 20_000_000, after: 0, obligations: 0 },
] }
const finished: LearningContext = { ...context, result: { won: false, insolvent: false, funds: 82_000_000, target: 90_000_000, worth: 100_000_000 } }
const question = 'Đối chiếu các quyết định và kết quả cuối ván với mục tiêu để tìm thông tin liên quan.'
const finalQuestion = 'Tại sao cuối ván tôi có 79 triệu mà vẫn không đạt mục tiêu? Tôi nên rút ra bài học gì?'
const goldQuestion = 'Tại sao dùng hết tiền mặt mua vàng lại có thể khiến tôi gặp khó khăn trong ván?'
const predictionQuestion = 'Tôi nghĩ giá vàng sẽ tăng, tại sao cuối cùng tôi vẫn không đạt mục tiêu?'
const origin = 'http://127.0.0.1:5207'
const session = '123e4567-e89b-42d3-a456-426614174001'
async function withHandler(
  options: Parameters<typeof createLearningHandler>[0] | ReturnType<typeof createLearningHandler>,
  run: (send: (body: unknown, origin?: string, chunked?: boolean) => Promise<Response>) => Promise<void>,
  decorate?: (req: IncomingMessage) => Promise<void>,
) {
  const handler = typeof options === 'function' ? options : createLearningHandler({ origin, ...options })
  const server = createServer(async (req, res) => {
    await decorate?.(req)
    await handler(req, res)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address() as { port: number }
  try {
    await run((body, requestOrigin = origin, chunked = false) => {
      const json = JSON.stringify(body)
      const request = {
        method: 'POST', headers: { origin: requestOrigin, 'content-type': 'application/json', 'x-mascot-learning': '1', 'x-mascot-session': session },
        body: chunked ? new Blob([json]).stream() : json, duplex: 'half' as const,
      }
      return fetch('http://127.0.0.1:' + port + LEARNING_ENDPOINT, request)
    })
  } finally {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
}

test('offline glossary, recorded purchase, prediction limits and negation use verified evidence', () => {
  const cards = learningCards(context)
  assert.match(offlineLearning('Nhịp tăng trưởng là gì?', cards)?.[0].text ?? '', /Tiêu dùng khởi sắc.*đi ngược dự báo/)
  for (const text of [
    'Nhịp tăng trưởng là gì? Giải thích đơn giản giúp tôi.',
    '“Nhịp tăng trưởng” trong EXE nghĩa là gì vậy?',
    'Giải thích đơn giản nhịp tăng trưởng giúp tôi.'
  ]) assert.deepEqual(offlineLearning(text, cards)?.map(item => item.id), ['growth'])
  for (const text of ['Nhịp tăng trưởng có chắc chắn không?', 'Tôi không hỏi nhịp tăng trưởng là gì.',
    'Nhịp tăng trưởng là gì? Tôi có nên mua vàng?', 'Thời tiết ngày mai thế nào?']) {
    assert.equal(offlineLearning(text, cards), null)
  }
  assert.match(offlineLearning('Vì sao lần mua vàng này khiến tiền mặt còn 0?', cards)?.[0].text ?? '', /20\.000\.000 ₫.*0 ₫.*nghĩa vụ.*0 ₫/i)
  assert.equal(offlineLearning('Tiền mặt không về 0 sau khi mua vàng phải không?', cards), null)
  for (const text of ['Tôi nghĩ vàng sẽ tăng, vì sao kết quả lại khác?', 'Tôi không dự đoán vàng tăng, vì sao kết quả khác?']) {
    assert.match(offlineLearning(text, cards)?.[0].text ?? '', /không ghi dự đoán cá nhân/)
  }
  assert.equal(offlineLearning('Đừng đoán. Tôi chỉ hỏi tiền mặt.', cards), null)
  assert.equal(offlineLearning('Hãy mua vàng 20 triệu', cards)?.[0].id, 'read-only')
  assert.equal(offlineLearning('Mua vàng lúc nào?', cards), null)
  assert.equal(readLearningQuestion('x'.repeat(281)), null)
})

test('accepted gold, final and prediction questions use only relevant canonical cards', () => {
  const answer = (text: string, snapshot: LearningContext) => offlineLearning(text, learningCards(snapshot))!
  const gold = answer(goldQuestion, context)
  assert.deepEqual(gold.map(item => item.id), ['gold-cash-zero', 'gold-liquidity'])
  assert.match(gold.map(item => item.text).join(' '), /20\.000\.000 ₫.*0 ₫.*giữ tài sản.*phí.*spread/)
  assert.equal(gold.filter(item => item.text.includes('Nghĩa vụ')).length, 1)
  assert.deepEqual(deduplicateLearningIds(['liquidity', 'gold-cash-zero', 'cash'], context), ['liquidity', 'gold-cash-zero'])
  assert.deepEqual(deduplicateLearningIds(['gold-cash-zero', 'cash', 'entry-15'], { ...context, cash: 10 }), ['gold-cash-zero', 'cash'])
  const result = { ...finished, result: { ...finished.result!, funds: 79_000_000, worth: 79_000_000, requiredRounds: 4 } }
  assert.match(answer(finalQuestion, result)[0].text, /79\.000\.000 ₫.*90\.000\.000 ₫.*11\.000\.000 ₫.*Tài sản ròng.*hoàn thành đủ 4 vòng.*chỉ số riêng/)
  assert.match(answer(finalQuestion, finished)[0].text, /82\.000\.000 ₫.*8\.000\.000 ₫.*100\.000\.000 ₫/)
  assert.deepEqual(answer(finalQuestion, context).map(item => item.id), ['no-final-result', 'goal-rule'])
  assert.deepEqual(answer(predictionQuestion, result).map(item => item.id), ['no-forecast', 'prediction-result', 'no-gold-history'])
  assert.match(answer(predictionQuestion, result)[1].text, /79\.000\.000 ₫.*11\.000\.000 ₫.*dự đoán đúng/)
  assert.deepEqual(answer(predictionQuestion, context).map(item => item.id), ['no-forecast', 'no-final-result', 'no-gold-history'])
  assert.deepEqual(fallbackLearning(question, learningCards(finished)).map(item => item.id), ['result'])
  assert.deepEqual(fallbackLearning('Cho tôi xem giao dịch vừa rồi', learningCards(context), context).map(item => item.id), ['entry-15'])
  assert.deepEqual(fallbackLearning('Thời tiết ngày mai thế nào?', learningCards(finished)), [])
})

test('projection reads engine transactions and selectors without changing the official save or replay', () => {
  let game = advance(createMultiCourseGame('mascot-quality-0', 30_000_000, 1))
  for (let i = 0; i <= 5; i++) {
    game = roll(game)
    if (i === 5) break
    const event = eventsForGame(game).find(event => event.id === game.eventId)!
    game = decide(game, (event.options.find(option => option.id === 'skip') ?? event.options[0]).id)
  }
  assert.equal(game.eventId, 'gold')
  game = transact(game, { kind: 'buy', asset: 'gold', amount: 20_000_000 })
  const save = () => {
    let packed = ''
    assert(saveGameLocally(game, { setItem(_key, value) { packed = value } }))
    return packed
  }
  const before = { save: save(), replay: serializeLog(game) }
  const projected = projectLearningContext(game)!
  assert.equal(projected.cash, 0)
  assert.equal(projected.result, null)
  assert.match(learningCards(projected).find(card => card.id === 'gold-cash-zero')?.text ?? '', /20\.000\.000 ₫/)
  assert.deepEqual({ save: save(), replay: serializeLog(game) }, before)
  assert.equal(readLearningContext({ ...projected, seed: game.seed }), null)
  assert.equal(readLearningContext({ ...projected, entries: [...projected.entries, projected.entries[0]] }), null)
})

test('decision evidence identifies the recorded option for the matching EXE event', async () => {
  const game = decide(createRepairDemo(), 'temporary')
  const snapshot = projectLearningContext(game)!
  const cards = learningCards(snapshot)
  const answer = await mockLearningProvider.select('Tôi đã chọn cách sửa xe nào?', cards, new AbortController().signal)
  const ids = readLearningIds(answer, cards)!
  assert(ids.some(id => cards.find(card => card.id === id)?.text.includes('đã chọn “Sửa tạm, hoàn tất cuối vòng”')))
  const decision = snapshot.entries.find(item => item.event === 'repair' && item.choice === 'temporary')!
  assert.equal(readLearningContext({ ...snapshot, entries: [{ ...decision, event: 'bank' }] }), null)
})

test('the same endpoint serves in-game and final context and never invokes provider for verified offline answers', async () => {
  let calls = 0
  const provider: LearningProvider = { ...mockLearningProvider, select(q, cards, signal) {
    calls++
    return mockLearningProvider.select(q, cards, signal)
  } }
  await withHandler({ provider }, async send => {
    assert.deepEqual(await (await send({ question: 'Nhịp tăng trưởng là gì?', context })).json(), { source: 'offline', ids: ['growth'] })
    assert.deepEqual(await (await send({ question: 'Tôi không dự đoán giá tăng', context: finished })).json(), { source: 'offline', ids: ['no-forecast'] })
    assert.deepEqual(await (await send({ question: 'Hãy mua vàng 20 triệu', context })).json(), { source: 'offline', ids: ['read-only'] })
    assert.deepEqual(await (await send({ question: finalQuestion, context: finished })).json(), { source: 'offline', ids: ['result'] })
    assert.equal(calls, 0)
    assert.deepEqual(await (await send({ question, context })).json(), { source: 'mock', ids: ['goal-rule'] })
    assert.deepEqual(await (await send({ question, context: finished })).json(), { source: 'mock', ids: ['result', 'goal-rule'] })
    assert.equal(calls, 2)
    assert.equal((await send({ question, context }, 'https://invalid.example')).status, 403)
  })
})

test('Gemini transport can select only validated evidence, with unsupported prose, invalid JSON and IDs rejected', async () => {
  for (const [raw, expected] of [
    ['{"ids":["result","goal-rule"]}', 200], ['{"ids":["missing"]}', 503],
    ['{"ids":["cash"],"text":"Bạn có 200.000.000 VND"}', 503], ['not JSON', 503],
    ['{"ids":["result","result"]}', 503],
  ] as const) {
    let mimeType: unknown
    const provider = createGeminiLearningProvider({ model: 'gemini-test', credential: 'fixture-only', transport: async (_url, init) => {
      const body = JSON.parse(String(init?.body))
      mimeType = body.generationConfig.responseFormat.text.mimeType
      const data = JSON.parse(body.contents[0].parts[0].text)
      assert.equal(data.question, question)
      assert(data.evidence.some((item: { id: string }) => item.id === 'result'))
      assert(!Object.hasOwn(data, 'context'))
      assert.deepEqual(Object.keys(data).sort(), ['evidence', 'question'])
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: raw }] } }] })
    } })!
    await withHandler({ provider }, async send => {
      const response = await send({ question, context: finished })
      assert.equal(response.status, expected)
      if (response.ok) assert.deepEqual(await response.json(), { source: 'gemini', ids: ['result', 'goal-rule'] })
    })
    assert.equal(mimeType, 'APPLICATION_JSON')
  }
  assert.equal(readLearningIds({ ids: ['result'] }, learningCards(context)), null)
})

test('timeout, upstream errors and simultaneous requests fail closed', async () => {
  await withHandler({}, async send => {
    assert.equal((await send({ question, context, rawSave: 'private' })).status, 400)
    assert.deepEqual(await (await send({ question: finalQuestion, context: finished })).json(), { source: 'offline', ids: ['result'] })
  })
  for (const status of [503, 429]) {
    const provider = createGeminiLearningProvider({ model: 'gemini-test', credential: 'fixture-only',
      transport: async () => new Response(null, { status }) })!
    await withHandler({ provider }, async send => {
      assert.deepEqual(await (await send({ question, context: finished })).json(), { error: 'UNAVAILABLE' })
    })
  }
  let started!: () => void
  const entered = new Promise<void>(resolve => { started = resolve })
  const provider: LearningProvider = { source: 'mock', select() {
    started()
    return new Promise(() => {})
  } }
  await withHandler({ provider, deadlineMs: 300 }, async send => {
    const first = send({ question, context: finished })
    await entered
    assert.equal((await send({ question, context: finished })).status, 429)
    assert.deepEqual(await (await first).json(), { error: 'TIMEOUT' })
  })
})

test('open questions combine result and decision limits, teach the cash trade-off and compare eligible funds', () => {
  const cards = learningCards({ ...finished, result: { ...finished.result!, requiredRounds: 4 } })
  const read = (q: string) => offlineLearning(q, cards)?.map(item => item.text).join(' ') ?? ''
  for (const q of [
    'Tôi dự đoán đúng giá vàng nhưng vẫn thua, quyết định nào của tôi ảnh hưởng nhiều nhất?',
    'Vi sao toi du doan dung gia vang ma van thua, va lua chon nao tac dong lon nhat?',
    'Mình nghĩ vàng sẽ tăng nhưng không thắng. Quyết định nào ảnh hưởng lớn nhất?',
  ]) {
    assert.match(read(q), /không ghi dự đoán cá nhân.*82\.000\.000 ₫.*90\.000\.000 ₫.*8\.000\.000 ₫.*4 vòng.*chưa đủ căn cứ.*ảnh hưởng lớn nhất/)
  }
  for (const q of ['Nếu tôi giữ nhiều tiền mặt hơn thì kết quả có tốt hơn không?', 'Gia su minh giu lai nhieu tien mat hon, lieu co tot hon?']) {
    assert.match(read(q), /82\.000\.000 ₫.*tiền mặt.*chi trả ngay.*cơ hội.*chưa có mô phỏng/)
  }
  for (const q of [
    'Tại sao hai người có tài sản tương đương nhưng khả năng đạt mục tiêu lại khác nhau?',
    'Vi sao hai danh muc cung gia tri tai san ma kha nang dat muc tieu khac nhau?',
  ]) {
    const text = read(q)
    assert.match(text, /nguồn huy động hợp lệ.*vốn kinh doanh chưa bán/is)
    assert.match(text, /giả định/i)
    assert.doesNotMatch(text, /82\.000\.000|90\.000\.000/)
  }
  const mixed = read('Nếu tôi giữ nhiều tiền mặt hơn thì có tốt hơn không? Vì sao hai danh mục cùng giá trị tài sản mà khả năng đạt mục tiêu khác nhau?')
  assert.match(mixed, /chưa có mô phỏng.*giả định/is)
  assert.equal(read('Tôi không hỏi vì sao mình thua. Thời tiết thế nào?'), '')
  assert.equal(read('Đừng nói về giá vàng. Đội nào thắng trận bóng đá?'), '')
  assert.equal(read('Vì sao dùng hết tiền mặt mua vàng?').includes('20.000.000 ₫'), true)
  assert.equal(read('Vì sao đừng dùng hết tiền mặt mua vàng?'), '')
  const missing = offlineLearning('Tôi dự đoán giá vàng nhưng vẫn thua. Quyết định nào ảnh hưởng nhất?', learningCards(context))
  assert(missing?.some(item => item.id === 'no-final-result'))
  assert(!missing?.some(item => item.id === 'result' || item.id === 'prediction-result'))
  assert.match(fallbackLearning('Đối chiếu nhật ký với luật EXE: vì sao hai người có tài sản tương đương nhưng khả năng đạt mục tiêu khác nhau?', cards)
    .map(item => item.text).join(' '), /nguồn huy động hợp lệ.*vốn kinh doanh chưa bán/is)
})


test('open Q&A endpoints compose verified answers offline while provider validation stays capped', async () => {
  const comparison = 'Vì sao hai người có tài sản tương đương nhưng khả năng đạt mục tiêu lại khác nhau?'
  const combined = 'Tôi dự đoán giá vàng nhưng vẫn thua. Lựa chọn nào tác động nhiều nhất? ' + comparison
  const provider: LearningProvider = { source: 'mock', select() { assert.fail('Verified question called the provider') } }
  await withHandler({ provider }, async send => {
    const response = await send({ question: combined, context: finished })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.deepEqual(body, { source: 'offline', ids: ['no-forecast', 'prediction-result', 'decision-impact', 'goal-comparison'] })
    const cards = learningCards(finished)
    assert.deepEqual(readLearningReply(body, cards), body)
    assert.equal(readLearningReply({ ...body, source: 'gemini' }, cards), null)
    assert.equal(readLearningIds({ ids: body.ids }, cards), null)
    assert.equal(readLearningReply({ ...body, ids: [...body.ids, 'missing'] }, cards), null)
  })
})

test('verified finance explanations cover comparisons, game outcomes and limits without the provider', () => {
  const cards = learningCards(finished)
  const answer = (q: string, available = cards) => offlineLearning(q, available)?.map(item => item.text).join(' ') ?? ''
  for (const q of ['Rủi ro thanh khoản khác rủi ro thị trường thế nào?', 'So sanh rui ro thi truong voi rui ro thanh khoan va cho vi du.', 'Rủi ro thanh khoản là gì? Khác rủi ro thị trường thế nào?']) {
    assert.match(answer(q), /Rủi ro thanh khoản.*đúng lúc.*Rủi ro thị trường.*giá.*Ví dụ trong EXE.*vàng/is)
  }
  for (const q of ['Đa dạng hóa rồi tại sao vẫn thua?', 'Tôi đa dạng hóa rồi mà vẫn thua, vậy đa dạng hóa có ích gì?',
    'Toi da da dang hoa tai san roi, tai sao van khong dat muc tieu? Da dang hoa co phai luc nao cung tot khong?']) {
    const text = answer(q)
    assert.match(text, /giảm rủi ro tập trung.*không bảo đảm.*82\.000\.000 ₫.*8\.000\.000 ₫.*chưa đủ dữ kiện/is)
    assert.equal((text.match(/82\.000\.000/gu) ?? []).length, 1)
  }
  assert.match(answer('Tôi đa dạng hóa rồi mà vẫn thua, vậy đa dạng hóa có ích gì?', learningCards(context)), /chưa có kết quả cuối ván/i)
  for (const q of ['Lãi suất tăng có luôn khiến cổ phiếu giảm không? EXE có tính như vậy không?',
    'Co phieu co chac chan giam khi lai suat tang?', 'Lãi suất tăng thì sao? Cổ phiếu có giảm không?']) {
    assert.match(answer(q), /Không phải lúc nào.*chi phí vay.*Trong EXE.*bối cảnh.*ngành.*từng mã.*cú sốc/is)
  }
  const negated = answer('Tôi không hỏi lãi suất tác động tới cổ phiếu. Rủi ro thanh khoản khác rủi ro thị trường thế nào?')
  assert.match(negated, /Rủi ro thanh khoản/)
  assert.doesNotMatch(negated, /chi phí vay/)
  assert.equal(answer('Đừng giải thích đa dạng hóa. Dự báo thời tiết ngày mai?'), '')
  assert.equal(answer('Đa dạng hóa hệ sinh thái rừng có ích gì?'), '')
  assert.equal(answer('Lãi suất tiết kiệm trong EXE là bao nhiêu?'), '')
  assert.match(answer('Đa dạng hóa danh mục có ích gì? Lãi suất tăng có luôn khiến cổ phiếu giảm không?'), /giảm rủi ro tập trung.*chi phí vay/is)
})


test('grounded composition restores the explanation and retains verified additions from a mock', () => {
  const cards = learningCards(finished)
  const mixed = 'Đối chiếu nhật ký: Tôi đa dạng hóa rồi mà vẫn thua, vậy đa dạng hóa có ích gì?'
  assert.equal(offlineLearning(mixed, cards), null)
  const fallback = composeLearningAnswer(fallbackLearning(mixed, cards, finished))
  assert.deepEqual(fallback.map(item => item.scope), ['GENERAL_FINANCE', 'EXE_RULE', 'GAME_FACT', 'UNKNOWN'])
  const reply = resolveLearningReply(mixed, cards, { source: 'mock', ids: ['result', 'entry-15'] }, finished)
  assert.equal(reply.source, 'mock')
  assert.deepEqual(reply.cards.map(item => item.id), ['diversification', 'diversification-exe', 'actual-result', 'entry-15', 'diversification-limit'])
  assert.equal(resolveLearningReply(mixed, cards, { source: 'mock', ids: ['result', 'goal-rule'] }, finished).source, 'offline')
  const risk = 'Rủi ro thị trường và rủi ro thanh khoản khác nhau ở đâu?'
  const selected = [...offlineLearning(risk, cards)!, ...cards.filter(item => ['liquidity', 'gold-rule', 'gold-liquidity'].includes(item.id))]
  assert.deepEqual(composeLearningAnswer(selected).map(item => item.id), ['risk-difference', 'risk-example-exe'])
})

test('hosted Learning Q&A requires an explicit server flag and a canonical HTTPS origin', async () => {
  const allowedOrigin = 'https://fixture.example'
  const env = { MASCOT_LEARNING_ORIGIN: allowedOrigin, GEMINI_API_KEY: 'test-placeholder', GEMINI_MODEL: 'gemini-test' }
  let providerCalls = 0
  const transport: typeof fetch = async () => {
    providerCalls++
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ids":["result"]}' }] } }] })
  }
  for (const settings of [env, { ...env, MASCOT_LEARNING_ENABLED: '0' }, { ...env, MASCOT_LEARNING_ENABLED: 'true' },
    { ...env, MASCOT_LEARNING_ENABLED: '1', GEMINI_MODEL: '' },
    { ...env, MASCOT_LEARNING_ENABLED: '1', MASCOT_LEARNING_ORIGIN: allowedOrigin + '/path' }]) {
    await withHandler(createHostedLearningHandler(settings, transport), async send => {
      const response = await send({ question, context: finished }, allowedOrigin)
      assert.equal(response.status, 503)
      assert.deepEqual(await response.json(), { error: 'UNAVAILABLE' })
    })
  }
  assert.equal(providerCalls, 0)
  await withHandler(createHostedLearningHandler({ ...env, MASCOT_LEARNING_ENABLED: '1' }, transport), async send => {
    assert.equal((await send({ question, context: finished }, origin)).status, 403)
    const response = await send({ question, context: finished }, allowedOrigin)
    assert.deepEqual(await response.json(), { source: 'gemini', ids: ['result'] })
  })
  assert.equal(providerCalls, 1)
})

test('Learning bounds raw request bytes before parsing, even without Content-Length', async () => {
  let calls = 0
  const provider: LearningProvider = { source: 'mock', async select() { calls++; return { ids: [] } } }
  await withHandler({ provider }, async send => {
    for (const size of [LEARNING_BODY_LIMIT, 9000]) {
      for (const chunked of [false, true]) {
        const response = await send({ question, context, padding: 'x'.repeat(size) }, origin, chunked)
        assert.equal(response.status, 413)
        assert.deepEqual(await response.json(), { error: 'REQUEST_TOO_LARGE' })
      }
    }
    assert.equal((await send({ question: finalQuestion, context: finished })).status, 200)
  })
  assert.equal(calls, 0)
})

test('hosted Learning validates the raw stream with Vercel-style lazy request helpers', async () => {
  const allowedOrigin = 'https://fixture.example'
  let providerCalls = 0
  let accessorReads = 0
  const handler = createHostedLearningHandler({
    MASCOT_LEARNING_ENABLED: '1', MASCOT_LEARNING_ORIGIN: allowedOrigin,
    GEMINI_API_KEY: 'fixture-only', GEMINI_MODEL: 'gemini-test',
  }, async () => {
    providerCalls++
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ids":["result"]}' }] } }] })
  })
  await withHandler(handler, async send => {
    const accepted = await send({ question, context: finished }, allowedOrigin)
    assert.equal(accepted.status, 200)
    assert.deepEqual(await accepted.json(), { source: 'gemini', ids: ['result'] })
    assert.equal((await send({ question, context, rawSave: 'fixture' }, allowedOrigin)).status, 400)
    assert.equal((await send({ question, context, padding: 'x'.repeat(LEARNING_BODY_LIMIT) }, allowedOrigin, true)).status, 413)
  }, async req => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk)
    const bytes = Buffer.concat(chunks)
    const restored = new PassThrough()
    const on = req.on.bind(req)
    // Vercel restores data and end listeners to a separate stream and exposes a lazy parser.
    Object.defineProperties(req, {
      on: { value: (event: string, listener: (...args: unknown[]) => void) =>
        event === 'data' || event === 'end' ? restored.on(event, listener) : on(event, listener) },
      body: { get() { accessorReads++; return JSON.parse(bytes.toString('utf8')) } },
    })
    restored.end(bytes)
  })
  assert.equal(accessorReads, 0)
  assert.equal(providerCalls, 1)
})
