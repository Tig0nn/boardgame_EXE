import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer, preview } from 'vite'
import { createRepairDemo } from '../../mobile_app/src/dev/repair-fixture.ts'
import { saveGameLocally } from '../../src/game/saved-game.ts'

// Uses an installed Playwright, without adding a production dependency.
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const out = resolve('docs/playtests/whatif-demo/2026-10-31')
mkdirSync(out, { recursive: true })
const server = await createServer({ root: resolve('mobile_app'), configFile: resolve('mobile_app/vite.config.ts'),
  server: { host: '127.0.0.1', port: 5191, strictPort: true, hmr: false } })
await server.listen()
const base = 'http://127.0.0.1:5191/'
const results = [], errors = [], forbidden = []
const launch = p => p.getByRole('button', { name: '✨ Nếu tôi chọn cách khác?', exact: true })
const dialog = p => p.getByRole('dialog', { name: 'Nếu tôi chọn cách khác?', exact: true })
const choose = (p, choice) => p.getByRole('button', { name: choice === 'full' ? /^Sửa ngay/i : /^Sửa tạm/i }).click()
const shot = (p, name) => p.screenshot({ animations: 'disabled', path: resolve(out, name + '.png') })
const save = p => p.evaluate(() => localStorage.getItem('xvtl:mobile:game:v1'))
async function run(name, fn, width = 390, height = 844) {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    ...(process.env.CHROMIUM_ARGS ? { args: JSON.parse(process.env.CHROMIUM_ARGS) } : {}) })
  const p = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true })
  p.on('pageerror', e => errors.push({ name, message: e.message }))
  p.on('request', req => { if (/\/api\/|generativelanguage/.test(req.url())) forbidden.push(req.url()) })
  await p.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  try { await fn(p); results.push({ name, passed: true }); console.log('PASS', name) }
  catch (e) { results.push({ name, passed: false, error: e.message }); await shot(p, 'FAIL-' + results.length); throw e }
  finally { await browser.close() }
}
async function fixture(p, query = '') {
  await p.addInitScript(() => localStorage.setItem('xvtl:mobile:game:v1', 'OWNER-SAVE-DO-NOT-OVERWRITE'))
  await p.goto(base + '?whatIfDemo=repair&repairAi=1' + query)
  await p.getByRole('button', { name: /^Sửa ngay/i }).waitFor()
}
async function noOverflow(p) {
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  const layout = await dialog(p).evaluate(el => ({ width: el.clientWidth, scrollWidth: el.scrollWidth,
    display: getComputedStyle(el).display, bg: getComputedStyle(el).backgroundColor,
    bounds: [...el.querySelectorAll('.whatif-card')].map(card => ({ left: card.getBoundingClientRect().left, right: card.getBoundingClientRect().right })) }))
  assert.equal(layout.display, 'block')
  assert.notEqual(layout.bg, 'rgba(0, 0, 0, 0)')
  assert(layout.scrollWidth <= layout.width)
  for (const box of layout.bounds) { assert(box.left >= 0); assert(box.right <= p.viewportSize().width) }
  const back = await p.getByRole('button', { name: '← Quay về ván đang chơi', exact: true }).boundingBox()
  assert(back.y >= 0 && back.y + back.height <= p.viewportSize().height)
}
try {
  for (const width of [390, 320]) for (const choice of ['full', 'temporary']) {
    await run(`${width}px ${choice}: decision → comparison → lesson → close/reopen → continue`, async p => {
      await fixture(p)
      assert.equal(await launch(p).count(), 0)
      assert.equal(await p.getByRole('tab').count(), 2)
      await p.getByRole('tab', { name: '✨ Hỏi AI', exact: true }).click()
      await p.getByRole('tab', { name: 'Quyết định', exact: true }).click()
      await shot(p, `${width}-${choice}-01-event`)
      await choose(p, choice)
      await launch(p).waitFor()
      assert.equal(await p.getByRole('tab').count(), 0)
      await shot(p, `${width}-${choice}-02-board`)
      await launch(p).click(); await dialog(p).waitFor()
      const actual = p.getByRole('region', { name: 'Actual · Bạn đã chọn', exact: true })
      const alt = p.getByRole('region', { name: 'What-if · Nếu chọn khác', exact: true })
      assert.match(await actual.innerText(), choice === 'full' ? /46.000.000 ₫/ : /49.000.000 ₫/)
      assert.match(await alt.innerText(), choice === 'full' ? /49.000.000 ₫/ : /46.000.000 ₫/)
      assert.match(await dialog(p).innerText(), /50.000.000 ₫/)
      assert.match(await dialog(p).innerText(), /Chỉ mô phỏng tác động tại thời điểm quyết định/)
      await noOverflow(p)
      await shot(p, `${width}-${choice}-03-comparison`)
      await dialog(p).evaluate(el => { el.scrollTop = el.scrollHeight })
      await shot(p, `${width}-${choice}-04-lesson`)
      await p.getByRole('button', { name: '← Quay về ván đang chơi', exact: true }).click()
      assert.equal(await dialog(p).count(), 0)
      assert.equal(await launch(p).evaluate(el => document.activeElement === el), true)
      await launch(p).click(); await dialog(p).waitFor(); await p.keyboard.press('Escape')
      assert.equal(await dialog(p).count(), 0)
      await launch(p).click(); await p.getByRole('button', { name: 'Đóng', exact: true }).click()
      assert.equal(await dialog(p).count(), 0)
      assert.equal(await save(p), 'OWNER-SAVE-DO-NOT-OVERWRITE')
      // Next real action clears the transient review. No stale What-if after movement.
      await p.waitForTimeout(320)
      const rollButton = p.getByRole('button', { name: 'Lắc Xúc Xắc', exact: true })
      assert(await rollButton.isEnabled())
      const rollBox = await rollButton.boundingBox()
      await p.touchscreen.tap(rollBox.x + rollBox.width / 2, rollBox.y + rollBox.height / 2)
      await launch(p).waitFor({ state: 'detached' })
      await p.waitForTimeout(4000)
      assert.equal(await dialog(p).count(), 0)
      assert.equal(await save(p), 'OWNER-SAVE-DO-NOT-OVERWRITE')
      await shot(p, `${width}-${choice}-05-continue`)
    }, width)
  }
  await run('low cash: paid temporary vs incomplete alternative; funding notice is honest', async p => {
    await fixture(p, '&cash=low'); await choose(p, 'temporary'); await launch(p).click()
    assert.match(await p.getByRole('region', { name: 'Actual · Bạn đã chọn' }).innerText(), /1.000.000 ₫/)
    const alt = await p.getByRole('region', { name: 'What-if · Nếu chọn khác' }).innerText()
    assert.match(alt, /Còn thiếu ngay\n2.000.000 ₫/)
    assert.match(alt, /Chưa hoàn tất thanh toán/)
    await noOverflow(p); await shot(p, '320-shortfall')
  }, 320)
  await run('actual funding: no comparison button before or after financing from a different state', async p => {
    await fixture(p, '&cash=funding'); await choose(p, 'temporary')
    await p.getByText(/Còn thiếu.*500.000/).first().waitFor()
    assert.equal(await launch(p).count(), 0)
    await shot(p, '390-actual-funding')
    await p.getByRole('button', { name: /Vay nợ/ }).click()
    await p.getByRole('spinbutton').fill('500000')
    await p.waitForTimeout(320)
    await p.getByRole('button', { name: 'Dùng nguồn tiền này →', exact: true }).click()
    await p.getByRole('spinbutton').waitFor({ state: 'detached' })
    assert.equal(await launch(p).count(), 0)
    assert.equal(await save(p), 'OWNER-SAVE-DO-NOT-OVERWRITE')
  })
  await run('fixture reset/reload preserves owner save and forgets old review', async p => {
    await fixture(p); await choose(p, 'full'); await launch(p).click()
    await p.keyboard.press('Escape')
    await p.getByRole('button', { name: 'Tái hiện sửa xe', exact: true }).click()
    assert.equal(await launch(p).count(), 0)
    await choose(p, 'temporary'); await launch(p).click()
    assert.match(await p.getByRole('region', { name: 'Actual · Bạn đã chọn' }).innerText(), /Sửa tạm/)
    await p.reload(); await p.getByRole('button', { name: /^Sửa ngay/i }).waitFor()
    assert.equal(await launch(p).count(), 0)
    assert.equal(await save(p), 'OWNER-SAVE-DO-NOT-OVERWRITE')
  })
  await run('real App integration: save unchanged during What-if, home/resume/new session clears review', async p => {
    let seedSave = ''
    assert(saveGameLocally(createRepairDemo(), { setItem(_key, value) { seedSave = value } }))
    await p.addInitScript(value => {
      if (!sessionStorage.getItem('seeded')) { localStorage.setItem('xvtl:mobile:game:v1', value); sessionStorage.setItem('seeded', '1') }
      localStorage.setItem('xvtl:mobile:tutorial:v1', 'seen')
    }, seedSave)
    await p.goto(base + '?whatIf=1&repairAi=1')
    await p.getByRole('button', { name: 'Bắt đầu phiêu lưu', exact: true }).click()
    await p.getByTestId('map-node-1.1').click()
    await choose(p, 'full'); await launch(p).waitFor(); await p.waitForTimeout(100)
    const paid = await save(p)
    await launch(p).click(); await p.locator('.whatif-lesson').scrollIntoViewIfNeeded()
    await shot(p, '390-real-app-whatif'); await p.keyboard.press('Escape')
    assert.equal(await save(p), paid)
    await p.getByRole('button', { name: 'Quay lại Bản đồ', exact: true }).click()
    await p.getByTestId('map-node-1.1').click()
    assert.equal(await launch(p).count(), 0)
    assert.equal(await save(p), paid)
    await p.getByRole('button', { name: 'Cài đặt', exact: true }).click()
    p.once('dialog', d => d.accept())
    await p.getByRole('button', { name: /Bắt Đầu Lại|Bắt đầu lại/i }).click()
    await p.waitForTimeout(100)
    assert.equal(await launch(p).count(), 0)
    assert.equal(await dialog(p).count(), 0)
    assert.notEqual(await save(p), paid)
    await p.reload()
    assert.equal(await launch(p).count(), 0)
    await shot(p, '390-restart-no-stale')
  })
  await run('universal Companion two tabs coexist with What-if and return intact', async p => {
    await fixture(p, '&universalAi=1')
    assert.equal(await p.getByRole('tab').count(), 2)
    await choose(p, 'temporary'); await launch(p).waitFor()
    await launch(p).click(); await noOverflow(p)
    await p.keyboard.press('Escape')
    assert.equal(await p.getByRole('tab').count(), 2)
    assert(await launch(p).isVisible())
    assert.equal(await save(p), 'OWNER-SAVE-DO-NOT-OVERWRITE')
    await shot(p, '390-universal-companion-after-whatif')
  })
  await run('short 320x568 viewport: scroll and return stay reachable', async p => {
    await fixture(p); await choose(p, 'full'); await launch(p).click(); await noOverflow(p)
    await p.locator('.whatif-scope').scrollIntoViewIfNeeded(); await noOverflow(p)
    await shot(p, '320x568-lesson'); await p.getByRole('button', { name: '← Quay về ván đang chơi' }).click()
  }, 320, 568)
  // Production query cannot load a fixture or enable the feature.
  const prod = await preview({ root: resolve('mobile_app'), configFile: resolve('mobile_app/vite.config.ts'), preview: { host: '127.0.0.1', port: 5192, strictPort: true } })
  try {
    await run('production build ignores fixture and What-if query; real saved game continues normally', async p => {
      let text = ''; saveGameLocally(createRepairDemo(), { setItem(_key, value) { text = value } })
      await p.addInitScript(value => { localStorage.setItem('xvtl:mobile:game:v1', value); localStorage.setItem('xvtl:mobile:tutorial:v1', 'seen') }, text)
      await p.goto('http://127.0.0.1:5192/?whatIfDemo=repair&whatIf=1&repairAi=1')
      await p.getByRole('button', { name: 'Bắt đầu phiêu lưu', exact: true }).waitFor()
      assert.equal(await p.getByRole('button', { name: 'Tái hiện sửa xe', exact: true }).count(), 0)
      await p.getByRole('button', { name: 'Bắt đầu phiêu lưu', exact: true }).click(); await p.getByTestId('map-node-1.1').click()
      assert.equal(await p.getByRole('tab').count(), 0)
      await choose(p, 'full'); await p.waitForTimeout(100)
      assert.equal(await launch(p).count(), 0)
    })
  } finally { await new Promise(resolve => prod.httpServer.close(resolve)) }
  assert.deepEqual(errors, []); assert.deepEqual(forbidden, [])
} finally {
  writeFileSync(resolve(out, 'browser-results.json'), JSON.stringify({ results, errors, forbidden,
    physicalDevices: 'NOT TESTED; Chromium mobile viewport emulation', screenshotDirectory: 'docs/playtests/whatif-demo/2026-10-31' }, null, 2) + '\n')
  await server.close()
}
