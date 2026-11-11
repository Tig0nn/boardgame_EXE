
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { isDeepStrictEqual } from 'node:util'
import { createServer } from 'vite'
import { ECONOMY } from '../../src/data/config.ts'
import { eventsForGame } from '../../src/data/events.ts'
import { creditBondLots } from '../../src/game/bond-credit.ts'
import { advance, decide, roll, snapshot, transact } from '../../src/game/engine.ts'
import { serializeLog } from '../../src/game/log.ts'
import { createMultiCourseGame } from '../../src/game/new-game.ts'
import { GAME_SAVE_KEY, restoreSavedGame, saveGameLocally } from '../../src/game/saved-game.ts'
import { replayGameLog } from './replay-game-log.ts'

const [mode, baselineFile, candidateFile] = process.argv.slice(2)
assert(['record', 'verify'].includes(mode) && baselineFile, 'Provide record/verify and an external evidence path')
if (mode === 'verify') assert(candidateFile)
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const amount = 2_000_000
const digest = value => createHash('sha256').update(value).digest('hex')
function packed(state) {
  let value
  assert(saveGameLocally(state, { setItem(_, text) { value = text } }))
  return value
}
function fixture(name) {
  return restoreSavedGame(gunzipSync(readFileSync('docs/playtests/' + name + '.json.gz')).toString())
}
function laterEncounter(asset) {
  for (let seed = 0; seed < 100; seed++) {
    let game = createMultiCourseGame('trading-parity-' + seed)
    let bought = false
    for (let i = 0; i < 240 && !['finished', 'funding'].includes(game.phase); i++) {
      if (game.phase === 'rolling') game = roll(game)
      else if (game.phase === 'event') {
        const event = eventsForGame(game).find(candidate => candidate.id === game.eventId)
        assert(event)
        if (event.id === asset && bought && game.portfolio[asset] > 0 && game.businessPurchaseTurn !== game.turn
          && (asset !== 'bonds' || creditBondLots(game).some(({ quote }) => quote.executable))) return game
        if (event.id === asset && !bought && game.portfolio.cash >= ECONOMY.business.cost) {
          game = transact(game, asset === 'business' ? { kind: 'buy', asset, amount: ECONOMY.business.cost }
            : { kind: 'buy', asset, amount, issuerId: 'an-tam', symbolId: game.market.stocks[0].id, completeEncounter: true })
          bought = true
          continue
        }
        const option = event.options.find(o => o.id === 'skip') ?? event.options.find(o => !o.obligation) ?? event.options[0]
        game = decide(game, option.id)
      } else game = advance(game)
    }
  }
  throw Error('No engine-generated follow-up encounter for ' + asset)
}

const stocks = fixture('b18-mobile-ux-writing/checkpoints/stocks')
const gold = fixture('b18-compact-financial-ui/checkpoints/gold')
const bonds = fixture('b18-compact-financial-ui/checkpoints/bonds')
const business = fixture('b18-mobile-ux-writing/checkpoints/business')
const heldStock = laterEncounter('stocks')
const heldBond = laterEncounter('bonds')
const heldBusiness = laterEncounter('business')
const soldStock = heldStock.market.stocks.find(s => heldStock.stockHoldings[s.id]?.units > 0)
const soldBond = creditBondLots(heldBond).find(({ quote }) => quote.executable)
assert(soldStock && soldBond)
const cases = [
  { name: 'stocks-buy', game: stocks, input: amount, symbol: 'CMG', button: /^Mua [\d.]+ ₫/, action: { kind: 'buy', asset: 'stocks', amount, term: 1, symbolId: 'CMG', completeEncounter: true }, rapid: true },
  { name: 'stocks-sell', game: heldStock, sell: true, input: 1_000_000, button: /^Xác nhận bán/, action: { kind: 'sell', asset: 'stocks', amount: 1_000_000, symbolId: soldStock.id } },
  { name: 'gold-buy', game: gold, input: amount, button: /^Mua [\d.]+ ₫/, action: { kind: 'buy', asset: 'gold', amount, term: 1, symbolId: gold.market.stocks[0].id, completeEncounter: true } },
  { name: 'bonds-buy', game: bonds, input: 3_000_000, issuer: 'Công ty Bứt Phá', button: /^Mua trái phiếu/, action: { kind: 'buy', asset: 'bonds', amount: 3_000_000, issuerId: 'but-pha', completeEncounter: true } },
  { name: 'bonds-sell', game: heldBond, sell: true, button: /^Xác nhận bán/, action: { kind: 'sell', asset: 'bonds', lotId: soldBond.lot.id, amount: soldBond.quote.gross } },
  { name: 'business-buy', game: business, button: /^Mở quán [\d.]+ ₫/, action: { kind: 'buy', asset: 'business', amount: ECONOMY.business.cost } },
  { name: 'business-upgrade', game: heldBusiness, preference: true, button: /^Nâng cấp .* · /, action: { kind: 'upgrade', asset: 'business', amount: ECONOMY.business.upgradeCost, customerPreferenceId: 'checkin' } },
  { name: 'business-sell', game: heldBusiness, button: /^Bán toàn cơ sở/, action: { kind: 'sell', asset: 'business', amount: heldBusiness.portfolio.business } },
  { name: 'stocks-skip', game: stocks, button: /^Bỏ qua cơ hội$/, skip: true },
  { name: 'bonds-insufficient', game: bonds, input: bonds.portfolio.cash + 1, button: /^Mua trái phiếu/, invalid: true },
]
const server = await createServer({ root: resolve('mobile_app'), envDir: resolve('node_modules/.tmp/no-trading-test-env'),
  server: { host: '127.0.0.1', port: 5271, strictPort: true, hmr: false } })
