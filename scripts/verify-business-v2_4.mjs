import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { advance, createGame, decide, roll, transact } from '../src/game/engine.ts'
import { businessIncome } from '../src/game/business.ts'
import { customerPreferenceForLap } from '../src/game/customer-preferences.ts'
import { liquidatableFunds } from '../src/game/selectors.ts'
import { money } from '../src/game/format.ts'
import { CUSTOMER_PREFERENCES } from '../src/data/customer-preferences.ts'
import { EVENTS } from '../src/data/events.ts'
import { replayGameLog } from './diagnostics/replay-game-log.ts'
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
const base = process.env.UI_URL || 'http://localhost:5173'
const folder = process.env.MVP_EVIDENCE_DIR || 'docs/playtests/business-v2_4/preferences'
mkdirSync(folder, { recursive: true })
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
let screenshots = 0
async function shot(name) {
  await page.screenshot({ path: `${folder}/${name}.png`, fullPage: await page.locator('dialog[open]').count() === 0 }); screenshots++
}
async function fit() {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  const modal = page.locator('dialog[open]')
  if (await modal.count()) assert.ok(await modal.evaluate(el => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().height <= innerHeight))
}
async function cash(value) {
  await page.waitForFunction(text => document.querySelector('.status-cash strong')?.textContent === text, money(value))
}
async function fixture(id) {
  await page.goto(`${base}/scripts/playtest-harness.html`)
  await page.getByRole('combobox', { name: 'Fixture', exact: true }).selectOption(id)
  await page.getByRole('button', { name: 'Nạp fixture', exact: true }).click()
  await page.locator('dialog[open]').waitFor()
}
async function forecast() {
  assert.deepEqual(await page.locator('.forecast.expanded .forecast-assets > div > span').allTextContents(), ['Cổ phiếu', 'Trái phiếu', 'Vàng'])
  assert.equal(await page.locator('.forecast.expanded .customer-preference').count(), 0)
  assert.doesNotMatch(await page.locator('.forecast.expanded').textContent(), /Không gian check-in|Giá cả hợp lý|Chất lượng đồ uống/)
}
try {
  for (const width of [320, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width >= 768 ? 1000 : 844 })
    await fixture('business')
    assert.equal(await page.getByRole('radio').count(), 0)
    assert.equal(await page.getByRole('button', { name: /Nâng cấp|Bán toàn cơ sở/ }).count(), 0)
    assert.match(await page.locator('.business-purchase-facts').textContent(), /20\.000\.000.*3\.000\.000.*14\.000\.000/s)
    await fit(); await shot(`${width}-purchase`)
    await page.getByRole('button', { name: /Đầu tư cơ sở/ }).evaluate(el => { el.click(); el.click() })
    await page.locator('dialog[open]').waitFor({ state: 'detached' }); await cash(30_000_000)
    assert.ok(await page.getByRole('status').filter({ hasText: 'Đã mua cơ sở kinh doanh' }).isVisible())
    assert.ok(await page.getByRole('button', { name: 'Gieo xúc xắc', exact: true }).isEnabled())
    await shot(`${width}-purchase-success`)
    await fixture('business-upgrade')
    const current = await page.locator('.customer-preference').getAttribute('data-current-preference')
    assert.equal(current, customerPreferenceForLap('V21-FIXTURE-business-upgrade', 1))
    assert.equal(await page.getByRole('radio').count(), 3)
    assert.equal(await page.locator('.business-facts strong').first().textContent(), money(3_000_000))
    await fit(); await shot(`${width}-preference`)
    // Native radios support keyboard arrows as well as taps.
    await page.getByRole('radio').first().focus(); await page.keyboard.press('ArrowDown')
    assert.ok(await page.getByRole('radio').nth(1).isChecked())
    for (const choice of CUSTOMER_PREFERENCES) {
      await page.locator(`input[value="${choice.id}"]`).check()
      assert.match(await page.locator('.upgrade-benefits p').textContent(), new RegExp(choice.id === current ? '1\\.700\\.000' : '700\\.000'))
    }
    await page.locator(`input[value="${current}"]`).check()
    const upgrade = page.getByRole('button', { name: /^Nâng cấp/ })
    await upgrade.scrollIntoViewIfNeeded(); await fit(); await shot(`${width}-upgrade-choice`)
    await upgrade.evaluate(el => { el.click(); el.click() }); await cash(25_000_000)
    assert.equal(await page.locator('.business-facts strong').first().textContent(), money(4_700_000))
    assert.ok(await page.getByRole('button', { name: /^Nâng cấp/ }).isDisabled())
    assert.match(await page.locator('.business-panel').textContent(), /Đã nâng cấp một lần tại ô này/)
    await page.getByRole('button', { name: /Bán toàn cơ sở/ }).scrollIntoViewIfNeeded(); await shot(`${width}-upgrade-used`)
    await page.getByRole('button', { name: /Bán toàn cơ sở/ }).click(); await cash(41_500_000)
    await fixture('business'); await page.getByRole('button', { name: 'Bỏ qua cơ hội', exact: false }).click()
    await cash(50_000_000); assert.equal(await page.locator('dialog[open]').count(), 0)
    await page.goto(base); await page.getByRole('button', { name: 'Bắt đầu hành trình' }).click()
    await forecast(); await fit()
  }

  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(base)
  await page.locator('.setup-customize summary').click(); await page.locator('#allocation').focus(); await page.keyboard.press('Home')
  await page.locator('#seed').fill('XVTL-V2-0'); await page.getByRole('button', { name: 'Bắt đầu hành trình' }).click()
  let expected = createGame('XVTL-V2-0', 0, 1, 'experimental-b')
  let legacy = createGame('XVTL-V2-0', 0, 1, 'experimental-b', undefined, 'v2.3-fixed-income')
  const act = fn => { expected = fn(expected); legacy = fn(legacy) }
  const preferences = {}; let guard = 0
  while (expected.phase !== 'finished' && guard++ < 180) {
    assert.equal(expected.customerPreferenceId, customerPreferenceForLap(expected.seed, expected.lap))
    preferences[expected.lap] = expected.customerPreferenceId
    if (expected.phase === 'forecast') {
      await forecast(); await page.getByRole('button', { name: `Bắt đầu vòng ${expected.lap}` }).click(); act(advance)
    } else if (expected.phase === 'rolling') {
      await page.getByRole('button', { name: 'Gieo xúc xắc', exact: true }).click(); act(roll)
      await page.waitForFunction(turn => document.querySelector('.location-turn')?.textContent === `Lượt ${turn}`, expected.turn)
      assert.deepEqual([expected.dice, expected.position, expected.rng], [legacy.dice, legacy.position, legacy.rng])
    } else if (expected.phase === 'event') {
      const event = EVENTS.find(e => e.id === expected.eventId)
      await page.getByRole('dialog', { name: event.title, exact: true }).waitFor()
      if (event.id === 'business' && expected.business.capital === 0 && expected.lap < 4) {
        await page.getByRole('button', { name: /Đầu tư cơ sở/ }).evaluate(el => { el.click(); el.click() })
        act(s => transact(s, { kind: 'buy', asset: 'business', amount: 20_000_000 }))
        await page.locator('dialog[open]').waitFor({ state: 'detached' }); await shot('game-purchase-success')
      } else if (event.id === 'stocks') {
        await page.locator('#trade-amount').fill('1000000')
        await page.getByRole('button', { name: /Xác nhận mua cổ phiếu/ }).evaluate(el => { el.click(); el.click() })
        act(s => transact(s, { kind: 'buy', asset: 'stocks', amount: 1_000_000, completeEncounter: true }))
      } else if (event.id === 'bank') {
        await page.locator('#trade-amount').fill('1000000'); await page.getByRole('button', { name: /Xác nhận gửi khoản mới/ }).click()
        act(s => transact(s, { kind: 'deposit', amount: 1_000_000, term: 1 }))
      } else {
        let traded = false
        if (event.id === 'business' && expected.business.capital > 0) {
          assert.equal(await page.locator('.customer-preference').getAttribute('data-current-preference'), expected.customerPreferenceId)
          if (expected.lap < 4) {
            await page.locator(`input[value="${expected.customerPreferenceId}"]`).check()
            await page.getByRole('button', { name: /^Nâng cấp/ }).click()
            expected = transact(expected, { kind: 'upgrade', asset: 'business', amount: 5_000_000, customerPreferenceId: expected.customerPreferenceId })
            legacy = transact(legacy, { kind: 'upgrade', asset: 'business', amount: 5_000_000, trend: legacy.scenarioId })
            assert.equal(await page.locator('.business-facts strong').first().textContent(), money(businessIncome(expected)))
            assert.ok(await page.getByRole('button', { name: /^Nâng cấp/ }).isDisabled())
          } else {
            await page.getByRole('button', { name: /Bán toàn cơ sở/ }).click()
            act(s => transact(s, { kind: 'sell', asset: 'business', amount: s.portfolio.business }))
          }
          traded = true; await shot(`game-business-${expected.turn}`)
        }
        const option = event.options.find(o => o.id === 'skip') || event.options[0]
        await page.getByRole('button', { name: traded ? 'Hoàn tất · Về bàn chơi' : option.label, exact: false }).click()
        act(s => decide(s, option.id))
      }
    } else if (expected.phase === 'summary') {
      await shot(`game-start-${expected.lap}`)
      await page.getByRole('button', { name: 'Mở quyền bán tại START' }).click(); act(advance)
    } else if (expected.phase === 'rebalancing') {
      await page.getByRole('button', { name: expected.lap === 4 ? 'Xem kết quả hành trình' : 'Hoàn tất · Xem dự báo' }).click(); act(advance)
    } else throw Error(`Unexpected ${expected.phase}`)
    await fit(); await cash(expected.portfolio.cash)
    assert.equal(await page.locator('.status-funds strong').textContent(), money(liquidatableFunds(expected)))
  }
  assert.equal(expected.termination, 'completed'); assert.equal(expected.summaries.length, 4)
  await shot('390-result')
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Tải nhật ký quyết định' }).click()
  const download = await downloadPromise; const path = `${folder}/browser-game-log.json`; await download.saveAs(path)
  const data = JSON.parse(readFileSync(path, 'utf8'))
  assert.equal(data.businessRulesVersion, 'v2.4-customer-preferences')
  assert.deepEqual(JSON.parse(JSON.stringify(replayGameLog(data))), JSON.parse(JSON.stringify(expected)))
  for (const e of data.entries.filter(e => ['buy-business','buy-stocks-complete','deposit-bank'].includes(e.decisionId))) assert.ok(!data.entries.some(p => p.turn === e.turn && p.decisionId === 'skip'))
  writeFileSync(`${path}.gz`, gzipSync(readFileSync(path))); rmSync(path)
  assert.deepEqual(errors, [])
  const result = { widths: [320,390,430,768,1024,1440], screenshots, errors, seed: expected.seed, businessRulesVersion: expected.businessRulesVersion,
    encounterRulesVersion: expected.encounterRulesVersion, customerPreferencesByLap: preferences, rounds: expected.summaries.map(s=>s.lap), rolls: expected.turn,
    lawfulProceeds: liquidatableFunds(expected), businessPurchases: data.playtest.businessPurchases, businessUpgrades: data.playtest.businessUpgrades,
    businessSales: data.playtest.businessSales, atomicStocks: data.playtest.financialPurchases.stocks, completeSnapshotReplay: true,
    legacyRngDiceMovementUnchanged: true, customerSpecializations: CUSTOMER_PREFERENCES.map(p=>p.id), nativeRadioKeyboardNavigation: true, forecastContainsOnlyFinancialAssets: true }
  assert.ok(result.businessPurchases && result.businessUpgrades && result.businessSales && result.atomicStocks)
  writeFileSync(`${folder}/verification.json`, JSON.stringify(result, null, 2)+'\n'); console.log(JSON.stringify(result, null, 2))
} finally { await browser.close() }
