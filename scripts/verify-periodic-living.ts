import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { replayGameLog } from './diagnostics/replay-game-log.ts'
import { LIVING_STRATEGIES, livingGameMetrics, playLivingGame } from './diagnostics/periodic-living-model.ts'
import type { livingGameMetrics as Metrics } from './diagnostics/periodic-living-model.ts'
import { buildStartOverview } from '../mobile_app/src/game/start-summary.ts'
import { liquidatableFunds } from '../src/game/selectors.ts'
import { boardFor } from '../src/data/board.ts'
import type { ReplayLog } from './diagnostics/replay-game-log.ts'

const out = 'docs/playtests/periodic-living-v26'
const load = (file: string) => JSON.parse(file.endsWith('.gz') ? gunzipSync(readFileSync(`${out}/${file}`)).toString() : readFileSync(`${out}/${file}`, 'utf8'))
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')
const research = load('balance-results.json')
assert.equal(research.games, 18000)
assert.equal(research.seedsPerStrategy, 500)
for (const [path, expected] of Object.entries(research.normalizedSourceHashes)) {
  assert.equal(createHash('sha256').update(readFileSync(path, 'utf8').replace(/\r\n/g, '\n')).digest('hex'), expected, `Normalized source ${path}`)
}
for (const config of research.configs) {
  const rows = load(`balance-${config.id}.json.gz`) as ReturnType<typeof Metrics>[]
  assert.equal(rows.length, 3000)
  assert.equal(rows.filter(r => r.won).length / rows.length, config.aggregate.winRate)
  for (const strategy of LIVING_STRATEGIES) {
    const sample = rows.filter(r => r.strategy === strategy), saved = config.strategies[strategy]
    assert.equal(sample.length, 500); assert.equal(new Set(sample.map(r => r.seed)).size, 500)
    assert.equal(sample.filter(r => r.won).length / sample.length, saved.winRate)
    assert.equal(sample.reduce((n, r) => n + r.funds, 0) / sample.length, saved.funds.mean)
    for (const [key, value] of Object.entries(saved.metrics)) assert.equal(sample.reduce((n, r) => n + (r[key as keyof typeof r] as number), 0) / sample.length, value)
    if (config.id === 'legacy' || config.id === '7m-a') {
      const row = sample[0]
      const game = playLivingGame(row.seed, strategy, config.policy)
      assert.deepEqual(livingGameMetrics(game, strategy), row, `${config.id}/${strategy} deterministic spot check`)
    }
  }
  if (config.id !== 'legacy') {
    assert.ok(rows.every(r => r.completedStarts === 4))
    assert.ok(rows.every(r => r.livingPaid === config.amount * 4))
    assert.ok(rows.every(r => r.livingFunding === 0))
  }
}
const games = []
for (const name of ['win', 'defeat']) {
  const file = `browser-${name}-full.json.gz`, data = load(file) as ReplayLog
  const game = replayGameLog(data), trace = load(`browser-${name}.json`)
  assert.deepEqual(JSON.parse(JSON.stringify(game)), data.state)
  assert.equal(game.termination, 'completed'); assert.equal(game.summaries.length, 4)
  assert.equal(game.livingExpenseRulesVersion, 'v2.6-periodic-start'); assert.equal(game.boardRevision, 'c20-v2.6-a')
  assert.equal(boardFor(game)[3].type, 'stocks'); assert.equal(boardFor(game)[14].type, 'gold')
  const living = game.log.filter(e => e.kind === 'schedule' && e.title === 'Chi phí sinh hoạt')
  assert.equal(living.length, 4); assert.equal(living.reduce((n, e) => n + e.expensePaid, 0), 28e6)
  assert.equal(game.log.filter(e => e.kind === 'roll').length, trace.rolls)
  assert.equal(trace.console.length, 0)
  assert.equal(trace.modelEvidence.status, 'ready'); assert.equal(trace.modelEvidence.loaded, 'true')
  const reconciliation = game.summaries.map(summary => {
    const view = buildStartOverview(game, summary.lap)!
    assert.ok(view); assert.equal(view.livingPaid, 7e6)
    assert.equal(view.received - view.paid, view.cashAfter - view.cashBefore)
    return { lap: summary.lap, ...view }
  })
  if (name === 'win') assert.equal(liquidatableFunds(game), 94_759_500)
  else {
    assert.equal(liquidatableFunds(game), 63_272_313)
    assert.equal(game.log.filter(e => e.kind === 'decision' && e.decisionId === 'defer' && ['medical', 'family'].includes(e.eventId ?? '')).length, 3)
    assert.ok(game.bondLots.some(lot => lot.credit?.history.some(payment => payment.status === 'defaulted')))
    assert.ok(game.bondLots.some(lot => lot.credit?.history.some(payment => payment.status === 'resolved' && payment.principalPaid > 0)))
  }
  games.push({ file, sha256: sha(`${out}/${file}`), seed: game.seed, rolls: trace.rolls, exactFullStateReplay: true,
    lawfulProceeds: liquidatableFunds(game), module: trace.module, reconciliation })
}
function jpegSize(bytes: Buffer) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8)
  let p = 2
  while (p < bytes.length) {
    if (bytes[p++] !== 0xff) continue
    const marker = bytes[p++]
    if (marker === 0xd8 || marker === 0xd9) continue
    const length = bytes.readUInt16BE(p)
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return { width: bytes.readUInt16BE(p + 5), height: bytes.readUInt16BE(p + 3) }
    p += length
  }
  throw new Error('JPEG dimensions unavailable')
}
const fixtures = load('browser-fixtures.json')
const layouts = fixtures.layouts.filter((row: { label?: string }) => row.label)
for (const layout of layouts) {
  assert.ok(layout.scrollWidth <= layout.width, `Horizontal overflow: ${layout.label}`)
  for (const dialog of layout.dialogs) {
    assert.ok(dialog.rect.x >= -1 && dialog.rect.x + dialog.rect.width <= layout.width + 1)
    assert.ok(dialog.rect.height <= layout.height)
  }
  for (const button of layout.buttons) assert.ok(button.bottom <= layout.height, `START CTA: ${layout.label}`)
}
for (const console of fixtures.console) assert.equal(console.logs.length, 0)
const screenshots = readdirSync(out).filter(file => file.endsWith('.jpg')).map(file => {
  const size = jpegSize(readFileSync(`${out}/${file}`))
  assert.ok([[320, 640], [390, 844], [430, 932]].some(([w, h]) => size.width === w && size.height === h), file)
  return { file, ...size, sha256: sha(`${out}/${file}`) }
})
writeFileSync(`${out}/verification.json`, JSON.stringify({ games, researchGames: research.games, sourceHashPolicy: 'UTF-8/LF normalized',
  replaySpotChecks: 12, layouts: layouts.length, screenshots, livingFunding: 'Defensive salary=0 fixture only; unreachable naturally with >=14M salary before 7M payment',
  consoleErrors: 0 }, null, 2) + '\n')
console.log(`PASS: ${research.games} raw balance rows; 12 deterministic spot checks; two browser full-state replays / eight reconciled STARTs; ${layouts.length} layouts / ${screenshots.length} JPEGs; no duplicate periodic charge.`)
