import assert from 'node:assert/strict'
import { readdirSync, readFileSync, writeFileSync, createWriteStream } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const files = [
  ...readdirSync('mobile_app/src/game').filter(name => /^endgame.*\.test\.ts$/.test(name)).map(name => 'mobile_app/src/game/' + name),
  ...readdirSync('mobile_app/src/game/what-if-ai').filter(name => name.endsWith('.test.ts')).map(name => 'mobile_app/src/game/what-if-ai/' + name),
  'src/ai/what-if/transport.test.ts',
  'scripts/diagnostics/what-if-bank-historical.test.ts',
]
const [run, mode = 'plain'] = process.argv.slice(2)
assert(/^[a-z0-9-]+$/.test(run) && ['plain', 'trace'].includes(mode))
const log = resolve(import.meta.dirname, run + '.tap')
const output = createWriteStream(log, { flags: 'wx' })
const tracing = mode === 'trace' ? ['--import', new URL('./register-gold-trace.mjs', import.meta.url).href] : []
const child = spawn(process.execPath, ['--experimental-strip-types', ...tracing, '--test', '--test-concurrency=2', ...files],
  { stdio: ['ignore', 'pipe', 'pipe'] })
child.stdout.pipe(output, { end: false })
child.stderr.pipe(output, { end: false })
const code = await new Promise(resolve => child.once('close', resolve))
await new Promise(resolve => output.end(resolve))
const tap = readFileSync(log, 'utf8')
const prior = readFileSync(resolve(import.meta.dirname, '../eg3-ai-09-01/regression-full.tap'), 'utf8')
const names = text => [...text.matchAll(/^(?:ok|not ok) \d+ - (.+)$/gm)].map(match => match[1].trimEnd()).sort()
assert.equal(names(prior).length, 305)
const baseline = names(prior), current = names(tap)
const missing = baseline.filter((name, index) => name !== current[index])
const failed = [...tap.matchAll(/^not ok \d+ - (.+)$/gm)].map(match => match[1].trimEnd())
const summary = { code, mode, concurrency: 2, files, previous: 305, ran: current.length,
  passed: current.length - failed.length, failed, exactBaselineNames: missing.length === 0 && current.length === 305 }
writeFileSync(resolve(import.meta.dirname, run + '-summary.json'), JSON.stringify(summary, null, 2), { flag: 'wx' })
console.log(JSON.stringify(summary))
if (code !== 0 || !summary.exactBaselineNames) process.exitCode = 1
