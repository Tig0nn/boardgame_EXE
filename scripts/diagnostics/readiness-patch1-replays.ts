import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { replayGameLog } from './replay-game-log.ts'
import { verifyReplayInput } from './replay-input-integrity.ts'
import type { ReplayHashExpectation } from './replay-input-integrity.ts'

// Reuse the exact prior natural replay inventory without overwriting its evidence.
const prior = JSON.parse(readFileSync('tests/fixtures/ai-companion/release-historical-replays.json', 'utf8')) as { results: ReplayHashExpectation[] }
const results = prior.results.map(item => {
  const bytes = readFileSync(item.file)
  const integrity = verifyReplayInput(bytes, item)
  try {
    replayGameLog(JSON.parse((item.file.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString()))
    return { ...item, integrity, pass: true }
  } catch (error) { return { ...item, pass: false, error: String(error) } }
})
const report = { total: results.length, pass: results.filter(x => x.pass).length, fail: results.filter(x => !x.pass).length, results }
mkdirSync('docs/qa/release-hardening-patch2', { recursive: true })
writeFileSync('docs/qa/release-hardening-patch2/replays.json', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ total: report.total, pass: report.pass, fail: report.fail }))
if (!report.total || report.fail) process.exitCode = 1
