import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { replayGameLog } from './diagnostics/replay-game-log.ts'
import type { ReplayLog } from './diagnostics/replay-game-log.ts'
import { ECONOMY } from '../src/data/config.ts'
import { liquidatableFunds, victory } from '../src/game/selectors.ts'
import { marketBulletin, roundMarketReview } from '../mobile_app/src/game/market-news.ts'

const input = process.argv[2]
const folder = process.argv[3] ?? 'docs/playtests/atomic-investments-v24'
if (!input) throw new Error('Usage: node --experimental-strip-types scripts/verify-atomic-investments-log.ts <browser-export.json[.gz]> [evidence-folder]')
const bytes = readFileSync(input)
const raw = input.endsWith('.gz') ? gunzipSync(bytes) : bytes
const data = JSON.parse(raw.toString()) as ReplayLog & { playtest: { diceRolls: number; financialPurchases: Record<string, number> } }
const game = data.state
assert.equal(game.encounterRulesVersion, 'v2.4-atomic-investments')
assert.equal(game.termination, 'completed')
assert.equal(game.summaries.length, 4)
assert.deepEqual(JSON.parse(JSON.stringify(replayGameLog(data))), game)
const buys = data.entries.filter(entry => /^buy-(stocks|gold|bonds)-complete$/.test(entry.decisionId ?? ''))
assert.equal(new Set(buys.map(entry => entry.turn)).size, buys.length)
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9)
for (const entry of buys) {
  const before = entry.before; const after = entry.after
  const amount = before.portfolio.cash - after.portfolio.cash
  assert.equal(after.phase, 'rolling')
  assert.equal(before.phase, 'event')
  assert.equal(after.encounterRulesVersion, 'v2.4-atomic-investments')
  assert.equal(after.rng, before.rng)
  assert.equal(after.turn, before.turn)
  assert.deepEqual(after.market, before.market)
  assert.ok(amount > 0 && Number.isSafeInteger(amount))
  assert.ok(!data.entries.some(other => other.turn === entry.turn && other.decisionId === 'skip'))
  if (entry.decisionId === 'buy-gold-complete') close(after.goldUnits - before.goldUnits, amount / before.market.gold.currentPrice)
  else if (entry.decisionId === 'buy-bonds-complete') {
    assert.equal(after.bondLots.length, before.bondLots.length + 1)
    const lot = after.bondLots.at(-1)!
    close(lot.units, amount / before.market.bond.currentPrice)
    close(lot.principal, lot.units * ECONOMY.bond.facePrice)
  } else {
    const stock = before.market.stocks.find(stock => (after.stockHoldings[stock.id]?.units ?? 0) > (before.stockHoldings[stock.id]?.units ?? 0))!
    close(after.stockHoldings[stock.id].units - (before.stockHoldings[stock.id]?.units ?? 0), amount / stock.currentPrice)
  }
}
for (const asset of ['stocks', 'gold', 'bonds']) {
  const count = buys.filter(entry => entry.decisionId === `buy-${asset}-complete`).length
  assert.ok(count > 0, `Missing browser purchase: ${asset}`)
  assert.equal(data.playtest.financialPurchases[asset], count)
}
const beforeNews = JSON.stringify(game)
marketBulletin(game)
const reviews = game.summaries.map(summary => roundMarketReview(game, summary.lap))
assert.equal(JSON.stringify(game), beforeNews)
const browser = JSON.parse(readFileSync(join(folder, 'browser-verification.json'), 'utf8'))
assert.equal(browser.rolls, data.playtest.diceRolls)
for (const check of browser.events.filter((event: { pass?: boolean }) => event.pass !== undefined)) assert.equal(check.pass, true)
for (const asset of ['stocks', 'gold', 'bonds']) assert.equal(browser.purchases[asset], data.playtest.financialPurchases[asset])
const historicalFiles = [join(folder, 'historical-multi-purchase.json.gz'), 'docs/playtests/encounter-limits-v2_3/browser-game-log.json.gz', 'docs/playtests/economic-news-v1/browser-game-log.json.gz']
const historical = historicalFiles.map(file => {
  const raw = gunzipSync(readFileSync(file)); const saved = JSON.parse(raw.toString())
  assert.deepEqual(JSON.parse(JSON.stringify(replayGameLog(saved))), saved.state)
  const repeated = { gold: 0, bonds: 0 }; const seen = new Set<string>()
  for (const entry of saved.entries) {
    if (!['buy-gold', 'buy-bonds'].includes(entry.decisionId)) continue
    const asset = entry.decisionId.slice(4) as 'gold' | 'bonds'; const key = `${entry.turn}:${asset}`
    if (seen.has(key)) repeated[asset]++
    seen.add(key)
  }
  return { file, encounterRulesVersion: saved.encounterRulesVersion ?? 'legacy-multi-action', fullStateReplay: true,
    repeated, sha256: createHash('sha256').update(raw).digest('hex') }
})
const generation = JSON.parse(readFileSync(join(folder, 'historical-fixture-generation.json'), 'utf8'))
assert.equal(historical[0].sha256, generation.sha256)
assert.ok(historical[0].repeated.gold > 0 && historical[0].repeated.bonds > 0)
const result = { seed: game.seed, encounterRulesVersion: game.encounterRulesVersion, laps: game.summaries.length,
  diceRolls: data.playtest.diceRolls, entries: data.entries.length, purchases: data.playtest.financialPurchases,
  lawfulProceeds: liquidatableFunds(game), victory: victory(game), fullStateReplay: true,
  onePurchasePerTurn: true, exactPurchaseFinancials: true, unchangedPurchaseRngAndPrices: true, newsReadOnly: true, reviews, historical }
writeFileSync(join(folder, 'browser-game-log.json.gz'), gzipSync(raw))
writeFileSync(join(folder, 'replay-verification.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ ...result, reviews: reviews.map(review => ({ lap: review.lap, forecastId: review.forecastId })), historical }, null, 2))
