import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { replayGameLog } from './replay-game-log.ts'

// Reuse the exact prior natural replay inventory without overwriting its evidence.
const prior = JSON.parse(readFileSync('tests/fixtures/ai-companion/release-historical-replays.json', 'utf8')) as { results: { file: string; sha256: string }[] }
const results = prior.results.map(item => {
  const bytes = readFileSync(item.file)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.file)
  try {
    replayGameLog(JSON.parse((item.file.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString()))
    return { ...item, pass: true }
  } catch (error) { return { ...item, pass: false, error: String(error) } }
})
const report = { total: results.length, pass: results.filter(x => x.pass).length, fail: results.filter(x => !x.pass).length, results }
writeFileSync('docs/qa/release-readiness-patch1/replays.json', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ total: report.total, pass: report.pass, fail: report.fail }))
if (!report.total || report.fail) process.exitCode = 1
