// Focused V2.3 UI and seeded C20 smoke test. Requires Vite and an existing Playwright installation.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { advance, createGame, decide, roll, transact } from '../src/game/engine.ts'
import { businessIncome } from '../src/game/business.ts'
import { liquidatableFunds } from '../src/game/selectors.ts'
import { money } from '../src/game/format.ts'
import { EVENTS } from '../src/data/events.ts'
import { ASSETS } from '../src/data/config.ts'
import { replayGameLog } from './diagnostics/replay-game-log.ts'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
const base = process.env.UI_URL || 'http://localhost:5173'
const folder = 'docs/playtests/encounter-limits-v2_3'
mkdirSync(folder, { recursive: true })
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
let screenshots = 0
async function screenshot(name) {
  await page.screenshot({ path: `${folder}/${name}.png`, fullPage: await page.locator('dialog[open]').count() === 0 })
  screenshots++
}
async function fit() {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  const dialog = page.locator('dialog[open]')
  if (await dialog.count()) assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().height <= innerHeight))
}
async function forecast() {
  assert.deepEqual(await page.locator('.forecast.expanded .forecast-assets > div > span').allTextContents(), ['stocks', 'bonds', 'gold'].map(asset => ASSETS[asset].label))
  assert.doesNotMatch(await page.locator('.forecast.expanded').textContent(), /Kinh doanh theo hiện trạng/)
}
async function cash(amount) {
  await page.waitForFunction(text => document.querySelector('.status-cash strong')?.textContent === text, money(amount))
}
try {
  for (const width of [320, 390, 430, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 })
    await page.goto(base)
    await page.getByRole('button', { name: 'Bắt đầu hành trình' }).click()
    await forecast()
    await fit()
    await screenshot(`${width}-forecast`)
    for (const fixture of ['bank', 'bank-later']) {
      await page.goto(`${base}/scripts/playtest-harness.html`)
      await page.getByRole('combobox', { name: 'Fixture', exact: true }).selectOption(fixture)
      await page.getByRole('button', { name: 'Nạp fixture', exact: true }).click()
      await page.locator('dialog[open]').waitFor()
      if (fixture === 'bank-later') {
        await page.locator('.trade-details summary').click()
        assert.equal(await page.locator('.trade-details p').filter({ hasText: /deposit-/ }).count(), 1)
        assert.match(await page.locator('.trade-details').textContent(), /đáo hạn vòng 1/)
        await page.locator('#deposit-term').selectOption('3')
      }
      await page.locator('#trade-amount').fill('1000000')
      await fit()
      await screenshot(`${width}-${fixture}`)
      await page.getByRole('button', { name: /Xác nhận gửi khoản mới/ }).evaluate(button => { button.click(); button.click() })
      await page.locator('dialog[open]').waitFor({ state: 'detached' })
      await cash(fixture === 'bank' ? 49_000_000 : 48_000_000)
      assert.ok(await page.getByRole('status').filter({ hasText: 'Đã gửi tiết kiệm' }).isVisible())
      assert.ok(await page.getByRole('button', { name: 'Gieo xúc xắc', exact: true }).isEnabled())
      assert.ok(await page.getByRole('button', { name: 'Gieo xúc xắc', exact: true }).evaluate(el => el === document.activeElement))
      await fit()
      await screenshot(`${width}-${fixture}-success`)
    }
    await page.goto(`${base}/scripts/playtest-harness.html`)
    await page.getByRole('combobox', { name: 'Fixture', exact: true }).selectOption('business-upgrade')
    await page.getByRole('button', { name: 'Nạp fixture', exact: true }).click()
    await page.getByRole('dialog', { name: 'Cơ sở kinh doanh', exact: true }).waitFor()
    assert.equal(await page.locator('.business-facts strong').first().textContent(), money(3_000_000))
    assert.match(await page.locator('.trading-panel').textContent(), /Nền cố định 3\.000\.000/)
    assert.doesNotMatch(await page.locator('.trading-panel').textContent(), /× hệ số xu hướng/)
    await fit()
    await screenshot(`${width}-business`)
    await page.getByRole('button', { name: /Nâng cấp 5/ }).evaluate(button => { button.click(); button.click() })
    await cash(25_000_000)
    assert.equal(await page.locator('.business-facts strong').first().textContent(), money(4_700_000))
    assert.ok(await page.getByRole('button', { name: /Nâng cấp 5/ }).isDisabled())
    assert.match(await page.locator('.trading-panel').textContent(), /Đã nâng cấp một lần tại ô này/)
    await page.getByRole('button', { name: /Nâng cấp 5/ }).scrollIntoViewIfNeeded()
    await fit()
    await screenshot(`${width}-business-upgrade-used`)
    await page.locator('.trade-details summary').click()
    assert.match(await page.locator('.trade-details').textContent(), /Cú sốc kinh tế đổi giá thu hồi, không đổi thu nhập vận hành/)
    await page.getByRole('button', { name: /Bán toàn cơ sở/ }).click()
    await cash(41_500_000)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(base)
  await page.locator('.setup-customize summary').click()
  await page.locator('#allocation').focus()
  await page.keyboard.press('Home')
  await page.locator('#seed').fill('XVTL-V2-0')
  await page.getByRole('button', { name: 'Bắt đầu hành trình' }).click()
  let expected = createGame('XVTL-V2-0', 0, 1, 'experimental-b')
  let legacy = createGame('XVTL-V2-0', 0, 1, 'experimental-b', undefined, 'v2.2-trend-shock')
  const act = transition => { expected = transition(expected); legacy = transition(legacy) }
  let guard = 0
  while (expected.phase !== 'finished' && guard++ < 180) {
    if (expected.phase === 'forecast') {
      await forecast()
      await page.getByRole('button', { name: `Bắt đầu vòng ${expected.lap}` }).click()
      act(advance)
    } else if (expected.phase === 'rolling') {
      const turn = expected.turn + 1
      await page.getByRole('button', { name: 'Gieo xúc xắc', exact: true }).click()
      act(roll)
      await page.waitForFunction(value => document.querySelector('.location-turn')?.textContent === `Lượt ${value}`, turn)
      assert.deepEqual([expected.dice, expected.position, expected.rng], [legacy.dice, legacy.position, legacy.rng])
    } else if (expected.phase === 'event') {
      const event = EVENTS.find(e => e.id === expected.eventId)
      await page.getByRole('dialog', { name: event.title, exact: true }).waitFor()
      if (event.id === 'stocks' && expected.portfolio.cash >= 1_000_000) {
        await page.locator('#trade-amount').fill('1000000')
        await page.getByRole('button', { name: /Xác nhận mua cổ phiếu/ }).evaluate(button => { button.click(); button.click() })
        act(s => transact(s, { kind: 'buy', asset: 'stocks', amount: 1_000_000, completeEncounter: true }))
        await page.locator('dialog[open]').waitFor({ state: 'detached' })
        assert.ok(await page.getByRole('button', { name: 'Gieo xúc xắc', exact: true }).isEnabled())
      } else {
        let traded = false
        if (event.id === 'business') {
          if (expected.business.capital === 0 && expected.lap < 4 && expected.portfolio.cash >= 20_000_000) {
            await page.getByRole('button', { name: /Đầu tư cơ sở/ }).click()
            act(s => transact(s, { kind: 'buy', asset: 'business', amount: 20_000_000 }))
            assert.ok(await page.getByRole('button', { name: /Nâng cấp/ }).isDisabled())
            traded = true
          } else if (expected.business.capital > 0 && expected.lap === 4) {
            await page.getByRole('button', { name: /Bán toàn cơ sở/ }).click()
            act(s => transact(s, { kind: 'sell', asset: 'business', amount: s.portfolio.business }))
            traded = true
          } else if (expected.business.capital > 0 && expected.turn > expected.businessPurchaseTurn) {
            if (expected.portfolio.cash >= 5_000_000 && Object.values(expected.business.upgrades).reduce((a, b) => a + b, 0) < 6) {
              await page.locator('#business-trend').selectOption(expected.scenarioId)
              await page.getByRole('button', { name: /Nâng cấp/ }).click()
              act(s => transact(s, { kind: 'upgrade', asset: 'business', amount: 5_000_000, trend: s.scenarioId }))
              traded = true
              assert.ok(await page.getByRole('button', { name: /Nâng cấp/ }).isDisabled())
            }
          }
          await cash(expected.portfolio.cash)
          if (expected.business.capital > 0) assert.equal(await page.locator('.business-facts strong').first().textContent(), money(businessIncome(expected)))
          await screenshot(`game-business-${expected.turn}`)
        }
        const option = event.options.find(o => o.id === 'skip') || event.options[0]
        await page.getByRole('button', { name: traded ? 'Hoàn tất · Về bàn chơi' : option.label, exact: false }).click()
        act(s => decide(s, option.id))
      }
    } else if (expected.phase === 'summary') {
      await page.getByRole('dialog', { name: `Quyết toán vòng ${expected.lap}` }).waitFor()
      await screenshot(`game-start-${expected.lap}`)
      await page.getByRole('button', { name: 'Mở quyền bán tại START' }).click()
      act(advance)
    } else if (expected.phase === 'rebalancing') {
      await page.getByRole('button', { name: expected.lap === 4 ? 'Xem kết quả hành trình' : 'Hoàn tất · Xem dự báo' }).click()
      act(advance)
    } else throw Error(`Unexpected ${expected.phase}`)
    await fit()
    await cash(expected.portfolio.cash)
    assert.equal(await page.locator('.status-funds strong').textContent(), money(liquidatableFunds(expected)))
  }
  assert.equal(expected.termination, 'completed')
  assert.equal(expected.summaries.length, 4)
  await screenshot('390-result')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Tải nhật ký quyết định' }).click()
  const download = await downloadPromise
  const path = `${folder}/browser-game-log.json`
  await download.saveAs(path)
  const data = JSON.parse(readFileSync(path, 'utf8'))
  assert.equal(data.businessRulesVersion, 'v2.3-fixed-income')
  assert.equal(data.encounterRulesVersion, 'v2.3-single-action')
  assert.deepEqual(JSON.parse(JSON.stringify(replayGameLog(data))), JSON.parse(JSON.stringify(expected)))
  for (const entry of data.entries.filter(e => e.decisionId === 'buy-stocks-complete')) assert.ok(!data.entries.some(e => e.turn === entry.turn && e.decisionId === 'skip'))
  writeFileSync(`${path}.gz`, gzipSync(readFileSync(path))); rmSync(path)
  assert.deepEqual(errors, [])
  const evidence = { widths: [320, 390, 430, 1440], screenshots, errors, seed: expected.seed, businessRulesVersion: expected.businessRulesVersion,
    encounterRulesVersion: expected.encounterRulesVersion, bankAtomicCompletion: true, bankDoubleTapProtected: true, bankLaterEncounterWithExistingLot: true, businessDoubleTapProtected: true, businessSaleAfterUpgrade: true,
    laps: expected.summaries.map(s => s.lap), rolls: expected.turn, lawfulProceeds: liquidatableFunds(expected), legacyLawfulProceedsSameActions: liquidatableFunds(legacy),
    businessPurchases: data.playtest.businessPurchases, businessUpgrades: data.playtest.businessUpgrades, businessSales: data.playtest.businessSales,
    stockPurchases: data.playtest.financialPurchases.stocks, forecastAssets: ['stocks', 'bonds', 'gold'], fullSnapshotReplay: true, legacyDicePathUnchanged: true }
  assert.ok(evidence.businessPurchases > 0 && evidence.businessUpgrades > 0 && evidence.businessSales > 0 && evidence.stockPurchases > 0)
  writeFileSync(`${folder}/verification.json`, JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify(evidence, null, 2))
} finally { await browser.close() }
