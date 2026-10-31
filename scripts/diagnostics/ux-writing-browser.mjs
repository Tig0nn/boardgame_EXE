import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
const pw = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const stage = process.argv.includes('--after') ? 'after' : 'before'
const root = 'docs/playtests/b18-mobile-ux-writing', out = `${root}/${stage}`
mkdirSync(out, { recursive: true })
const browser = await pw.chromium.launch({ headless: true, executablePath: 'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const checks = [], errors = [], consoleErrors = [], httpErrors = []
const hash = text => createHash('sha256').update(text).digest('hex')
const saved = p => p.evaluate(() => localStorage.getItem('xvtl:mobile:game:v1'))
async function setup(p) {
  await p.goto(process.env.UX_WRITING_URL ?? 'http://127.0.0.1:5210', { waitUntil: 'networkidle' })
  await p.getByRole('button', { name: 'Bỏ qua hướng dẫn' }).click()
}
async function shot(p, label) {
  const dimensions = await p.evaluate(() => {
    const dialog = document.querySelector('dialog[open]')
    return { width: innerWidth, height: innerHeight, pageWidth: document.documentElement.scrollWidth,
      modalOverflow: dialog ? dialog.scrollWidth > dialog.clientWidth + 1 : false,
      actions: [...(dialog ?? document).querySelectorAll('button.button')].filter(e => e.checkVisibility()).map(e => ({ text: e.textContent, height: e.getBoundingClientRect().height })) }
  })
  assert.ok(dimensions.pageWidth <= dimensions.width + 1, label)
  assert.equal(dimensions.modalOverflow, false, label)
  await p.screenshot({ path: `${out}/${label}.png` })
  writeFileSync(`${out}/${label}.txt`, await p.locator('body').innerText())
  checks.push({ label, ...dimensions })
}
try {
  for (const [width, height] of [[320, 740], [390, 844], [430, 932]]) {
    const screens = stage === 'before' ? ['economic-event', 'bonds', 'stocks', 'result'] : ['economic-event', 'bonds', 'stocks', 'result', 'bank', 'gold', 'business', 'course', 'repair', 'funding', 'settlement']
    for (const label of screens) {
      const c = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true }), p = await c.newPage()
      p.on('pageerror', e => errors.push({ width, label, error: e.message }))
      p.on('console', e => { if (e.type() === 'error') consoleErrors.push({ width, label, error: e.text(), location: e.location() }) })
      p.on('response', r => { if (r.status() >= 400) httpErrors.push({ width, label, url: r.url(), status: r.status() }) })
      try {
        await setup(p)
        await p.getByText('Mở ván đã lưu', { exact: true }).click()
        await p.locator('#saved-game-file').setInputFiles({ name: `${label}.json`, mimeType: 'application/json', buffer: gunzipSync(readFileSync(`${root}/checkpoints/${label}.json.gz`)) })
        await p.locator('dialog[open]').waitFor()
        await p.waitForTimeout(300)
        const before = await saved(p)
        assert.ok(before)
        await shot(p, `${width}-${label}`)
        const cta = p.locator('dialog[open] .button.primary:enabled').first()
        if (await cta.count()) { await cta.click({ trial: true }); checks.push({ label: `${width}-${label}-cta`, reachable: true }) }
        if (['economic-event', 'bonds', 'stocks', 'result'].includes(label)) {
          // Paired bond cards show risk before/after. This supplemental details
          // capture is market context; the credit scale has its own a11y capture.
          const detail = label === 'bonds' ? p.locator('.bond-credit-panel > details').first() : label === 'stocks' ? p.locator('.stock-trading .trade-details').first() : label === 'result' ? p.getByText('Chi tiết kết quả & nhật ký', { exact: true }).locator('..') : p.locator('.event-breakdown')
          await detail.locator('summary').click()
          await detail.locator('summary').scrollIntoViewIfNeeded()
          await shot(p, `${width}-${label}-details`)
        }
        assert.equal(await saved(p), before, 'Viewing explanations must not mutate save')
        if (stage === 'after') {
          await p.reload()
          await p.getByRole('button', { name: label === 'result' ? /Xem lại ván B18/ : /Tiếp tục ván B18/ }).click()
          assert.equal(await saved(p), before)
          checks.push({ label: `${width}-${label}-resume`, unchanged: true, sha256: hash(before) })
        }
      } finally { await c.close() }
    }
    if (stage === 'after') {
      const c = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true }), p = await c.newPage()
      p.on('pageerror', e => errors.push({ width, label: 'new-game', error: e.message }))
      await setup(p)
      await p.getByRole('button', { name: '50 triệu', exact: true }).click()
      await shot(p, `${width}-setup-zero-cash`)
      await p.getByRole('button', { name: '0 triệu', exact: true }).click()
      await p.getByRole('button', { name: /Bắt đầu hành trình/ }).click()
      await shot(p, `${width}-forecast`)
      await p.getByRole('button', { name: 'Bắt đầu vòng 1', exact: true }).click()
      await p.waitForTimeout(350)
      const before = await saved(p), seen = new Set()
      for (const tile of await p.locator('[data-b18-tile]').all()) {
        const type = (await tile.getAttribute('aria-label')).split(': ')[1]
        if (seen.has(type)) continue
        seen.add(type)
        await tile.focus(); await p.keyboard.press('Enter')
        await shot(p, `${width}-tile-${seen.size}`)
        await p.getByRole('button', { name: 'Trở về bàn', exact: true }).click()
      }
      assert.equal(seen.size, 9); assert.equal(await saved(p), before)
      await p.getByRole('button', { name: 'Mở sổ tay', exact: true }).first().click()
      for (const tab of await p.getByRole('tab').all()) {
        await tab.click(); await shot(p, `${width}-handbook-${await tab.getAttribute('id')}`)
      }
      await p.getByRole('button', { name: 'Đóng sổ tay', exact: true }).click()
      assert.equal(await saved(p), before)
      checks.push({ label: `${width}-read-only-board-handbook`, types: [...seen], unchanged: true })
      await c.close()
    }
  }
  writeFileSync(`${out}/results.json`, JSON.stringify({ stage, browser: await browser.version(), checks, errors, consoleErrors,
    httpErrors, source: 'Local Mobile build, exact replay prefixes imported through product UI. Not a new full gameplay run.', physicalDevices: false }, null, 2) + '\n')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ stage, checks: checks.length, screenshots: checks.filter(c => c.pageWidth).length, errors, consoleErrors }))
} finally { await browser.close() }
