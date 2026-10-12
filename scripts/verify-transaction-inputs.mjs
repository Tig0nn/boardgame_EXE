// Focused input/short-screen checks after the full browser regression run.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { money } from '../src/game/format.ts'
import { ECONOMY } from '../src/data/config.ts'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
const base = process.env.UI_URL || 'http://localhost:5173'
const folder = process.env.MVP_EVIDENCE_DIR || 'docs/playtests/encounter-limits-v2_3'
mkdirSync(folder, { recursive: true })
async function fixture(id) {
  await page.goto(`${base}/scripts/playtest-harness.html`)
  await page.getByRole('combobox', { name: 'Fixture', exact: true }).selectOption(id)
  await page.getByRole('button', { name: 'Nạp fixture', exact: true }).click()
  await page.locator('dialog[open]').waitFor()
}
try {
  await fixture('stocks')
  const input = page.locator('#trade-amount')
  assert.equal(await input.getAttribute('inputmode'), 'numeric')
  await input.fill('1234567')
  assert.equal(await input.inputValue(), '1.234.567')
  await input.evaluate(el => { el.focus(); el.setSelectionRange(1, 1) })
  await page.keyboard.type('9')
  assert.equal(await input.inputValue(), '19.234.567')
  await page.keyboard.press('Backspace')
  assert.equal(await input.inputValue(), '1.234.567')
  for (const invalid of ['-1', '1,5', '50000001', '9007199254740992']) {
    await input.fill(invalid)
    assert.ok(await page.getByRole('button', { name: /Xác nhận mua cổ phiếu/ }).isDisabled())
  }
  await input.evaluate(el => {
    const data = new DataTransfer(); data.setData('text/plain', '1.5')
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  })
  assert.ok(await page.getByRole('button', { name: /Xác nhận mua cổ phiếu/ }).isDisabled())
  await input.fill('1234567')
  await input.focus()
  // Reduced visible viewport approximates keyboard space; this is not a real device keyboard test.
  await page.setViewportSize({ width: 320, height: 460 })
  const confirm = page.getByRole('button', { name: /Xác nhận mua cổ phiếu/ })
  await confirm.scrollIntoViewIfNeeded()
  const box = await confirm.boundingBox()
  assert.ok(box.y >= 0 && box.y + box.height <= 460)
  assert.ok(await page.locator('dialog[open]').evaluate(el => el.scrollWidth <= el.clientWidth))
  await page.screenshot({ path: `${folder}/320-keyboard-space.png` })
  await confirm.click()
  assert.equal(await page.locator('dialog[open]').count(), 0)
  assert.equal(await page.locator('.status-cash strong').textContent(), money(48_765_433))
  await page.setViewportSize({ width: 390, height: 844 })
  await fixture('bank-later')
  await page.locator('.trade-details summary').click()
  const lots = page.locator('.trade-details p').filter({ hasText: /deposit-/ })
  assert.equal(await lots.count(), 1)
  assert.match(await lots.nth(0).textContent(), /vòng 1/)
  await page.locator('#deposit-term').selectOption('3')
  await page.locator('#trade-amount').fill('1000000')
  await page.screenshot({ path: `${folder}/390-bank-existing-lot.png` })
  await page.getByRole('button', { name: /Xác nhận gửi khoản mới/ }).click()
  assert.equal(await page.locator('dialog[open]').count(), 0)
  assert.equal(await page.locator('.status-cash strong').textContent(), money(48_000_000))
  for (const id of ['family', 'bills', 'contract']) {
    await fixture(id)
    await page.getByRole('button', { name: /Thanh toán cuối vòng/ }).click()
    assert.equal(await page.locator('dialog[open]').count(), 0)
    assert.ok(await page.getByRole('button', { name: 'Gieo xúc xắc', exact: true }).isEnabled())
  }
  await fixture('repair')
  await page.getByRole('button', { name: /Sửa tạm, hoàn tất cuối vòng/ }).click()
  assert.equal(await page.locator('.status-cash strong').textContent(), money(50_000_000 - ECONOMY.personal.repair[1]))
  assert.equal(await page.locator('dialog[open]').count(), 0)
  assert.deepEqual(errors, [])
  const result = { exactDong: 1_234_567, middleEditing: true, malformedPasteRejected: true, numericKeyboardHint: true,
    reducedViewport: '320x460', realDeviceKeyboardTested: false, bankIndependentTermsFromDifferentEncounters: [1, 3], deferredObligations: ['family', 'bills', 'contract', 'repair'], errors }
  writeFileSync(`${folder}/input-verification.json`, JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result, null, 2))
} finally { await browser.close() }