const origin = 'http://127.0.0.1:5271'
const results = []
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH })
  for (const width of [320, 390]) {
    for (const test of cases) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width === 390 })
      try {
        await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
        const source = packed(test.game)
        await context.addInitScript(({ key, source }) => {
          if (!localStorage.getItem(key)) localStorage.setItem(key, source)
          localStorage.setItem('xvtl:mobile:tutorial:v1', 'seen')
          localStorage.setItem('xvtl:mobile:tutorial_disabled', 'true')
        }, { key: GAME_SAVE_KEY, source })
        const page = await context.newPage()
        page.setDefaultTimeout(15000)
        const pageErrors = []
        page.on('pageerror', error => pageErrors.push(error.message))
        await page.goto(origin)
        await page.getByRole('button', { name: 'Bắt đầu phiêu lưu', exact: true }).click()
        await page.getByTestId('map-node-1.1').click()
        const trade = page.locator('.gamified-modal-card').filter({ has: page.locator('.trading-panel, .investment-encounter') })
        await trade.waitFor()
        const scope = trade.locator('.mobile-trading')
        assert.equal(await scope.count(), mode === 'verify' ? 1 : 0, 'Mobile Trading renderer mount')
        const activate = async locator => width === 390 ? locator.tap() : locator.click()
        if (test.sell) await activate(trade.getByRole('button', { name: 'Bán', exact: true }))
        if (test.symbol) await trade.locator('#trade-symbol').selectOption(test.symbol)
        if (test.issuer) await activate(trade.getByRole('button', { name: new RegExp(test.issuer) }))
        if (test.preference) await trade.locator('input[name="business-preference"][value="checkin"]').check()
        let formatted
        if (test.input !== undefined) {
          const input = trade.locator(test.sell ? '#tile-sell-amount' : '#trade-amount')
          await input.fill(String(test.input))
          assert(await input.evaluate(node => node === document.activeElement))
          formatted = await input.inputValue()
          assert.equal(Number(formatted.replace(/\D/g, '')), test.input)
        }
        assert.equal(await page.evaluate(key => localStorage.getItem(key), GAME_SAVE_KEY), source)
        if (mode === 'verify') {
          const selected = trade.locator('.investment-actions button[aria-pressed="true"]')
          if (await selected.count()) assert.equal(await selected.evaluate(node => getComputedStyle(node).borderTopLeftRadius), '10px')
          const overflow = await scope.evaluate(node => {
            const limit = node.getBoundingClientRect().right + 1
            return node.scrollWidth <= node.clientWidth + 1 ? null : {
              width: node.clientWidth, scroll: node.scrollWidth,
              elements: [...node.querySelectorAll('*')].filter(item => item.getBoundingClientRect().right > limit)
                .slice(0, 10).map(item => [item.tagName, item.className, item.getBoundingClientRect().width])
            }
          })
          assert(!overflow, 'Trading overflow ' + JSON.stringify(overflow))
        }
        const button = trade.getByRole('button', { name: test.button }).first()
        let saved = source
        if (test.invalid) {
          assert(await button.isDisabled())
          assert.equal(await trade.locator('#trade-amount').getAttribute('aria-invalid'), 'true')
          await button.evaluate(node => { node.click(); node.click() })
        } else {
          const expected = test.skip ? decide(test.game, 'skip') : transact(test.game, test.action)
          if (test.rapid) {
            await button.evaluate(node => { node.click(); node.click() })
          } else if (width === 320) {
            await button.focus()
            assert(await button.evaluate(node => document.activeElement === node))
            if (mode === 'verify') {
              await page.keyboard.press('Tab')
              await page.keyboard.press('Shift+Tab')
              assert(await button.evaluate(node => document.activeElement === node && getComputedStyle(node).outlineStyle !== 'none'))
            }
            await page.keyboard.press('Enter')
          } else await activate(button)
          await page.waitForFunction(({ key, before }) => localStorage.getItem(key) !== before, { key: GAME_SAVE_KEY, before: source })
          saved = await page.evaluate(key => localStorage.getItem(key), GAME_SAVE_KEY)
          const restored = restoreSavedGame(saved)
          const oracle = restoreSavedGame(packed(expected))
          assert(isDeepStrictEqual(restored, oracle), 'State or log differs from engine for ' + test.name
            + ' actual=' + JSON.stringify(restored.log.at(-1)?.action) + ' expected=' + JSON.stringify(oracle.log.at(-1)?.action))
          const replay = replayGameLog(JSON.parse(serializeLog(restored)))
          assert(isDeepStrictEqual(snapshot(replay), snapshot(restored)), 'Independent replay differs for ' + test.name)
          await page.reload()
          assert.equal(await page.evaluate(key => localStorage.getItem(key), GAME_SAVE_KEY), saved)
        }
        if (test.invalid) assert.equal(await page.evaluate(key => localStorage.getItem(key), GAME_SAVE_KEY), source)
        assert.deepEqual(pageErrors, [])
        results.push({ width, case: test.name, input: digest(source), output: digest(saved), formatted: formatted ?? null })
        console.log('PASS ' + width + ' ' + test.name)
      } finally { await context.close() }
    }
  }
  if (mode === 'record') writeFileSync(baselineFile, JSON.stringify(results, null, 2) + '\n', { flag: 'wx' })
  else {
    assert.deepEqual(results, JSON.parse(readFileSync(baselineFile, 'utf8')), 'Candidate outcomes differ from HEAD baseline')
    writeFileSync(candidateFile, JSON.stringify(results, null, 2) + '\n', { flag: 'wx' })
  }
  console.log('TRADING PARITY ' + results.length + '/' + cases.length * 2)
} finally {
  await browser?.close()
  await server.close()
}
