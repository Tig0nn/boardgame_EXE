import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { advance, transact } from '../../src/game/engine.ts'
import { GAME_SAVE_KEY, restoreSavedGame, saveGameLocally } from '../../src/game/saved-game.ts'
import { startMascotDev } from '../mascot-dev.ts'
import { MASCOT_EXPLANATION_ENDPOINT } from '../../src/ai/mascot/contracts.ts'
import { LEARNING_ENDPOINT } from '../../src/ai/mascot/learning.ts'
import { mockLearningProvider } from '../../src/ai/mascot/learning-server.ts'
import { WHAT_IF_ENDPOINT } from '../../src/ai/what-if/contracts.ts'

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const server = await startMascotDev(5298, undefined, 'node_modules/.vite-mascot-browser', { learningProvider: mockLearningProvider })
const origin = 'http://127.0.0.1:5298'
const mascot = page => page.getByLabel('Cáo EXE, bạn đồng hành tài chính')
const trigger = page => mascot(page).getByRole('button', { name: 'Cáo EXE', exact: true })
const bubble = page => mascot(page).locator('.mascot-bubble')
const reason = page => mascot(page).getByRole('button', { name: 'Vì sao?' })
const panel = page => mascot(page).getByRole('region', { name: 'Cáo EXE', exact: true })
const question = page => panel(page).getByRole('textbox')
const submit = async (page, text) => {
  await question(page).fill(text)
  await question(page).press('Enter')
}
const qualityQuestions = {
  K1: 'Rủi ro thanh khoản khác rủi ro thị trường như thế nào? Cho tôi một ví dụ dễ hiểu.',
  K2: 'Tôi đã đa dạng hóa tài sản rồi, tại sao vẫn không đạt mục tiêu? Đa dạng hóa có phải lúc nào cũng tốt không?',
  K3: 'Lãi suất tăng có luôn làm cổ phiếu giảm không? Điều đó có đúng trong EXE không?',
  Q1: 'Tôi dự đoán đúng giá vàng nhưng vẫn thua, quyết định nào của tôi ảnh hưởng nhiều nhất?',
  Q2: 'Nếu tôi giữ nhiều tiền mặt hơn thì kết quả có tốt hơn không?',
  Q3: 'Tại sao hai người có tài sản tương đương nhưng khả năng đạt mục tiêu lại khác nhau?',
  A: 'Nhịp tăng trưởng là gì? Giải thích đơn giản giúp tôi.',
  B: 'Tại sao dùng hết tiền mặt mua vàng lại có thể khiến tôi gặp khó khăn trong ván?',
  C: 'Tại sao cuối ván tôi có 79 triệu mà vẫn không đạt mục tiêu? Tôi nên rút ra bài học gì?',
  D: 'Tôi nghĩ giá vàng sẽ tăng, tại sao cuối cùng tôi vẫn không đạt mục tiêu?',
}
async function checkQualityAnswer(page, id, expected) {
  const start = performance.now()
  await submit(page, qualityQuestions[id])
  await panel(page).getByText(expected).waitFor()
  const response = panel(page).locator('.mascot-learning-answer')
  assert.equal(await response.locator('.mascot-explanation-source').innerText(), 'Dữ kiện EXE')
  const durationMs = Math.round(performance.now() - start)
  const width = page.viewportSize().width
  console.log(JSON.stringify({ qualityCase: id, width, durationMs, ...(width === 390 ? { answer: await response.innerText() } : {}) }))
}

const artifacts = process.env.MASCOT_QA_ARTIFACTS
if (artifacts) mkdirSync(artifacts, { recursive: true })

async function openBoardNote(page, id) {
  await bubble(page).and(page.locator(`[data-signal="${id}"]`)).waitFor({ state: 'attached' })
  assert.equal(await bubble(page).isVisible(), false)
  assert.equal(await page.locator('.mascot-board').count(), 1)
  await trigger(page).click()
}

async function assertSingleEntry(page) {
  await trigger(page).waitFor()
  assert.equal(await trigger(page).count(), 1)
  assert.equal(await mascot(page).locator(':scope > button:visible').count(), 1)
  assert.equal(await mascot(page).getByRole('button', { name: 'Hỏi Cáo', exact: true }).count(), 0)
}

