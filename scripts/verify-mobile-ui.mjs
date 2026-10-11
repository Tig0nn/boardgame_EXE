// Browser regression checks. No game state is injected into the production app.
// Run: node --experimental-strip-types scripts/verify-mobile-ui.mjs (Vite must be running).
// PLAYWRIGHT_MODULE optionally points to an existing bundled Playwright installation.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { createGame, advance, roll, decide, transact, canChoose } from '../src/game/engine.ts'
import { liquidatableFunds } from '../src/game/selectors.ts'
import { boardFor } from '../src/data/board.ts'
import { EVENTS } from '../src/data/events.ts'
import { money } from '../src/game/format.ts'
import { replayGameLog } from './diagnostics/replay-game-log.ts'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const base = process.env.UI_URL || 'http://localhost:5173'
const folder = 'docs/playtests/mobile-mvp'
mkdirSync(folder, { recursive: true })
const errors = []
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(`${message.text()} (${message.location().url})`) })
let screenshots = 0
async function screenshot(name) {
  await page.screenshot({ path: `${folder}/${name}.png`, fullPage: await page.locator('dialog[open]').count() === 0 })
  screenshots++
}
async function fit() {
  const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(el => el.tagName + '.' + el.className) }))
  assert.ok(overflow.scroll <= overflow.width, `No horizontal page overflow: ${JSON.stringify(overflow)}`)
  const panel = page.locator('dialog[open]')
  if (await panel.count()) {
    assert.ok(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'No horizontal dialog overflow')
    const box = await panel.boundingBox()
    const viewport = page.viewportSize()
    assert.ok(box.x >= -1 && box.x + box.width <= viewport.width + 1 && box.y >= 0 && box.y + box.height <= viewport.height + 1, 'Dialog fits viewport')
  }
}
async function cash(expected) {
  await page.waitForFunction(value => document.querySelector('.event-cash strong')?.textContent === value, money(expected))
}
async function fixture(name) {
  await page.goto(`${base}/scripts/playtest-harness.html`)
  await page.getByRole('combobox', { name: 'Fixture', exact: true }).selectOption(name)
  await page.getByRole('button', { name: 'Nạp fixture', exact: true }).click()
  await page.locator('dialog[open]').waitFor()
  await fit()
  assert.equal(await page.locator('dialog[open]').evaluate(el => el.scrollTop), 0, 'Financial panel opens at its heading')
}
try {
  for (const [width, height] of [[320, 740], [390, 844], [430, 932], [1440, 1000]]) {
    await page.setViewportSize({ width, height })
    await page.goto(base)
    await page.evaluate(() => document.fonts.ready)
    assert.equal(await page.locator('#game-mode').count(), 0, 'Setup exposes only the primary C20 mode')
    await fit()
    await screenshot(`${width}-setup`)
    const startBox = await page.getByRole('button', { name: 'Bắt đầu hành trình' }).boundingBox()
    assert.ok(startBox.y + startBox.height <= height, 'Start action is visible without opening custom settings')
    await page.getByRole('button', { name: 'Luật chơi', exact: true }).click()
    assert.match(await page.getByRole('dialog').textContent(), /4 vòng/)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Bắt đầu hành trình' }).click()
    await page.getByRole('button', { name: 'Bắt đầu vòng 1' }).click()
    const tiles = await page.locator('[data-tile-index]').evaluateAll(nodes => nodes.map(node => ({ index: Number(node.dataset.tileIndex), category: node.dataset.category, label: node.getAttribute('aria-label') })))
    assert.deepEqual(tiles.map(t => [t.index, t.category]), boardFor({ boardLayout: 'C20' }).map(t => [t.index, t.category]))
    assert.match(tiles[13].label, /Kinh doanh/)
    assert.equal(await page.locator('.die').count(), 1)
    await fit()
    await screenshot(`${width}-board`)
    await page.locator('[data-tile-index="13"]').focus()
    await page.keyboard.press('Enter')
    assert.equal(await page.getByRole('dialog', { name: 'Ô 14: Kinh doanh' }).count(), 1)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Tài sản', exact: true }).click()
    await fit()
    await screenshot(`${width}-portfolio`)
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Luật chơi', exact: true }).click()
    await fit()
    await page.getByRole('button', { name: 'Đã hiểu' }).click()
    await page.locator('.forecast-disclosure summary').click()
    assert.ok(await page.locator('.forecast-disclosure .forecast').isVisible())
    await page.locator('.forecast-disclosure summary').click()
    await page.getByRole('button', { name: 'Nhật ký', exact: true }).click()
    await fit()
    await page.keyboard.press('Escape')
  }

  // Complete real four-lap B game, matching the historical V2.2 browser playthrough.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(base)
  await page.locator('.setup-customize summary').click()
  await page.locator('#allocation').focus()
  await page.keyboard.press('Home')
  for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowRight')
  await page.locator('#initial-term').selectOption('3')
  await page.locator('#seed').fill('XVTL-V2-6')
  await page.getByRole('button', { name: 'Bắt đầu hành trình' }).click()
  let expected = createGame('XVTL-V2-6', 30_000_000, 3, 'experimental-b')
  let guard = 0
  while (expected.phase !== 'finished' && guard++ < 160) {
    if (expected.phase === 'forecast') {
      await page.getByRole('button', { name: `Bắt đầu vòng ${expected.lap}` }).click()
      expected = advance(expected)
    } else if (expected.phase === 'rolling') {
      const previousTurn = expected.turn
      await page.getByRole('button', { name: 'Gieo xúc xắc', exact: true }).click()
      // A second click while the animation runs must not draw a second die.
      await page.getByRole('button', { name: 'Đang gieo…' }).dispatchEvent('click')
      expected = roll(expected)
      await page.waitForFunction(turn => document.querySelector('.location-turn')?.textContent === `Lượt ${turn}`, previousTurn + 1)
      assert.equal(await page.locator('[aria-current="step"]').getAttribute('data-tile-index'), String(expected.position))
      assert.equal(await page.locator('.die').getAttribute('aria-label'), `Xúc xắc ${expected.dice}`)
      assert.equal(await page.locator('.die .visible').count(), expected.dice)
    } else if (expected.phase === 'event') {
      const event = EVENTS.find(e => e.id === expected.eventId)
      await page.getByRole('dialog', { name: event.title, exact: true }).waitFor()
      if (expected.eventId === 'bank') {
        const term = expected.lap === 3 ? 2 : 1
        await page.locator('#deposit-term').selectOption(String(term))
        await page.locator('#trade-amount').fill('5000000')
        await page.getByRole('button', { name: /Xác nhận gửi khoản mới/ }).click()
        expected = transact(expected, { kind: 'deposit', amount: 5_000_000, term })
        await cash(expected.portfolio.cash)
      }
      const option = event.id === 'course' && canChoose(expected, 'upgrade') ? event.options[0] : event.options.find(o => o.id === 'skip') || event.options[0]
      await fit()
      if ([1, 8, 16, 22].includes(expected.turn)) await screenshot(`game-event-${expected.eventId}`)
      await page.getByRole('button', { name: option.label, exact: false }).click()
      expected = decide(expected, option.id)
    } else if (expected.phase === 'summary') {
      await page.getByRole('dialog', { name: `Quyết toán vòng ${expected.lap}` }).waitFor()
      await fit()
      await screenshot(`game-start-${expected.lap}`)
      await page.getByRole('button', { name: 'Mở quyền bán tại START' }).click()
      expected = advance(expected)
    } else if (expected.phase === 'rebalancing') {
      await page.getByRole('button', { name: expected.lap === 4 ? 'Xem kết quả hành trình' : 'Hoàn tất · Xem dự báo' }).click()
      expected = advance(expected)
    } else throw Error(`Unexpected phase ${expected.phase}`)
    assert.equal(await page.locator('.status-cash strong').textContent(), money(expected.portfolio.cash))
    assert.equal(await page.locator('.status-funds strong').textContent(), money(liquidatableFunds(expected)))
    assert.equal(await page.locator('.status-goal progress').getAttribute('value'), String(liquidatableFunds(expected)))
  }
  assert.equal(expected.termination, 'completed')
  assert.equal(expected.turn, 26)
  assert.equal(liquidatableFunds(expected), 102_800_000)
  await page.getByRole('dialog', { name: 'Kết quả hành trình' }).waitFor()
  await fit()
  await screenshot('390-result')
  await page.setViewportSize({ width: 320, height: 740 })
  await fit()
  await screenshot('320-result')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Tải nhật ký quyết định' }).click()
  const download = await downloadPromise
  const logFile = `${folder}/browser-game-log.json`
  await download.saveAs(logFile)
  const data = JSON.parse(readFileSync(logFile, 'utf8'))
  assert.deepEqual([...new Set(data.entries.filter(entry => entry.kind === 'roll').map(entry => entry.after.dice))].sort(), [1, 2, 3, 4, 5, 6])
  const replay = replayGameLog(data)
  assert.deepEqual(JSON.parse(JSON.stringify(replay)), JSON.parse(JSON.stringify(expected)))
  assert.deepEqual(data.state, JSON.parse(readFileSync('docs/playtests/v2_2-b-log.json', 'utf8')).state)
  writeFileSync(`${logFile}.gz`, gzipSync(readFileSync(logFile)))
  rmSync(logFile)

  // Controlled financial panels: verify every transaction family using real UI actions.
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
    for (const name of ['bank', 'stocks', 'bonds', 'gold', 'business', 'business-upgrade', 'funding', 'withdrawal', 'lap4', 'locked-final', 'insolvent', 'start-sales']) {
      await fixture(name)
      await screenshot(`${width}-${name}`)
      if (['bank', 'stocks', 'bonds', 'gold'].includes(name)) {
        await page.locator('#trade-amount').fill('0')
        assert.ok(await page.getByRole('button', { name: /Xác nhận (mua|gửi)/ }).isDisabled())
        await page.locator('#trade-amount').fill('1000000')
        await page.getByRole('button', { name: /Xác nhận (mua|gửi)/ }).click()
        await cash(49_000_000)
      } else if (name === 'business') {
        await page.getByRole('button', { name: /Đầu tư cơ sở/ }).click()
        await cash(30_000_000)
        assert.ok(await page.getByRole('button', { name: /Nâng cấp/ }).isDisabled())
        await page.getByRole('button', { name: /Bán toàn cơ sở/ }).click()
        await cash(44_000_000)
      } else if (name === 'business-upgrade') {
        await page.getByRole('button', { name: /Nâng cấp/ }).click()
        await cash(25_000_000)
        await page.getByRole('button', { name: /Bán toàn cơ sở/ }).click()
        assert.ok(await page.getByRole('button', { name: /Đầu tư cơ sở/ }).isVisible())
      } else if (name === 'funding' || name === 'withdrawal') {
        await page.getByRole('button', { name: /Thanh toán 5/ }).click()
        await page.getByRole('dialog', { name: 'Chọn nguồn thanh toán' }).waitFor()
        await fit()
        await screenshot(`${width}-${name}-sources`)
        await page.keyboard.press('Escape')
        assert.ok(await page.getByRole('dialog').isVisible(), 'Mandatory financial decision cannot be dismissed')
        if (name === 'funding') {
          await page.getByRole('button', { name: /Vay phần còn thiếu/ }).click()
          await page.locator('#fund-amount').fill('1000000')
          await page.getByRole('button', { name: 'Dùng nguồn tiền này' }).click()
          await page.getByRole('button', { name: /Bán cổ phiếu/ }).click()
        }
        await page.getByRole('button', { name: 'Dùng nguồn tiền này' }).click()
        assert.equal(await page.locator('dialog[open]').count(), 0)
      } else if (name === 'start-sales') {
        for (const asset of ['stocks', 'bonds', 'gold']) {
          await page.locator('#sell-asset').selectOption(asset)
          await page.getByRole('button', { name: 'Xác nhận bán', exact: false }).click()
        }
        await page.getByRole('button', { name: /Trả .* gốc/ }).click()
        assert.equal(await page.getByRole('button', { name: /Trả .* gốc/ }).count(), 0)
      }
      await fit()
    }
  }
  assert.deepEqual(errors, [], 'Browser console has no errors')
  const evidence = { widths: [320, 390, 430, 1440], screenshots, errors, seed: expected.seed,
    mode: expected.gameMode, board: expected.boardLayout, laps: expected.summaries.map(s => s.lap),
    rolls: expected.turn, lawfulProceeds: liquidatableFunds(expected), fullSnapshotReplay: true,
    matchesHistoricalV22Game: true, transactionPanels: ['bank', 'stocks', 'bonds', 'gold', 'business', 'funding', 'START', 'result'] }
  writeFileSync(`${folder}/verification.json`, JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify(evidence, null, 2))
} finally { await browser.close() }
