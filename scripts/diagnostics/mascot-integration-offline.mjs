import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { advance } from '../../src/game/engine.ts'
import { serializeLog } from '../../src/game/log.ts'
import { createMultiCourseGame } from '../../src/game/new-game.ts'
import { GAME_SAVE_KEY, restoreSavedGame, saveGameLocally } from '../../src/game/saved-game.ts'
import { projectLearningContext } from '../../mobile_app/src/game/mascot-learning-context.ts'
import { LEARNING_ENDPOINT } from '../../src/ai/mascot/learning.ts'
import { replayGameLog } from './replay-game-log.ts'
import { startMascotDev } from '../mascot-dev.ts'

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const port = 5299
const origin = 'http://127.0.0.1:' + port
const flags = '?universalAi=1&mascotLearning=1&VITE_MASCOT_LEARNING_ENABLED=1'
const initial = advance(createMultiCourseGame('b18-mascot-integration-resume', 30_000_000, 1))
let packed
assert(saveGameLocally(initial, { setItem(_key, value) { packed = value } }))
const server = await startMascotDev(port, null, 'node_modules/.vite-mascot-integration-offline')
const entry = page => page.getByRole('button', { name: 'Cáo EXE', exact: true })
const panel = page => page.getByRole('region', { name: 'Cáo EXE', exact: true })

async function open(page) {
  await entry(page).waitFor()
  assert.equal(await entry(page).count(), 1)
  assert.equal(await page.getByRole('button', { name: 'Hỏi Cáo', exact: true }).count(), 0)
  await entry(page).click()
}
async function ask(page, text, expected, source = 'Dữ kiện EXE') {
  const input = panel(page).getByRole('textbox')
  assert.equal(await input.count(), 1)
  await input.fill(text)
  await input.press('Enter')
  await panel(page).getByText(expected).waitFor()
  assert.equal(await panel(page).locator('.mascot-learning-answer .mascot-explanation-source').innerText(), source)
}
async function resumeBoard(page) {
  await page.goto(origin + '/' + flags)
  await page.getByRole('button', { name: 'Bắt đầu phiêu lưu' }).click()
  await page.getByTestId('map-node-1.1').click()
  await page.locator('.mascot-board').waitFor()
}

let browser
try {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true })
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 }, reducedMotion: 'reduce' })
    const calls = []
    const errors = []
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.origin !== origin) {
        // Existing font stylesheets are external. Block them without treating them as AI traffic.
        if (url.hostname !== 'fonts.googleapis.com' || route.request().resourceType() !== 'stylesheet') calls.push(url.origin)
        return route.abort()
      }
      if (url.pathname.startsWith('/api/')) {
        calls.push(url.pathname)
        return route.abort()
      }
      return route.continue()
    })
    await context.addInitScript(({ key, save }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, save)
      localStorage.setItem('xvtl:mobile:tutorial:v1', 'seen')
    }, { key: GAME_SAVE_KEY, save: packed })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await resumeBoard(page)
    const readSave = () => page.evaluate(key => localStorage.getItem(key), GAME_SAVE_KEY)
    const before = await readSave()
    const beforeGame = restoreSavedGame(before)
    const beforeReplay = serializeLog(beforeGame)
    assert.deepEqual(replayGameLog(JSON.parse(beforeReplay)).portfolio, beforeGame.portfolio)
    await open(page)
    await ask(page, 'Nhịp tăng trưởng là gì?', /Tiêu dùng khởi sắc/)
    await ask(page, 'Rủi ro thanh khoản khác rủi ro thị trường thế nào?', /Rủi ro thanh khoản.*Rủi ro thị trường/)
    await ask(page, 'Nếu giữ thêm tiền mặt thì kết quả tốt hơn không?', /chi trả ngay.*cơ hội.*chưa có mô phỏng/)
    await ask(page, 'Lãi suất tăng có luôn làm cổ phiếu giảm không?', /Không phải lúc nào.*chi phí vay/i)
    await ask(page, 'Đối chiếu nhật ký: Đa dạng hóa rồi tại sao vẫn thua?', /Đa dạng hóa giúp giảm rủi ro tập trung/)
    await panel(page).getByText(/chưa có kết quả cuối ván/).waitFor()
    await ask(page, 'Thời tiết ngày mai thế nào?', /Bạn có thể hỏi rõ về một giao dịch/, 'Chưa đủ dữ kiện')
    assert.equal(await panel(page).getByRole('alert').count(), 0)
    await entry(page).click()
    await page.getByRole('button', { name: 'Sổ Tay', exact: true }).click()
    await page.getByRole('tablist', { name: 'Các chương luật chơi' }).waitFor()
    assert.equal(await entry(page).count(), 0)
    await page.getByRole('button', { name: 'Đóng', exact: true }).click()
    await entry(page).waitFor()
    const after = await readSave()
    assert.equal(after, before)
    assert.equal(serializeLog(restoreSavedGame(after)), beforeReplay)
    await resumeBoard(page)
    assert.equal(serializeLog(restoreSavedGame(await readSave())), beforeReplay)
    await open(page)
    assert.equal(await panel(page).locator('.mascot-learning-answer').count(), 0)

    await page.goto(origin + '/' + flags + '&mascotDemo=finished')
    const result = page.locator('.game-result-container')
    await result.waitFor()
    const official = () => result.evaluate(el => {
      const copy = el.cloneNode(true)
      copy.querySelector('.mascot-summary')?.remove()
      return copy.textContent
    })
    const finalBefore = await official()
    await open(page)
    await ask(page, 'Đa dạng hóa rồi tại sao vẫn thua?', /Đa dạng hóa giúp giảm rủi ro tập trung/)
    await panel(page).getByText(/79\.000\.000 ₫.*90\.000\.000 ₫.*11\.000\.000 ₫/).waitFor()
    await panel(page).getByText(/chưa đủ dữ kiện.*phân bổ|chưa đủ dữ kiện về cách phân bổ/).waitFor()
    assert.equal(await official(), finalBefore)
    assert.equal(await readSave(), after)
    const review = page.getByRole('button', { name: /Xem Bàn Cờ/ })
    await review.waitFor()
    assert(await review.evaluate(el => {
      const b = el.getBoundingClientRect()
      return b.height >= 32 && b.bottom <= innerHeight
    }))
    await entry(page).click()
    assert.equal(await official(), finalBefore)
    assert.deepEqual(calls, [])
    assert.deepEqual(errors, [])
    console.log('PASS default offline, query ignored, real board, Guide, save/replay/continue and final result at ' + width + 'px')
    await context.close()
  }
  const reply = await fetch(origin + LEARNING_ENDPOINT, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json', 'x-mascot-learning': '1', 'x-mascot-session': '123e4567-e89b-42d3-a456-426614174001' },
    body: JSON.stringify({ question: 'Thời tiết ngày mai thế nào?', context: projectLearningContext(initial) }),
  })
  assert.equal(reply.status, 503)
  assert.deepEqual(await reply.json(), { error: 'UNAVAILABLE' })
  console.log('PASS default-off local endpoint fails closed')
} finally {
  await browser?.close()
  await server.close()
}
