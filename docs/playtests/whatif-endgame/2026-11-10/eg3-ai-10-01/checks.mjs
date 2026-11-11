import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const source = [ 'scripts/diagnostics/what-if-reliability-fixtures.ts', 'mobile_app/src/game/what-if-ai/reliability.test.ts', 'mobile_app/src/game/what-if-ai/natural-language.ts', 'mobile_app/src/game/what-if-ai/natural-language.test.ts', 'mobile_app/src/game/what-if-ai/grounded-explanation.ts', 'mobile_app/src/game/what-if-ai/grounded-explanation.test.ts', 'src/ai/what-if/server.ts', 'src/ai/what-if/mock-server-provider.ts', 'mobile_app/src/game/what-if-ai/http-provider.ts',
  'mobile_app/src/game/endgame-whatif-paired.ts', 'mobile_app/src/game/endgame-whatif-gold-resume.ts',
  'mobile_app/src/game/endgame-whatif-gold-identity.ts', 'mobile_app/src/game/endgame-whatif-gold-c1.test.ts',
  'mobile_app/src/game/what-if-ai/in-game-controller.test.ts', 'mobile_app/src/dev/EndgameWhatIfDev.tsx',
  'mobile_app/src/game/what-if-ai/flexible-catalog.ts', 'mobile_app/src/game/what-if-ai/flexible.test.ts',
  'mobile_app/src/game/what-if-ai/decision-adapters.ts', 'mobile_app/src/game/what-if-ai/decision-replay.ts',
  'mobile_app/src/game/what-if-ai/decision-client.ts', 'mobile_app/src/game/what-if-ai/decision.worker.ts',
  'mobile_app/src/game/what-if-ai/native-worker.test.ts', 'mobile_app/src/game/what-if-ai/in-game-controller.ts',
  'mobile_app/src/game/what-if-ai/orchestrator.ts', 'mobile_app/src/game/what-if-ai/mock-gemini.ts',
  'mobile_app/src/components/endgame-what-if/FlexibleChoices.tsx', 'mobile_app/src/components/endgame-what-if/InGameAiEntry.tsx',
  'src/ai/what-if/contracts.ts', 'src/ai/what-if/gemini.ts', 'src/ai/what-if/model-provider.ts', 'src/ai/what-if/transport.test.ts',
  'scripts/diagnostics/what-if-flexible-fixtures.ts',
]
const checks = []
for (const [name, args] of [
  ['mobile-typescript', ['node_modules/typescript/bin/tsc', '-p', 'mobile_app/tsconfig.json', '--noEmit']],
  ['root-typescript', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.app.json', '--noEmit']],
  ['scoped-eslint', ['node_modules/eslint/bin/eslint.js', ...source]],
]) {
  const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', value => { output += value }); child.stderr.on('data', value => { output += value })
  const code = await new Promise(resolve => child.once('close', resolve))
  checks.push({ name, code, output }); console.log(name, code === 0 ? 'PASS' : output)
}
writeFileSync(resolve(import.meta.dirname, (process.argv[2] ?? 'checks') + '.json'), JSON.stringify({ source, checks }, null, 2), { flag: 'wx' })
assert(checks.every(check => check.code === 0))
