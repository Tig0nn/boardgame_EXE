// Browser regression for the real player entry point; no test-state injection or animation skipping.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { createPlayerGame } from '../src/game/new-game.ts'
import { advance, decide, roll, transact } from '../src/game/engine.ts'
import { EVENTS } from '../src/data/events.ts'
import { liquidatableFunds, victory } from '../src/game/selectors.ts'
import { replayGameLog } from './diagnostics/replay-game-log.ts'
import { businessIncome } from '../src/game/business.ts'

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { createServer } = await import('../mobile_app/node_modules/vite/dist/node/index.js')
const server = process.env.UI_URL ? null : await createServer({ root: fileURLToPath(new URL('../mobile_app', import.meta.url)), server: { host: '127.0.0.1', port: 5186, strictPort: true } })
await server?.listen()
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
const base = process.env.UI_URL || 'http://127.0.0.1:5186'
const folder = process.env.MVP_EVIDENCE_DIR || 'docs/playtests/mobile-ui-final'
mkdirSync(folder, { recursive: true })
const errors = []; const consoleErrors = []; const checkpoints = []; const widths = [320, 390, 430, 1440]
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
try {
// External fonts are optional. Keep browser verification independent of Internet connectivity.
await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }))
await page.goto(base)
await page.getByRole('dialog', { name: 'Hướng dẫn chơi' }).waitFor()
for (let step = 1; step <= 6; step++) {
  assert.equal(await page.getByRole('progressbar', { name: 'Tiến độ hướng dẫn' }).getAttribute('aria-valuenow'), String(step))
  if (step < 6) await page.getByRole('button', { name: 'Tiếp theo →', exact: true }).click()
}
await page.getByRole('button', { name: 'Sẵn sàng chơi!', exact: true }).click()
await page.reload()
await page.getByRole('dialog', { name: 'Bắt đầu hành trình' }).waitFor()
assert.equal(await page.getByRole('dialog', { name: 'Hướng dẫn chơi' }).count(), 0, 'Completed onboarding stays dismissed')
for (const width of widths) {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
  await page.getByRole('dialog', { name: 'Bắt đầu hành trình' }).waitFor()
  const box = await page.getByRole('dialog').boundingBox()
  assert.ok(box.x >= 0 && box.x + box.width <= width)
  await page.screenshot({ path: `${folder}/${width}-setup.png` })
}
await page.setViewportSize({ width: 390, height: 844 })
await page.getByRole('radio', { name: '2 START · 5% mỗi START · 10% cuối kỳ', exact: true }).check()
await page.getByRole('dialog', { name: 'Bắt đầu hành trình' }).getByRole('button', { name: 'Mở sổ tay', exact: true }).click()
await page.getByRole('dialog', { name: 'Sổ tay hành trình' }).getByRole('button', { name: 'Đóng', exact: true }).click()
assert.equal(await page.getByRole('radio', { name: '2 START · 5% mỗi START · 10% cuối kỳ', exact: true }).isChecked(), true, 'Rulebook preserves the selected savings term')
await page.getByRole('radio', { name: '1 START · 4% mỗi START · 4% cuối kỳ', exact: true }).check()
await page.getByText('Chơi lại cùng hành trình', { exact: true }).click()
const seed = 'mobile-browser-v24'
await page.getByLabel('Mã hành trình', { exact: true }).fill(seed)
await page.getByRole('button', { name: 'Bắt đầu hành trình', exact: true }).click()
let web = createPlayerGame(seed, 20e6, 1)
let moves = 0; let stockBuys = 0; let bankDeposits = 0; let businessPurchases = 0; let upgrades = 0
while (web.phase !== 'finished') {
  // Separate intentional decisions from the UI's 300ms double-tap guard.
  await page.waitForTimeout(310)
  if (web.phase === 'forecast') {
    await page.getByRole('button', { name: `Bắt đầu vòng ${web.lap}`, exact: true }).click()
    web = advance(web)
    if (web.lap === 1) for (const width of widths) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
      await page.screenshot({ path: `${folder}/${width}-board.png` })
      const target = await page.getByRole('button', { name: 'Gieo xúc xắc', exact: true }).boundingBox()
      assert.ok(target.width >= 44 && target.height >= 44)
    }
    await page.setViewportSize({ width: 390, height: 844 })
  } else if (web.phase === 'rolling') {
    const button = page.getByRole('button', { name: 'Gieo xúc xắc', exact: true })
    await button.waitFor()
    await button.click()
    // Repeated tapping during flight must never draw again.
    assert.equal(await button.isDisabled(), true)
    web = roll(web); moves++
    if (web.phase !== 'rolling') await page.getByRole('dialog').waitFor({ timeout: 10_000 })
    else await page.waitForFunction(() => !document.querySelector('button[aria-label="Gieo xúc xắc"]').disabled)
    if (moves === 1) for (const width of widths) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
      await page.screenshot({ path: `${folder}/${width}-first-event.png` })
    }
    await page.setViewportSize({ width: 390, height: 844 })
  } else if (web.phase === 'event') {
    const event = EVENTS.find(e => e.id === web.eventId)
    const mobileTitle = { stocks: 'Cổ phiếu', bonds: 'Trái phiếu', gold: 'Vàng', business: 'Quán của bạn' }[event.id] ?? event.title
    await page.getByRole('dialog', { name: mobileTitle }).waitFor()
    if (event.id === 'bank' && web.portfolio.cash >= 15e6) {
      await page.locator('#trade-amount').fill('5000000')
      await page.getByRole('button', { name: /^Gửi tiết kiệm/ }).click()
      web = transact(web, { kind: 'deposit', amount: 5e6, term: 1 }); bankDeposits++
    } else if (event.id === 'stocks' && web.portfolio.cash >= 15e6) {
      await page.locator('#trade-amount').fill('5000000')
      await page.getByRole('button', { name: /^Mua / }).click()
      web = transact(web, { kind: 'buy', asset: 'stocks', amount: 5e6, symbolId: 'FPT', term: 1, completeEncounter: true }); stockBuys++
    } else if (event.id === 'business' && !web.business.capital && web.lap <= 2 && web.portfolio.cash >= 30e6) {
      await page.getByRole('button', { name: /^Mở quán / }).click()
      web = transact(web, { kind: 'buy', asset: 'business', amount: 20e6 }); businessPurchases++
    } else if (event.id === 'business' && web.business.capital && web.lap <= 2 && web.portfolio.cash >= 15e6 &&
      !web.log.some(e => e.turn === web.turn && e.decisionId === 'upgrade-business')) {
      await page.getByRole('button', { name: /^Nâng cấp/ }).click()
      web = transact(web, { kind: 'upgrade', asset: 'business', amount: 5e6, customerPreferenceId: web.customerPreferenceId }); upgrades++
    } else if (event.id === 'business' && web.business.capital && web.lap >= 3) {
      await page.getByRole('button', { name: /Bán toàn cơ sở/ }).click()
      web = transact(web, { kind: 'sell', asset: 'business', amount: web.portfolio.business })
    } else {
      const option = event.id === 'course' && !web.coursePurchased && web.portfolio.cash >= 6e6 ? event.options.find(o => o.id === 'upgrade')
        : event.options.find(o => o.id === 'skip') ?? event.options[0]
      if (option.id === 'skip' && event.id === 'stocks') await page.getByRole('button', { name: 'Bỏ qua cơ hội', exact: true }).click()
      else if (option.id === 'skip') await page.getByRole('button', { name: /Bỏ qua cơ hội|Hoàn tất · Về bàn chơi/ }).click()
      else if (option.id === 'acknowledge') await page.getByRole('button', { name: 'Đi tiếp', exact: true }).click()
      else await page.getByRole('button').filter({ has: page.getByText(option.label, { exact: true }) }).click()
      web = decide(web, option.id)
    }
  } else if (web.phase === 'summary') {
    await page.getByRole('button', { name: 'Ghé ví tại START →', exact: true }).click()
    checkpoints.push({ lap: web.lap, cash: web.portfolio.cash, lawfulProceeds: liquidatableFunds(web) })
    web = advance(web)
  } else if (web.phase === 'rebalancing') {
    await page.getByRole('button', { name: web.lap === 4 ? /Xem kết quả hành trình/ : /Hoàn tất · Xem dự báo/ }).click()
    web = advance(web)
  } else throw new Error(`Unexpected funding in conservative browser fixture: ${web.pendingPayment?.remaining}`)
}
assert.equal(web.summaries.length, 4)
await page.getByRole('dialog', { name: 'Kết quả hành trình' }).waitFor()
const downloaded = page.waitForEvent('download')
await page.getByText('Chi tiết kết quả & nhật ký', { exact: true }).click()
await page.getByRole('button', { name: 'Lưu nhật ký hành trình', exact: true }).click()
const download = await downloaded
const log = JSON.parse(readFileSync(await download.path(), 'utf8'))
assert.deepEqual(log.state, JSON.parse(JSON.stringify(web)), 'Real UI financial state must match web engine exactly')
assert.deepEqual(replayGameLog(log), web)
writeFileSync(`${folder}/browser-game-log.json.gz`, gzipSync(JSON.stringify(log)))
await page.route('**/api/ai-coach', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ fallback: 'Phân tích AI hiện chưa sẵn sàng.' }) }))
await page.getByText('Nhìn lại hành trình', { exact: true }).click()
await page.getByRole('button', { name: 'Nhờ AI phân tích ván chơi' }).click()
await page.getByText('Phân tích AI hiện chưa sẵn sàng.', { exact: true }).waitFor()
assert.equal(await page.getByRole('button', { name: 'Chơi hành trình mới' }).isEnabled(), true)
for (const width of widths) {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
  await page.screenshot({ path: `${folder}/${width}-result.png` })
}
await page.getByRole('button', { name: 'Chơi hành trình mới' }).click()
await page.getByRole('button', { name: 'Bắt đầu hành trình', exact: true }).focus()
await page.keyboard.press('Enter')
await page.getByRole('button', { name: 'Bắt đầu vòng 1', exact: true }).waitFor()
const randomSeeds = []
for (let fresh = 0; fresh < 2; fresh++) {
  if (fresh) { await page.reload(); await page.getByRole('button', { name: 'Bắt đầu hành trình', exact: true }).click() }
  await page.getByRole('button', { name: 'Bắt đầu vòng 1', exact: true }).click()
  await page.locator('button[title="Nhật Ký Hành Trình"]').click()
  const exported = page.waitForEvent('download')
  await page.getByRole('button', { name: /Tải nhật ký JSON/ }).click()
  const startLog = JSON.parse(readFileSync(await (await exported).path(), 'utf8'))
  assert.match(startLog.seed, /^[a-f0-9]{32}$/)
  replayGameLog(startLog)
  randomSeeds.push(startLog.seed)
}
assert.notEqual(randomSeeds[0], randomSeeds[1])

