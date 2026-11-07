import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { replayGameLog } from './replay-game-log.ts'

const out = 'docs/playtests/b18-mobile-ux-writing'
const baseline = JSON.parse(readFileSync('docs/playtests/b18-language-cleanup/after-replay-verification.json', 'utf8'))
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const results = []
for (const item of baseline.results) {
  const bytes = readFileSync(item.path)
  assert.equal(hash(bytes), item.sha256)
  replayGameLog(JSON.parse((item.path.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8')))
  results.push({ path: item.path, sha256: item.sha256, matched: true })
}
assert.equal(results.length, 81)
const manifests = []
for (const name of ['b18-release-qa', 'b18-language-cleanup', 'b18-terminology', 'b18-beginner-ux', 'core-mvp-b18-multi-course', 'b18-mobile-only-readiness']) {
  const path = `docs/playtests/${name}/manifest.json`, m = JSON.parse(readFileSync(path, 'utf8'))
  for (const item of m.artifacts) {
    const bytes = readFileSync(item.path)
    assert.equal(hash(bytes), item.sha256, item.path)
    assert.equal(bytes.length, item.bytes, item.path)
  }
  manifests.push({ path, artifacts: m.artifacts.length, allRawHashesMatch: true })
}
writeFileSync(`${out}/compatibility.json`, JSON.stringify({ historicalReplays: results.length, results,
  manifests, verifiedHistoricalArtifacts: manifests.reduce((n, m) => n + m.artifacts, 0),
  note: 'Original source manifests describe their locked candidates; new presentation source is intentionally different. Only raw archived artifacts are verified here, never rewritten.' }, null, 2) + '\n')
console.log(JSON.stringify({ historicalReplays: results.length, manifests, passed: true }))
