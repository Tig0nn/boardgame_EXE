import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { eq, sql } from 'drizzle-orm'
import { advance, decide, fundPayment, roll, transact } from '../../../src/game/engine.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { gameActionBody } from '../src/validation.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { liquidatableFunds, victory } from '../../../src/game/selectors.ts'
import { replayGameLog } from '../../../scripts/diagnostics/replay-game-log.ts'
import { buildApp } from '../src/app.ts'
import { localDatabaseUrl } from '../src/config.ts'
import { createDatabase } from '../src/db/client.ts'
import { migrateDatabase } from '../src/db/migrations.ts'
import { gameActions, gameResults, gameSessions, gameSnapshots } from '../src/db/schema.ts'
import { startJwtIssuer } from './jwks.ts'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.EXE_PLAYWRIGHT_MODULE || 'playwright')

test('Mobile browser uses real HTTP, JWT ownership and PostgreSQL to finish a B18 game', { timeout: 360_000 }, async t => {
  const local = localDatabaseUrl(process.env.DATABASE_URL)
  const admin = createDatabase(local.href)
  const dbName = 'exe_phase3a_test_' + randomUUID().replaceAll('-', '')
  local.pathname = '/' + dbName
  const database = createDatabase(local.href)
  const issuer = await startJwtIssuer()
  const app = buildApp(database, issuer.config)
  let created = false
  t.after(async () => {
    try {
      await Promise.all([app.close(), issuer.close()])
      if (created) await admin.pool.query('DROP DATABASE "' + dbName + '"')
    } finally { await admin.close() }
  })
  await admin.pool.query('CREATE DATABASE "' + dbName + '" TEMPLATE template0')
  created = true
  await migrateDatabase(database.db)
  const origin = await app.listen({ host: '127.0.0.1', port: 0 })
  const owner = randomUUID()
  const expires = { exp: Math.floor(Date.now() / 1000) + 900 }
  const token = await issuer.sign(owner, expires)
  const outsider = await issuer.sign(randomUUID(), expires)
  const expired = await issuer.sign(owner, { exp: 1 })
  const browser = await chromium.launch({ headless: true, executablePath: process.env.EXE_CHROMIUM_PATH || undefined })
  t.after(() => browser.close())
  const mobileRoot = fileURLToPath(new URL('../../../mobile_app/', import.meta.url))
  const mobileRequire = createRequire(new URL('../../../mobile_app/package.json', import.meta.url))
  const vite = await import(pathToFileURL(mobileRequire.resolve('vite')).href)
  const frontend = await vite.createServer({
    root: mobileRoot,
    server: { host: '127.0.0.1', port: 0, hmr: false, proxy: { '/v1': { target: origin, changeOrigin: true } } },
    plugins: [{
      name: 'phase3a-browser-test-entry',
      configureServer(server: { transformIndexHtml: (url: string, html: string) => Promise<string>; middlewares: { use: (handler: (request: { url?: string }, response: { setHeader: (key: string, value: string) => void; end: (body: string) => void }, next: (error?: unknown) => void) => void) => void } }) {
        server.middlewares.use((request, response, next) => {
          if (request.url !== '/__phase3a_browser_test') { next(); return }
          response.setHeader('Content-Type', 'text/html; charset=utf-8')
          const html = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/model-viewer.min.js"></script><script type="module" src="/__phase3a_browser_entry.js"></script></body></html>'
          void server.transformIndexHtml(request.url, html).then(value => response.end(value), next)
        })
      },
      resolveId(id: string) { if (id === '/__phase3a_browser_entry.js') return fileURLToPath(new URL('../../../mobile_app/__phase3a_browser_entry.js', import.meta.url)).replaceAll('\\', '/') },
      load(id: string) {
        if (!id.endsWith('/__phase3a_browser_entry.js')) return
        return [
          "import React from 'react'",
          "import { createRoot } from 'react-dom/client'",
          "import { OnlineApp } from '/src/components/OnlineApp.tsx'",
          "import '/src/index.css'",
          "import '/src/engine-ui.css'",
          "import '/src/core-mvp.css'",
          "import '/src/medieval-theme.css'",
          "import { createAccountToken } from '/src/game/account-token.ts'",
          "const read=async()=>({user:{id:'browser-test'},access_token:sessionStorage.getItem('phase3a-test-token')})",
          "const refresh=async()=>{const fresh=sessionStorage.getItem('phase3b-refresh-token');if(!fresh)return null;sessionStorage.setItem('phase3a-test-token',fresh);return read()}",
          "createRoot(document.getElementById('root')).render(React.createElement(OnlineApp,{accessToken:createAccountToken('browser-test',read,refresh,()=>{})}))",
        ].join('\n')
      },
    }],
  })
  await frontend.listen()
  t.after(() => frontend.close())
  const frontendUrl = (frontend.resolvedUrls!.local[0] ?? frontend.resolvedUrls!.network[0]) + '__phase3a_browser_test'
  const sessionsPath = '/v1/game-sessions'
  const direct = async (id: string, bearer = token) => fetch(origin + sessionsPath + '/' + id, { headers: { authorization: 'Bearer ' + bearer } })

  const errors: string[] = []
  async function player(width: number, bearer = token, refreshToken = '') {
    const context = await browser.newContext({ viewport: { width, height: 870 }, reducedMotion: 'reduce' })
    await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
      (route: { abort: () => Promise<void> }) => route.abort())
    await context.addInitScript(({ bearer, refreshToken }: { bearer: string; refreshToken: string }) => {
      sessionStorage.setItem('phase3a-test-token', bearer)
      sessionStorage.setItem('phase3b-refresh-token', refreshToken)
    }, { bearer, refreshToken })
    const page = await context.newPage()
    const statuses: number[] = []
    page.on('response', (response: { url: () => string; status: () => number }) => {
      if (response.url().includes('/v1/game-sessions')) statuses.push(response.status())
    })
    page.on('pageerror', (error: Error) => errors.push(error.message))
    await page.goto(frontendUrl, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Bắt đầu phiêu lưu' }).click()
    await page.getByRole('heading', { name: 'Ván chơi của bạn' }).waitFor()
    return { context, page, statuses }
  }
  type Page = Awaited<ReturnType<typeof player>>['page']
  async function create(page: Page, amount: number) {
    await page.getByRole('button', { name: 'Tạo ván mới', exact: true }).click()
    await page.getByRole('button', { name: amount / 1_000_000 + ' triệu', exact: true }).click()
    const pending = page.waitForResponse((response: { url: () => string; request: () => { method: () => string } }) =>
      response.url().endsWith(sessionsPath) && response.request().method() === 'POST')
    await page.getByRole('button', { name: /Bắt đầu hành trình/ }).click()
    const response = await pending
    assert.equal(response.status(), 201)
    const { session } = await response.json()
    assert.deepEqual(session.setup, { initialSavings: amount, savingsTerm: 3 })
    await page.getByRole('button', { name: 'Bắt đầu vòng 1', exact: true }).waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
    return session.id as string
  }
  async function action(page: Page, click: () => Promise<void>, expected = 200) {
    const [response] = await Promise.all([
      page.waitForResponse((value: { url: () => string }) => value.url().endsWith('/actions')),
      click(),
    ]).catch(async error => {
      const retry = await page.getByRole('button', { name: 'Thử lại thao tác', exact: true }).isVisible()
      const reconnect = await page.getByRole('button', { name: 'Tải lại ván', exact: true }).isVisible()
      throw new Error('Action response missing. Retry visible: ' + retry + '. Reload visible: ' + reconnect, { cause: error })
    })
    assert.equal(response.status(), expected, await response.text())
    return response.json()
  }
  async function rollDice(page: Page) {
    const button = page.getByRole('button', { name: 'Lắc Xúc Xắc', exact: true })
    await button.click({ trial: true })
    await button.evaluate((element: HTMLButtonElement) => element.click())
  }
  async function transaction(page: Page, choice: string, quote: boolean, amount?: number) {
    await page.getByLabel('Thao tác', { exact: true }).selectOption(choice)
    if (amount !== undefined) await page.getByLabel('Số tiền (VND)').fill(String(amount))
    if (quote) {
      const pending = page.waitForResponse((response: { url: () => string }) => /\/(bank|business|trade)-quote$/.test(response.url()))
      await page.getByRole('button', { name: 'Xem báo giá', exact: true }).click()
      const response = await pending
      assert.equal(response.status(), 200, await response.text())
    }
    return action(page, () => page.getByRole('button', { name: 'Xác nhận', exact: true }).click())
  }
  const tiny = await player(320)
  const emptyId = await create(tiny.page, 0)
  assert.equal((await (await direct(emptyId)).json()).state.portfolio.cash, 50_000_000)
  await tiny.context.close()

  const wide = await player(1440)
  const fullId = await create(wide.page, 50_000_000)
  const full = await (await direct(fullId)).json()
  assert.equal(full.state.portfolio.cash, 0)
  assert.equal(full.state.bank.deposits[0].maturityLap, 3)
  let funded = await action(wide.page, () => wide.page.getByRole('button', { name: 'Bắt đầu vòng 1', exact: true }).click())
  let exercisedFunding = false
  for (let step = 0; step < 22 && funded.state.lap <= 2; step++) {
    const state = funded.state
    if (state.phase === 'funding') {
      const lot = state.fundingOptions.find((option: { source: string }) => option.source === 'savings')
      if (lot) {
        const reply = await transaction(wide.page, 'savings-' + lot.lotId, true)
        assert.equal(reply.state.bank.deposits[0].status, 'withdrawn')
        exercisedFunding = true
        break
      }
      const option = state.fundingOptions[0]
      funded = await transaction(wide.page, [option.source, option.lotId].filter(Boolean).join('-'), option.source === 'debt')
    } else if (state.phase === 'rolling') funded = await action(wide.page, () => rollDice(wide.page))
    else if (state.phase === 'summary') funded = await action(wide.page, () => wide.page.getByRole('button', { name: 'Ghé ví tại ô Xuất phát', exact: true }).click())
    else if (state.phase === 'rebalancing') funded = await action(wide.page, () => wide.page.getByRole('button', { name: 'Kết thúc điều chỉnh', exact: true }).click())
    else if (state.phase === 'forecast') funded = await action(wide.page, () => wide.page.getByRole('button', { name: 'Bắt đầu vòng ' + state.lap, exact: true }).click())
    else if (state.phase === 'event') {
      const option = state.options.find((item: { id: string }) => ['pay', 'full', 'defer'].includes(item.id)) ?? state.options[0]
      funded = await action(wide.page, () => wide.page.locator('[data-option-id="' + option.id + '"]').click())
    } else break
  }
  if (!exercisedFunding) {
    // Select an untouched, server-generated genesis whose first landing requires payment.
    // Gameplay and quote acceptance still go through the browser.
    let fundingId: string | undefined
    for (let attempt = 0; attempt < 36 && !fundingId; attempt++) {
      const response = await fetch(origin + sessionsPath, {
        method: 'POST',
        headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', 'idempotency-key': randomUUID() },
        body: JSON.stringify({ scenarioId: 'b18', setup: { initialSavings: 50_000_000, savingsTerm: 3 } }),
      })
      assert.equal(response.status, 201)
      const { session } = await response.json()
      const [row] = await database.db.select({ seed: gameSessions.seed }).from(gameSessions).where(eq(gameSessions.id, session.id))
      const landing = roll(advance(createMultiCourseGame(row.seed, 50_000_000, 3)))
      if (['medical', 'repair', 'family'].includes(landing.eventId ?? '')) fundingId = session.id
    }
    assert.ok(fundingId, 'Could not find a new game with a first-roll payment')
    await wide.page.reload()
    await wide.page.getByRole('button', { name: 'Bắt đầu phiêu lưu' }).click()
    await wide.page.getByRole('button', { name: /Tiếp tục ván/ }).first().press('Enter')
    await action(wide.page, () => wide.page.getByRole('button', { name: 'Bắt đầu vòng 1', exact: true }).click())
    const landing = await action(wide.page, () => rollDice(wide.page))
    const option = landing.state.options.find((item: { cost?: number }) => (item.cost ?? 0) > 0)
    assert.ok(option)
    const payment = await action(wide.page, () => wide.page.locator('[data-option-id="' + option.id + '"]').click())
    assert.equal(payment.state.phase, 'funding')
    const reply = await transaction(wide.page, 'savings-deposit-1', true)
    assert.equal(reply.state.bank.deposits[0].status, 'withdrawn')
    assert.equal((await (await direct(fundingId)).json()).session.stateVersion, 4)
    exercisedFunding = true
  }
  t.diagnostic('Funding confirmed through Mobile UI using Bank quote and early savings withdrawal.')
  await wide.context.close()

  const { page } = await player(390)
  // Supply entropy for this one test creation, so all required encounters occur.
  // Session creation, actions, snapshots and replay still use the real API and engine.
  const originalEntropy = globalThis.crypto.getRandomValues.bind(globalThis.crypto)
  let fixedSeedUsed = false
  t.mock.method(globalThis.crypto, 'getRandomValues', (value: ArrayBufferView<ArrayBuffer>) => {
    if (!fixedSeedUsed && value instanceof Uint32Array && value.length === 4) {
      fixedSeedUsed = true
      value.set([2, 0xabcdef01, 0x01234567, 0xdeadcafe])
      return value
    }
    return originalEntropy(value)
  })
  const id = await create(page, 10_000_000)
  assert.equal(fixedSeedUsed, true)
  t.mock.restoreAll()
  assert.equal((await direct(id, outsider)).status, 404)
  const foreign = await player(390, outsider)
  await foreign.page.getByText('Bạn chưa có ván trực tuyến.').waitFor()
  await foreign.context.close()
  const initial = await (await direct(id)).json()
  assert.equal(initial.state.portfolio.cash, 40_000_000)
  const device = await player(390, expired, token)
  const tab = device.page
  await tab.getByRole('button', { name: /Tiếp tục ván/ }).first().press('Enter')
  assert.deepEqual(device.statuses.slice(0, 2), [401, 200])
  await tab.getByRole('button', { name: 'Bắt đầu vòng 1', exact: true }).waitFor()
  const initialButton = page.getByRole('button', { name: 'Bắt đầu vòng 1', exact: true })
  const first = await action(page, () => initialButton.evaluate((button: HTMLButtonElement) => { button.click(); button.click() }))
  assert.equal(first.stateVersion, 1)
  await action(tab, () => tab.getByRole('button', { name: 'Bắt đầu vòng 1', exact: true }).click(), 409)
  await tab.getByText('Ván đã thay đổi. Đã tải lại trạng thái từ máy chủ.').waitFor()
  await device.context.close()

  let seenFailedKey: string | undefined
  let replayedKey: string | undefined
  const matcher = '**/actions'
  await page.route(matcher, async (route: { request: () => { headers: () => Record<string, string> }; fetch: () => Promise<{ status: () => number }>; abort: () => Promise<void>; continue: () => Promise<void> }) => {
    const key = route.request().headers()['idempotency-key']
    if (!seenFailedKey) {
      seenFailedKey = key
      const committed = await route.fetch()
      assert.equal(committed.status(), 200)
      await route.abort()
    } else { replayedKey = key; await route.continue() }
  })
  await rollDice(page)
  await page.getByRole('button', { name: 'Thử lại thao tác', exact: true }).waitFor()
  let current = await action(page, () => page.getByRole('button', { name: 'Thử lại thao tác', exact: true }).click())
  assert.equal(current.stateVersion, 2)
  assert.ok(seenFailedKey)
  assert.equal(replayedKey, seenFailedKey)
  await page.unroute(matcher)

  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Bắt đầu phiêu lưu' }).click()
  const restoredResponse = page.waitForResponse((response: { url: () => string; status: () => number }) =>
    response.url().endsWith('/v1/game-sessions/' + id) && response.status() === 200)
  await page.getByRole('button', { name: /Tiếp tục ván/ }).first().press('Enter')
  const restored = await (await restoredResponse).json()
  assert.equal(restored.session.stateVersion, 2)
  assert.deepEqual(restored.state.portfolio, current.state.portfolio)

  const openFox = async () => {
    const button = page.getByRole('button', { name: 'Cáo EXE', exact: true })
    if (await button.getAttribute('aria-expanded') !== 'true') await button.click()
  }
  const foxEvidence = () => page.getByLabel('Cáo giải thích từ ván đã lưu')
  let checkedFoxAtStart = false
  const covered = new Set<string>(exercisedFunding ? ['funding'] : [])
  t.diagnostic('Setup checked at 320/390/1440 px. Refresh, separate device context and lost response checked at 390 px.')
  for (let i = 0; i < 120 && current.state.phase !== 'finished'; i++) {
    const state = current.state
    covered.add(state.phase)
    if (state.phase === 'rolling') {
      try {
        current = await action(page, () => rollDice(page))
      } catch (error) {
        t.diagnostic(JSON.stringify({ step: i, phase: state.phase, lap: state.lap, version: current.stateVersion,
          serverVersion: (await (await direct(id)).json()).session?.stateVersion, browserErrors: errors }))
        throw error
      }
    } else if (state.phase === 'forecast') {
      current = await action(page, () => page.getByRole('button', { name: 'Bắt đầu vòng ' + state.lap, exact: true }).click())
    } else if (state.phase === 'summary') {
      current = await action(page, () => page.getByRole('button', { name: 'Ghé ví tại ô Xuất phát', exact: true }).click())
    } else if (state.phase === 'rebalancing') {
      if (!checkedFoxAtStart) {
        await page.context().setOffline(true)
        await openFox()
        await foxEvidence().getByText('Quyết toán START vòng ' + state.lap, { exact: true }).waitFor()
        await page.getByRole('button', { name: 'Cáo EXE', exact: true }).click()
        await page.context().setOffline(false)
        checkedFoxAtStart = true
      }
      const sell = state.start.sales.find((sale: { asset: string; symbolId?: string }) => sale.asset === 'gold' || !sale.symbolId)
      if (sell && !covered.has('rebalance-trade')) {
        const choice = ['sell', sell.asset, sell.symbolId, sell.lotId].filter(Boolean).join('-')
        current = await transaction(page, choice, true, Math.min(sell.maxAmount, 1_000_000))
        covered.add('rebalance-trade')
      } else current = await action(page, () => page.getByRole('button', { name: /Kết thúc điều chỉnh|Chốt kết quả/ }).click())
    } else if (state.phase === 'funding') {
      const option = state.fundingOptions.find((item: { source: string }) => item.source === 'savings')
        ?? state.fundingOptions.find((item: { source: string }) => item.source === 'debt') ?? state.fundingOptions[0]
      current = await transaction(page, [option.source, option.lotId].filter(Boolean).join('-'), ['savings', 'debt'].includes(option.source))
    } else if (state.phase === 'event') {
      if (state.tradingAsset && state.portfolio.cash >= 1_000_000 && !covered.has('trading') &&
          await page.locator('#server-transaction option[value^="buy-"]').first().count()) {
        const choice = await page.locator('#server-transaction option[value^="buy-"]').first().getAttribute('value')
        current = await transaction(page, choice, true)
        covered.add('trading')
      } else if (state.bank.canDeposit && state.portfolio.cash > 10_000_000 && !covered.has('bank')) {
        current = await transaction(page, 'deposit', true)
        covered.add('bank')
      } else if (state.business.actions.some((item: { kind: string }) => item.kind === 'buy') && !covered.has('business')) {
        current = await transaction(page, 'buy-business', true)
        covered.add('business')
      } else {
        const id = ['skip', 'acknowledge', 'defer', 'temporary'].find(option => state.options.some((item: { id: string }) => item.id === option))
          ?? state.options[0].id
        current = await action(page, () => page.locator('[data-option-id="' + id + '"]').click())
      }
    }
  }
  assert.equal(current.state.phase, 'finished')
  assert.equal(current.state.summaries.length, 4)
  t.diagnostic('Four rounds completed through Mobile UI. Operations: ' + [...covered].join(', '))
  assert.ok(checkedFoxAtStart)
  const coachRequests: string[] = []
  page.on('request', (request: { url: () => string }) => {
    if (/\/coach(?:[/?]|$)/u.test(request.url())) coachRequests.push(request.url())
  })
  await page.context().setOffline(true)
  await openFox()
  await foxEvidence().getByText(/Ván đã hoàn tất 4 vòng/).waitFor()
  const officialCoachText = await foxEvidence().innerText()
  const question = page.getByRole('textbox', { name: 'Câu hỏi về ván hoặc luật EXE' })
  const sendQuestion = () => page.getByRole('button', { name: 'Hỏi Cáo', exact: true }).click()
  await question.fill('Thanh khoản là gì?')
  await sendQuestion()
  await page.getByText(/Thanh khoản nói về khả năng huy động tiền/).waitFor()
  await question.fill('Vì sao cuối ván chưa đạt mục tiêu?')
  await sendQuestion()
  await page.locator('.mascot-learning-answer').getByText(/mốc mục tiêu/).waitFor()
  await question.fill('Bạn có thể tiên đoán tỷ giá ngày mai?')
  await sendQuestion()
  await page.getByText(/Mình chưa có đủ dữ kiện/).waitFor()
  assert.equal(coachRequests.length, 0)
  await page.context().setOffline(false)
  const optIn = page.getByRole('checkbox', { name: /Cho phép gửi câu hỏi này tới Gemini/ })
  const assist = page.getByRole('button', { name: 'Nhờ Gemini tìm nội dung' })
  assert.equal(await assist.isDisabled(), true)
  await optIn.check()
  await page.route('**/coach/learn', (route: { abort: () => Promise<void> }) => route.abort())
  await assist.click()
  await page.getByRole('alert').filter({ hasText: 'Chưa nhận được phản hồi' }).waitFor()
  await page.unroute('**/coach/learn')
  await optIn.check()
  await assist.click()
  await page.getByText('Gemini chưa được bật cho Cáo.').waitFor()
  assert.equal(coachRequests.length, 2)
  await page.getByRole('button', { name: 'Cáo EXE', exact: true }).click()
  await page.getByText('Kết quả chính thức · Nguồn huy động hợp lệ').waitFor()
  const persisted = await (await direct(id)).json()
  assert.deepEqual(persisted.result, current.result)
  const snapshots = await database.db.select({
    version: gameSnapshots.stateVersion,
    schemaVersion: gameSnapshots.schemaVersion,
    hash: sql<string>`encode(sha256(convert_to(${gameSnapshots.payload}, 'UTF8')), 'hex')`,
  }).from(gameSnapshots).where(eq(gameSnapshots.sessionId, id)).orderBy(gameSnapshots.stateVersion)
  const actions = await database.db.select().from(gameActions).where(eq(gameActions.sessionId, id)).orderBy(gameActions.sequence)
  const [result] = await database.db.select().from(gameResults).where(eq(gameResults.sessionId, id))
  const [session] = await database.db.select().from(gameSessions).where(eq(gameSessions.id, id))
  const [final] = await database.db.select({ payload: gameSnapshots.payload }).from(gameSnapshots)
    .where(eq(gameSnapshots.sessionId, id)).orderBy(sql`${gameSnapshots.stateVersion} desc`).limit(1)
  let engine = createMultiCourseGame(session.seed, session.initialSavings, session.savingsTerm)
  const digest = () => createHash('sha256').update(serializeLog(engine)).digest('hex')
  assert.deepEqual(snapshots[0], { version: 0, schemaVersion: 7, hash: digest() })
  for (const [index, row] of actions.entries()) {
    const command = gameActionBody.parse({ actionId: row.actionType, payload: row.payload, expectedStateVersion: index })
    switch (command.actionId) {
      case 'advance': engine = advance(engine); break
      case 'roll': engine = roll(engine); break
      case 'choose': engine = decide(engine, command.payload.optionId); break
      case 'trade': engine = transact(engine, command.payload); break
      case 'fund': engine = fundPayment(engine, command.payload.source, command.payload.amount,
        'lotId' in command.payload ? command.payload.lotId : undefined); break
    }
    assert.deepEqual(snapshots[index + 1], { version: index + 1, schemaVersion: 7, hash: digest() },
      'Canonical replay after action ' + (index + 1) + ' (' + row.actionType + ')')
  }
  const replay = replayGameLog(JSON.parse(final.payload))
  assert.equal(serializeLog(replay), final.payload)
  assert.equal(result.lawfulProceedsVnd, BigInt(liquidatableFunds(replay)))
  assert.equal(result.outcome, victory(replay).won ? 'victory' : 'defeat')
  assert.equal(session.stateVersion, actions.length)
  assert.equal(snapshots.length, actions.length + 1)
  assert.equal(actions.filter(entry => entry.idempotencyKey === seenFailedKey).length, 1)
  assert.equal(await page.evaluate(() => localStorage.getItem('xvtl:mobile:game:v1')), null)
  // Compare from the official result at mobile width; recover from a lost response
  // and after a full page refresh, using the same saved game and no browser game state.
  const whatIfName = 'Nếu chọn khác thì sao?'
  const launchWhatIf = () => page.getByRole('button', { name: whatIfName, exact: true }).click()
  const decision = () => page.getByLabel('Quyết định đã thực hiện')
  const omitTrade = () => page.getByRole('button', { name: 'Bỏ giao dịch này', exact: true }).click()
  await launchWhatIf()
  const sale = actions.findLast(row => row.actionType === 'trade' && row.payload.kind === 'sell')
  assert.ok(sale)
  await decision().selectOption(String(sale.sequence))
  await page.route('**/what-if', async (route: { request: () => { method: () => string }; abort: () => Promise<void>; continue: () => Promise<void> }) => {
    if (route.request().method() === 'POST') await route.abort()
    else await route.continue()
  })
  await omitTrade()
  await page.getByRole('alert').filter({ hasText: 'Chưa nhận được phản hồi' }).waitFor()
  await page.unroute('**/what-if')
  const evaluate = async () => {
    const [response] = await Promise.all([
      page.waitForResponse((response: { url: () => string; request: () => { method: () => string } }) =>
        response.url().endsWith('/what-if') && response.request().method() === 'POST'),
      omitTrade(),
    ])
    assert.equal(response.status(), 200, await response.text())
    const comparison = await response.json()
    assert.equal(comparison.status, 'completed')
    assert.deepEqual(comparison.alternative.completedLaps, [1, 2, 3, 4])
    assert.deepEqual(comparison.actual.lawfulProceedsVnd, persisted.result.lawfulProceedsVnd)
    await page.getByRole('heading', { name: 'So sánh sau vòng 4' }).waitFor()
    await page.getByRole('heading', { name: 'Vì sao kết quả khác?' }).waitFor()
    await page.context().setOffline(true)
    await page.getByText('Cáo giải thích What-if', { exact: true }).click()
    await page.getByRole('heading', { name: 'Quyết định gốc' }).waitFor()
    await page.getByRole('heading', { name: 'Quyết định thay thế' }).waitFor()
    await page.getByRole('heading', { name: 'Nguồn huy động ở cuối vòng 4' }).waitFor()
    await page.context().setOffline(false)
    return comparison
  }
  const beforeRefresh = await evaluate()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Bắt đầu phiêu lưu' }).click()
  await page.getByRole('button', { name: /Xem kết quả/ }).first().press('Enter')
  await openFox()
  await foxEvidence().getByText(/Ván đã hoàn tất 4 vòng/).waitFor()
  assert.equal(await foxEvidence().innerText(), officialCoachText)
  await page.getByRole('button', { name: 'Cáo EXE', exact: true }).click()
  await launchWhatIf()
  await decision().selectOption(String(sale.sequence))
  assert.deepEqual(await evaluate(), beforeRefresh)
  assert.deepEqual(await (await direct(id)).json(), persisted)
  t.diagnostic('Fox START, offline endgame and Q&A, explicit Gemini opt-in with OFF fallback, network retry, reload and offline What-if explanation verified.')
  t.diagnostic('What-if comparison and recovery verified through Chromium Mobile with a completed PostgreSQL game.')
  assert.deepEqual(errors, [])
  for (const required of ['rolling', 'event', 'funding', 'trading', 'bank', 'business', 'summary', 'rebalancing', 'rebalance-trade']) {
    assert.ok(covered.has(required), 'Browser journey did not encounter ' + required)
  }
  t.diagnostic('Mobile UI phases and operations: ' + [...covered].join(', ') + '. Committed actions: ' + actions.length)
})
