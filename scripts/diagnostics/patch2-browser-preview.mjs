import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { homedir } from 'node:os'
import assert from 'node:assert/strict'
import { preview } from '../../node_modules/vite/dist/node/index.js'
import { CURATED_QUESTIONS, CURATED_CATEGORIES } from '../../mobile_app/src/game/curated-catalog.ts'
import { curatedQuestionCase, naturalCuratedState } from '../../tests/helpers/curated-natural.ts'
import { saveGameLocally, GAME_SAVE_KEY } from '../../src/game/saved-game.ts'
import { createSemanticRequest, answerSemantic, validateSemanticResponse } from '../../src/ai/companion/semantic-index.ts'
import { presentEducationalAnswer } from '../../mobile_app/src/components/educational-ai-presentation.ts'

const out = 'docs/qa/release-hardening-patch2'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || join(homedir(), 'AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe') })
const beta = await preview({ configFile: resolve('release/beta/vite.config.ts'), logLevel: 'error', preview: { host: '127.0.0.1', port: 5444, strictPort: true } })
const production = await preview({ configFile: false, root: resolve('mobile_app'), preview: { host: '127.0.0.1', port: 5445, strictPort: true } })
const results = [], errors = [], pageErrors = [], apiRequests = [], blockedExternal = [], routeProbes = []
let activePage
const encode = state => { let encoded; assert.ok(saveGameLocally(state, { setItem(_key, value) { encoded = value } })); return encoded }
async function enter(page, port, query = '?aiBeta=1') {
  activePage = page
  await page.goto(`http://127.0.0.1:${port}/${query}`)
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
  await page.getByRole('button', { name: 'Bắt đầu phiêu lưu' }).click()
  await page.locator('[data-node-id]').first().click()
  await page.waitForFunction(() => !document.querySelector('[data-node-id]'))
}
async function ask(page, question) {
  await page.getByRole('radio', { name: CURATED_CATEGORIES.find(c => c.id === question.categoryId).label, exact: true }).check()
  await page.locator(`input[name="ai-beta-question"][value="${question.id}"]`).check()
  await page.getByRole('button', { name: 'Gửi', exact: true }).click()
}
try {
  const probes = await browser.newContext()
  for (const endpoint of ['/api/ai-coach', '/api/%61i-coach?preview=1', '/api/ai-coach/']) {
    const response = await probes.request.post('http://127.0.0.1:5444' + endpoint, { data: {} })
    assert.equal(response.status(), 404)
    assert.match((await response.json()).error, /not available in this isolated Beta/)
    routeProbes.push({ endpoint, status: response.status(), providerRequest: false })
  }
  await probes.close()
  for (const width of [320, 390]) for (const id of ['personal-rules', 'macro-compare']) {
    const question = CURATED_QUESTIONS.find(q => q.id === id), scenario = curatedQuestionCase(question)
    const context = await browser.newContext({ viewport: { width, height: 844 } })
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.hostname !== '127.0.0.1') { blockedExternal.push(url.origin); return route.abort() }
      if (url.pathname.startsWith('/api/')) { apiRequests.push(url.pathname); return route.abort() }
      return route.continue()
    })
    await context.addInitScript(({ betaSave, prodSave, key }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, location.port === '5444' ? betaSave : prodSave)
      localStorage.setItem('xvtl:mobile:tutorial:v1', 'seen'); localStorage.setItem('xvtl:mobile:tutorial_disabled', 'true'); localStorage.setItem('xvtl:mobile:auto_show_rules', 'false')
    }, { betaSave: encode(scenario.state), prodSave: encode(naturalCuratedState('bank')), key: GAME_SAVE_KEY })
    const prod = await context.newPage(), page = await context.newPage()
    for (const p of [page, prod]) p.on('pageerror', e => pageErrors.push(e.message))
    await enter(prod, 5445, '?aiBeta=1&VITE_AI_COMPANION_BETA=1&VERCEL_ENV=preview')
    assert.equal(await prod.getByRole('button', { name: /Hỏi AI/ }).count(), 0)
    const prodSave = await prod.evaluate(key => { localStorage.setItem('release-origin-probe', 'production'); return localStorage.getItem(key) }, GAME_SAVE_KEY)
    await enter(page, 5444)
    assert.equal(await page.evaluate(() => localStorage.getItem('release-origin-probe')), null)
    await page.evaluate(() => localStorage.setItem('release-origin-probe', 'beta'))
    assert.equal(await prod.evaluate(() => localStorage.getItem('release-origin-probe')), 'production')
    const info = await page.evaluate(async () => (await fetch('/beta-build-info.json')).json())
    assert.equal(info.viteMode, 'production'); assert.equal(info.nodeEnvironment, 'production'); assert.equal(info.environment, 'preview')
    await page.getByRole('button', { name: /Hỏi AI/ }).click()
    const betaSave = await page.evaluate(key => localStorage.getItem(key), GAME_SAVE_KEY)
    const request = await createSemanticRequest(JSON.parse(JSON.stringify(scenario.context)), question.text, 'compiled-browser-' + id)
    const expected = presentEducationalAnswer(await validateSemanticResponse(await answerSemantic(request), request), question)
    // The compiled app must answer without an API or even a network connection.
    await context.setOffline(true)
    await ask(page, question)
    await page.waitForFunction(() => !!document.querySelector('.educational-answer'))
    assert.deepEqual(await page.locator('.educational-answer > p').allTextContents(), [expected.lead, ...expected.paragraphs])
    assert.ok(await page.locator('.educational-lead').isVisible())
    assert.ok(await page.locator('.beta-panel').evaluate(el => el.scrollWidth <= el.clientWidth))
    const send = page.getByRole('button', { name: 'Gửi', exact: true }), bounds = await send.boundingBox()
    assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= 844)
    await page.screenshot({ path: `${out}/preview-${id}-${width}.png` })
    const details = page.locator('.educational-answer details')
    if (await details.count()) { await details.locator('summary').click(); assert.notEqual(await details.getAttribute('open'), null); await details.locator('summary').click() }
    await page.evaluate(() => {
      const original = crypto.subtle.digest.bind(crypto.subtle), pending = []
      crypto.subtle.digest = async (...args) => { await new Promise(done => pending.push(done)); return original(...args) }
      window.__releaseCompiledDigest = () => { crypto.subtle.digest = original; pending.splice(0).forEach(done => done()) }
    })
    await send.click()
    await page.waitForFunction(() => document.querySelector('.semantic-result[aria-busy="true"]'))
    const alternate = CURATED_QUESTIONS.find(q => q.categoryId === question.categoryId && q.id !== id)
    await page.locator(`input[value="${alternate.id}"]`).check()
    await page.evaluate(() => window.__releaseCompiledDigest())
    await page.waitForTimeout(100)
    assert.equal(await page.locator('.semantic-result').count(), 0)
    await page.getByRole('button', { name: 'Đóng Hỏi AI Beta' }).click()
    assert.equal(await page.evaluate(key => localStorage.getItem(key), GAME_SAVE_KEY), betaSave)
    assert.equal(await prod.evaluate(key => localStorage.getItem(key), GAME_SAVE_KEY), prodSave)
    await context.setOffline(false)
    const noOptIn = await context.newPage()
    await enter(noOptIn, 5444, '')
    assert.equal(await noOptIn.getByRole('button', { name: /Hỏi AI/ }).count(), 0)
    results.push({ id, width, compiledPreview: true, mode: info.viteMode, deployment: info.environment, offlineDeterministicAnswer: true, noApi: true, mainMatchesValidatedP5: true, mobileLayout: true, pendingQuestionDiscarded: true, saveUnchanged: true, separateOriginStorage: true, productionQueryAttackOff: true, previewNeedsOptIn: true })
    await context.close()
  }
  assert.deepEqual(apiRequests, []); assert.deepEqual(pageErrors, [])
} catch (error) {
  errors.push({ message: String(error), stack: error.stack }); process.exitCode = 1
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: `${out}/preview-failure.png` }).catch(() => {})
} finally {
  writeFileSync(out + '/browser-preview.json', JSON.stringify({ scope: 'Locally served compiled Preview artifact and ordinary Mobile production artifact on separate ports/origins; not a hosted Vercel URL.', results, errors, pageErrors, apiRequests, blockedExternal, routeProbes }, null, 2) + '\n')
  await browser.close(); await new Promise(done => beta.httpServer.close(done)); await new Promise(done => production.httpServer.close(done))
}
console.log(JSON.stringify({ records: results.length, errors, pageErrors, apiRequests, blockedExternal, routeProbes }))