async function assertBubbleActions(page) {
  await assertSingleEntry(page)
  assert.deepEqual(await panel(page).getByRole('button').allTextContents(), ['Vì sao?', 'Gửi'])
  assert.equal(await question(page).getAttribute('placeholder'), 'Hỏi về luật EXE, ván chơi hoặc kết quả cuối ván')
}

async function expectSignal(page, id, surface = 'board') {
  if (surface === 'board') await openBoardNote(page, id)
  else assert.equal(await page.locator('.mascot-summary').count(), 1)
  await mascot(page).locator(`.mascot-bubble[data-signal="${id}"]:visible`).waitFor()
  assert.equal(await mascot(page).count(), 1)
  await assertBubbleActions(page)
  await reason(page).click()
  await mascot(page).getByText('Giải thích từ dữ kiện ván', { exact: true }).waitFor()
  const explanation = mascot(page).getByLabel('Giải thích tín hiệu')
  assert.match(await explanation.locator('dl').innerText(), /[\d.]+ ₫/)
  assert.doesNotMatch(await explanation.locator('.mascot-reason').innerText(), /[\d.]+ ₫/)
  return explanation
}

function pack(game) {
  let value
  assert(saveGameLocally(game, { setItem(_key, saved) { value = saved } }))
  return value
}

async function buyGold(page, amount) {
  await page.locator('#trade-amount').fill(String(amount))
  await page.getByRole('button', { name: /^Mua [\d.]+ ₫/ }).click()
}

