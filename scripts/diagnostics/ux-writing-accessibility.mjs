import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
const pw = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const root = 'docs/playtests/b18-mobile-ux-writing', out = `${root}/accessibility`
mkdirSync(out, { recursive: true })
const browser = await pw.chromium.launch({ headless: true, executablePath: 'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const checks = [], errors = []
async function open(c, name) {
  const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message))
  await p.goto('http://127.0.0.1:5210', { waitUntil: 'networkidle' })
  if (await p.getByRole('button', { name: 'Bỏ qua hướng dẫn' }).count()) await p.getByRole('button', { name: 'Bỏ qua hướng dẫn' }).click()
  await p.getByText('Mở ván đã lưu', { exact: true }).click()
  await p.locator('#saved-game-file').setInputFiles({ name: `${name}.json`, mimeType: 'application/json', buffer: gunzipSync(readFileSync(`${root}/checkpoints/${name}.json.gz`)) })
  await p.waitForTimeout(250)
  return p
}
const saved = p => p.evaluate(() => localStorage.getItem('xvtl:mobile:game:v1'))
async function capture(p, name) {
  const layout = await p.evaluate(() => ({ page: document.documentElement.scrollWidth <= innerWidth + 1,
    modal: [...document.querySelectorAll('dialog[open]')].every(e => e.scrollWidth <= e.clientWidth + 1) }))
  assert.ok(layout.page && layout.modal)
  await p.screenshot({ path: `${out}/${name}.png` })
  writeFileSync(`${out}/${name}.txt`, await p.locator('body').innerText())
}
try {
  for (const [width, height] of [[320, 740], [390, 844], [430, 932]]) {
    const c = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true })
    const p = await open(c, 'bonds'), before = await saved(p)
    assert.doesNotMatch(await p.locator('.bond-issuer-cards').innerText(), /\d\/2/)
    const detail = p.locator('.bond-credit-panel > .trade-details')
    await detail.locator('summary').click(); await detail.locator('p').nth(2).scrollIntoViewIfNeeded()
    await capture(p, `${width}-bond-risk-details`)
    assert.match(await detail.innerText(), /Mức 0 vẫn có thể chậm trả hoặc mất vốn; đây không phải nợ của bạn/)
    const term = p.locator('.financial-term-trigger').first()
    await term.tap(); assert.equal(await term.getAttribute('aria-expanded'), 'true')
    await capture(p, `${width}-coupon-explanation`)
    await p.keyboard.press('Escape'); assert.equal(await term.getAttribute('aria-expanded'), 'false')
    assert.equal(await p.locator('dialog[open]').count(), 1)
    await term.focus(); let reached = false
    for (let i = 0; i < 25; i++) {
      await p.keyboard.press('Tab')
      if (await p.evaluate(() => document.activeElement?.textContent?.startsWith('Mua trái phiếu'))) { reached = true; break }
    }
    assert.ok(reached, 'Primary purchase reachable with keyboard')
    const buy = p.getByRole('button', { name: /^Mua trái phiếu/ })
    await buy.click({ trial: true })
    const touchHeight = await buy.evaluate(e => e.getBoundingClientRect().height)
    assert.ok(touchHeight >= 44)
    assert.equal(await saved(p), before)
    checks.push({ width, name: 'bond-risk-and-keyboard', scaleHiddenByDefault: true, tapOpened: true, escapePreservedModal: true, keyboardReachedBuy: true, touchHeight, saveUnchanged: true })
    await p.close()
    for (const name of ['economic-empty', 'economic-owned']) {
      const page = await open(c, name), first = await saved(page)
      assert.doesNotMatch(await page.locator('.event-market').innerText(), /\d\/2/)
      const personal = page.locator('.event-personal-impact')
      assert.match(await personal.innerText(), name === 'economic-owned' ? /Giá trị tài sản bạn đang giữ thay đổi/ : /Bạn chưa giữ cổ phiếu/)
      await personal.scrollIntoViewIfNeeded(); await capture(page, `${width}-${name}-personal-impact`)
      const ack = page.getByRole('button', { name: 'Đã hiểu · Tiếp tục', exact: true })
      await ack.click({ trial: true }); assert.ok(await ack.evaluate(e => e.getBoundingClientRect().height) >= 44)
      assert.equal(await saved(page), first)
      checks.push({ width, name, explainedFromObservedState: true, rawPressureHidden: true, ctaReachable: true, saveUnchanged: true })
      await page.close()
    }
    const result = await open(c, 'result')
    await result.getByRole('button', { name: 'Chơi hành trình mới', exact: true }).click()
    assert.ok(await result.getByRole('button', { name: 'Xem lại ván B18 đã kết thúc', exact: true }).count())
    assert.equal(await result.getByRole('button', { name: /Tiếp tục ván B18/ }).count(), 0)
    const newBefore = await saved(result)
    await result.getByRole('button', { name: /Bắt đầu hành trình/ }).click()
    await result.getByRole('button', { name: 'Bắt đầu vòng 1', exact: true }).click()
    await result.waitForTimeout(250)
    const newAfter = await saved(result)
    assert.notEqual(newBefore, newAfter)
    await result.reload(); await result.getByRole('button', { name: /Tiếp tục ván B18/ }).click()
    assert.equal(await saved(result), newAfter)
    checks.push({ width, name: 'finished-to-setup-new-save-resume', finishedSeparated: true, latestSaveResumed: true })
    await c.close()
  }
  assert.deepEqual(errors, [])
  writeFileSync(`${out}/results.json`, JSON.stringify({ checks, errors, physicalDevices: false, screenReader: false, screenshots: 12 }, null, 2) + '\n')
  console.log(JSON.stringify({ checks: checks.length, screenshots: 12, errors }))
} finally { await browser.close() }
