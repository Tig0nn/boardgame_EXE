import { writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { LIVING_STRATEGIES, livingGameMetrics, playLivingGame } from './periodic-living-model.ts'
import type { LivingExpenseRulesVersion } from '../../src/game/types.ts'

const [output, countText, policy] = process.argv.slice(2)
const count = Number(countText)
if (!output || !Number.isSafeInteger(count) || count < 1 || !['v2.4-on-landing', 'v2.6-periodic-start'].includes(policy)) throw new Error('Invalid worker arguments')
const rows = []
for (const strategy of LIVING_STRATEGIES) for (let i = 0; i < count; i++) {
  rows.push(livingGameMetrics(playLivingGame(`PERIODIC-V26-${i}`, strategy, policy as LivingExpenseRulesVersion), strategy))
}
writeFileSync(output, gzipSync(JSON.stringify(rows)))
console.log(JSON.stringify({ games: rows.length, output }))
