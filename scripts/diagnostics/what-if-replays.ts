import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { replayGameLog } from './replay-game-log.ts'
import { createRepairDemo } from '../../mobile_app/src/dev/repair-fixture.ts'
import { simulateRepairWhatIf } from '../../src/game/what-if.ts'
import { decide } from '../../src/game/engine.ts'
import { serializeLog } from '../../src/game/log.ts'

const baseline = JSON.parse(readFileSync('docs/playtests/b18-language-cleanup/after-replay-verification.json', 'utf8'))
const results = []
for (const item of baseline.results) {
  const bytes = readFileSync(item.path), sha256 = createHash('sha256').update(bytes).digest('hex')
  let windowsCheckoutOnly = false
  if (sha256 !== item.sha256) {
    // Git autocrlf can change JSON working-tree bytes on Windows. Require BOTH
    // the pinned Git blob hash AND byte equality after CRLF-only normalization.
    assert(!item.path.endsWith('.gz'), 'Binary evidence must match byte-for-byte')
    const blob = execFileSync('git', ['show', `759a6fe1879816a716e21e38cc91eecd3fe5f50a:${item.path}`], { maxBuffer: 30_000_000 })
    assert.equal(createHash('sha256').update(blob).digest('hex'), item.sha256)
    assert(Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n')).equals(blob), item.path)
    windowsCheckoutOnly = true
  }
  replayGameLog(JSON.parse((item.path.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8')))
  results.push({ path: item.path, sha256, baselineSha256: item.sha256, windowsCheckoutOnly, matched: true })
}
assert.equal(results.length, 81)
const fixtures = []
for (const savings of [0, 48_000_000, 49_500_000]) for (const choice of ['full', 'temporary'] as const) {
  const before = createRepairDemo(savings)
  simulateRepairWhatIf(before, choice)
  const after = decide(before, choice)
  replayGameLog(JSON.parse(serializeLog(after)))
  fixtures.push({ savings, choice, phase: after.phase, matched: true })
}
const out = process.env.WHATIF_QA_OUT || 'docs/playtests/whatif-demo/2026-10-31'
mkdirSync(out, { recursive: true })
writeFileSync(`${out}/replays.json`, JSON.stringify({ passed: results.length, failures: 0, fixtures, results }, null, 2) + '\n')
console.log(JSON.stringify({ historicalReplays: results.length, fixtureReplays: fixtures.length, failures: 0 }))
