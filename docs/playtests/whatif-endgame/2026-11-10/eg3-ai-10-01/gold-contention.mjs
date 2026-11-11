import assert from 'node:assert/strict'
import { availableParallelism } from 'node:os'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [run, rawPeers] = process.argv.slice(2), peers = Number(rawPeers)
assert(/^[a-z0-9-]+$/.test(run) && Number.isInteger(peers) && peers >= 1 && peers <= 6)
assert.equal(availableParallelism(), 1, 'Pin the launching PowerShell process to one logical CPU')
const tests = await Promise.all(Array.from({ length: peers }, (_, index) => new Promise((done, reject) => {
  const child = spawn(process.execPath, [
    '--experimental-strip-types', '--import', new URL('./register-gold-trace.mjs', import.meta.url).href,
    '--test', '--test-concurrency=2', '--test-name-pattern=public pending rejects invalid inputs',
    'mobile_app/src/game/endgame-whatif-gold-c1.test.ts',
  ], { stdio: ['ignore', 'pipe', 'pipe'] })
  let tap = ''
  child.stdout.on('data', chunk => { tap += chunk })
  child.stderr.on('data', chunk => { tap += chunk })
  child.on('error', reject)
  child.on('close', code => {
    writeFileSync(resolve(import.meta.dirname, `${run}-${index + 1}.tap`), tap, { flag: 'wx' })
    const stages = [...tap.matchAll(/^# EG3-GOLD-STAGES (.+)$/gm)].map(match => JSON.parse(match[1]))
    const result = tap.match(/^# EG3-GOLD-RESULT (.+)$/m)
    done({ code, result: result ? JSON.parse(result[1]) : null, stages })
  })
})))
writeFileSync(resolve(import.meta.dirname, run + '-summary.json'), JSON.stringify({ logicalCpu: 1, peers, tests }, null, 2), { flag: 'wx' })
console.log(tests.map(({ code, result }) => ({ code, ...result })))
if (tests.some(test => test.code !== 0)) process.exitCode = 1
