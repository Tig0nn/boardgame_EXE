import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { replayGameLog } from './replay-game-log.ts'

const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')
const frozen = JSON.parse(readFileSync('docs/playtests/b18-language-cleanup/after-replay-verification.json', 'utf8'))
for (const item of frozen.results) {
  const b = readFileSync(item.path); assert.equal(hash(b), item.sha256)
  replayGameLog(JSON.parse((item.path.endsWith('.gz') ? gunzipSync(b) : b).toString()))
}
assert.equal(frozen.results.length, 81)
const manifests = []
for (const name of ['b18-financial-decision-copy', 'b18-course-layout', 'b18-mobile-ux-writing', 'b18-release-qa', 'b18-language-cleanup', 'b18-terminology', 'b18-beginner-ux', 'core-mvp-b18-multi-course', 'b18-mobile-only-readiness']) {
  const path = `docs/playtests/${name}/manifest.json`, m = JSON.parse(readFileSync(path, 'utf8'))
  for (const a of m.artifacts) { const b = readFileSync(a.path); assert.equal(hash(b), a.sha256, a.path); assert.equal(b.length, a.bytes) }
  manifests.push({ path, sha256: hash(readFileSync(path)), artifacts: m.artifacts.length })
}
const results = { historicalReplays: 81, protectedArtifacts: manifests.reduce((n, m) => n + m.artifacts, 0), manifests, passed: true }
writeFileSync('docs/playtests/b18-compact-financial-ui/compatibility.json', JSON.stringify(results, null, 2) + '\n')
console.log(JSON.stringify(results))
