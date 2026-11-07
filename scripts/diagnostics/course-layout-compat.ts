import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { replayGameLog } from './replay-game-log.ts'

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const frozen = JSON.parse(readFileSync('docs/playtests/b18-language-cleanup/after-replay-verification.json', 'utf8'))
for (const item of frozen.results) {
  const bytes = readFileSync(item.path)
  assert.equal(hash(bytes), item.sha256)
  replayGameLog(JSON.parse((item.path.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8')))
}
assert.equal(frozen.results.length, 81)
const manifests = []
for (const name of ['b18-mobile-ux-writing', 'b18-release-qa', 'b18-language-cleanup', 'b18-terminology', 'b18-beginner-ux', 'core-mvp-b18-multi-course', 'b18-mobile-only-readiness']) {
  const path = `docs/playtests/${name}/manifest.json`, manifest = JSON.parse(readFileSync(path, 'utf8'))
  for (const item of manifest.artifacts) { const bytes = readFileSync(item.path); assert.equal(hash(bytes), item.sha256, item.path); assert.equal(bytes.length, item.bytes) }
  manifests.push({ path, sha256: hash(readFileSync(path)), artifacts: manifest.artifacts.length })
}
const result = { historicalReplays: 81, manifests, protectedArtifacts: manifests.reduce((n, m) => n + m.artifacts, 0), passed: true }
writeFileSync('docs/playtests/b18-course-layout/compatibility.json', JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result))
