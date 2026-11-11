import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createMultiCourseGame } from '../../../../../src/game/new-game.ts'
import { advance, canChoose, decide, roll } from '../../../../../src/game/engine.ts'
import { eventsForGame } from '../../../../../src/data/events.ts'
import { serializeLog } from '../../../../../src/game/log.ts'
import { saveGameLocally, GAME_SAVE_KEY } from '../../../../../src/game/saved-game.ts'
import { parseHistory, equalData } from '../../../../../mobile_app/src/game/endgame-whatif-identity.ts'
import { replayHistory, commandsOf, alignActual, applyRecorded } from '../../../../../mobile_app/src/game/endgame-whatif-replay.ts'
import { WorkBudget } from '../../../../../mobile_app/src/game/endgame-whatif-contract.ts'
import { listDecisionPage, createDecisionReplay } from '../../../../../mobile_app/src/game/what-if-ai/decision-replay.ts'
import { prepareGoldRequest } from '../../../../../mobile_app/src/game/endgame-whatif-gold-identity.ts'
import { createGoldContinuation } from '../../../../../mobile_app/src/game/endgame-whatif-gold-resume.ts'
import { reliabilityHistory, reliabilityCases } from '../../../../../scripts/diagnostics/what-if-reliability-fixtures.ts'
import { createWhatIfHandler } from '../../../../../src/ai/what-if/server.ts'
import { mockServerProvider } from '../../../../../src/ai/what-if/mock-server-provider.ts'
import { createModelWhatIfProvider } from '../../../../../src/ai/what-if/model-provider.ts'
const { createServer } = await import(pathToFileURL(resolve('mobile_app/node_modules/vite/dist/node/index.js')).href)
const { chromium } = createRequire(import.meta.url)(resolve('node_modules/.tmp/whatif-v3-qa/node_modules/playwright'))
const dir = import.meta.dirname, workOptions = () => ({ maxMilliseconds: 30000 })
const runName = process.argv[2] ?? 'browser'
assert(/^[a-z0-9-]+$/.test(runName))
const filter = process.argv[3]
const port = Number(process.argv[4] ?? 5197)
const origin = `http://127.0.0.1:${port}`
const sha = value => createHash('sha256').update(value).digest('hex')
async function pack(text) {
  const source = parseHistory(text), work = new WorkBudget(workOptions()), verified = await replayHistory(source, work)
  const initial = source.entries[0].after, lot = initial.deposits[0]
  let state = createMultiCourseGame(source.seed, initial.portfolio.savings, lot ? lot.maturityLap - lot.startLap + 1 : 1)
  for (const entry of commandsOf(source)) state = applyRecorded(alignActual(state, entry, work), entry, work)
  for (let i = 0; i < 4 && !['summary', 'rebalancing'].includes(state.phase); i++) state = advance(state)
  assert(['summary', 'rebalancing'].includes(state.phase) && state.lap === 4)
  const final = state.phase === 'summary' ? advance(advance(state)) : advance(state)
  assert(equalData(final, verified.final))
  let packed
  assert(saveGameLocally(state, { setItem: (_key, value) => { packed = value } }))
  return { packed, sourceHash: sha(text), phase: state.phase }
}
async function oracle(text, kind, sequence, parameters, alternativeId) {
  const page = await listDecisionPage(text, kind, { mode: 'alternatives', sequence, offset: 0, ...(parameters ? { parameters } : {}) }, workOptions())
  const selection = page.decisions.find(choice => parameters || choice.alternativeId === alternativeId)
  assert(selection)
  const handle = await createDecisionReplay(text, selection, workOptions())
  const followUps = []
  let result = handle.result
  try {
    while (result.status === 'needs-followup') {
      assert(followUps.length < 8)
      followUps.push(result.followUp.sequence)
      result = await handle.resume({ id: result.followUp.id, optionId: 'skip' }, workOptions())
    }
    assert.equal(result.status, 'supported-final', result.reason)
    return { selection, followUps, comparison: result.comparison }
  } finally { handle.dispose() }
}
const baselineDir = resolve(dir, '../eg3-ai-05-01')
const archivedFixtures = JSON.parse(readFileSync(resolve(baselineDir, 'fixtures.json')))
const fixtures = {}
for (const [name, fixture] of Object.entries(archivedFixtures)) {
  console.log('PREPARE', name)
  const text = gunzipSync(readFileSync(resolve(baselineDir, name + '.json.gz'))).toString()
  assert.equal(sha(text), fixture.sourceHash)
  const cache = resolve(dir, name + '.packed.gz')
  const previous = resolve(dir, '../eg3-ai-06-01', name + '.packed.gz')
  const packed = existsSync(previous) ? gunzipSync(readFileSync(previous)).toString() : existsSync(cache) ? gunzipSync(readFileSync(cache)).toString() : (await pack(text)).packed
  if (!existsSync(previous) && !existsSync(cache)) writeFileSync(cache, gzipSync(packed), { flag: 'wx' })
  fixtures[name] = { ...fixture, packed }
}
const definitions = { course: { sequence: Number(fixtures.course.selection.decisionId.split(':')[1]) } }
const courseSequence = definitions.course.sequence
for (const [name, source, sequence, alternativeId] of [
  ['courseBasic', 'course', courseSequence, 'course-basic'], ['courseSkipBasic', 'gold', 37, 'skip'],
]) {
  const text = gunzipSync(readFileSync(resolve(baselineDir, source + '.json.gz'))).toString()
  fixtures[name] = { ...fixtures[source], ...await oracle(text, 'course', sequence, undefined, alternativeId), kind: 'course' }
}
if (!filter || filter === 'baseline' || 'player-real-catalog-paging'.startsWith(filter)) {
  let state = createMultiCourseGame('EG3-AI-07-PAGING-996', 0, 1)
  for (let step = 0; state.phase !== 'finished' && step < 300; step++) {
    assert.notEqual(state.phase, 'funding')
    if (state.phase === 'rolling') state = roll(state)
    else if (state.phase !== 'event') state = advance(state)
    else {
      const option = canChoose(state, 'skip') ? 'skip' : eventsForGame(state).find(event => event.id === state.eventId)?.options.find(candidate => canChoose(state, candidate.id))?.id
      assert(option)
      state = decide(state, option)
    }
  }
  assert.equal(state.termination, 'completed')
  const text = serializeLog(state)
  const last = await listDecisionPage(text, 'course', { mode: 'history', offset: 8 }, workOptions())
  assert.equal(last.total, 9)
  fixtures.paging = { ...await pack(text), ...await oracle(text, 'course', last.history[0].sequence, undefined, 'course-basic'), kind: 'course' }
}
let mode = 'mock', providerStarted = 0, interpretStarted = 0, intakeAborted = 0, explainStarted = 0
const requests = [], cases = [], errors = [], forbidden = [], interceptedFonts = [], coreEntry = []
const newHistories = {}, resourceChecks = []
async function loadNewFixture(spec) {
  const { text, state, beforeLastAdvance } = reliabilityHistory(spec.seed, spec.sales, spec.goldSale)
  assert(equalData(advance(beforeLastAdvance), state))
  let packed
  assert(saveGameLocally(beforeLastAdvance, { setItem: (_key, value) => { packed = value } }))
  let replay
  if (spec.kind === 'gold') {
    const handle = await createGoldContinuation(await prepareGoldRequest(text, spec.sequence, workOptions()), workOptions())
    const pending = handle.result
    assert.equal(pending.status, 'needs-followup')
    const result = await handle.resume({ continuation: pending.continuation, blocker: pending.blocker, choice: pending.blocker.choices[0].action }, workOptions())
    assert.equal(result.status, 'supported-final', result.reason)
    replay = { selection: { decisionId: `gold:${spec.sequence}`, alternativeId: 'skip' }, followUps: [pending.blocker.command.sequence], comparison: { delta: result.delta, proof: result.proof } }
  } else replay = await oracle(text, spec.kind, spec.sequence, spec.parameters, spec.alternativeId)
  assert.deepEqual(replay.followUps, spec.followUps)
  assert(replay.comparison.proof.alternativeReplay)
  const name = `new-${spec.kind}`
  const sourceHash = sha(text)
  fixtures[name] = { ...replay, kind: spec.kind, phase: beforeLastAdvance.phase, packed, sourceHash }
  newHistories[name] = { seed: spec.seed, sourceHash, characters: text.length, bytes: Buffer.byteLength(text), entries: state.log.length,
    selection: replay.selection, followUps: replay.followUps, delta: replay.comparison.delta, proof: replay.comparison.proof }
  return name
}
const simulatedModel = createModelWhatIfProvider(async (request, signal) => {
  if (request.operation === 'interpret') {
    if (mode === 'model-invalid-json') return '{ "status":'
    if (mode === 'model-slow') {
      await new Promise(resolve => setTimeout(resolve, 1500))
      return '{"status":"unsupported"}'
    }
    if (['model-unspoken-amount', 'model-paraphrase', 'model-bad-id'].includes(mode)) {
      return '{"status":"intent","intent":{"kind":"stocks","action":"buy","sequence":10,"symbolId":"CMG","amount":1234567}}'
    }
    if (mode === 'model-missing') return '{"status":"intent","intent":{"kind":"stocks","action":"buy","sequence":10,"symbolId":"CMG"}}'
    return '{"status":"ambiguous"}'
  }
  if (request.operation === 'propose') {
    const choice = request.catalog[0]
    return JSON.stringify({ decisionId: mode === 'model-bad-id' ? 'stocks:499' : choice.decisionId, alternativeId: choice.alternativeId })
  }
  return JSON.stringify(await mockServerProvider.explain(request.facts, signal))
})
const provider = { ...mockServerProvider, async interpret(input, signal) {
  interpretStarted++
  if (mode.startsWith('model-')) return simulatedModel.interpret(input, signal)
  if (mode === 'intent-invalid') return { status: 'intent', intent: { kind: 'stocks', action: 'buy', decisionId: 'stocks:499' } }
  if (mode === 'intent-missing') return { status: 'intent', intent: { kind: 'stocks', action: 'buy', sequence: 10 } }
  if (mode === 'intent-ambiguous') return { status: 'ambiguous' }
  if (mode === 'intent-slow') return new Promise(() => signal.addEventListener('abort', () => { intakeAborted++ }, { once: true }))
  return mockServerProvider.interpret(input, signal)
}, async propose(input, signal) {
  providerStarted++
  if (mode.startsWith('model-')) return simulatedModel.propose(input, signal)
  if (mode === 'valid-wrong-alternative') return { decisionId: 'course:7', alternativeId: 'course-basic' }
  if (mode === 'invalid') return { decisionId: 'stocks:999', alternativeId: 'skip' }
  if (mode === 'ambiguous') return { status: 'ambiguous' }
  if (mode === 'timeout' || mode === 'slow') return new Promise(() => {})
  return mockServerProvider.propose(input, signal)
}, async explain(facts, signal) {
  explainStarted++
  if (mode === 'explain-slow') return new Promise(() => {})
  return mockServerProvider.explain(facts, signal)
} }
const handler = createWhatIfHandler(provider, { deadlineMs: 1200, maxRequests: 130, maxCalls: 130 })
const throttled = createWhatIfHandler(provider, { maxCalls: 0 })
const server = await createServer({ root: resolve('mobile_app'), server: { host: '127.0.0.1', port, strictPort: true, watch: null, hmr: false },
  plugins: [{ name: 'eg3-10-what-if-http', configureServer(vite) {
    vite.middlewares.use((req, res, next) => req.url?.split('?')[0] === '/api/what-if-provider'
      ? void (mode === 'throttle' ? throttled : handler)(req, res) : next())
  } }],
})
let browser
const dialog = page => page.getByRole('dialog', { name: 'Hỏi AI về lựa chọn khác', exact: true })
const idle = page => page.waitForFunction(() => !document.querySelector('dialog [aria-busy="true"]'))
async function open(name, width = 1280) {
  const fixture = fixtures[name]
  const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 900 }, hasTouch: width < 500, isMobile: width < 500,
    ...(width === 390 ? { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36' } : {}) })
  await context.addInitScript(({ packed, key }) => {
    localStorage.setItem(key, packed)
    localStorage.setItem('xvtl:mobile:tutorial:v1', 'seen')
    localStorage.setItem('xvtl:mobile:tutorial_disabled', 'true')
    const workers = [], NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        super(url, options)
        this.record = { name: options?.name, closed: false, posts: [], results: [] }
        workers.push(this.record)
        this.addEventListener('message', ({ data }) => this.record.results.push({ kind: data.kind ?? data.result?.status,
          delta: data.body?.delta ?? data.result?.comparison?.delta, proof: data.body?.proof ?? data.result?.comparison?.proof }))
      }
      postMessage(value, ...rest) { this.record.posts.push(value.kind); return super.postMessage(value, ...rest) }
      terminate() { this.record.closed = true; return super.terminate() }
    }
    window.eg3Workers = workers
  }, { packed: fixture.packed, key: GAME_SAVE_KEY })
  const page = await context.newPage()
  page.setDefaultTimeout(35000)
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (!request.url().endsWith('/api/what-if-provider')) return
    const body = request.postDataJSON()
    requests.push(body)
    assert(Buffer.byteLength(request.postData()) <= 8192)
    assert.deepEqual(Object.keys(body).sort(), body.operation === 'propose' ? ['catalog', 'operation', 'question'] : body.operation === 'interpret' ? ['operation', 'question'] : ['facts', 'operation'])
    assert(!/"(?:snapshot|save|state|entries|source|cash|seed|email)"/.test(request.postData()))
  })
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin === origin && (!url.pathname.startsWith('/api') || url.pathname === '/api/what-if-provider')) return route.continue()
    if (url.origin === 'https://fonts.googleapis.com' && url.pathname === '/css2') {
      interceptedFonts.push(url.origin + url.pathname)
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' })
    }
    forbidden.push(url.origin + url.pathname); return route.abort()
  })
  await page.goto(`${origin}/?endgameWhatIf=1&whatIfAi=1`)
  await activate(page.getByRole('button', { name: 'Bắt đầu phiêu lưu', exact: true }), page)
  await activate(page.getByTestId('map-node-1.1'), page)
  for (let step = 0; step < 3 && !await page.getByRole('button', { name: /Thử Lại Ván Mới|Chơi Ván Mới/i }).count(); step++) {
    const resultButton = page.getByRole('button', { name: /Xem kết quả hành trình/i })
    await resultButton.waitFor()
    if (width === 320) {
      // The existing START rebalance content can overlap its footer on 320px; use the real button's keyboard action.
      await resultButton.focus(); await resultButton.press('Enter')
      coreEntry.push({ name, width, step, resultActivation: 'keyboard-enter' })
    } else {
      await activate(resultButton, page)
      coreEntry.push({ name, width, step, resultActivation: width === 390 ? 'touch' : 'pointer' })
    }
    await page.waitForTimeout(350)
  }
  await page.getByRole('button', { name: /Thử Lại Ván Mới|Chơi Ván Mới/i }).waitFor()
  const before = await page.evaluate(key => localStorage.getItem(key), GAME_SAVE_KEY)
  const official = await page.locator('.game-result-container').innerText()
  await activate(page.getByRole('button', { name: 'Hỏi AI về lựa chọn khác', exact: true }), page)
  await page.getByLabel('Nhóm quyết định').waitFor(); await idle(page)
  if (fixture.kind !== 'gold') { await page.getByLabel('Nhóm quyết định').selectOption(fixture.kind); await idle(page) }
  return { page, context, before, official }
}
async function select(session, name) {
  const { page } = session, fixture = fixtures[name], parameters = fixture.selection.parameters
  const sequence = fixture.selection.decisionId.split(':')[1]
  for (let i = 0; i < 60; i++) {
    if (await page.getByLabel('Quyết định lịch sử').locator(`option[value="${sequence}"]`).count()) break
    const next = page.getByRole('button', { name: 'Trang quyết định sau', exact: true })
    if (!await next.count()) {
      await page.screenshot({ path: resolve(dir, runName + '-missing-history.png') })
      throw new Error(`Missing ${name}:${sequence}. UI: ${await dialog(page).innerText()}`)
    }
    await next.click(); await idle(page)
  }
  await page.getByLabel('Quyết định lịch sử').selectOption(sequence); await idle(page)
  if (parameters) {
    if (fixture.kind !== 'bank') await page.getByLabel('Hành động', { exact: true }).selectOption(parameters.operation)
    if (parameters.symbolId) await page.getByLabel('Mã cổ phiếu').selectOption(parameters.symbolId)
    if (parameters.issuerId) await page.getByLabel('Tổ chức phát hành').selectOption(parameters.issuerId)
    if (parameters.lotId) await page.getByLabel('Khoản trái phiếu').selectOption(parameters.lotId)
    if (parameters.term) await page.getByLabel('Kỳ hạn START').selectOption(String(parameters.term))
    await page.getByLabel('Số tiền VND', { exact: true }).fill(String(parameters.amount))
    assert(await page.getByRole('button', { name: 'Đề xuất phương án', exact: true }).isDisabled())
    await page.getByRole('button', { name: 'Xác minh phương án', exact: true }).click(); await idle(page)
    assert.equal(await page.getByLabel('Số tiền VND', { exact: true }).inputValue(), String(parameters.amount))
  }
}
async function propose(page, manual = false, alternativeId) {
  if (manual) {
    const index = await page.getByLabel('Phương án đã xác minh hợp lệ').locator('option').evaluateAll((options, label) => {
      const found = label ? options.find(option => option.textContent.includes(label)) : options.find(option => option.value !== '')
      return found?.value
    }, alternativeId)
    assert(index != null); await page.getByLabel('Phương án đã xác minh hợp lệ').selectOption(index)
  } else {
    const fill = page.getByRole('button', { name: 'Điền câu hỏi theo tham số đã xác minh', exact: true })
    if (await fill.count()) await fill.click()
    const called = providerStarted
    await page.getByRole('button', { name: 'Đề xuất phương án', exact: true }).evaluate(button => { button.click(); button.click() })
    await page.getByRole('heading', { name: 'Đề xuất cần bạn xác nhận' }).waitFor()
    assert.equal(providerStarted, called + 1)
  }
  await page.getByRole('heading', { name: 'Đề xuất cần bạn xác nhận' }).waitFor()
  assert.equal(await dialog(page).locator('.endgame-what-if__metric').count(), 0)
}
async function finish(page, name) {
  const fixture = fixtures[name]
  await activate(page.getByRole('button', { name: 'Xác nhận và mô phỏng' }), page)
  let confirmations = 0
  while (true) {
    await page.waitForFunction(() => Array.from(document.querySelectorAll('dialog h3')).some(heading => ['Cần thêm lựa chọn', 'So sánh cuối ván'].includes(heading.textContent)))
    if (await page.getByRole('heading', { name: 'So sánh cuối ván', exact: true }).count()) break
    assert(++confirmations <= 8)
    assert.equal(await dialog(page).locator('.endgame-what-if__metric').count(), 0)
    await activate(page.getByRole('button', { name: /Bỏ qua giao dịch sau|Bỏ qua lần học sau|Bỏ qua lần bán vàng sau đó/, exact: true }), page)
  }
  assert.equal(confirmations, fixture.followUps.length)
  const final = await page.evaluate(() => window.eg3Workers.flatMap(worker => worker.results).filter(result => result.delta).at(-1))
  const { delta } = final
  assert.equal(final.proof.actualReplay && final.proof.alternativeReplay && final.proof.sourceUnchanged, true)
  if (name.startsWith('new-')) assert.equal(final.proof.alternativeExportHash, fixture.comparison.proof.alternativeExportHash)
  if (name === 'gold') for (const key of ['cash', 'totalWorth', 'liquidatableFunds']) assert.equal(delta[key], 104006)
  else assert.deepEqual(delta, fixture.comparison.delta)
  assert.equal(await dialog(page).locator('.endgame-what-if__metric').count(), 3)
  await page.screenshot({ path: resolve(dir, runName + '-' + name + '-app.png') })
}
async function end(session) {
  const { page, context, before, official } = session
  if (await dialog(page).count()) await page.keyboard.press('Escape')
  await dialog(page).waitFor({ state: 'detached' })
  await page.waitForFunction(() => window.eg3Workers.every(worker => worker.closed))
  assert.equal(sha(await page.evaluate(key => localStorage.getItem(key), GAME_SAVE_KEY) ?? ''), sha(before), 'Packed save bytes changed')
  assert.equal(await page.locator('.game-result-container').innerText(), official)
  await context.close()
}
async function run(name, work) {
  if (filter === 'baseline' ? /^(reliability|provider-model|ux)-/.test(name) : filter && !name.startsWith(filter)) return
  mode = 'mock'; console.log('CASE', name)
  try { await work(); cases.push({ name, status: 'PASS' }) }
  catch (error) { cases.push({ name, status: 'FAIL', error: String(error.stack) }); throw error }
}
async function activate(locator, page) {
  if (page.viewportSize().width < 500) await locator.tap()
  else await locator.click()
}
async function askNatural(page, question) {
  await page.getByLabel('Câu hỏi What-if').fill(question)
  await activate(page.getByRole('button', { name: 'Phân tích câu hỏi (mock)', exact: true }), page)
}
try {
  await server.listen()
  browser = await chromium.launch({ executablePath: 'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe', headless: true })
  await run('provider-model-paraphrase-native-comparison', async () => {
    const session = await open('stocks'), { page } = session
    try {
      mode = 'model-paraphrase'
      await askNatural(page, 'Thử đổi quyết định 10 sang mã CMG với 1.234.567 đồng thì cuối ván ra sao?')
      await page.getByRole('heading', { name: 'Đề xuất cần bạn xác nhận' }).waitFor()
      assert.equal(await dialog(page).locator('.endgame-what-if__metric').count(), 0)
      await finish(page, 'stocks')
    } finally { await end(session) }
  })
  await run('provider-model-missing-parameter-and-ambiguous-mobile', async () => {
    const session = await open('stocks', 390), { page } = session
    try {
      mode = 'model-ambiguous'
      await askNatural(page, 'Nếu tôi đổi lựa chọn hôm đó thì sao?')
      await page.getByRole('status').filter({ hasText: /Hãy nêu rõ nhóm/ }).waitFor()
      mode = 'model-missing'
      await askNatural(page, 'Thử mua mã CMG tại quyết định 10')
      await page.getByRole('note').filter({ hasText: /số tiền VND/ }).waitFor()
      const amount = page.getByLabel('Số tiền VND', { exact: true })
      assert(await amount.evaluate(element => element === document.activeElement))
      assert.equal(await amount.inputValue(), '')
      await amount.fill('1.234.567')
      await page.getByRole('button', { name: 'Xác minh phương án', exact: true }).tap()
      await finish(page, 'stocks')
    } finally { await end(session) }
  })
  await run('provider-model-rejected-responses-manual-touch-320', async () => {
    const session = await open('stocks', 320), { page } = session
    try {
      for (const fault of ['model-invalid-json', 'model-unspoken-amount', 'model-bad-id']) {
        mode = fault
        await askNatural(page, fault === 'model-bad-id' ? 'Mua CMG 1.234.567 đồng tại quyết định 10' : 'Mua CMG tại quyết định 10')
        await page.getByRole('status').filter({ hasText: /Chưa thể xác minh phản hồi AI/ }).waitFor()
        assert.equal(await dialog(page).locator('.endgame-what-if__metric').count(), 0)
        assert.equal(await page.getByRole('heading', { name: 'Đề xuất cần bạn xác nhận' }).count(), 0)
      }
      const beforeManual = requests.length
      await page.getByRole('button', { name: 'Chọn phương án thủ công', exact: true }).tap()
      const verified = page.getByLabel('Phương án đã xác minh hợp lệ')
      assert(await verified.evaluate(element => element === document.activeElement))
      await verified.selectOption('0')
      await finish(page, 'stocks')
      assert.equal(requests.length, beforeManual)
      await page.screenshot({ path: resolve(dir, runName + '-manual-320.png') })
    } finally { await end(session) }
  })
  await run('provider-model-timeout-retry-and-late-completion', async () => {
    const session = await open('stocks'), { page } = session
    try {
      mode = 'model-slow'
      await askNatural(page, 'Nếu tôi mua CMG 1.234.567 đồng tại quyết định 10?')
      await page.getByRole('status').filter({ hasText: /AI chưa phản hồi kịp/ }).waitFor()
      mode = 'model-paraphrase'
      await page.getByRole('button', { name: 'Phân tích câu hỏi (mock)', exact: true }).click()
      await finish(page, 'stocks')
      assert.equal(await page.getByText('Câu hỏi này chưa được hỗ trợ.', { exact: false }).count(), 0)
    } finally { await end(session) }
  })
  await run('ux-course-suggestion-recorded-basic', async () => {
    const session = await open('courseSkipBasic', 390), { page } = session
    try {
      const suggestions = dialog(page).getByRole('region', { name: 'Gợi ý câu hỏi' })
      await suggestions.getByRole('button', { name: /bỏ học khóa cơ bản tại quyết định 37/ }).tap()
      assert.match(await page.getByLabel('Câu hỏi What-if').inputValue(), /bỏ học khóa cơ bản tại quyết định 37/)
      await page.getByRole('button', { name: 'Phân tích câu hỏi (mock)', exact: true }).tap()
      await finish(page, 'courseSkipBasic')
    } finally { await end(session) }
  })
  for (const spec of reliabilityCases) {
    await run(`reliability-new-${spec.kind}`, async () => {
      const name = await loadNewFixture(spec)
      const width = ['gold', 'advanced'].includes(spec.kind) ? 320 : ['stocks', 'bank'].includes(spec.kind) ? 390 : 1280
      const session = await open(name, width), { page } = session
      try {
        const questions = { gold: 'Không mua vàng', bank: 'Gửi tiết kiệm 7.250.019 VND kỳ hạn 3 START',
          course: 'Bỏ học khóa cơ bản', stocks: 'Bỏ mua FPT', bonds: 'Bán trái phiếu lot bond-4 số tiền 17',
          business: 'Nâng cấp chất lượng đồ uống' }
        if (spec.kind === 'advanced') {
          await select(session, name)
          await page.getByLabel('Phương án đã xác minh hợp lệ').selectOption({ label: 'Học khóa nâng cao' })
        } else await askNatural(page, `${questions[spec.kind]} tại quyết định ${spec.sequence}`)
        await finish(page, name)
      } finally { await end(session) }
    })
  }
  await run('reliability-http-throttle-manual-recovery', async () => {
    const session = await open('stocks', 320), { page } = session
    try {
      mode = 'throttle'
      await askNatural(page, 'Mua CMG 1.234.567 VND tại quyết định 10')
      await page.getByRole('status').filter({ hasText: /Đã chạm giới hạn yêu cầu AI/ }).waitFor()
      assert.equal(await dialog(page).locator('.endgame-what-if__metric').count(), 0)
      await select(session, 'stocks')
      await page.getByLabel('Phương án đã xác minh hợp lệ').selectOption('0')
      await finish(page, 'stocks')
    } finally { await end(session) }
  })
  await run('reliability-same-game-repeated-run-and-close-stress', async () => {
    if (!fixtures['new-stocks']) await loadNewFixture(reliabilityCases.find(spec => spec.kind === 'stocks'))
    const session = await open('new-stocks'), { page, context, before, official } = session
    const cdp = await context.newCDPSession(page)
    const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize }
    const launch = page.getByRole('button', { name: 'Hỏi AI về lựa chọn khác', exact: true })
    const close = async () => {
      await page.keyboard.press('Escape'); await dialog(page).waitFor({ state: 'detached' })
      await page.waitForFunction(() => window.eg3Workers.every(worker => worker.closed))
      assert.equal(await page.evaluate(key => localStorage.getItem(key), GAME_SAVE_KEY), before)
      assert.equal(await page.locator('.game-result-container').innerText(), official)
    }
    try {
      await close()
      const beforeHeap = await heap()
      for (let i = 0; i < 8; i++) {
        const created = await page.evaluate(() => window.eg3Workers.length)
        await launch.click()
        await page.waitForFunction(count => window.eg3Workers.length > count, created)
        await close()
      }
      for (let i = 0; i < 3; i++) {
        await launch.click(); await idle(page)
        await askNatural(page, 'Bỏ mua FPT tại quyết định 7')
        await finish(page, 'new-stocks')
        await close()
      }
      const workers = await page.evaluate(() => ({ created: window.eg3Workers.length, live: window.eg3Workers.filter(worker => !worker.closed).length }))
      assert.equal(workers.live, 0)
      resourceChecks.push({ rapidCancels: 8, completedRuns: 3, ...workers, heapBytesAfterGC: [beforeHeap, await heap()] })
    } finally { await cdp.detach(); await end(session) }
  })
  await run('player-timeout-retry-in-place', async () => {
    const session = await open('stocks'), { page } = session
    try {
      mode = 'intent-slow'
      await askNatural(page, 'Mua CMG 1.234.567 VND tại quyết định 10')
      await page.getByRole('status').filter({ hasText: /chưa phản hồi kịp/ }).waitFor()
      mode = 'mock'
      const ask = page.getByRole('button', { name: 'Phân tích câu hỏi (mock)', exact: true })
      assert(await ask.isEnabled(), 'the existing question must be retryable after a timeout')
      await ask.click()
      await finish(page, 'stocks')
    } finally { await end(session) }
  })
  await run('player-mobile-390-suggestion-edit-and-ask-again', async () => {
    const session = await open('stocks', 390), { page } = session
    const question = page.getByLabel('Câu hỏi What-if')
    try {
      assert.match(await page.evaluate(() => navigator.userAgent), /Android/)
      await dialog(page).getByRole('region', { name: 'Gợi ý câu hỏi' }).getByRole('button').first().tap()
      assert.match(await question.inputValue(), /mua cổ phiếu tại quyết định 10/)
      await page.getByRole('button', { name: 'Phân tích câu hỏi (mock)', exact: true }).tap()
      await page.getByRole('note').filter({ hasText: /mã cổ phiếu, số tiền/ }).waitFor()
      await askNatural(page, 'Mua CMG\n1.234.567 VND tại quyết định 10')
      await page.getByRole('button', { name: 'Sửa câu hỏi', exact: true }).tap()
      assert(await question.evaluate(element => element === document.activeElement))
      assert.equal(await page.getByRole('button', { name: 'Xác nhận và mô phỏng' }).count(), 0)
      await askNatural(page, 'Mua FPT 7,25 triệu lần đầu')
      await finish(page, 'stockAgain')
      const content = dialog(page).locator('.endgame-what-if__content')
      const layout = await content.evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth, height: element.clientHeight, scrollHeight: element.scrollHeight }))
      assert(layout.scrollWidth <= layout.width + 1 && layout.scrollHeight > layout.height)
      await page.getByText('Cách đọc kết quả', { exact: true }).tap()
      await page.getByText(/Hai nhánh được replay đến hết vòng 4/).waitFor()
      assert(await content.evaluate(element => element.scrollTop > 0))
      await page.getByRole('button', { name: 'Hỏi câu khác trên ván gốc', exact: true }).tap()
      await idle(page)
      assert.equal(await question.inputValue(), '')
      assert(await question.evaluate(element => element === document.activeElement))
      assert.equal(await content.locator('.endgame-what-if__metric').count(), 0)
      await page.getByLabel('Quyết định lịch sử').selectOption('10'); await idle(page)
      await page.getByLabel('Mã cổ phiếu').selectOption('CMG')
      await page.getByLabel('Số tiền VND', { exact: true }).fill('1.234.567')
      await page.getByRole('button', { name: 'Xác minh phương án', exact: true }).tap(); await idle(page)
      await page.getByLabel('Phương án đã xác minh hợp lệ').selectOption('0')
      await finish(page, 'stocks')
      await page.screenshot({ path: resolve(dir, 'player-mobile-390.png') })
    } finally { await end(session) }
  })
  await run('player-edit-and-cancel-outstanding-intake', async () => {
    const session = await open('stocks', 320), { page } = session
    try {
      const question = page.getByLabel('Câu hỏi What-if')
      const ask = page.getByRole('button', { name: 'Phân tích câu hỏi (mock)', exact: true })
      for (const action of ['cancel', 'edit']) {
        mode = 'intent-slow'
        const before = interpretStarted, abortedBefore = intakeAborted
        await question.fill('Mua FPT 7,25 triệu lần đầu')
        await ask.evaluate(button => { button.click(); button.click() })
        await page.getByRole('button', { name: 'Hủy yêu cầu AI' }).waitFor()
        for (let i = 0; i < 80 && interpretStarted === before; i++) await page.waitForTimeout(10)
        assert.equal(interpretStarted - before, 1)
        if (action === 'cancel') await page.getByRole('button', { name: 'Hủy yêu cầu AI' }).tap()
        else await question.fill('Mua CMG 1.234.567 VND tại quyết định 10')
        for (let i = 0; i < 80 && intakeAborted === abortedBefore; i++) await page.waitForTimeout(10)
        assert.equal(intakeAborted - abortedBefore, 1)
        assert(await ask.isEnabled())
        assert.equal(await page.getByRole('button', { name: 'Xác nhận và mô phỏng' }).count(), 0)
      }
      mode = 'mock'; await ask.tap(); await finish(page, 'stocks')
    } finally { await end(session) }
  })
  await run('player-real-catalog-paging', async () => {
    const session = await open('paging', 390), { page } = session
    try {
      const next = page.getByRole('button', { name: 'Trang quyết định sau' })
      const previous = page.getByRole('button', { name: 'Trang quyết định trước' })
      await page.getByText('1–8 / 9 quyết định', { exact: true }).waitFor()
      await next.tap(); await page.getByText('9–9 / 9 quyết định', { exact: true }).waitFor()
      await previous.tap(); await page.getByText('1–8 / 9 quyết định', { exact: true }).waitFor()
      await select(session, 'paging')
      await page.getByLabel('Phương án đã xác minh hợp lệ').selectOption({ label: 'Học khóa cơ bản' })
      await finish(page, 'paging')
    } finally { await end(session) }
  })
  await run('player-verified-result-independent-of-explain-service', async () => {
    const session = await open('course'), { page } = session
    try {
      mode = 'explain-slow'
      const before = explainStarted
      await askNatural(page, 'Học khóa nâng cao lần đầu')
      await finish(page, 'course')
      assert.equal(explainStarted, before)
      await page.getByRole('region', { name: 'Dữ kiện lương từ engine' }).getByText(/Vòng .*tại START/).first().waitFor()
      await page.getByRole('region', { name: 'Follow-up đã xác nhận' }).waitFor()
    } finally { await end(session) }
  })
  await run('player-clear-failed-filter-for-manual-fallback', async () => {
    const session = await open('stocks'), { page } = session
    try {
      await askNatural(page, 'Mua CMG tại quyết định 499')
      await page.getByRole('status').filter({ hasText: /Không có quyết định/ }).waitFor()
      await page.getByLabel('Câu hỏi What-if').fill('Tôi muốn chọn thủ công')
      await page.getByRole('button', { name: 'Xem toàn bộ quyết định trong nhóm' }).click(); await idle(page)
      await select(session, 'stocks')
      await page.getByLabel('Phương án đã xác minh hợp lệ').selectOption('0')
      await finish(page, 'stocks')
    } finally { await end(session) }
  })
  await run('player-advanced-category-native-fallback', async () => {
    const session = await open('course', 320), { page } = session
    try {
      await page.getByLabel('Nhóm quyết định').selectOption('advanced'); await idle(page)
      await select(session, 'course')
      await page.getByLabel('Phương án đã xác minh hợp lệ').selectOption({ label: 'Học khóa nâng cao' })
      await finish(page, 'course')
      await page.getByRole('region', { name: 'Follow-up đã xác nhận' }).waitFor()
    } finally { await end(session) }
  })
  await run('stocks-desktop-http-native-restart', async () => {
    const session = await open('stocks'), { page } = session
    try {
      await select(session, 'stocks')
      await page.screenshot({ path: resolve(dir, 'stocks-parameters-desktop.png') })
      await propose(page); await finish(page, 'stocks')
      await page.getByRole('button', { name: 'Đổi phương án trên ván gốc' }).click(); await idle(page)
      await select(session, 'stockAgain'); await propose(page, true); await finish(page, 'stockAgain')
    } finally { await end(session) }
  })
  for (const name of ['bank', 'bonds', 'sale', 'course', 'business', 'gold']) await run(name + '-small-app', async () => {
    const session = await open(name, 320), { page } = session
    try {
      await select(session, name)
      const layout = await dialog(page).locator('.endgame-what-if__content').evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth }))
      assert(layout.scroll <= layout.width + 1, JSON.stringify(layout))
      await page.screenshot({ path: resolve(dir, name + '-parameters-small.png') })
      if (name === 'course') await page.getByLabel('Câu hỏi What-if').fill(`Học khóa nâng cao tại quyết định ${courseSequence}`)
      await propose(page, name === 'business', name === 'business' ? 'giá cả hợp lý' : undefined)
      await finish(page, name)
    } finally { await end(session) }
  })
  for (const fault of ['invalid', 'ambiguous', 'timeout']) await run('provider-' + fault, async () => {
    const session = await open('stocks'), { page } = session
    try {
      await select(session, 'stocks'); mode = fault
      await page.getByRole('button', { name: 'Điền câu hỏi theo tham số đã xác minh' }).click()
      await page.getByRole('button', { name: 'Đề xuất phương án', exact: true }).click()
      await page.getByRole('status').filter({ hasText: fault === 'ambiguous' ? /mơ hồ/ : fault === 'timeout' ? /chưa phản hồi kịp/ : /Chưa thể xác minh/ }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Xác nhận và mô phỏng' }).count(), 0)
      assert.equal(await dialog(page).locator('.endgame-what-if__metric').count(), 0)
    } finally { await end(session) }
  })
  await run('editing-revokes-old-choice-and-unowned-sale-is-excluded', async () => {
    const session = await open('stocks', 320), { page } = session
    try {
      await select(session, 'stocks')
      await page.getByLabel('Số tiền VND', { exact: true }).fill('1.5')
      assert(await page.getByRole('button', { name: 'Xác minh phương án' }).isDisabled())
      assert(await page.getByRole('button', { name: 'Đề xuất phương án', exact: true }).isDisabled())
      await page.getByLabel('Số tiền VND', { exact: true }).fill('1000000')
      await page.getByLabel('Hành động', { exact: true }).selectOption('sell')
      // No holdings at this prefix: local bound prevents even submitting an impossible sale.
      assert(await page.getByRole('button', { name: 'Xác minh phương án' }).isDisabled())
      assert(await page.getByLabel('Phương án đã xác minh hợp lệ').isDisabled())
      assert.equal(await dialog(page).locator('.endgame-what-if__metric').count(), 0)
    } finally { await end(session) }
  })
  for (const during of ['provider', 'worker', 'probe']) await run('close-during-' + during, async () => {
    const session = await open('stocks'), { page } = session
    try {
      await select(session, 'stocks')
      if (during === 'probe') {
        await page.getByLabel('Số tiền VND', { exact: true }).fill('2000000')
        await page.getByRole('button', { name: 'Xác minh phương án' }).click()
      } else {
        if (during === 'provider') mode = 'slow'
        if (during === 'worker') { await propose(page); await page.getByRole('button', { name: 'Xác nhận và mô phỏng' }).click() }
        else {
          await page.getByRole('button', { name: 'Điền câu hỏi theo tham số đã xác minh' }).click()
          const before = providerStarted
          await page.getByRole('button', { name: 'Đề xuất phương án', exact: true }).click()
          for (let i = 0; i < 100 && before === providerStarted; i++) await page.waitForTimeout(10)
          assert(providerStarted > before)
        }
      }
    } finally { await end(session) }
  })
  for (const [name, question, width] of [
    ['stocks', 'Nếu tôi mua cổ phiếu CMG 1.234.567 VND ở quyết định 10 thì sao?', 1280],
    ['stockAgain', 'Nếu mua FPT 7,25 triệu lần đầu thì sao?', 320],
    ['sale', 'Bán FPT 1 triệu ở quyết định 51', 320],
    ['bank', 'Gửi tiết kiệm 1 triệu kỳ hạn 3 START tại quyết định 36', 320],
    ['bonds', 'Bán trái phiếu lot bond-2 750 nghìn ở quyết định 23', 320],
    ['course', 'Nếu tôi học khóa nâng cao lần đầu thì sao?', 320],
    ['courseBasic', 'Nếu tôi học khóa cơ bản lần đầu thì sao?', 320],
    ['courseSkipBasic', 'Nếu bỏ học khóa cơ bản ở quyết định 37 thì sao?', 320],
    ['business', 'Nâng cấp cơ sở theo giá cả hợp lý tại quyết định 48', 1280],
    ['gold', 'Nếu tôi không mua vàng lần đầu thì sao?', 320],
  ]) await run('natural-' + name, async () => {
    const session = await open(name, width), { page } = session
    try {
      if (name === 'stocks') { await page.getByLabel('Nhóm quyết định').selectOption('bank'); await idle(page) }
      await askNatural(page, question)
      await page.getByRole('heading', { name: 'Đề xuất cần bạn xác nhận' }).waitFor()
      assert(await page.getByRole('heading', { name: 'Đề xuất cần bạn xác nhận' }).evaluate(element => element === document.activeElement))
      assert.equal(await dialog(page).locator('.endgame-what-if__metric').count(), 0)
      await finish(page, name)
      const text = await dialog(page).innerText()
      assert(text.includes('Quyết định gốc:') && text.includes('Phương án thay thế:'))
      if (['stocks', 'stockAgain'].includes(name)) assert(text.includes('khác chiều'))
      if (['gold', 'course'].includes(name)) assert(text.includes('Bạn đã xác nhận'))
      const layout = await dialog(page).evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth }))
      assert(layout.scroll <= layout.width + 1)
      await page.screenshot({ path: resolve(dir, 'natural-' + name + '.png') })
    } finally { await end(session) }
  })
  await run('natural-ambiguous-history-choice', async () => {
    const session = await open('stocks', 320), { page } = session
    try {
      await askNatural(page, 'Nếu tôi mua CMG 1.234.567 VND thì sao?')
      await page.getByRole('status').filter({ hasText: /nhiều quyết định/ }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Xác nhận và mô phỏng' }).count(), 0)
      await page.getByLabel('Quyết định lịch sử').selectOption('10')
      await page.getByRole('heading', { name: 'Đề xuất cần bạn xác nhận' }).waitFor()
      await finish(page, 'stocks')
    } finally { await end(session) }
  })
  await run('natural-provider-cannot-switch-to-another-legal-alternative', async () => {
    const session = await open('course'), { page } = session
    try {
      mode = 'valid-wrong-alternative'
      await askNatural(page, 'Nếu học khóa nâng cao tại quyết định 7 thì sao?')
      await page.getByRole('status').filter({ hasText: /Chưa thể xác minh/ }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Xác nhận và mô phỏng' }).count(), 0)
      assert.deepEqual(requests.at(-1).catalog.map(choice => choice.alternativeId), ['course-advanced'])
    } finally { await end(session) }
  })
  for (const [name, question, fields] of [
    ['stocks', 'Mua CMG tại quyết định 10', [['Số tiền VND', '1234567']]],
    ['stocks', 'Mua CMG 1.000 triệu tại quyết định 10', [['Số tiền VND', '1234567']]],
    ['bank', 'Gửi tiết kiệm 1 triệu tại quyết định 36', [['Kỳ hạn START', '3']]],
    ['bonds', 'Bán trái phiếu 750 nghìn tại quyết định 23', [['Khoản trái phiếu', 'bond-2']]],
  ]) await run('natural-missing-' + name, async () => {
    const session = await open(name, 320), { page } = session
    try {
      await askNatural(page, question)
      await page.getByRole('note').filter({ hasText: /Cần bổ sung/ }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Xác nhận và mô phỏng' }).count(), 0)
      assert(await page.locator('[data-parameter]').evaluateAll(elements => elements.some(element => element === document.activeElement)))
      for (const [label, value] of fields) {
        const field = page.getByLabel(label, { exact: true })
        if ((await field.evaluate(element => element.tagName)) === 'SELECT') await field.selectOption(value)
        else await field.fill(value)
      }
      await activate(page.getByRole('button', { name: 'Xác minh phương án', exact: true }), page)
      await page.getByRole('heading', { name: 'Đề xuất cần bạn xác nhận' }).waitFor()
      await finish(page, name)
    } finally { await end(session) }
  })
  for (const [question, expected] of [
    ['Bỏ mua vàng và bỏ bán vàng', /nhiều thay đổi/],
    ['Nếu tôi thay đổi thì sao?', /nêu rõ nhóm/],
    ['Mua CMG 1 triệu tại quyết định 499', /Không có quyết định/],
    ['Mua cổ phiếu ZZZ 1 triệu tại quyết định 10', /không hợp lệ/],
    ['Bỏ mua CMG tại quyết định 10', /Không có quyết định/],
    ['Gửi 1 triệu kỳ hạn 2 hoặc 3 START', /nêu rõ nhóm/],
    ['Gửi 1 triệu kỳ hạn 3 tháng', /kỳ hạn ngân hàng dùng START/],
  ]) await run('natural-refusal-' + question, async () => {
    const session = await open('stocks', 320), { page } = session
    try {
      await askNatural(page, question)
      await page.getByRole('status').filter({ hasText: expected }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Xác nhận và mô phỏng' }).count(), 0)
      assert.equal(await dialog(page).locator('.endgame-what-if__metric').count(), 0)
    } finally { await end(session) }
  })
  await run('natural-engine-blocked-lot-provenance-explained', async () => {
    const session = await open('bonds', 320), { page } = session
    try {
      await askNatural(page, 'Bỏ mua trái phiếu tại quyết định 10')
      await page.getByRole('button', { name: 'Xác nhận và mô phỏng' }).waitFor()
      await activate(page.getByRole('button', { name: 'Xác nhận và mô phỏng' }), page)
      await page.getByRole('status').filter({ hasText: /nguồn mua gốc/ }).waitFor()
      assert.equal(await dialog(page).locator('.endgame-what-if__metric').count(), 0)
      await page.screenshot({ path: resolve(dir, 'blocked-provenance.png') })
    } finally { await end(session) }
  })
  for (const fault of ['intent-invalid', 'intent-ambiguous', 'intent-missing']) await run(fault, async () => {
    const session = await open('stocks', 320), { page } = session
    try {
      mode = fault; await askNatural(page, 'Mua CMG 1.234.567 VND tại quyết định 10')
      if (fault === 'intent-missing') await page.getByRole('note').filter({ hasText: /mã cổ phiếu, số tiền/ }).waitFor()
      else await page.getByRole('status').filter({ hasText: fault === 'intent-ambiguous' ? /nêu rõ nhóm/ : /Chưa thể xác minh/ }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Xác nhận và mô phỏng' }).count(), 0)
    } finally { await end(session) }
  })
  await run('natural-close-reopen-intake-stale-and-focus', async () => {
    const session = await open('stocks', 320), { page } = session
    try {
      mode = 'intent-slow'; const before = interpretStarted
      await askNatural(page, 'Mua CMG 1 triệu lần đầu')
      for (let i = 0; i < 100 && interpretStarted === before; i++) await page.waitForTimeout(10)
      assert(interpretStarted > before)
      await activate(dialog(page).getByRole('button', { name: 'Đóng', exact: true }), page)
      await dialog(page).waitFor({ state: 'detached' })
      assert(await page.getByRole('button', { name: 'Hỏi AI về lựa chọn khác', exact: true }).evaluate(element => element === document.activeElement))
      mode = 'mock'
      await activate(page.getByRole('button', { name: 'Hỏi AI về lựa chọn khác', exact: true }), page)
      await idle(page); await page.waitForTimeout(700)
      assert.equal(await dialog(page).locator('.endgame-what-if__metric').count(), 0)
      await page.keyboard.press('Escape')
    } finally { await end(session) }
  })
  await run('natural-keyboard-tab-enter-escape-reopen', async () => {
    const session = await open('stocks'), { page } = session
    try {
      await page.getByLabel('Câu hỏi What-if').fill('Mua CMG 1.234.567 VND tại quyết định 10')
      await page.keyboard.press('Tab')
      assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Phân tích câu hỏi (mock)')
      await page.keyboard.press('Enter')
      await page.getByRole('heading', { name: 'Đề xuất cần bạn xác nhận' }).waitFor()
      assert(await page.getByRole('heading', { name: 'Đề xuất cần bạn xác nhận' }).evaluate(element => element === document.activeElement))
      await page.keyboard.press('Tab')
      assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Xác nhận và mô phỏng')
      await page.keyboard.press('Enter')
      await page.getByRole('heading', { name: 'So sánh cuối ván', exact: true }).waitFor()
      await page.keyboard.press('Escape')
      assert(await page.getByRole('button', { name: 'Hỏi AI về lựa chọn khác', exact: true }).evaluate(element => element === document.activeElement))
      await page.keyboard.press('Enter'); await idle(page)
      assert.equal(await dialog(page).locator('.endgame-what-if__metric').count(), 0)
    } finally { await end(session) }
  })
  assert.deepEqual(errors, []); assert.deepEqual(forbidden, [])
  console.log('FLEXIBLE APP HTTP PASS', cases.length, 'cases · desktop/390px/320px · immutable save/result · LIVE_NOT_RUN')
} finally {
  writeFileSync(resolve(dir, runName + '-results.json'), JSON.stringify({ cases, errors, forbidden, interceptedFonts, coreEntry, requests, newHistories, resourceChecks,
    fixtures: Object.fromEntries(Object.entries(fixtures).map(([name, f]) => [name, { sourceHash: f.sourceHash, phase: f.phase }])) }, null, 2))
  try { await browser?.close() } finally { await server.close() }
}
