import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve, dirname, delimiter } from 'node:path'

const output = resolve('docs/qa/release-readiness-patch1')
mkdirSync(output, { recursive: true })
const commands = [
  ['product', ['--experimental-strip-types', '--test', ...readdirSync('tests').filter(x => x.endsWith('.test.ts')).map(x => 'tests/' + x)]],
  ['diagnostics', ['--experimental-strip-types', '--test', ...readdirSync('scripts/diagnostics').filter(x => x.endsWith('.test.ts')).map(x => 'scripts/diagnostics/' + x)]],
  ['root-types', ['node_modules/typescript/bin/tsc', '-b', '--force']],
  ['mobile-types', ['node_modules/typescript/bin/tsc', '-p', 'mobile_app/tsconfig.json', '--noEmit']],
  ['lint', ['node_modules/eslint/bin/eslint.js', '.']],
  ['root-build', ['node_modules/vite/bin/vite.js', 'build']],
  ['mobile-build', ['node_modules/vite/bin/vite.js', 'build', 'mobile_app', '--config', 'mobile_app/vite.config.ts']],
  ['semantic-evaluation', ['--experimental-strip-types', 'scripts/diagnostics/semantic-evaluation.mjs']],
  ['historical-replays', ['--experimental-strip-types', 'scripts/diagnostics/readiness-patch1-replays.ts']],
]
const results = []
for (const [name, args] of commands) {
  const start = Date.now()
  const result = await new Promise(resolveResult => {
    const child = spawn(process.execPath, args, { env: { ...process.env, PATH: dirname(process.execPath) + delimiter + process.env.PATH, SEMANTIC_QA_DIR: resolve('node_modules/.tmp/release-readiness-patch1') }, windowsHide: true })
    let log = ''
    child.stdout.on('data', x => { log += x })
    child.stderr.on('data', x => { log += x })
    child.on('error', error => { log += error.stack })
    child.on('close', code => resolveResult({ code, log }))
  })
  writeFileSync(resolve(output, name + '.txt'), result.log)
  const row = { name, exitCode: result.code, milliseconds: Date.now() - start, command: [process.execPath, ...args], summary: result.log.split('\n').filter(x => /^# (tests|pass|fail|skipped|cancelled)/.test(x)) }
  results.push(row)
  writeFileSync(resolve(output, 'commands.json'), JSON.stringify(results, null, 2) + '\n')
  console.log(name, result.code, row.summary.join('; '))
}
if (results.some(x => x.exitCode !== 0)) process.exitCode = 1
