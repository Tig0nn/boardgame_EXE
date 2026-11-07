import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { replayGameLog } from './diagnostics/replay-game-log.ts'
import { BOND_STRATEGIES, playBondGame } from './diagnostics/bond-credit-model.ts'
import { liquidatableFunds, victory } from '../src/game/selectors.ts'
import { buildCoachFacts } from '../src/ai/facts.ts'
import { validateCoachFacts } from '../src/ai/schema.ts'

const out = 'docs/playtests/bond-credit-v25'
const results = JSON.parse(readFileSync(`${out}/balance-results.json`, 'utf8'))
const runs = JSON.parse(gunzipSync(readFileSync(`${out}/balance-runs.json.gz`)).toString())
assert.equal(results.games, results.seedsPerStrategy * 6)
for (const strategy of BOND_STRATEGIES) {
  const rows = runs[strategy]
  assert.equal(rows.length, results.seedsPerStrategy)
  assert.equal(new Set(rows.map((r: { seed: string }) => r.seed)).size, rows.length)
  const rate = rows.filter((r: { won: boolean }) => r.won).length / rows.length
  const mean = rows.reduce((n: number, r: { funds: number }) => n + r.funds, 0) / rows.length
  assert.equal(rate, results.aggregates[strategy].winRate)
  assert.equal(mean, results.aggregates[strategy].funds.mean)
  for (const metric of ['funds', 'creditLoss', 'couponReceived', 'recoveries', 'illiquidPrincipal', 'unpaidCoupon']) {
    const values = rows.map((r: Record<string, number>) => r[metric]).sort((a: number, b: number) => a - b)
    const saved = results.aggregates[strategy][metric]
    assert.equal(saved.mean, values.reduce((n: number, v: number) => n + v, 0) / values.length)
    assert.equal(saved.median, values[Math.floor(values.length / 2)])
    assert.equal(saved.p95, values[Math.floor(values.length * .95)])
    assert.equal(saved.p99, values[Math.floor(values.length * .99)])
    assert.equal(saved.max, values.at(-1))
  }
  const sample = playBondGame('BOND-V25-0', strategy)
  assert.equal(liquidatableFunds(sample), rows[0].funds)
  assert.equal(victory(sample).won, rows[0].won)
}
const files = readdirSync(out).filter(name => /^(simulation-|browser-).*\.json\.gz$/.test(name))
const verified = files.map(file => {
  const raw = gunzipSync(readFileSync(`${out}/${file}`)), data = JSON.parse(raw.toString())
  const state = replayGameLog(data)
  assert.equal(state.bondRulesVersion, 'v2.5-credit-risk')
  assert.equal(state.summaries.length, 4, file)
  const facts = buildCoachFacts(state)
  assert.equal(validateCoachFacts(facts, new TextEncoder().encode(JSON.stringify(facts)).length).valid, true)
  return { file, seed: state.seed, sha256: createHash('sha256').update(raw).digest('hex'),
    fullStateReplay: true, coachFactsValid: true, rolls: state.log.filter(e => e.kind === 'roll').length,
    entries: state.log.length, lawfulProceeds: liquidatableFunds(state), won: victory(state).won,
    couponDelays: state.bondLots.flatMap(lot => lot.credit!.history).filter(h => h.status === 'delayed' && h.couponDue > h.couponPaid).length,
    principalDelays: state.bondLots.flatMap(lot => lot.credit!.history).filter(h => h.status === 'delayed' && h.principalDue > h.principalPaid).length,
    losses: state.bondLots.reduce((n, lot) => n + lot.credit!.principalLost + lot.credit!.couponLost, 0),
    recovered: state.bondLots.filter(lot => lot.credit!.principalLost > 0).reduce((n, lot) => n + lot.credit!.principalPaid, 0) }
})
const historicalFiles = [...new Set([
  ...readdirSync('docs/playtests', { recursive: true }).map(file => String(file).replaceAll('\\', '/'))
    .filter(file => !file.startsWith('bond-credit-v25/') && /game-log\.json\.gz$/.test(file)),
  'atomic-investments-v24/historical-multi-purchase.json.gz',
])].sort()
const historical = historicalFiles.map(file => {
  const raw = gunzipSync(readFileSync(`docs/playtests/${file}`)), state = replayGameLog(JSON.parse(raw.toString()))
  assert.equal(state.bondRulesVersion, undefined)
  return { file, sha256: createHash('sha256').update(raw).digest('hex'), fullStateReplay: true }
})
const browserEvidence = JSON.parse(readFileSync(`${out}/browser-verification.json`, 'utf8'))
for (const game of browserEvidence.games) {
  const found = verified.find(row => row.file === `browser-${game.label}.json.gz`)
  assert.ok(found, game.label)
  assert.equal(found.seed, game.seed)
  assert.equal(found.rolls, game.rolls)
}
const fixtureEvidence = JSON.parse(readFileSync(`${out}/fixture-verification.json`, 'utf8'))
for (const layout of [...browserEvidence.layouts, ...fixtureEvidence.layouts]) {
  assert.ok(layout.documentWidth <= layout.width, `Document overflow: ${layout.name}/${layout.width}`)
  for (const dialog of layout.dialogs) assert.ok(dialog.scrollWidth <= dialog.clientWidth + 1, `Dialog overflow: ${layout.name}/${layout.width}`)
}
function jpegDimensions(bytes: Buffer) {
  let offset = 2
  while (offset < bytes.length) {
    assert.equal(bytes[offset], 0xff)
    const marker = bytes[offset + 1], size = bytes.readUInt16BE(offset + 2)
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) }
    offset += size + 2
  }
  throw new Error('Invalid JPEG')
}
const screenshots = readdirSync(out).filter(file => /^\d+-.*\.jpg$/.test(file)).map(file => {
  const dimensions = jpegDimensions(readFileSync(`${out}/${file}`))
  const expectedWidth = Number(file.split('-')[0])
  assert.equal(dimensions.width, expectedWidth, file)
  assert.equal(dimensions.height, expectedWidth === 320 ? 640 : expectedWidth === 390 ? 844 : 932, file)
  return { file, ...dimensions }
})
writeFileSync(`${out}/screenshot-dimensions.json`, JSON.stringify(screenshots, null, 2) + '\n')
writeFileSync(`${out}/replay-verification.json`, JSON.stringify({ balanceRowsVerified: results.games, simulations: verified.filter(r => r.file.startsWith('simulation-')),
  browser: verified.filter(r => r.file.startsWith('browser-')), historical, screenshots: screenshots.length,
  layoutsNoOverflow: true, limitations: 'Browser coverage only includes actual exported browser files listed above; Node simulation examples are separate. Funding fixture is not a replayable full game.' }, null, 2) + '\n')
console.table(verified)
console.log(`PASS: ${results.games} balance rows, ${files.length} V2.5 full-state replays, ${historical.length} historical replays`)
