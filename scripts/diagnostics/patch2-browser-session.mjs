import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { resolve, join } from 'node:path'
import { homedir } from 'node:os'
import { createServer, preview } from '../../node_modules/vite/dist/node/index.js'
import react from '@vitejs/plugin-react'
import { legacyAiIsolation } from '../../release/beta/legacy-ai-isolation.ts'
import { betaBuildSettings } from '../../release/beta/build-policy.ts'
import { naturalCuratedState } from '../../tests/helpers/curated-natural.ts'
import { serializeLog } from '../../src/game/log.ts'
import { saveGameLocally, GAME_SAVE_KEY } from '../../src/game/saved-game.ts'
import { currentTileName } from '../../mobile_app/src/game/curated-catalog.ts'

const out = 'docs/qa/release-hardening-patch2'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || join(homedir(), 'AppData/Local/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe') })
const betaPreview = await preview({ configFile: resolve('release/beta/vite.config.ts'), logLevel: 'error', preview: { host: '127.0.0.1', port: 5444, strictPort: true } })
const initial = naturalCuratedState('personal'), imported = naturalCuratedState('macro')
const results = [], errors = [], pageErrors = [], apiRequests = []
const host = `import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{GameExperience}from'/mobile_app/src/App.tsx';import{GameSetup}from'/mobile_app/src/components/GameSetup.tsx';import{createMobileSession,createMvpMobileGame}from'/mobile_app/src/game/session.ts';import{serializeLog}from'/src/game/log.ts';import{restoreSavedGame}from'/src/game/saved-game.ts';import'/mobile_app/src/index.css';function Host(){const[session,setSession]=useState(()=>createMobileSession(${JSON.stringify(initial)}));const[importOpen,setImportOpen]=useState(false);const restart=()=>setSession(createMobileSession(createMvpMobileGame('curated-browser-restart',0,1)));return <><nav aria-label="QA lifecycle controls" style={{position:'fixed',left:0,top:0,zIndex:50000}}><button onClick={restart}>QA Restart</button><button onClick={()=>setSession(createMobileSession(restoreSavedGame(serializeLog(session.getSnapshot()))))}>QA Resume</button><button onClick={()=>setImportOpen(true)}>QA Import</button></nav>{importOpen&&<GameSetup onStart={restart} onHelp={()=>{}} onRestore={state=>{setSession(createMobileSession(state));setImportOpen(false)}}/>}<GameExperience session={session} onRestart={restart}/></>}createRoot(document.getElementById('root')).render(<React.StrictMode><Host/></React.StrictMode>);`
const settings = betaBuildSettings(process.env)
const server = await createServer({ define: { 'import.meta.env.VITE_VERCEL_ENV': JSON.stringify(settings.environment), 'import.meta.env.VITE_AI_COMPANION_BETA': JSON.stringify(settings.enabled) }, configFile: false, root: resolve('.'), envDir: resolve('.npm-cache/curated-v2-no-env'), publicDir: resolve('mobile_app/public'), resolve: { dedupe: ['react', 'react-dom'] }, plugins: [legacyAiIsolation(), react(), {
  name: 'curated-lifecycle-qa-only',
  resolveId(id) { if (id === '/__curated_lifecycle.tsx') return id },
  load(id) { if (id === '/__curated_lifecycle.tsx') return host.replace('createMobileSession(' + JSON.stringify(initial) + ')', 'createMobileSession(new URLSearchParams(location.search).get("case")==="macro-compare"?' + JSON.stringify(imported) + ':' + JSON.stringify(initial) + ')') },
  configureServer(server) { server.middlewares.use(async (request, response, next) => {
    if (request.url?.startsWith('/api/')) { response.statusCode = 403; response.end('Local QA only'); return }
    if (request.url?.startsWith('/__curated_lifecycle.html')) {
      response.setHeader('Content-Type', 'text/html')
      response.end(await server.transformIndexHtml('/__curated_lifecycle.html', '<html lang="vi"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/__curated_lifecycle.tsx"></script></body></html>'))
    } else next()
  }) },
}], server: { host: '127.0.0.1', port: 5446, strictPort: true, hmr: false } })
function observe(page) {
  page.on('pageerror', e => pageErrors.push(e.message))
  page.on('request', r => { if (/\/api\/|generativelanguage|api.openai/i.test(r.url())) apiRequests.push(r.url()) })
}
async function askCurrent(page, id = 'personal-rules') {
  await page.locator(`input[name="ai-beta-category"][value="${id === 'personal-rules' ? 'personal' : 'macro'}"]`).check()
  await page.locator(`input[value="${id}"]`).check()
  await page.getByRole('button', { name: 'Gửi', exact: true }).click()
}
try {
  // Main app navigation: real Settings restart, without test-only lifecycle controls.
  const mainContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  let encoded
  saveGameLocally(initial, { setItem(_key, value) { encoded = value } })
  await mainContext.addInitScript(({ encoded, key }) => {
    localStorage.setItem(key, encoded)
    localStorage.setItem('xvtl:mobile:tutorial:v1', 'seen')
    localStorage.setItem('xvtl:mobile:tutorial_disabled', 'true')
    localStorage.setItem('xvtl:mobile:auto_show_rules', 'false')
  }, { encoded, key: GAME_SAVE_KEY })
  await mainContext.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  const main = await mainContext.newPage(); observe(main)
  await main.goto('http://127.0.0.1:5444/?aiBeta=1')
  await main.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
  await main.getByRole('button', { name: 'Bắt đầu phiêu lưu' }).click()
  await main.locator('[data-node-id]').first().click()
  await main.getByRole('button', { name: /Hỏi AI/ }).click()
  await main.setViewportSize({ width: 320, height: 844 })
  await main.screenshot({ path: `${out}/curated-empty-320.png` })
  await main.setViewportSize({ width: 390, height: 844 })
  await main.screenshot({ path: `${out}/curated-empty-390.png` })
  await askCurrent(main)
  await main.waitForFunction(() => document.querySelector('.semantic-result:not([aria-busy="true"])'))
  await main.getByRole('button', { name: 'Đóng Hỏi AI Beta' }).click()
  await main.getByRole('button', { name: /^Trả ngay/ }).click()
  await main.getByRole('button', { name: 'Cài đặt', exact: true }).click()
  await main.getByText('Bắt Đầu Lại Từ Đầu', { exact: true }).click()
  await main.getByText('BẤM LẦN NỮA ĐỂ XÁC NHẬN!', { exact: true }).click()
  await main.getByRole('button', { name: /Hỏi AI/ }).click()
  assert.equal(await main.locator('.curated-tile').innerText(), 'Ô vừa đến: Xuất phát')
  assert.equal(await main.locator('input[name="ai-beta-category"]:checked').count(), 0)
  assert.equal(await main.locator('.semantic-result').count(), 0)
  results.push({ scope: 'Main app, actual Settings two-step restart', pass: true })
  await mainContext.close()

  await server.listen()
  for (const width of [320, 390]) for (const id of ['personal-rules', 'macro-compare']) for (const action of ['restart', 'import', 'resume']) {
    const context = await browser.newContext({ viewport: { width, height: 844 } })
    await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
    const page = await context.newPage(); observe(page)
    await page.goto('http://127.0.0.1:5446/__curated_lifecycle.html?aiBeta=1&case=' + id)
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' })
    await page.getByRole('button', { name: /Hỏi AI/ }).click()
    await page.evaluate(() => {
      const original = crypto.subtle.digest.bind(crypto.subtle)
      window.__lifecycleWaiters = []
      crypto.subtle.digest = async (...args) => { await new Promise(resolveDigest => window.__lifecycleWaiters.push(resolveDigest)); return original(...args) }
      window.__restoreLifecycleDigest = () => { crypto.subtle.digest = original; window.__lifecycleWaiters.splice(0).forEach(resolveDigest => resolveDigest()) }
    })
    await askCurrent(page, id)
    await page.waitForFunction(() => document.querySelector('.semantic-result[aria-busy="true"]'))
    if (action === 'import') {
      await page.getByRole('button', { name: 'QA Import', exact: true }).click()
      // This probes the real file-input/restore lifecycle, not the legacy setup dialog's layout.
      await page.locator('#saved-game-file').setInputFiles({ name: 'curated-natural-gold.json', mimeType: 'application/json', buffer: Buffer.from(serializeLog(imported)) })
    }
    else await page.getByRole('button', { name: action === 'restart' ? 'QA Restart' : 'QA Resume', exact: true }).click()
    await page.waitForFunction(() => !document.querySelector('input[name="ai-beta-category"]:checked'))
    await page.evaluate(() => window.__restoreLifecycleDigest())
    await page.waitForTimeout(100)
    assert.equal(await page.locator('.semantic-result').count(), 0)
    assert.equal(await page.locator('input[name="ai-beta-question"]:checked').count(), 0)
    const expected = action === 'restart' ? 'Xuất phát' : action === 'import' || id === 'macro-compare' ? currentTileName(imported) : currentTileName(initial)
    assert.equal(await page.locator('.curated-tile').innerText(), 'Ô vừa đến: ' + expected)
    await page.screenshot({ path: `${out}/lifecycle-${id}-${action}-${width}.png` })
    results.push({ id, width, action, scope: 'QA-only browser component host: unchanged GameExperience + real GameSetup file input / canonical save restore / new session. Not main app import navigation.', pendingOldRequestDiscarded: true, selectionsReset: true, header: expected, pass: true })
    await context.close()
  }
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(apiRequests, [])
} catch (error) { errors.push({ message: String(error), stack: error.stack }); process.exitCode = 1 }
finally {
  writeFileSync(`${out}/browser-session.json`, JSON.stringify({ results, errors, pageErrors, apiRequests }, null, 2) + '\n')
  await browser.close(); await server.close(); await new Promise(done => betaPreview.httpServer.close(done))
}
console.log(JSON.stringify({ records: results.length, errors, pageErrors, apiRequests }))