// Isolated synthetic fixture coverage, distinct from the real four-lap game above.
await page.goto(`${base}/integration-harness.html?fixture=funding`)
await page.getByRole('dialog', { name: 'Chọn nguồn thanh toán' }).waitFor()
await page.keyboard.press('Escape')
assert.equal(await page.getByRole('dialog', { name: 'Chọn nguồn thanh toán' }).isVisible(), true)
assert.equal(await page.getByRole('button', { name: 'Gieo xúc xắc', exact: true }).isDisabled(), true)
await page.getByText('Đã dùng tiền mặt: 2.000.000 ₫', { exact: true }).waitFor()
for (const width of widths) {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
  await page.screenshot({ path: `${folder}/${width}-funding.png` })
}
await page.setViewportSize({ width: 390, height: 844 })
await page.getByRole('button', { name: /Dùng nguồn tiền này/ }).dblclick()
let funded = await page.evaluate(() => window.mobileHarness.getState())
assert.equal(funded.pendingPayment.remaining, 2e6)
assert.equal(funded.log.filter(e => e.kind === 'funding').length, 1, 'double tap cannot fund twice')
await page.waitForTimeout(310)
await page.getByRole('button', { name: /Bán vàng/ }).click()
await page.getByRole('button', { name: /Dùng nguồn tiền này/ }).click()
funded = await page.evaluate(() => window.mobileHarness.getState())
assert.equal(funded.pendingPayment.remaining, 79_400)
await page.waitForTimeout(310)
await page.getByRole('button', { name: /Dùng nguồn tiền này/ }).click()
funded = await page.evaluate(() => window.mobileHarness.getState())
assert.equal(funded.phase, 'rolling')
assert.equal(funded.portfolio.cash, 0)
assert.equal(funded.portfolio.debt, 79_400)
assert.equal(funded.log.find(e => e.kind === 'funding').lostSavingsInterest, 540_000)

