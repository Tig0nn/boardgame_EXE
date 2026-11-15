import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { eventsForGame } from '../../src/data/events.ts'
import { decide, transact, snapshot } from '../../src/game/engine.ts'
import { depositPreview } from '../../src/game/selectors.ts'
import { money } from '../../src/game/format.ts'
import { restoreSavedGame } from '../../src/game/saved-game.ts'
const pw = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE ?? 'C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href)
const stage = process.argv.includes('--after') ? 'after' : 'before', root = 'docs/playtests/b18-financial-decision-copy', out = `${root}/${stage}`
mkdirSync(out, { recursive: true })
const browser = await pw.chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH ?? 'C:/Users/Admin/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const checks = [], errors = [], consoleErrors = []
const stored = p => p.evaluate(() => localStorage.getItem('xvtl:mobile:game:v1'))
const norm = s => s.replace(/\s+/g, ' ').trim()
async function open(c, id) {
  const p = await c.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('console', e => { if (e.type() === 'error') consoleErrors.push({ error: e.text(), location: e.location() }) })
  await p.goto(process.env.DECISION_COPY_URL ?? 'http://127.0.0.1:5214', { waitUntil: 'networkidle' })
  if (await p.getByRole('button', { name: 'Bỏ qua hướng dẫn' }).count()) await p.getByRole('button', { name: 'Bỏ qua hướng dẫn' }).click()
  const buffer = gunzipSync(readFileSync(`${root}/checkpoints/${id}.json.gz`)), game = JSON.parse(buffer).state
  await p.getByText('Mở ván đã lưu', { exact: true }).click()
  await p.locator('#saved-game-file').setInputFiles({ name: `${id}.json`, mimeType: 'application/json', buffer })
  await p.locator('dialog[open] #trade-amount,dialog[open] .decision-button').first().waitFor()
  await p.evaluate(() => document.fonts.ready)
  return { p, game }
}
async function shot(p, label) {
  const layout = await p.locator('dialog[open]').evaluate(e => ({ viewport: innerWidth, pageWidth: document.documentElement.scrollWidth,
    modalOverflow: e.scrollWidth > e.clientWidth + 1, nestedScroll: [...e.querySelectorAll('*')].filter(x => x.scrollHeight > x.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(x).overflowY)).length }))
  assert.ok(layout.pageWidth <= layout.viewport + 1 && !layout.modalOverflow && !layout.nestedScroll, label)
  await p.screenshot({ path: `${out}/${label}.png` }); writeFileSync(`${out}/${label}.txt`, await p.locator('dialog[open]').innerText())
  checks.push({ label, ...layout })
}
async function resume(p, expected) {
  const saved = await stored(p)
  assert.deepEqual(snapshot(restoreSavedGame(saved)), snapshot(expected))
  await p.reload(); await p.getByRole('button', { name: /Tiếp tục ván B18/ }).click()
  assert.equal(await stored(p), saved)
}
try {
  for (const [width, height] of [[320, 740], [390, 844], [430, 932], [1440, 900]]) {
    const c = await browser.newContext({ viewport: { width, height }, hasTouch: true })
    for (const id of ['family', 'repair', 'medical']) {
      const { p, game } = await open(c, id), before = await stored(p), event = eventsForGame(game).find(e => e.id === id)
      await shot(p, `${width}-${id}`)
      if (stage === 'after') {
        const text = await p.locator('dialog[open]').innerText()
        assert.doesNotMatch(text, /Nghĩa vụ tại|\+\s*[\d.,]+\s*₫|lãi vay|tiền phạt|\bSTART\b/)
        assert.match(text, /Trả ngay/); assert.match(text, /khi qua ô Xuất phát/)
        if (id === 'family') assert.match(text, /nhiều hơn trả ngay 500\.000 ₫/)
        for (let i = 0; i < event.options.length; i++) {
          const current = i === 0 ? { p, game } : await open(c, id), button = current.p.locator('dialog[open] .decision-button').nth(i)
          await button.click({ trial: true }); assert.ok(await button.evaluate(e => e.getBoundingClientRect().height) >= 44)
          if (i === 0) assert.equal(await stored(p), before)
          await button.click()
          await current.p.waitForFunction(length => JSON.parse(localStorage.getItem('xvtl:mobile:game:v1')).state.log.length > length, game.log.length)
          await resume(current.p, decide(game, event.options[i].id))
          checks.push({ label: `${width}-${id}-${event.options[i].id}`, actionUnchanged: true, exactEngineSnapshot: true, saveResumed: true })
          if (i !== 0) await current.p.close()
        }
      }
      await p.close()
    }
    {
      const { p, game } = await open(c, 'bank'), before = await stored(p)
      await p.locator('#trade-amount').fill('10000000'); await p.locator('.savings-terms input[value="2"]').check()
      await p.locator('#trade-amount').scrollIntoViewIfNeeded(); await shot(p, `${width}-bank`)
      if (stage === 'after') {
        for (const term of [1, 2, 3]) for (const amount of [10000000, 2000000]) {
          await p.locator('.savings-terms input[value="' + term + '"]').check(); await p.locator('#trade-amount').fill(String(amount))
          const preview = p.locator('.savings-preview'), quote = depositPreview(game, amount, term), text = norm(await preview.innerText())
          for (const value of [amount, quote.interest, amount + quote.interest]) assert.ok(text.includes(norm(money(value))))
          assert.match(text, new RegExp(`lần thứ ${quote.maturityLap}`))
          checks.push({ label: `${width}-bank-${term}-${amount}`, exactPreview: true })
        }
        await p.locator('.savings-preview').scrollIntoViewIfNeeded(); await shot(p, `${width}-bank-summary`)
        for (const amount of ['0', '99999999', 'abc']) {
          await p.locator('#trade-amount').fill(amount)
          assert.equal(await p.locator('.savings-preview dl').count(), 0)
          assert.equal(await p.getByRole('button', { name: /^Gửi tiết kiệm/ }).isDisabled(), true)
          checks.push({ label: `${width}-bank-invalid-${amount}`, noInvalidProjection: true })
        }
        await shot(p, `${width}-bank-invalid`)
        assert.equal(await stored(p), before)
        await p.locator('#trade-amount').fill('10000000'); await p.locator('.savings-terms input[value="2"]').check()
        await p.getByRole('button', { name: /^Gửi tiết kiệm/ }).click()
        await p.waitForFunction(length => JSON.parse(localStorage.getItem('xvtl:mobile:game:v1')).state.deposits.length > length, game.deposits.length)
        await resume(p, transact(game, { kind: 'deposit', amount: 10000000, term: 2, symbolId: game.market.stocks[0].id }))
        checks.push({ label: `${width}-bank-deposit-resume`, exactEngineSnapshot: true, saveResumed: true })
      }
      await p.close()
    }
    {
      const { p, game } = await open(c, 'stocks'), before = await stored(p)
      assert.ok(new Set(game.market.stocks.map(s => s.currentPrice)).size > 1, 'Real different prices required for symbol change check')
      for (const stock of game.market.stocks) {
        await p.locator('#trade-symbol').selectOption(stock.id)
        const fact = p.locator('.stock-trading .trade-facts > div').first()
        assert.equal(norm(await fact.locator('strong').innerText()), norm(money(stock.currentPrice)))
        if (stage === 'after') assert.equal(await fact.locator('span').innerText(), 'Giá hiện tại')
        checks.push({ label: `${width}-stock-${stock.id}`, correctSelectedPrice: true })
      }
      await p.locator('dialog[open]').evaluate(e => e.scrollTop = 0); await shot(p, `${width}-stocks`)
      assert.equal(await stored(p), before); if (stage === 'after') await resume(p, game)
      await p.close()
    }
    await c.close()
  }
  writeFileSync(`${out}/results.json`, JSON.stringify({ stage, browser: await browser.version(), checks, errors, consoleErrors,
    physicalDevices: false, source: 'Local Mobile UI; legal historical prefixes, all selected actions compared to unchanged engine snapshots.' }, null, 2) + '\n')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ stage, checks: checks.length, errors }))
} finally { await browser.close() }
