import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { courseChoices } from '../../src/game/courses.ts'
const pw = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const stage = process.argv.includes('--after') ? 'after' : 'before', root = 'docs/playtests/b18-course-layout', out = `${root}/${stage}`
mkdirSync(out, { recursive: true })
const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH ?? 'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const checks = [], findings = [], errors = [], consoleErrors = []
const states = ['available', 'insufficient', 'basic-only-affordable', 'basic-learned', 'advanced-learned', 'both-learned']
const stored = p => p.evaluate(() => localStorage.getItem('xvtl:mobile:game:v1'))
async function layout(p, label) {
  const data = await p.locator('.course-choices').evaluate(root => {
    const rect = e => { const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } }
    const dialog = root.closest('dialog'), cards = [...root.querySelectorAll('.course-card')].map(rect)
    const overflow = [...root.querySelectorAll('.course-card h3,.course-card dt,.course-card dd,.course-status,button.button,summary')].filter(e => e.getClientRects().length && e.checkVisibility()).filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent)
    const nestedScroll = [...root.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)).length
    const buttons = [...root.querySelectorAll('button.button')].map(e => ({ ...rect(e), disabled: e.disabled, name: e.textContent, parentWidth: e.parentElement.clientWidth - parseFloat(getComputedStyle(e.parentElement).paddingLeft) - parseFloat(getComputedStyle(e.parentElement).paddingRight) }))
    return { viewport: innerWidth, modalWidth: dialog.clientWidth, pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      modalOverflow: dialog.scrollWidth > dialog.clientWidth + 1, cards, stacked: cards.length < 2 || cards[1].top >= cards[0].bottom - 1,
      overflow, nestedScroll, buttons, skipPosition: root.querySelector('.course-skip') ? getComputedStyle(root.querySelector('.course-skip')).position : null }
  })
  checks.push({ label, ...data })
  if (!data.stacked || data.pageOverflow || data.modalOverflow || data.overflow.length || data.nestedScroll || (stage === 'after' && data.skipPosition === 'sticky')) findings.push({ label, ...data })
  if (stage === 'after') {
    for (const button of data.buttons) { assert.ok(button.height >= 44, label); assert.ok(Math.abs(button.width - button.parentWidth) < 3, `${label}: button full width`) }
    if (data.cards.length === 2) assert.ok(Math.abs(data.cards[0].width - data.cards[1].width) < 1)
  }
}
async function shot(p, label) {
  await p.screenshot({ path: `${out}/${label}.png` })
  writeFileSync(`${out}/${label}.txt`, await p.locator('dialog[open]').innerText())
}
try {
  for (const [width, height] of [[320, 740], [390, 844], [430, 932], [768, 1024], [1440, 900]]) {
    const c = await browser.newContext({ viewport: { width, height }, hasTouch: true })
    for (const name of states) {
      const p = await c.newPage(), label = `${width}-${name}`, buffer = gunzipSync(readFileSync(`${root}/checkpoints/${name}.json.gz`)), initial = JSON.parse(buffer).state
      p.on('pageerror', e => errors.push({ label, error: e.message }))
      p.on('console', e => { if (e.type() === 'error') consoleErrors.push({ label, error: e.text(), location: e.location() }) })
      await p.goto(process.env.COURSE_LAYOUT_URL ?? 'http://127.0.0.1:5212', { waitUntil: 'networkidle' })
      if (await p.getByRole('button', { name: 'Bỏ qua hướng dẫn' }).count()) await p.getByRole('button', { name: 'Bỏ qua hướng dẫn' }).click()
      await p.getByText('Mở ván đã lưu', { exact: true }).click()
      await p.locator('#saved-game-file').setInputFiles({ name: `${name}.json`, mimeType: 'application/json', buffer })
      await p.locator('.course-choices').waitFor(); await p.evaluate(() => document.fonts.ready)
      const before = await stored(p), choices = courseChoices(initial), cards = p.locator('.course-card')
      const capture = name === 'available' || width === 390 || width === 1440
      await layout(p, label)
      if (width === 1440) assert.ok(await p.locator('dialog[open]').evaluate(e => e.clientWidth) < 500, 'Wide viewport must still exercise narrow modal')
      if (capture) await shot(p, label)
      if (name !== 'both-learned') {
        for (let i = 0; i < 2; i++) {
          const card = cards.nth(i), choice = choices[i], buy = card.locator('button.button')
          assert.equal(await buy.isDisabled(), !choice.canBuy)
          assert.match(await card.innerText(), new RegExp(choice.owned ? 'Đã học' : choice.canBuy ? 'Chưa học' : 'Không đủ tiền'))
          const disclosure = card.locator('details'), summary = disclosure.locator('summary')
          await summary.focus(); await p.keyboard.press('Enter'); assert.equal(await disclosure.getAttribute('open'), '')
          await layout(p, `${label}-expanded-${choice.id}`)
          if (capture && name === 'available' && i === 0) { await disclosure.scrollIntoViewIfNeeded(); await shot(p, `${label}-expanded`) }
          await summary.focus(); await p.keyboard.press('Enter'); assert.equal(await disclosure.getAttribute('open'), null)
          if (!await buy.isDisabled()) await buy.click({ trial: true })
        }
        await p.getByRole('button', { name: 'Bỏ qua', exact: true }).click({ trial: true })
        if (capture && name === 'available') { await cards.nth(1).scrollIntoViewIfNeeded(); await shot(p, `${label}-second-card`) }
        if (name === 'available' && [320, 1440].includes(width)) {
          // Text-only magnification: double each element's computed font size.
          // This is not a claim about native browser zoom or physical devices.
          await p.locator('.course-choices').evaluate(root => {
            const elements = [root, ...root.querySelectorAll('*')], sizes = elements.map(e => parseFloat(getComputedStyle(e).fontSize))
            elements.forEach((e, i) => { e.dataset.originalStyle = e.getAttribute('style') ?? ''; e.style.fontSize = `${sizes[i] * 2}px` })
          })
          await layout(p, `${label}-text-200`); await cards.first().scrollIntoViewIfNeeded(); await shot(p, `${label}-text-200`)
          await p.locator('.course-choices').evaluate(root => { for (const e of [root, ...root.querySelectorAll('*')]) { e.setAttribute('style', e.dataset.originalStyle); delete e.dataset.originalStyle } })
        }
      } else assert.match(await p.locator('.course-choices').innerText(), /Đã hoàn thành cả hai khóa/)
      assert.equal(await stored(p), before, `${label}: viewing disclosure must not mutate save`)
      checks.push({ label: `${label}-disclosure-and-eligibility`, saveUnchanged: true })
      if (stage === 'after') {
        const choice = choices.find(c => c.canBuy && (width !== 390 || name !== 'available' || c.id === 'advanced'))
        if (choice && name !== 'both-learned') {
          await p.getByRole('button', { name: `Mua ${choice.name.toLowerCase()}`, exact: true }).click()
          await p.waitForFunction(id => JSON.parse(localStorage.getItem('xvtl:mobile:game:v1')).state.ownedCourses.includes(id), choice.id)
          const after = JSON.parse(await stored(p)).state
          assert.equal(after.portfolio.cash, initial.portfolio.cash - choice.cost)
          assert.equal(after.recurringIncome, initial.recurringIncome + choice.boost)
          assert.deepEqual(after.ownedCourses, [...initial.ownedCourses, choice.id])
          assert.equal(after.log.findLast(e => e.kind === 'decision').decisionId, `course-${choice.id}`)
          assert.equal(await p.locator('.course-choices').count(), 0, 'One purchase ends the encounter')
          checks.push({ label: `${label}-buy`, action: `course-${choice.id}`, cost: choice.cost, boost: choice.boost, exactlyOnePurchase: true })
        } else {
          await p.getByRole('button', { name: name === 'both-learned' ? 'Tiếp tục' : 'Bỏ qua', exact: true }).click()
          await p.waitForFunction(() => JSON.parse(localStorage.getItem('xvtl:mobile:game:v1')).state.phase !== 'event')
          const after = JSON.parse(await stored(p)).state
          assert.equal(after.portfolio.cash, initial.portfolio.cash); assert.deepEqual(after.ownedCourses, initial.ownedCourses)
          assert.equal(after.log.findLast(e => e.kind === 'decision').decisionId, 'skip')
          checks.push({ label: `${label}-skip`, cashAndCoursesUnchanged: true })
        }
      }
      await p.close()
    }
    await c.close()
  }
  writeFileSync(`${out}/results.json`, JSON.stringify({ stage, browser: await browser.version(), checks, findings, errors, consoleErrors,
    source: 'Actual Mobile UI imports of exact archived replay prefixes; no game-state injection.', textMagnification: 'Computed fonts doubled, not native zoom', physicalDevices: false }, null, 2) + '\n')
  assert.deepEqual(errors, [])
  if (stage === 'after') assert.deepEqual(findings, [])
  console.log(JSON.stringify({ stage, checks: checks.length, layoutFindings: findings.length, errors }))
} finally { await browser.close() }
