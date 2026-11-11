import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { startWhatIfDev } from '../what-if-ai-dev.ts'
import { advance } from '../../src/game/engine.ts'
import { createMultiCourseGame } from '../../src/game/new-game.ts'
import { GAME_SAVE_KEY, saveGameLocally } from '../../src/game/saved-game.ts'
import { equalData, parseHistory } from '../../mobile_app/src/game/endgame-whatif-identity.ts'
import { alignActual, applyRecorded, commandsOf, replayHistory } from '../../mobile_app/src/game/endgame-whatif-replay.ts'
import { WorkBudget } from '../../mobile_app/src/game/endgame-whatif-contract.ts'

const { chromium } = createRequire(import.meta.url)(resolve('node_modules/.tmp/whatif-v3-qa/node_modules/playwright'))
const baseline = resolve('docs/playtests/whatif-endgame/2026-11-10/eg3-ai-05-01')
const fixtures = JSON.parse(readFileSync(resolve(baseline, 'fixtures.json'), 'utf8'))
const hash = text => createHash('sha256').update(text).digest('hex')
const cases = [
  { name: 'gold', question: 'Nếu lúc đó tôi không mua vàng tại quyết định 4 thì sao?', action: 'skip', originalAction: 'buy' },
  { name: 'bank', question: 'Gửi tiết kiệm 1 triệu kỳ hạn 3 START tại quyết định 36', action: 'deposit' },
  { name: 'course', question: 'Học khóa nâng cao tại quyết định 7', action: 'advanced' },
  { name: 'advanced', source: 'course', question: 'Nếu tôi chọn khóa nâng cao ở quyết định 7 thì sao?', action: 'advanced' },
  { name: 'stocks', question: 'Mua CMG với 1.234.567 VND tại quyết định 10', action: 'buy' },
  { name: 'bonds', question: 'Bán bond-2 với 750 nghìn tại quyết định 23', action: 'sell' },
  { name: 'business', question: 'Nâng cấp giá cả hợp lý tại quyết định 48', action: 'upgrade', preferenceId: 'budget' },
]

async function pack(name) {
  const text = gunzipSync(readFileSync(resolve(baseline, name + '.json.gz'))).toString()
  assert.equal(hash(text), fixtures[name].sourceHash)
  const history = parseHistory(text), work = new WorkBudget({ maxMilliseconds: 30_000 })
  const verified = await replayHistory(history, work)
  const initial = history.entries[0].after, deposit = initial.deposits[0]
  let state = createMultiCourseGame(history.seed, initial.portfolio.savings, deposit ? deposit.maturityLap - deposit.startLap + 1 : 1)
  for (const entry of commandsOf(history)) state = applyRecorded(alignActual(state, entry, work), entry, work)
  for (let i = 0; i < 4 && !['summary', 'rebalancing'].includes(state.phase); i++) state = advance(state)
  assert(['summary', 'rebalancing'].includes(state.phase) && state.lap === 4)
  assert(equalData(state.phase === 'summary' ? advance(advance(state)) : advance(state), verified.final))
  let packed
  assert(saveGameLocally(state, { setItem: (_, value) => { packed = value } }))
  return packed
}

const packed = new Map()
for (const { source, name } of cases) {
  const key = source ?? name
  if (!packed.has(key)) packed.set(key, await pack(key))
}

let scenario
const operations = [], pageErrors = [], external = []
let explainStarted, releaseExplain, explainAborted = false
const deferredExplain = new Promise(resolve => { releaseExplain = resolve })
const sawExplain = new Promise(resolve => { explainStarted = resolve })
function geminiReply(value) {
  return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] })
}
const transport = async (url, init) => {
  assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent')
  const body = JSON.parse(init.body), request = JSON.parse(body.contents[0].parts[0].text)
  const current = scenario, fixture = fixtures[current.source ?? current.name]
  const { operation: _, ...parameters } = fixture.selection.parameters ?? {}
  operations.push(request.operation)
  if (request.operation === 'interpret') {
    assert.deepEqual(request, { operation: 'interpret', question: current.question })
    if (current.failure) return new Response(null, { status: 429 })
    return geminiReply({ status: 'intent', intent: { kind: current.name, action: current.action,
      sequence: Number(fixture.selection.decisionId.split(':')[1]), ...parameters,
      ...(current.originalAction ? { originalAction: current.originalAction } : {}),
      ...(current.preferenceId ? { preferenceId: current.preferenceId } : {}) } })
  }
  if (request.operation === 'propose') {
    const decisionId = current.name + ':' + fixture.selection.decisionId.split(':')[1]
    const alternativeId = fixture.selection.alternativeId ?? 'skip'
    const verified = request.catalog.find(choice => choice.decisionId === decisionId && choice.alternativeId === alternativeId)
    assert(verified)
    assert.deepEqual(verified.parameters, fixture.selection.parameters)
    return geminiReply({ decisionId, alternativeId })
  }
  assert.equal(request.operation, 'explain')
  const direction = current.name === 'gold' || fixture.comparison.delta.cash > 0 ? 'up'
    : fixture.comparison.delta.cash < 0 ? 'down' : 'unchanged'
  assert.deepEqual(request.facts, { kind: current.name, direction, confirmedFollowUp: fixture.followUps.length > 0 })
  const result = { claimId: current.name + '-' + direction }
  if (current.delayed) {
    init.signal.addEventListener('abort', () => { explainAborted = true }, { once: true })
    explainStarted()
    await deferredExplain
  }
  return geminiReply(result)
}

