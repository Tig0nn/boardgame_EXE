import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { GAME_SAVE_KEY } from '../../../../../src/game/saved-game.ts'
import { tooltipPosition } from '../../../../../src/components/glossary.ts'
const { createServer } = await import(pathToFileURL(resolve('mobile_app/node_modules/vite/dist/node/index.js')).href)
const { chromium } = createRequire(import.meta.url)(resolve('node_modules/.tmp/whatif-v3-qa/node_modules/playwright'))
const dir = import.meta.dirname, results = [], runName = process.argv[2] ?? 'core'
const server = await createServer({ root: resolve('mobile_app'), cacheDir: resolve('node_modules/.tmp/eg3-ai-06-core-vite'), server: { host: '127.0.0.1', port: 5198, strictPort: true, watch: null } })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ executablePath: 'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe', headless: true })
  for (const width of [320, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 844 : 900 }, hasTouch: width === 320, isMobile: width === 320 })
    await context.addInitScript(({ packed, key }) => {
      localStorage.setItem(key, packed); localStorage.setItem('xvtl:mobile:tutorial:v1', 'seen'); localStorage.setItem('xvtl:mobile:tutorial_disabled', 'true')
    }, { key: GAME_SAVE_KEY, packed: gunzipSync(readFileSync(resolve(dir, 'bonds.packed.gz'))).toString() })
    const page = await context.newPage()
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }))
    await page.goto('http://127.0.0.1:5198/?endgameWhatIf=1&whatIfAi=1')
    const activate = async locator => width === 320 ? locator.tap() : locator.click()
    await activate(page.getByRole('button', { name: 'Bắt đầu phiêu lưu', exact: true }))
    await activate(page.getByTestId('map-node-1.1'))
    for (let step = 0; step < 2; step++) {
      const button = page.getByRole('button', { name: /Xem kết quả hành trình/i })
      await button.waitFor(); await page.waitForTimeout(350)
      const term = page.locator('.financial-term-trigger').filter({ hasText: /Lãi trái phiếu định kỳ/ }).first()
      if (await term.count()) await activate(term)
      await page.waitForTimeout(150)
      const geometry = await button.evaluate(element => {
        const rect = node => { const r = node.getBoundingClientRect(); const s = getComputedStyle(node); return {
          tag: node.tagName, className: node.className, text: node.textContent?.slice(0, 160), x: r.x, y: r.y, width: r.width, height: r.height,
          overflow: s.overflow, position: s.position, zIndex: s.zIndex, flex: s.flex, flexShrink: s.flexShrink, minHeight: s.minHeight, transform: s.transform,
        } }
        const r = element.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2
        const anchor = document.querySelector('.financial-term-trigger[aria-expanded="true"]')
        const popup = document.querySelector('.financial-term-popup[data-open]')
        const bands = selector => [...document.querySelectorAll(selector)].filter(node => !node.disabled && node.getClientRects().length > 0)
          .map(node => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom } })
        return { button: rect(element), heading: document.querySelector('.gamified-modal-card h2')?.textContent,
          tooltipAnchor: anchor ? { left: anchor.getBoundingClientRect().left, top: anchor.getBoundingClientRect().top, bottom: anchor.getBoundingClientRect().bottom } : null,
          tooltipHeight: popup?.scrollHeight,
          oldActions: bands('.button'), proposedActions: bands('.button, .gamified-modal-card button:not(.financial-term-trigger)'),
          ancestors: [element.parentElement, element.parentElement.parentElement,
          element.closest('.gamified-modal-card')].map(rect), hit: document.elementsFromPoint(x, y).slice(0, 8).map(rect),
          scrollers: [...document.querySelectorAll('.anime-slim-scroll')].map(rect), viewport: { width: innerWidth, height: innerHeight } }
      })
      const record = { width, step, geometry }
      if (geometry.tooltipAnchor) {
        record.proposedPosition = tooltipPosition(geometry.tooltipAnchor, width, geometry.viewport.height, geometry.tooltipHeight, geometry.proposedActions)
        const p = record.proposedPosition, b = geometry.button
        record.proposedPositionOverlapsCta = p.top < b.y + b.height && p.top + p.maxHeight > b.y
      }
      await page.screenshot({ path: resolve(dir, `${runName}-${width}-step${step}.png`) })
      try {
        if (width === 320) await button.tap({ timeout: 1800 })
        else await button.click({ timeout: 1800 })
        record.entry = 'PASS'
      } catch (error) {
        record.entry = 'BLOCKED'; record.error = error.message
        if (width === 320) {
          try { await button.click({ timeout: 1800 }); record.mouseEntry = 'PASS' }
          catch (error) { record.mouseEntry = 'BLOCKED'; record.mouseError = error.message }
        }
      }
      results.push(record)
      if (record.entry === 'BLOCKED') {
        if (width === 320) {
          await page.touchscreen.tap(5, 5)
          await page.waitForTimeout(200)
          await button.tap({ timeout: 2500 })
          record.outsideDismissThenTouch = 'PASS'
        } else break
      }
      await page.waitForTimeout(350)
    }
    await context.close()
  }
  assert(results.some(result => result.width === 320 && result.entry === 'BLOCKED'))
  assert(results.filter(result => result.width === 1280).every(result => result.entry === 'PASS'))
  console.log('CORE 320px pointer/touch BLOCKED reproduced; desktop pointer PASS; no core source changed')
} finally {
  writeFileSync(resolve(dir, runName + '-repro.json'), JSON.stringify({ results, protectedSourceModified: false, proposedDiffApplied: false }, null, 2))
  try { await browser?.close() } finally { await server.close() }
}
