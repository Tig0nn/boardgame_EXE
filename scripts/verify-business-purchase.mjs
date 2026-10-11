import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
const base = process.env.UI_URL || 'http://localhost:5173'
const folder = 'docs/playtests/business-v2_4/purchase-flow'
mkdirSync(folder, { recursive: true })
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
try {
  for (const width of [320, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
    await page.goto(`${base}/scripts/playtest-harness.html`)
    await page.getByRole('combobox', { name: 'Fixture', exact: true }).selectOption('business')
    await page.getByRole('button', { name: 'Nạp fixture', exact: true }).click()
    await page.locator('dialog[open]').waitFor()
    assert.equal(await page.getByRole('button', { name: /Nâng cấp|Bán toàn cơ sở/ }).count(), 0)
    const buy = page.getByRole('button', { name: /Đầu tư cơ sở/ })
    await buy.scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${folder}/${width}-purchase.png` })
    await buy.evaluate(el => { el.click(); el.click() })
    await page.locator('dialog[open]').waitFor({ state: 'detached' })
    assert.equal(await page.locator('.status-cash strong').textContent(), '30.000.000 ₫')
    assert.ok(await page.getByRole('status').filter({ hasText: 'Đã mua cơ sở kinh doanh' }).isVisible())
    const roll = page.getByRole('button', { name: 'Gieo xúc xắc', exact: true })
    assert.ok(await roll.isEnabled())
    assert.ok(await roll.evaluate(el => el === document.activeElement))
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.screenshot({ path: `${folder}/${width}-success.png`, fullPage: true })
  }
  assert.deepEqual(errors, [])
  const result = { widths: [320, 390, 430, 1440], purchaseCash: 30_000_000, doubleTapProtected: true, automaticCompletion: true, focusReturnsToRoll: true, errors }
  writeFileSync(`${folder}/verification.json`, JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result))
} finally { await browser.close() }