const server = await startWhatIfDev(Number(process.argv[2] ?? 5228), {
  mode: 'gemini', gemini: { model: 'gemini-test-model', apiKey: 'synthetic-test-value',
    accessApproved: true, allowLiveTraffic: true, fetch: transport },
}, { maxCalls: 64, maxRequests: 64 })
const origin = 'http://127.0.0.1:' + server.httpServer.address().port
let browser
const byName = (page, name) => page.getByRole('button', { name, exact: true })
const dialog = page => page.getByRole('dialog', { name: 'Hỏi AI về lựa chọn khác', exact: true })
async function launch(page) {
  await byName(page, 'Hỏi AI về lựa chọn khác').click()
  await page.getByLabel('Nhóm quyết định').waitFor()
  await page.waitForFunction(() => !document.querySelector('dialog [aria-busy="true"]'))
}
async function open(entry) {
  scenario = entry
  operations.length = 0
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.addInitScript(({ save, key }) => {
    localStorage.setItem(key, save)
    localStorage.setItem('xvtl:mobile:tutorial:v1', 'seen')
    localStorage.setItem('xvtl:mobile:tutorial_disabled', 'true')
    const NativeWorker = window.Worker
    window.geminiWorkers = []
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options)
        this.record = { closed: false, comparisons: [], messages: [] }
        window.geminiWorkers.push(this.record)
        this.addEventListener('message', ({ data }) => {
          const comparison = data.result?.comparison ?? data.body
          if (comparison?.delta) this.record.comparisons.push({ delta: comparison.delta, proof: comparison.proof })
        })
      }
      postMessage(message, ...rest) {
        this.record.messages.push(message.kind)
        return super.postMessage(message, ...rest)
      }
      terminate() {
        this.record.closed = true
        return super.terminate()
      }
    }
  }, { save: packed.get(entry.source ?? entry.name), key: GAME_SAVE_KEY })
  const page = await context.newPage()
  page.setDefaultTimeout(30_000)
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin === origin && (!url.pathname.startsWith('/api') || url.pathname === '/api/what-if-provider')) return route.continue()
    if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' })
    external.push(url.origin + url.pathname)
    return route.abort()
  })
  await page.goto(origin + '/?endgameWhatIf=1&whatIfAi=1')
  await byName(page, 'Bắt đầu phiêu lưu').click()
  await page.getByTestId('map-node-1.1').click()
  for (let step = 0; step < 3 && !await page.getByRole('button', { name: /Thử Lại Ván Mới|Chơi Ván Mới/i }).count(); step++) {
    await page.getByRole('button', { name: /Xem kết quả hành trình/i }).click()
    await page.waitForTimeout(350)
  }
  await page.getByRole('button', { name: /Thử Lại Ván Mới|Chơi Ván Mới/i }).waitFor()
  const before = await page.evaluate(key => localStorage.getItem(key), GAME_SAVE_KEY)
  const official = await page.locator('.game-result-container').innerText()
  await launch(page)
  return { context, page, before, official }
}
async function ask(page, question) {
  await page.getByLabel('Câu hỏi What-if').fill(question)
  await byName(page, 'Phân tích câu hỏi').evaluate(button => { button.click(); button.click() })
}
async function finish(page, entry) {
  const fixture = fixtures[entry.source ?? entry.name]
  await page.getByRole('heading', { name: 'Đề xuất cần bạn xác nhận', exact: true }).waitFor()
  assert.equal(await dialog(page).locator('.endgame-what-if__metric').count(), 0)
  assert.equal(await page.evaluate(() => window.geminiWorkers.flatMap(worker => worker.comparisons).length), 0)
  assert(!operations.includes('explain'))
  await byName(page, 'Xác nhận và mô phỏng').click()
  for (let i = 0; i < fixture.followUps.length; i++) {
    await page.getByRole('heading', { name: 'Cần thêm lựa chọn', exact: true }).waitFor()
    assert.equal(await dialog(page).locator('.endgame-what-if__metric').count(), 0)
    assert(!operations.includes('explain'))
    await page.getByRole('button', { name: /Bỏ qua giao dịch sau|Bỏ qua lần học sau|Bỏ qua lần bán vàng sau đó/, exact: true }).click()
  }
  await page.getByRole('heading', { name: 'So sánh cuối ván', exact: true }).waitFor()
  assert.equal(await dialog(page).locator('.endgame-what-if__metric').count(), 3)
  const final = await page.evaluate(() => window.geminiWorkers.flatMap(worker => worker.comparisons).at(-1))
  assert(final?.proof.actualReplay && final.proof.alternativeReplay && final.proof.sourceUnchanged)
  for (const metric of ['cash', 'totalWorth', 'liquidatableFunds']) {
    assert.equal(final.delta[metric], entry.name === 'gold' ? 104006 : fixture.comparison.delta[metric])
  }
}
async function closeAndVerify({ page, before, official }) {
  if (await dialog(page).count()) await page.keyboard.press('Escape')
  await dialog(page).waitFor({ state: 'detached' })
  await page.waitForFunction(() => window.geminiWorkers.every(worker => worker.closed))
  assert.equal(await page.evaluate(key => localStorage.getItem(key), GAME_SAVE_KEY), before)
  assert.equal(await page.locator('.game-result-container').innerText(), official)
}
async function run(entry, work) {
  const session = await open(entry)
  try { await work(session); await closeAndVerify(session) }
  finally { await session.context.close() }
}
try {
  browser = await chromium.launch({ executablePath: process.env.WHAT_IF_TEST_CHROMIUM
    ?? 'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe', headless: true })
  for (const entry of cases) {
    await run(entry, async ({ page }) => {
      await ask(page, entry.question)
      await finish(page, entry)
      await dialog(page).locator('[data-explanation-source="gemini-claim"]').waitFor()
      assert.deepEqual(operations, ['interpret', 'propose', 'explain'])
    })
    console.log('PASS Gemini App ' + entry.name)
  }
  const fallback = { ...cases[0], failure: true }
  await run(fallback, async ({ page }) => {
    await ask(page, fallback.question)
    await page.getByRole('status').filter({ hasText: /Đã chạm giới hạn/ }).waitFor()
    await byName(page, 'Chọn phương án thủ công').click()
    const history = page.getByLabel('Quyết định lịch sử')
    assert(await history.evaluate(element => element === document.activeElement))
    await history.selectOption('4')
    await page.getByLabel('Phương án đã xác minh hợp lệ').selectOption({ label: 'Bỏ qua lần mua vàng' })
    await finish(page, fallback)
    await dialog(page).locator('[data-explanation-source="gemini-claim"]').waitFor()
    assert.deepEqual(operations, ['interpret', 'explain'])
  })
  console.log('PASS Gemini App upstream 429 and manual fallback')
  const delayed = { ...cases[2], delayed: true }
  await run(delayed, async session => {
    const { page } = session
    await ask(page, delayed.question)
    await finish(page, delayed)
    await sawExplain
    await dialog(page).locator('[data-explanation-source="engine"]').waitFor()
    await closeAndVerify(session)
    await launch(page)
    for (let i = 0; i < 50 && !explainAborted; i++) await page.waitForTimeout(20)
    assert(explainAborted)
    releaseExplain()
    assert.equal(await dialog(page).locator('[data-explanation-source="gemini-claim"]').count(), 0)
    assert.equal(await dialog(page).locator('.endgame-what-if__metric').count(), 0)
  })
  console.log('PASS Gemini App delayed explanation, abort and stale response isolation')
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(external, [])
  console.log('GEMINI SIMULATED CHROMIUM PASS 9/9')
} finally {
  releaseExplain()
  try { await browser?.close() } finally { await server.close() }
}