await page.goto(`${base}/integration-harness.html?fixture=business`)
await page.getByRole('dialog', { name: 'Quán của bạn' }).waitFor()
await page.getByRole('button', { name: /^Nâng cấp/ }).dblclick()
const upgraded = await page.evaluate(() => window.mobileHarness.getState())
assert.equal(Object.values(upgraded.business.upgrades).reduce((sum, n) => sum + n, 0), 1)
assert.equal(businessIncome(upgraded), 4_700_000)
assert.equal(await page.getByRole('button', { name: /^Nâng cấp/ }).isDisabled(), true)
for (const width of widths) {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
  await page.screenshot({ path: `${folder}/${width}-business-upgraded.png` })
}
await page.goto(`${base}/integration-harness.html?fixture=bank`)
await page.getByRole('button', { name: /^Gửi tiết kiệm/ }).dblclick()
const deposited = await page.evaluate(() => window.mobileHarness.getState())
assert.equal(deposited.deposits.filter(l => l.status === 'active').length, 2)
assert.equal(deposited.phase, 'rolling')
assert.equal(deposited.deposits[0].principal, 3e6)
assert.equal(deposited.deposits[1].principal, 10e6)
await page.goto(`${base}/integration-harness.html?fixture=gold`)
await page.getByRole('button', { name: /^Mua / }).click()
await page.getByRole('button', { name: /^Mua / }).click()
assert.equal((await page.evaluate(() => window.mobileHarness.getState())).goldUnits, 6)
await page.waitForTimeout(310)
await page.getByRole('button', { name: /^Mua / }).click()
assert.equal((await page.evaluate(() => window.mobileHarness.getState())).goldUnits, 12, 'rejected fast tap must not permanently lock trading')
await page.goto(`${base}/integration-harness.html?fixture=rebalancing`)
await page.getByRole('dialog', { name: 'Ghé ví tại START' }).waitFor()
assert.deepEqual(await page.locator('#sell-asset option').evaluateAll(options => options.map(option => option.value)), ['stocks', 'bonds', 'gold'])
let expectedRebalance = await page.evaluate(() => window.mobileHarness.getState())
await page.getByRole('button', { name: /Xác nhận bán/ }).click()
expectedRebalance = transact(expectedRebalance, { kind: 'sell', asset: 'stocks', amount: 6e6 })
assert.deepEqual(await page.evaluate(() => window.mobileHarness.getState()), JSON.parse(JSON.stringify(expectedRebalance)))
await page.waitForTimeout(310)
await page.locator('#sell-asset').selectOption('gold')
await page.getByRole('button', { name: /Xác nhận bán/ }).click()
expectedRebalance = transact(expectedRebalance, { kind: 'sell', asset: 'gold', amount: 6e6 })
assert.deepEqual(await page.evaluate(() => window.mobileHarness.getState()), JSON.parse(JSON.stringify(expectedRebalance)))
assert.equal(expectedRebalance.business.capital, 20e6)
assert.equal(expectedRebalance.deposits[0].status, 'active')
await page.waitForTimeout(310)
await page.getByRole('button', { name: /Xem kết quả hành trình/ }).click()
assert.equal((await page.evaluate(() => window.mobileHarness.getState())).phase, 'finished')
assert.deepEqual(errors, [])
// A deliberately mocked 503 can be logged by Chrome; all other browser errors are failures.
const unexpectedConsole = consoleErrors.filter(e => !e.includes('503'))
assert.deepEqual(unexpectedConsole, [])
const result = { widths, moves, bankDeposits, stockBuys, businessPurchases, upgrades, checkpoints,
  fourLaps: true, fullStateParity: true, snapshotReplay: true, seed, victory: victory(web),
  lawfulProceeds: liquidatableFunds(web), pageErrors: errors, consoleErrors,
  keyboardStart: true, freshPlayerSeeds: randomSeeds, aiFailureNonBlocking: true, fundingDoubleTapGuard: true,
  combinedFunding: { savings: 3e6, goldGross: 2e6, goldNet: 1_920_600, debt: 79_400 },
  businessUpgradeOnce: true, matchingIncome: businessIncome(upgraded), multipleSavingsLots: true, tradingUnlockAfterRejectedTap: true, startSaleStateParity: true,
  animations: 'real 800ms dice + 400ms pause + 280ms per hop',
  realPhone: 'not available' }
writeFileSync(`${folder}/browser-verification.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify(result))
} catch (error) {
  await page.screenshot({ path: `${folder}/browser-failure.png` }).catch(() => {})
  writeFileSync(`${folder}/browser-failure.json`, JSON.stringify({ error: String(error), errors, consoleErrors }, null, 2))
  throw error
} finally {
  await browser.close()
  await server?.close()
}
