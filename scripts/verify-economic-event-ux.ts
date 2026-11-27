import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { replayGameLog } from './diagnostics/replay-game-log.ts'
import type { ReplayLog } from './diagnostics/replay-game-log.ts'
import { buildEconomicEventImpact } from '../mobile_app/src/game/economic-event.ts'
import { roundMarketReview } from '../mobile_app/src/game/market-news.ts'
import { money, percent } from '../src/game/format.ts'
import { liquidatableFunds, victory } from '../src/game/selectors.ts'
import { buildCoachFacts } from '../src/ai/facts.ts'
import { validateCoachFacts } from '../src/ai/schema.ts'

const out = 'docs/playtests/economic-event-ux-v1'
const bytes = readFileSync(`${out}/browser-full-game.json.gz`)
const data = JSON.parse(gunzipSync(bytes).toString()) as ReplayLog
const game = replayGameLog(data)
assert.deepEqual(JSON.parse(JSON.stringify(game)), data.state)
assert.equal(game.phase, 'finished'); assert.equal(game.termination, 'completed')
assert.equal(game.summaries.length, 4); assert.equal(liquidatableFunds(game), 86_772_313)
assert.equal(victory(game).won, false)
assert.ok(validateCoachFacts(buildCoachFacts(game)).valid)
const browser = JSON.parse(readFileSync(`${out}/full-game-browser.json`, 'utf8'))
assert.equal(browser.productionModuleSrc, `/assets/${browser.bundle}`)
assert.equal(browser.rolls, game.log.filter(entry => entry.kind === 'roll').length)
assert.deepEqual(browser.startLaps, [1, 2, 3, 4])
for (const asset of ['stocks', 'bonds', 'gold']) assert.equal(browser.purchases[asset], game.log.filter(entry => entry.action?.kind === 'buy' && entry.action.asset === asset).length)
const shocks = game.log.filter(entry => entry.kind === 'market' && entry.eventId)
assert.equal(shocks.length, 3)
assert.deepEqual(shocks.map(entry => entry.eventId), ['credit-tightening', 'supply-recovery', 'demand-boom'])
const impacts = shocks.map(entry => {
  const index = game.log.indexOf(entry)
  const state = { ...game, ...entry.after, eventId: entry.eventId!, phase: 'event' as const,
    log: game.log.slice(0, index + 1), summaries: game.summaries.filter(summary => summary.lap < entry.after.lap) }
  const before = JSON.stringify(state), impact = buildEconomicEventImpact(state)!
  const observed = browser.events.find((event: { id: string; roll: number }) => event.id === entry.eventId && event.roll === entry.turn)
  assert.ok(observed); assert.equal(impact.available, true)
  for (const group of impact.groups) for (const item of group.items) {
    assert.ok(observed.details.includes(item.label))
    if (item.returnRate === null) assert.ok(observed.details.includes('Chưa đủ dữ liệu'))
    else {
      assert.ok(observed.details.includes(percent(item.returnRate)))
      assert.ok(observed.details.includes(`${money(item.priceBefore!)} → ${money(item.priceAfter!)}`))
    }
    if (item.credit) {
      assert.equal(item.credit.statusBefore, item.credit.statusAfter)
      assert.ok(observed.details.includes(`Áp lực trả nợ ${item.credit.stressBefore}/2 → ${item.credit.stressAfter}/2`))
    }
  }
  for (const instrument of [...entry.after.market.stocks, entry.after.market.gold, ...entry.after.bondCredit!.issuers])
    assert.equal(instrument.priceHistory.filter(point => point.kind === 'shock' && point.eventId === entry.eventId && point.timestamp === entry.turn).length, 1)
  const acknowledgement = game.log.find(item => item.kind === 'decision' && item.turn === entry.turn && item.eventId === entry.eventId)
  assert.equal(acknowledgement?.decisionId, 'acknowledge')
  assert.equal(game.log.filter(item => item.kind === 'decision' && item.turn === entry.turn && item.eventId === entry.eventId).length, 1)
  assert.deepEqual(acknowledgement!.before.market, acknowledgement!.after.market)
  assert.deepEqual(acknowledgement!.before.bondCredit, acknowledgement!.after.bondCredit)
  assert.equal(acknowledgement!.before.rng, acknowledgement!.after.rng)
  assert.equal(acknowledgement!.cashDelta, 0)
  buildEconomicEventImpact(state)
  assert.equal(JSON.stringify(state), before)
  return { id: entry.eventId, turn: entry.turn, lap: entry.lap, groups: impact.groups, portfolio: impact.portfolio,
    singleShock: true, acknowledgementNoPriceCreditCashOrRngChange: true }
})
for (const panel of browser.investmentPanels) {
  const entry = game.log.find(item => item.kind === 'encounter' && item.turn === panel.roll && item.eventId === panel.asset)
  assert.ok(entry)
  const state = entry.after
  if (panel.asset === 'gold') assert.ok(panel.text.includes(money(state.market.gold.currentPrice)))
  else if (panel.asset === 'stocks') assert.ok(panel.text.includes(money(state.market.stocks[0].currentPrice)))
  else for (const issuer of state.bondCredit!.issuers) assert.ok(panel.text.includes(issuer.currentPrice ? money(issuer.currentPrice) : 'Tạm ngừng giao dịch'))
}
const reviews = game.summaries.map(summary => roundMarketReview(game, summary.lap))
assert.equal(reviews.reduce((total, review) => total + review.shocks.length, 0), shocks.length)
const layouts = JSON.parse(readFileSync(`${out}/browser-layouts.json`, 'utf8'))
for (const width of [320, 390, 430]) for (const event of ['credit-tightening', 'demand-boom', 'supply-recovery']) {
  assert.ok(layouts.some((layout: { file: string }) => layout.file === `${width}-${event}.jpg`))
  assert.ok(layouts.some((layout: { file: string }) => layout.file === `${width}-${event}-details.jpg`))
}
const colors: Record<string, string> = { up: 'rgb(110, 231, 183)', down: 'rgb(253, 164, 175)', flat: 'rgb(203, 213, 225)', unavailable: 'rgb(203, 213, 225)' }
for (const layout of layouts) {
  assert.equal(layout.groups, 3); assert.equal(layout.clipped.length, 0)
  assert.ok(layout.documentWidth <= layout.width && layout.dialogScrollWidth <= layout.dialogWidth + 1 && layout.scrollWidth <= layout.scrollClientWidth + 1)
  assert.ok(layout.cta.top >= 0 && layout.cta.bottom <= layout.height)
  for (const movement of layout.movements) assert.equal(movement.color, colors[movement.class.split(' ').at(-1)])
}
const interactions = JSON.parse(readFileSync(`${out}/browser-interactions.json`, 'utf8'))
assert.deepEqual(interactions.map((item: { width: number }) => item.width), [320, 390, 430])
assert.ok(interactions.every((item: { passed: boolean; noUnintendedRoll: boolean }) => item.passed && item.noUnintendedRoll))
const consoleLog = JSON.parse(readFileSync(`${out}/browser-console.json`, 'utf8'))
assert.deepEqual(consoleLog, { fixtures: [], production: [] })
function jpegDimensions(bytes: Buffer) {
  let offset = 2
  while (offset < bytes.length) {
    assert.equal(bytes[offset], 0xff)
    const marker = bytes[offset + 1], size = bytes.readUInt16BE(offset + 2)
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker))
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) }
    offset += size + 2
  }
  throw new Error('Invalid JPEG')
}
const screenshots = readdirSync(out).filter(file => /^\d+-.*\.jpg$/.test(file)).map(file => {
  const dimensions = jpegDimensions(readFileSync(`${out}/${file}`)), expected = Number(file.split('-')[0])
  assert.equal(dimensions.width, expected, file)
  assert.equal(dimensions.height, expected === 320 ? 640 : expected === 390 ? 844 : expected === 430 ? 932 : 720, file)
  return { file, ...dimensions }
})
writeFileSync(`${out}/verification.json`, JSON.stringify({ fullStateReplay: true, seed: game.seed,
  exportSha256: createHash('sha256').update(bytes).digest('hex'), rolls: browser.rolls, laps: 4,
  lawfulProceeds: liquidatableFunds(game), won: false, impacts, investmentPanelsVerified: browser.investmentPanels.length,
  roundReviewsNoDoubleCounting: true, coachFactsValid: true, layouts: layouts.length, screenshots,
  limitations: 'Three-event responsive fixtures are injected DEV-only states. The exported four-lap production game uses normal UI/dice/animations. Initial setup and first purchase at 1280x720; all macro events onward at 390x844. No balance study, live provider or physical device test.' }, null, 2) + '\n')
console.log(`PASS: production game ${game.seed}, ${browser.rolls} rolls / 4 laps, 3 single shocks, full-state replay; popup and ${browser.investmentPanels.length} subsequent investment panels match snapshots; ${layouts.length} layouts / ${screenshots.length} JPEG dimensions; rapid acknowledgement, news and AI facts verified.`)
