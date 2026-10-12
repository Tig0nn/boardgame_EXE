// Run with Vite (or preview) running; uses an existing Playwright installation.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { boardFor } from '../src/data/board.ts'
import { SCENE, tileCenter } from '../src/components/board-scene.ts'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
const base = process.env.UI_URL || 'http://localhost:5173'
const folder = process.env.MVP_EVIDENCE_DIR || 'docs/playtests/gd-artwork'
mkdirSync(folder, { recursive: true })
const errors = [], geometry = []
let failureExpected = false
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error' && !failureExpected) errors.push(m.text()) })
const shot = name => page.screenshot({ path: `${folder}/${name}.png`, fullPage: true })
async function start() {
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Bắt đầu hành trình' }).click()
  await page.getByRole('button', { name: 'Bắt đầu vòng 1' }).click()
  await page.evaluate(() => document.fonts.ready)
}
async function fit() {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow')
  const panel = page.locator('dialog[open]')
  if (await panel.count()) {
    assert.ok(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1))
    const box = await panel.boundingBox()
    assert.ok(box.y >= 0 && box.y + box.height <= page.viewportSize().height + 1)
  }
}
async function pawn(position) {
  const { x, y } = tileCenter(boardFor({ boardLayout: 'C20' })[position])
  assert.equal(await page.locator('.city-player').getAttribute('transform'), `translate(${x} ${y})`)
  assert.equal(await page.locator('[aria-current="step"]').getAttribute('data-tile-index'), String(position))
  assert.match(await page.locator('.location-card small').textContent(), new RegExp(String(position + 1).padStart(2, '0')))
}
try {
  for (const [width, height] of [[320, 740], [390, 844], [430, 932], [1440, 1000]]) {
    await page.setViewportSize({ width, height }); await start(); await fit(); await pawn(0)
    assert.equal(await page.locator('.die').count(), 1)
    assert.equal(await page.locator('.board-city').count(), 0, 'Only the approved city renders in the board')
    const svg = page.locator('.isometric-board'), bounds = await svg.boundingBox()
    assert.equal(await svg.getAttribute('viewBox'), `${SCENE.crop.x} ${SCENE.crop.y} ${SCENE.crop.width} ${SCENE.crop.height}`)
    const asset = await page.request.get(`${base}/art/city-background.webp`)
    assert.equal(asset.status(), 200)
    assert.match(asset.headers()['content-type'], /image\/webp/)
    const centers = await page.locator('[data-tile-index]').evaluateAll(nodes => nodes.map(n => {
      const box = n.getBoundingClientRect(), matrix = n.transform.baseVal.consolidate().matrix
      return { index: Number(n.dataset.tileIndex), x: matrix.e, y: matrix.f, width: box.width, height: box.height, left: box.left, right: box.right, top: box.top, bottom: box.bottom }
    }))
    assert.equal(centers.length, 20)
    centers.forEach((center, i) => {
      assert.deepEqual({ x: center.x, y: center.y }, tileCenter(boardFor({ boardLayout: 'C20' })[i]))
      assert.ok(center.left >= bounds.x && center.right <= bounds.x + bounds.width && center.top >= bounds.y && center.bottom <= bounds.y + bounds.height, `Tile ${i} is never clipped`)
      assert.ok(center.width >= 24 && center.height >= 24, `Tile ${i} has a usable touch area`)
    })
    const roll = await page.locator('.roll-button').boundingBox()
    assert.ok(roll.y + roll.height <= height, `Roll stays visible at ${width}px`)
    geometry.push({ width, height, tiles: centers, rollBottom: roll.y + roll.height })
    await shot(`${width}-board`)
    // Verify each real tap target opens its own information, including under pawn.
    for (let i = 0; i < 20; i++) {
      await page.locator(`[data-tile-index="${i}"]`).click()
      await page.getByRole('dialog', { name: `Ô ${i + 1}: ${boardFor({ boardLayout: 'C20' })[i].label}`, exact: true }).waitFor()
      await fit(); await page.keyboard.press('Escape')
    }
    await page.locator('[data-tile-index="13"]').focus(); await page.keyboard.press('Space')
    await page.getByRole('dialog', { name: 'Ô 14: Kinh doanh' }).waitFor(); await page.keyboard.press('Escape')
    assert.equal(await page.locator('[data-tile-index="13"]').evaluate(el => el === document.activeElement), true)
    await page.locator('[data-tile-index="14"]').focus()
    assert.equal(await page.locator('[data-tile-index="14"]').evaluate(el => el.matches(':focus-visible')), true)
    assert.equal(await page.locator('[data-tile-index="14"] .tile-face').evaluate(el => getComputedStyle(el).strokeWidth), '3px')
    if (width === 390) await shot('390-keyboard-focus')
    await page.keyboard.press('Enter'); await page.getByRole('dialog', { name: 'Ô 15: Sinh hoạt' }).waitFor(); await page.keyboard.press('Escape')
    await page.evaluate(() => scrollTo(0, 0))
    if (width === 390) {
      await page.getByRole('button', { name: 'Gieo xúc xắc', exact: true }).click()
      await page.waitForFunction(() => document.querySelector('.location-turn')?.textContent === 'Lượt 1')
      const position = Number(await page.locator('[aria-current="step"]').getAttribute('data-tile-index'))
      await pawn(position); await fit()
      await page.getByRole('button', { name: 'Bỏ qua cơ hội', exact: true }).click()
      await page.locator('dialog[open]').waitFor({ state: 'detached' })
      await page.evaluate(() => scrollTo(0, 0)); await shot('390-after-movement')
    }
  }
  if (!process.env.ARTWORK_PRODUCTION) {
    // Explicitly synthetic: every possible pawn endpoint and corner, no RNG override.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${base}/scripts/playtest-harness.html`, { waitUntil: 'domcontentloaded' })
    for (let i = 0; i < 20; i++) {
      await page.getByRole('combobox', { name: 'Fixture', exact: true }).selectOption(`board-${i}`)
      await page.getByRole('button', { name: 'Nạp fixture', exact: true }).click()
      await pawn(i); await fit()
    }
    await page.getByRole('combobox', { name: 'Fixture', exact: true }).selectOption('stocks')
    await page.getByRole('button', { name: 'Nạp fixture', exact: true }).click()
    await page.getByRole('dialog').waitFor(); await fit()
    await page.screenshot({ path: `${folder}/390-financial-event.png` })
    assert.ok(await page.getByRole('dialog').evaluate(el => {
      const r = el.getBoundingClientRect()
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + 20))
    }), 'Financial dialog is above the artwork')
  }
  // A failed visual asset must leave board actions and engine state usable.
  await page.setViewportSize({ width: 390, height: 844 })
  failureExpected = true
  await page.route('**/art/city-background.webp', route => route.abort())
  await start(); await page.getByRole('status').filter({ hasText: 'Ảnh thành phố chưa tải được' }).waitFor()
  await pawn(0); assert.equal(await page.locator('[data-tile-index]').count(), 20)
  await page.getByRole('button', { name: 'Gieo xúc xắc', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.location-turn')?.textContent === 'Lượt 1')
  await page.getByRole('button', { name: 'Bỏ qua cơ hội', exact: true }).click()
  await page.locator('dialog[open]').waitFor({ state: 'detached' })
  await fit(); await shot('390-asset-fallback')
  assert.deepEqual(errors, [])
  const result = { geometry, errors, allTilesTapAndKeyboard: true, allPawnPositions: !process.env.ARTWORK_PRODUCTION, artworkFailurePlayable: true, production: !!process.env.ARTWORK_PRODUCTION }
  writeFileSync(`${folder}/artwork-verification.json`, JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify({ widths: geometry.map(g => g.width), errors, allTilesTapAndKeyboard: true, artworkFailurePlayable: true }))
} finally { await browser.close() }
