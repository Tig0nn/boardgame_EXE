import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const branch = execFileSync('git', ['--no-optional-locks', 'branch', '--show-current'], { encoding: 'utf8' }).trim()
const head = execFileSync('git', ['--no-optional-locks', 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
assert.equal(branch, 'feat/b18-whatif-deep-analysis-v2')
assert.equal(head, '759a6fe1879816a716e21e38cc91eecd3fe5f50a')
assert.equal(execFileSync('git', ['--no-optional-locks', 'diff', '--cached', '--name-only'], { encoding: 'utf8' }).trim(), '')
const files = [
  'mobile_app/src/game/endgame-whatif-paired.ts',
  'mobile_app/src/game/endgame-whatif-gold-identity.ts',
  'mobile_app/src/game/endgame-whatif-gold-resume.ts',
  'mobile_app/src/game/endgame-whatif-gold-c1.test.ts',
  'mobile_app/src/game/endgame-whatif-contract.ts',
]
const sources = files.map(path => ({ path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }))
const budgetSource = readFileSync(files.at(-1), 'utf8')
assert(budgetSource.includes('options.maxSteps ?? 5_000, milliseconds = options.maxMilliseconds ?? 20_000'))
const regressions = ['final-regression-a', 'final-regression-b'].map(name => {
  const summary = JSON.parse(readFileSync(resolve(import.meta.dirname, name + '-summary.json'), 'utf8'))
  assert(summary.code === 0 && summary.passed === 305 && summary.exactBaselineNames)
  return { name, passed: summary.passed, concurrency: summary.concurrency, exactBaselineNames: true }
})
const browser = ['baseline-final', 'reliability-final'].map(name => {
  const result = JSON.parse(readFileSync(resolve(import.meta.dirname, name + '-results.json'), 'utf8'))
  assert(result.cases.every(test => test.status === 'PASS') && !result.errors.length && !result.forbidden.length)
  return { name, passed: result.cases.length }
})
assert.equal(browser.reduce((count, run) => count + run.passed, 0), 59)
writeFileSync(resolve(import.meta.dirname, 'freeze-manifest.json'),
  JSON.stringify({ branch, head, staging: 'empty', sources, regressions, browser, live: 'LIVE_NOT_RUN' }, null, 2), { flag: 'wx' })
console.log('DEV_MOCK_STABLE', JSON.stringify({ regressions, browser }))