let browser
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true })
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 }, reducedMotion: 'reduce' })
    const errors = []
    const apiCalls = []
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.pathname.startsWith('/api/')) apiCalls.push(url.pathname)
      return url.origin === origin ? route.continue() : route.abort()
    })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => {
      localStorage.setItem('xvtl:mobile:game:v1', 'OWNER-SAVE-SENTINEL')
    })
    try {
      await page.goto(origin + '/?mascotDemo=routine&universalAi=1')
      await page.locator('#trade-amount').waitFor()
      assert.equal(await mascot(page).count(), 0)
      assert.equal(await page.getByRole('tab', { name: /Hỏi AI/ }).count(), 0)
      await buyGold(page, 6_000_000)
      assert.deepEqual(apiCalls, [])
      const routine = await expectSignal(page, 'trade-off')
      assert.match(await routine.locator('dl').innerText(), /20\.000\.000 ₫[\s\S]*14\.000\.000 ₫/)
      assert.match(await routine.locator('.mascot-reason').innerText(), /chưa có căn cứ kết luận bạn thiếu tiền/)
      const layout = await bubble(page).evaluate(element => {
        const box = element.getBoundingClientRect()
        const roll = document.querySelector('button[aria-label="Lắc Xúc Xắc"]').getBoundingClientRect()
        return { fits: box.left >= 0 && box.right <= innerWidth && box.top >= 0,
          aboveRoll: box.bottom <= roll.top, noOverflow: document.documentElement.scrollWidth <= innerWidth }
      })
      assert.deepEqual(layout, { fits: true, aboveRoll: true, noOverflow: true })
      await page.keyboard.press('Escape')
      assert.equal(await bubble(page).isVisible(), false)
      assert(await trigger(page).evaluate(el => document.activeElement === el))
      await page.keyboard.press('Enter')
      assert(await bubble(page).isVisible())
      assert.match(await bubble(page).getByRole('status').innerText(), /Đã mua tài sản/)
      await trigger(page).click()
      assert.equal(await bubble(page).isVisible(), false)
      await expectSignal(page, 'trade-off')
      await page.getByRole('button', { name: 'Túi Đồ' }).click()
      assert.equal(await mascot(page).count(), 0)
      assert.equal(await page.evaluate(() => localStorage.getItem('xvtl:mobile:game:v1')), 'OWNER-SAVE-SENTINEL')
      assert.deepEqual(errors, [])
      assert.deepEqual(apiCalls, [])
      await page.goto(origin + '/?mascotDemo=routine')
      await page.locator('#trade-amount').waitFor()
      assert.equal(await mascot(page).count(), 0)
      await buyGold(page, 20_000_000)
      await page.locator('.mascot-board .mascot-bubble[data-signal="cash-exhaustion"]:visible').waitFor()
      assert.equal(await mascot(page).count(), 1)
      assert.equal(await page.locator('#trade-amount').count(), 0)
      assert.match(await bubble(page).getByRole('status').innerText(), /hết tiền mặt để mua vàng/)
      await assertBubbleActions(page)
      await reason(page).click()
      await mascot(page).getByText('Giải thích từ dữ kiện ván', { exact: true }).waitFor()
      const facts = await mascot(page).locator('dl').innerText()
      assert.match(facts, /Tiền mặt trước giao dịch\s*20\.000\.000 ₫/)
      assert.match(facts, /Tiền mặt còn lại\s*0 ₫/)
      assert.match(facts, /Khoản phải trả đã ghi nhận\s*0 ₫/)
      assert.deepEqual(apiCalls, [])
      await reason(page).click()
      await question(page).focus()
      assert.deepEqual(apiCalls, [])
      assert(await question(page).evaluate(el => el === document.activeElement))
      await question(page).press('Enter')
      await panel(page).getByRole('alert').getByText(/Nhập câu hỏi/).waitFor()
      await submit(page, 'Nhịp tăng trưởng là gì?')
      await panel(page).getByText(/Tiêu dùng khởi sắc/).waitFor()
      await checkQualityAnswer(page, 'A', /Tiêu dùng khởi sắc/)
      await checkQualityAnswer(page, 'B', /Giữ vàng vẫn là giữ tài sản.*phí.*spread/)
      const goldAnswer = await panel(page).locator('.mascot-learning-answer').innerText()
      assert.equal(goldAnswer.match(/Nghĩa vụ/gu)?.length, 1)
      assert.match(goldAnswer, /toàn bộ 20\.000\.000 ₫.*0 ₫/)
      assert.deepEqual(apiCalls, [])
      await submit(page, 'Tôi không hỏi dự đoán, tiền mặt hiện thế nào?')
      await panel(page).getByText('Gemini giả lập', { exact: true }).waitFor()
      assert.deepEqual(apiCalls, [LEARNING_ENDPOINT])
      const cash = page.locator('[title^="Tiền mặt hiện có:"]')
      assert.match(await cash.getAttribute('title'), /:\s*0\s*₫$/)
      assert.equal(await page.getByRole('button', { name: /^Ô \d+:/ }).count(), 18)
      assert.equal(await page.evaluate(key => localStorage.getItem(key), GAME_SAVE_KEY), 'OWNER-SAVE-SENTINEL')
      assert(await panel(page).evaluate(el => {
        const box = el.getBoundingClientRect()
        return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && document.documentElement.scrollWidth <= innerWidth
      }))
      if (artifacts) await page.screenshot({ path: artifacts + '/mascot-learning-' + width + '.png' })
      await question(page).press('Escape')
      assert.equal(await panel(page).count(), 0)
      assert(await trigger(page).evaluate(el => el === document.activeElement))
      await page.evaluate(() => localStorage.setItem('xvtl:mobile:mascot-muted:v1', '1'))
      await page.reload()
      await page.locator('#trade-amount').waitFor()
      assert.equal(await mascot(page).count(), 0)
      await buyGold(page, 20_000_000)
      await page.locator('.mascot-board .mascot-bubble[data-signal="cash-exhaustion"]:visible').waitFor()
      assert.equal(await trigger(page).innerText(), 'Cáo EXE')
      await assertBubbleActions(page)
      await page.getByRole('button', { name: 'Tắt âm thanh', exact: true }).click()
      await page.getByRole('button', { name: 'Bật âm thanh', exact: true }).waitFor()
      assert(await bubble(page).isVisible())
      await page.getByRole('button', { name: 'Bật âm thanh', exact: true }).click()
      await page.getByRole('button', { name: 'Tắt âm thanh', exact: true }).waitFor()
      await trigger(page).click()
      assert.equal(await bubble(page).isVisible(), false)
      assert.equal(await page.evaluate(() => localStorage.getItem('xvtl:mobile:mascot-muted:v1')), '1')
      await page.goto(origin + '/?mascotDemo=finished')
      await assertSingleEntry(page)
      assert.equal(await trigger(page).innerText(), 'Cáo EXE')
      await trigger(page).press('Enter')
      await page.keyboard.press('Tab')
      assert(await question(page).evaluate(el => el === document.activeElement))
      assert.deepEqual(apiCalls, [LEARNING_ENDPOINT])
      await checkQualityAnswer(page, 'C', /79\.000\.000 ₫.*90\.000\.000 ₫.*11\.000\.000 ₫.*Tài sản ròng.*hoàn thành đủ 4 vòng/)
      assert.deepEqual(apiCalls, [LEARNING_ENDPOINT])
      assert(await panel(page).evaluate(el => {
        const box = el.getBoundingClientRect()
        return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight
      }))
      assert(await panel(page).getByText(/Nguồn huy động hợp lệ.*mốc mục tiêu/).evaluate(el => {
        const answer = el.getBoundingClientRect()
        const body = el.closest('.mascot-summary').parentElement.getBoundingClientRect()
        return answer.top >= body.top && answer.top + 16 <= body.bottom
      }))
      const reviewBoard = page.getByRole('button', { name: /Xem Bàn Cờ/ })
      assert(await reviewBoard.evaluate(el => {
        const button = el.getBoundingClientRect()
        const modal = el.closest('.game-result-container').getBoundingClientRect()
        return button.height >= 32 && button.bottom <= innerHeight && button.bottom <= modal.bottom
      }))
      if (artifacts) await page.screenshot({ path: artifacts + '/mascot-final-' + width + '.png' })
      await checkQualityAnswer(page, 'D', /79\.000\.000 ₫.*11\.000\.000 ₫.*dự đoán đúng/)
      await panel(page).getByText(/không ghi dự đoán cá nhân/).waitFor()
      assert.deepEqual(apiCalls, [LEARNING_ENDPOINT])
      await checkQualityAnswer(page, 'Q1', /79\.000\.000 ₫.*90\.000\.000 ₫.*11\.000\.000 ₫.*hoàn thành đủ 4 vòng/)
      await panel(page).getByText(/không ghi dự đoán cá nhân/).waitFor()
      await panel(page).getByText(/chưa đủ căn cứ.*quyết định nào ảnh hưởng lớn nhất/).waitFor()
      await checkQualityAnswer(page, 'Q2', /chi trả ngay.*cơ hội.*chưa có mô phỏng/)
      await panel(page).getByText(/Kết quả thực tế.*79\.000\.000 ₫/).waitFor()
      await checkQualityAnswer(page, 'Q3', /nguồn huy động hợp lệ.*Ví dụ giả định.*vốn kinh doanh chưa bán/i)
      assert.doesNotMatch(await panel(page).locator('.mascot-learning-answer').innerText(), /79\.000\.000|90\.000\.000/)
      assert.deepEqual(apiCalls, [LEARNING_ENDPOINT])
      await checkQualityAnswer(page, 'K1', /Rủi ro thanh khoản.*đúng lúc.*Rủi ro thị trường.*giá/)
      await panel(page).getByText(/Ví dụ trong EXE.*giá vàng giảm/).waitFor()
      await checkQualityAnswer(page, 'K2', /Đa dạng hóa giúp giảm rủi ro tập trung.*không bảo đảm/)
      await panel(page).getByText(/79\.000\.000 ₫.*90\.000\.000 ₫.*11\.000\.000 ₫/).waitFor()
      await panel(page).getByText(/chưa đủ dữ kiện.*mức nào/).waitFor()
      assert.equal((await panel(page).locator('.mascot-learning-answer').innerText()).match(/79\.000\.000/gu)?.length, 1)
      await checkQualityAnswer(page, 'K3', /Không phải lúc nào.*chi phí vay/i)
      await panel(page).getByText(/Trong EXE, giá cổ phiếu.*bối cảnh.*ngành.*từng mã.*Cú sốc/).waitFor()
      assert.deepEqual(apiCalls, [LEARNING_ENDPOINT])
      assert.equal(await page.evaluate(key => localStorage.getItem(key), GAME_SAVE_KEY), 'OWNER-SAVE-SENTINEL')
      assert.deepEqual(errors, [])
      console.log(`PASS one entry, offline Why, board and final Q&A, keyboard, cash exhaustion, legacy preference and audio controls at ${width}px`)
    } catch (error) {
      if (errors.length) console.error('Page errors:', errors)
      throw error
    } finally {
      await context.close()
    }
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
  await page.goto(origin + '/?mascotDemo=bank')
  await page.getByLabel('Số tiền gửi', { exact: true }).fill('3000000')
  assert.equal(await mascot(page).count(), 0)
  await page.getByRole('button', { name: /^Gửi tiết kiệm [\d.]+ ₫/ }).click()
  const deposit = await expectSignal(page, 'trade-off')
  assert.match(await deposit.locator('.mascot-reason').innerText(), /rút toàn bộ.*mất phần lãi/)
  assert.match(await deposit.locator('dl').innerText(), /3\.000\.000 ₫/)
  await page.goto(origin + '/?mascotDemo=concentration')
  await buyGold(page, 44_000_000)
  const concentration = await expectSignal(page, 'concentration')
  assert.match(await concentration.locator('dl').innerText(), /3\.500\.000 ₫/)
  await page.goto(origin + '/?mascotDemo=concentration')
  await buyGold(page, 48_000_000)
  await expectSignal(page, 'liquidity')
  assert.match(await bubble(page).getByRole('status').first().innerText(), /thiếu 1\.500\.000 ₫/)
  await page.goto(origin + '/?mascotDemo=liquidity')
  await page.getByRole('button', { name: /^Sửa ngay/ }).click()
  await page.getByRole('button', { name: /Dùng nguồn tiền này/ }).waitFor()
  assert.equal(await mascot(page).count(), 0)
  await page.getByRole('button', { name: /Rút tiết kiệm/ }).click()
  await page.getByRole('button', { name: /Dùng nguồn tiền này/ }).click()
  await openBoardNote(page, 'liquidity')
  await mascot(page).getByText('Ghi nhận trước đó trong ván').waitFor()
  await reason(page).click()
  await mascot(page).getByText('Dữ kiện tại thời điểm ghi nhận').waitFor()
  await page.goto(origin + '/?mascotDemo=debt')
  await page.getByRole('button', { name: /Vay nợ/ }).click()
  assert.equal(await mascot(page).count(), 0)
  await page.getByRole('button', { name: /Dùng nguồn tiền này/ }).click()
  await expectSignal(page, 'debt')
  await page.goto(origin + '/?mascotDemo=progress')
  await page.getByRole('button', { name: 'Lắc Xúc Xắc' }).press('Enter')
  await page.getByRole('heading', { name: /Khép lại vòng/ }).waitFor()
  await expectSignal(page, 'progress', 'summary')
  await trigger(page).click()
  assert.equal(await bubble(page).isVisible(), false)
  await trigger(page).click()
  assert.equal(await bubble(page).getAttribute('data-signal'), 'progress')
  await assertBubbleActions(page)
  await page.keyboard.press('Escape')
  assert.equal(await bubble(page).isVisible(), false)
  await page.getByRole('button', { name: /Ghé ví tại ô Xuất phát/ }).click()
  assert.equal(await mascot(page).count(), 0)
  await page.goto(origin + '/?mascotDemo=gold')
  await buyGold(page, 2_000_000)
  const routePattern = '**' + LEARNING_ENDPOINT
  let calls = 0
  let release
  const held = new Promise(resolve => { release = resolve })
  const deferResponse = async route => {
    calls++
    await held
    await route.fulfill({ json: { source: 'mock', ids: ['cash'] } }).catch(() => {})
  }
  await page.route(routePattern, deferResponse)
  await trigger(page).click()
  await submit(page, 'Tóm tắt tiền mặt hiện tại')
  await panel(page).getByText('Đang tìm dữ kiện…', { exact: true }).waitFor()
  await submit(page, 'Nhịp tăng trưởng là gì?')
  await panel(page).getByText(/Tiêu dùng khởi sắc/).waitFor()
  release()
  await page.unroute(routePattern, deferResponse)
  assert.equal(calls, 1)
  assert.equal(await panel(page).getByText('Gemini giả lập', { exact: true }).count(), 0)
  for (const status of [429, 503, 504]) {
    const offline = route => route.fulfill({ status, json: { error: 'UNAVAILABLE' } })
    await page.route(routePattern, offline)
    await submit(page, 'Câu hỏi ngoài phạm vi EXE số ' + status)
    await panel(page).getByText('Chưa đủ dữ kiện', { exact: true }).waitFor()
    await panel(page).getByRole('alert').waitFor()
    await page.unroute(routePattern, offline)
  }
  let releaseNavigation
  const holdNavigation = new Promise(resolve => { releaseNavigation = resolve })
  const late = async route => {
    await holdNavigation
    await route.fulfill({ json: { source: 'mock', ids: ['cash'] } }).catch(() => {})
  }
  await page.route(routePattern, late, { times: 1 })
  await submit(page, 'Tiền mặt hiện thế nào?')
  await panel(page).getByText('Đang tìm dữ kiện…', { exact: true }).waitFor()
  await question(page).press('Escape')
  assert.equal(await panel(page).count(), 0)
  await page.goto(origin + '/?mascotDemo=finished')
  releaseNavigation()
  await trigger(page).click()
  assert.equal(await panel(page).getByText('Gemini giả lập', { exact: true }).count(), 0)
  let outageCalls = 0
  const outage = route => { outageCalls++; return route.fulfill({ status: 503, json: { error: 'UNAVAILABLE' } }) }
  await page.route(routePattern, outage)
  await checkQualityAnswer(page, 'C', /79\.000\.000 ₫.*11\.000\.000 ₫/)
  assert.equal(outageCalls, 0)
  await submit(page, 'Đối chiếu các quyết định và kết quả cuối ván với mục tiêu để tìm thông tin liên quan.')
  await panel(page).getByRole('alert').waitFor()
  await panel(page).getByText(/79\.000\.000 ₫.*11\.000\.000 ₫/).waitFor()
  await panel(page).getByText('Dữ kiện EXE', { exact: true }).waitFor()
  assert.equal(outageCalls, 1)
  await page.unroute(routePattern, outage)
  const compareWithJournal = 'Đối chiếu nhật ký với luật EXE: ' + qualityQuestions.Q3
  for (const error of [{ status: 503, code: 'UNAVAILABLE' }, { status: 504, code: 'TIMEOUT' },
    { status: 503, code: 'OUTPUT_REJECTED' }]) {
    const callsBefore = outageCalls
    const reject = route => {
      outageCalls++
      return route.fulfill({ status: error.status, json: { error: error.code } })
    }
    await page.route(routePattern, reject)
    await checkQualityAnswer(page, 'Q3', /Ví dụ giả định/)
    assert.equal(outageCalls, callsBefore)
    await submit(page, compareWithJournal)
    await panel(page).getByRole('alert').waitFor()
    const rule = panel(page).getByText(/nguồn huy động hợp lệ.*Ví dụ giả định/i)
    await rule.waitFor()
    assert.doesNotMatch(await rule.innerText(), /79\.000\.000|90\.000\.000/)
    assert.equal(outageCalls, callsBefore + 1)
    await page.unroute(routePattern, reject)
    console.log('PASS verified comparison fallback after ' + error.code)
    await page.route(routePattern, reject)
    await submit(page, 'Đối chiếu nhật ký: ' + qualityQuestions.K2)
    await panel(page).getByText(/Đa dạng hóa giúp giảm rủi ro tập trung/).waitFor()
    await panel(page).getByText(/79\.000\.000 ₫.*11\.000\.000 ₫/).waitFor()
    assert.equal(outageCalls, callsBefore + 2)
    await page.unroute(routePattern, reject)
    console.log('PASS knowledge and canonical result after ' + error.code)
  }
  if (artifacts) await page.screenshot({ path: artifacts + '/mascot-learning-finished.png' })
  await submit(page, 'Tôi nghĩ vàng sẽ tăng, vì sao kết quả lại khác?')
  await panel(page).getByText(/không ghi dự đoán cá nhân/).waitFor()
  await page.goto(origin + '/?whatIfDemo=repair&universalAi=1')
  assert.equal(await page.getByRole('tab', { name: /Hỏi AI/ }).count(), 0)
  await page.getByRole('button', { name: /^Sửa ngay/ }).waitFor()
  assert.equal(await mascot(page).count(), 0)
  await page.getByRole('button', { name: /^Sửa ngay/ }).click()
  await page.getByRole('button', { name: 'Xem phương án khác' }).click()
  await page.getByRole('dialog', { name: 'Nếu tôi chọn cách khác?' }).waitFor()
  const isolation = await page.evaluate(async ({ mascotPath, whatIfPath }) => {
    const post = (url, header, body) => fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', [header]: '1',
        'x-mascot-profile': 'core-mvp-b18-multi-course-v1', 'x-mascot-session': '123e4567-e89b-42d3-a456-426614174000' },
      body: JSON.stringify(body),
    })
    const whatIf = { operation: 'explain', facts: { kind: 'gold', direction: 'up', confirmedFollowUp: false } }
    const mascot = { version: 1, topic: 'debt', facts: { debt: 3_500_000, cash: 0 } }
    const actual = await post(whatIfPath, 'X-What-If-Request', whatIf)
    return {
      status: actual.status, result: await actual.json(),
      mascotRejectsWhatIf: (await post(mascotPath, 'X-Mascot-Request', whatIf)).status,
      whatIfRejectsMascot: (await post(whatIfPath, 'X-What-If-Request', mascot)).status,
    }
  }, { mascotPath: MASCOT_EXPLANATION_ENDPOINT, whatIfPath: WHAT_IF_ENDPOINT })
  assert.equal(isolation.status, 200)
  assert.deepEqual(Object.keys(isolation.result), ['claimId'])
  assert.equal(isolation.mascotRejectsWhatIf, 400)
  assert.equal(isolation.whatIfRejectsMascot, 400)
  console.log('PASS decision screens omit Mascot, funding deferral, board review, round summary, offline fallback and What-if isolation')
  await page.close()

  // Optional external QA checkpoint from the pinned Rebalance hotfix.
  const rebalanceFixture = process.argv[2]
  if (rebalanceFixture) {
    const checkpoint = restoreSavedGame(gunzipSync(readFileSync(rebalanceFixture)).toString('utf8'))
    const game = checkpoint.phase === 'summary' ? advance(checkpoint) : checkpoint
    assert.equal(game.phase, 'rebalancing')
    const packed = pack(game)
    const holdings = game.portfolio.stocks
    assert(holdings > 2_000_000 && holdings % 1_000 !== 0)
    const presets = [
      ['25%', Math.floor(holdings / 4_000) * 1_000],
      ['50%', Math.floor(holdings / 2_000) * 1_000],
      ['Tất cả', holdings],
    ]
    for (const width of [320, 390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 844 } })
      try {
        await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
        await context.addInitScript(({ key, save }) => {
          if (!localStorage.getItem(key)) localStorage.setItem(key, save)
          localStorage.setItem('xvtl:mobile:tutorial:v1', 'seen')
        }, { key: GAME_SAVE_KEY, save: packed })
        const app = await context.newPage()
        await app.goto(origin + '/?universalAi=1')
        await app.getByRole('button', { name: 'Bắt đầu phiêu lưu' }).click()
        await app.getByTestId('map-node-1.1').click()
        await app.getByRole('heading', { name: 'Ghé ví tại ô Xuất phát' }).waitFor()
        assert.equal(await mascot(app).count(), 0)
        const before = await app.evaluate(key => localStorage.getItem(key), GAME_SAVE_KEY)
        const input = app.getByRole('spinbutton')
        for (const [name, amount] of presets) {
          const preset = app.getByRole('button', { name, exact: true })
          await preset.click()
          assert.equal(Number(await input.inputValue()), amount)
          assert.equal(await preset.getAttribute('aria-pressed'), 'true')
        }
        assert.equal(await app.evaluate(key => localStorage.getItem(key), GAME_SAVE_KEY), before)
        const amount = 1_234_567
        await input.fill(String(amount))
        await app.getByRole('button', { name: /Xác nhận bán/ }).click()
        assert.equal(await mascot(app).count(), 0)
        const actual = await app.waitForFunction(({ key, old }) => {
          const saved = localStorage.getItem(key)
          return saved !== old && saved
        }, { key: GAME_SAVE_KEY, old: before }).then(result => result.jsonValue())
        const expected = pack(transact(game, { kind: 'sell', asset: 'stocks', amount }))
        assert.deepEqual(restoreSavedGame(actual), restoreSavedGame(expected))
        await app.reload()
        await app.getByRole('button', { name: 'Bắt đầu phiêu lưu' }).click()
        await app.getByTestId('map-node-1.1').click()
        await app.getByRole('heading', { name: 'Ghé ví tại ô Xuất phát' }).waitFor()
        assert.equal(await mascot(app).count(), 0)
        console.log(`PASS official Rebalance presets, sale, and reload at ${width}px`)
      } finally {
        await context.close()
      }
    }
  }
} finally {
  await browser?.close()
  await server.close()
}
