import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
import { replayGameLog } from './diagnostics/replay-game-log.ts'
import type { ReplayLog } from './diagnostics/replay-game-log.ts'
import { marketBulletin, roundMarketReview } from '../mobile_app/src/game/market-news.ts'
import { liquidatableFunds, victory } from '../src/game/selectors.ts'
import { percent } from '../src/game/format.ts'

// Run against an actual browser export. UI evidence is collected independently through CUA.
const input = process.argv[2]
const folder = process.argv[3] ?? 'docs/playtests/economic-news-v1'
if (!input) throw new Error('Usage: node --experimental-strip-types scripts/verify-economic-news-log.ts <browser-export.json[.gz]> [evidence-folder]')
const bytes = readFileSync(input)
const raw = input.endsWith('.gz') ? gunzipSync(bytes) : bytes
const log = JSON.parse(raw.toString('utf8')) as ReplayLog & { playtest: { diceRolls: number } }
const game = log.state
assert.equal(game.phase, 'finished')
assert.equal(game.termination, 'completed')
assert.equal(game.summaries.length, 4)
assert.deepEqual(JSON.parse(JSON.stringify(replayGameLog(log))), game)
const before = JSON.stringify(game)
const reviews = game.summaries.map((summary: { lap: number }) => roundMarketReview(game, summary.lap))
for (const review of reviews) {
  assert.ok(review.forecastId)
  assert.equal(review.settled, true)
  assert.ok(review.assets.every(item => item.returnRate !== null))
  const announced = log.entries.filter((entry: { kind: string; eventId?: string; after: { lap: number } }) => entry.kind === 'market' && entry.eventId && entry.after.lap === review.lap)
  assert.equal(review.shocks.length, announced.length)
  for (const item of review.assets) {
    const instruments = item.asset === 'stocks' ? game.market.stocks : [item.asset === 'gold' ? game.market.gold : game.market.bond]
    const expected = instruments.map((instrument: { priceHistory: { lap: number; kind: string; priceBefore: number; priceAfter: number }[] }) => {
      const points = instrument.priceHistory.filter(point => point.lap === review.lap && point.kind !== 'history')
      return points.at(-1)!.priceAfter / points[0].priceBefore - 1
    })
    assert.ok(Math.abs(item.returnRate! - expected.reduce((sum: number, value: number) => sum + value, 0) / expected.length) < 1e-12)
  }
  assert.equal(marketBulletin(game, review.lap).forecastId, review.forecastId)
}
assert.equal(JSON.stringify(game), before)
const evidence = JSON.parse(readFileSync(join(folder, 'browser-verification.json'), 'utf8'))
for (const review of reviews) {
  const observed = evidence.summaries.find((summary: { lap: number }) => summary.lap === review.lap)
  assert.ok(observed, `Missing browser round ${review.lap}`)
  assert.ok(observed.text.includes(review.headline))
  for (const item of review.assets) assert.ok(observed.text.includes(percent(item.returnRate!)), `Browser price return mismatch: ${review.lap}/${item.asset}`)
}
const result = { seed: game.seed, laps: game.summaries.length, diceRolls: log.playtest.diceRolls,
  entries: log.entries.length, lawfulProceeds: liquidatableFunds(game), victory: victory(game),
  fullStateReplay: true, selectorsReadOnly: true, browserRoundComparisonsMatch: true, reviews }
writeFileSync(join(folder, 'browser-game-log.json.gz'), gzipSync(raw))
writeFileSync(join(folder, 'replay-verification.json'), JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ ...result, reviews: reviews.map(review => ({ lap: review.lap, forecastId: review.forecastId, shocks: review.shocks.length })) }, null, 2))
