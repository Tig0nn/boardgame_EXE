import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { replayGameLog } from './diagnostics/replay-game-log.ts'
import type { ReplayLog } from './diagnostics/replay-game-log.ts'
import { buildBondStartSummary, buildStartOverview } from '../mobile_app/src/game/start-summary.ts'
import { money, signedMoney } from '../src/game/format.ts'
import { roundMarketReview, creditRoundReview } from '../mobile_app/src/game/market-news.ts'
import { buildCoachFacts } from '../src/ai/facts.ts'
import { validateCoachFacts } from '../src/ai/schema.ts'

const out = 'docs/playtests/bond-start-ux'
const cases = { normal: ['normal-a', 1], delayed: ['delayed', 2], cure: ['delayed', 3],
  default: ['default-recovery', 2], recovery: ['default-recovery', 3], defeat: ['default-b', 4] } as const
const layouts = JSON.parse(readFileSync(`${out}/browser-verification.json`, 'utf8'))
const verified = []
for (const label of new Set(Object.values(cases).map(item => item[0]))) {
  const file = `docs/playtests/bond-credit-v25/browser-${label}.json.gz`
  const bytes = readFileSync(file), data = JSON.parse(gunzipSync(bytes).toString()) as ReplayLog
  const game = replayGameLog(data), before = JSON.stringify(game)
  const facts = buildCoachFacts(game)
  assert.ok(validateCoachFacts(facts).valid)
  for (const summary of game.summaries) {
    const lap = summary.lap, end = game.log.find(entry => entry.decisionId === 'settle-lap' && entry.after.lap === lap)!.after
    const issuers = buildBondStartSummary(game, lap), overview = buildStartOverview(game, lap)
    assert.ok(overview, `${label}/${lap}: cash records unavailable`)
    assert.equal(overview.received - overview.paid, overview.cashAfter - overview.cashBefore)
    const payments = end.bondLots.flatMap(lot => lot.credit?.history.filter(payment => payment.lap === lap) ?? [])
    assert.equal(overview.bondReceived, payments.reduce((total, payment) => total + payment.couponPaid + payment.principalPaid, 0))
    for (const issuer of issuers) {
      for (const key of ['couponDue', 'couponPaid', 'principalDue', 'principalPaid', 'outstandingCoupon', 'outstandingPrincipal', 'principalLost', 'couponLost', 'newLoss'] as const)
        assert.equal(issuer[key], issuer.lots.reduce((total, lot) => total + lot[key], 0))
      for (const lot of issuer.lots) assert.ok(lot.history.every(payment => payment.lap === lap))
    }
    const newsBefore = JSON.stringify([roundMarketReview(game, lap), creditRoundReview(game, lap)])
    buildBondStartSummary(game, lap); buildStartOverview(game, lap)
    assert.equal(JSON.stringify([roundMarketReview(game, lap), creditRoundReview(game, lap)]), newsBefore)
    for (const [name, checkpoint] of Object.entries(cases)) if (checkpoint[0] === label && checkpoint[1] === lap) {
      for (const width of [320, 390, 430]) {
        const layout = layouts.find((item: { file: string }) => item.file === `${width}-${name}.jpg`)
        assert.ok(layout, `Missing ${width}/${name}`)
        assert.ok(layout.text.includes(signedMoney(overview.received)), `${name}: actual receipt mismatch`)
        assert.ok(layout.text.includes(money(overview.cashAfter)), `${name}: closing cash mismatch`)
        assert.equal(layout.visibleIds, false)
        for (const issuer of issuers) {
          assert.ok(layout.text.includes(issuer.name))
          if (issuer.couponPaid > 0) assert.ok(layout.text.includes(money(issuer.couponPaid)))
          if (issuer.principalPaid > 0) assert.ok(layout.text.includes(money(issuer.principalPaid)))
          const waiting = issuer.outstandingCoupon + issuer.outstandingPrincipal
          const lost = issuer.couponLost + issuer.principalLost
          if (waiting > 0) assert.ok(layout.text.includes(money(waiting)))
          if (lost > 0) assert.ok(layout.text.includes(money(lost)))
        }
      }
    }
  }
  assert.equal(JSON.stringify(game), before)
  verified.push({ file, sha256: createHash('sha256').update(bytes).digest('hex'), fullStateReplay: true,
    lapsReconciled: game.summaries.length, presentationReadOnly: true, newsUnchanged: true, coachFactsValid: true })
}
for (const layout of layouts) {
  assert.ok(layout.documentWidth <= layout.viewport.width)
  assert.ok(layout.dialogScrollWidth <= layout.dialogWidth + 1)
  assert.ok(layout.scrollWidth <= layout.scrollClientWidth + 1)
  assert.equal(layout.clippedAmounts.length, 0)
  assert.ok(layout.cta.top >= 0 && layout.cta.bottom <= layout.viewport.height)
}
const interactions = JSON.parse(readFileSync(`${out}/browser-interactions.json`, 'utf8'))
assert.equal(interactions.length, 4)
assert.ok(interactions.every((item: { doubleTapStayedInWallet: boolean }) => item.doubleTapStayedInWallet))
for (const item of interactions.slice(0, 3)) { assert.equal(item.keyboardDisclosure, true); assert.equal(item.nextRound, 3) }
assert.ok(interactions[3].resultText.includes('72.250.000'))
const originals = JSON.parse(readFileSync(`${out}/before-screenshots.json`, 'utf8'))
for (const original of originals) {
  const copied = readFileSync(`${out}/${original.file}`)
  assert.equal(createHash('sha256').update(copied).digest('hex'), original.sha256)
  assert.deepEqual(copied, readFileSync(original.source))
}
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
  const dimensions = jpegDimensions(readFileSync(`${out}/${file}`)), width = Number(file.split('-')[0])
  assert.equal(dimensions.width, width, file)
  assert.equal(dimensions.height, width === 320 ? 640 : width === 390 ? 844 : 932, file)
  return { file, ...dimensions }
})
writeFileSync(`${out}/verification.json`, JSON.stringify({ archivedGames: verified, startLaps: 16, layouts: layouts.length,
  screenshots, beforeCopies: originals.length, interactions: interactions.length,
  limitations: 'Development-only archived checkpoints, not new full browser games. No balance study regenerated or live AI provider tested.' }, null, 2) + '\n')
console.log(`PASS: ${verified.length} archived games replayed, 16 START summaries reconciled, ${layouts.length} layouts, ${screenshots.length} JPEG dimensions; before copies exact; UI matches engine cash/claims/losses; AI/news read-only.`)
