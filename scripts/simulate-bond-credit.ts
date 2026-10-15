import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { BOND_STRATEGIES, playBondGame } from './diagnostics/bond-credit-model.ts'
import { replayGameLog } from './diagnostics/replay-game-log.ts'
import { serializeLog } from '../src/game/log.ts'
import { liquidatableFunds, victory } from '../src/game/selectors.ts'
import { creditBondLots } from '../src/game/bond-credit.ts'
import { BOND_ISSUERS } from '../src/data/bond-issuers.ts'
import type { GameState } from '../src/game/types.ts'

const count = Number(process.argv[2] ?? 2000)
if (!Number.isSafeInteger(count) || count < 100) throw new Error('At least 100 common seeds required')
const out = 'docs/playtests/bond-credit-v25'
mkdirSync(out, { recursive: true })
const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
const distribution = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b), avg = mean(values)
  const se = Math.sqrt(values.reduce((n, v) => n + (v - avg) ** 2, 0) / (values.length - 1) / values.length)
  return { mean: avg, median: sorted[Math.floor(sorted.length / 2)], p05: sorted[Math.floor(sorted.length * .05)],
    p95: sorted[Math.floor(sorted.length * .95)], p99: sorted[Math.floor(sorted.length * .99)], max: sorted.at(-1),
    mean95CI: [avg - 1.96 * se, avg + 1.96 * se] }
}
function metrics(s: GameState) {
  const lots = s.bondLots.filter(lot => lot.credit)
  for (const lot of lots) {
    const c = lot.credit!
    assert.equal(c.originalFace, lot.principal + c.soldPrincipal + c.principalLost + c.principalPaid, 'Face conservation')
    assert.equal(c.history.reduce((n, h) => n + h.couponDue, 0), c.outstandingCoupon + c.couponLost + c.transferredCoupon + c.history.reduce((n, h) => n + h.couponPaid, 0), 'Coupon conservation')
    assert.ok(lot.principal >= 0 && c.outstandingCoupon >= 0 && c.outstandingPrincipal >= 0)
    assert.equal(new Set(c.history.map(h => h.lap)).size, c.history.length, 'At-most-once payment lap')
  }
  const payments = lots.flatMap(lot => lot.credit!.history)
  return { won: victory(s).won, insolvent: s.termination === 'insolvent', funds: liquidatableFunds(s),
    creditLoss: lots.reduce((n, lot) => n + lot.credit!.principalLost + lot.credit!.couponLost, 0),
    couponReceived: payments.reduce((n, h) => n + h.couponPaid, 0),
    delay: payments.some(h => h.status === 'delayed'), default: lots.some(lot => lot.credit!.principalLost > 0),
    recoveries: lots.filter(lot => lot.credit!.principalLost > 0).reduce((n, lot) => n + lot.credit!.principalPaid, 0),
    illiquidPrincipal: creditBondLots(s).filter(item => item.lot.status === 'active' && !item.quote.executable).reduce((n, item) => n + item.lot.principal, 0),
    unpaidCoupon: lots.reduce((n, lot) => n + lot.credit!.outstandingCoupon, 0),
    bondBuys: lots.length, couponDelay: payments.some(h => h.couponDue > h.couponPaid && h.status === 'delayed'),
    principalDelay: payments.some(h => h.principalDue > h.principalPaid && h.status === 'delayed') }
}
type Row = ReturnType<typeof metrics> & { seed: string }
const runs: Record<string, Row[]> = {}, examples: Record<string, unknown> = {}
let activeStrategy = ''
function example(key: string, s: GameState, row: Row) {
  if (examples[key]) return
  const exported = serializeLog(s)
  replayGameLog(JSON.parse(exported))
  writeFileSync(`${out}/simulation-${key}.json.gz`, gzipSync(exported))
  examples[key] = { ...row, strategy: activeStrategy, file: `simulation-${key}.json.gz`, fullStateReplay: true }
}
for (const strategy of BOND_STRATEGIES) {
  activeStrategy = strategy
  const values: Row[] = []
  for (let index = 0; index < count; index++) {
    const seed = `BOND-V25-${index}`, s = playBondGame(seed, strategy), row = { seed, ...metrics(s) }
    values.push(row)
    if (row.bondBuys > 0 && !row.delay && !row.default && strategy === 'issuer-a') example('normal-a', s, row)
    if (row.bondBuys > 0 && !row.delay && !row.default && strategy === 'issuer-b') example('normal-b', s, row)
    if (row.couponDelay) example('coupon-delay', s, row)
    if (row.principalDelay) example('principal-delay', s, row)
    if (row.default && row.recoveries > 0) example('default-recovery', s, row)
    if (!row.won && row.bondBuys > 0) example('defeat', s, row)
    if (row.won && row.bondBuys > 0) example('victory', s, row)
  }
  runs[strategy] = values
  console.log(`${strategy}: ${count} games complete; wins=${values.filter(r => r.won).length}`)
}
const aggregates = Object.fromEntries(BOND_STRATEGIES.map(strategy => {
  const values = runs[strategy], rate = (key: 'won' | 'insolvent' | 'delay' | 'default') => values.filter(v => v[key]).length / count
  const winRate = rate('won'), margin = 1.96 * Math.sqrt(winRate * (1 - winRate) / count)
  return [strategy, { games: count, winRate, win95CI: [Math.max(0, winRate - margin), Math.min(1, winRate + margin)],
    insolvencyRate: rate('insolvent'), funds: distribution(values.map(v => v.funds)),
    lossRate: values.filter(v => v.creditLoss > 0).length / count,
    meanLossWhenLoss: values.some(v => v.creditLoss > 0) ? mean(values.filter(v => v.creditLoss > 0).map(v => v.creditLoss)) : 0,
    creditLoss: distribution(values.map(v => v.creditLoss)), couponReceived: distribution(values.map(v => v.couponReceived)),
    holdingDelayRate: rate('delay'), holdingDefaultRate: rate('default'), recoveries: distribution(values.map(v => v.recoveries)),
    illiquidPrincipal: distribution(values.map(v => v.illiquidPrincipal)), unpaidCoupon: distribution(values.map(v => v.unpaidCoupon)),
    meanBondBuys: mean(values.map(v => v.bondBuys)), pairedProceedsVsBank: distribution(values.map((v, index) => v.funds - runs['bank-first'][index].funds)) }]
}))
const output = { version: 'v2.5-credit-risk', seedPrefix: 'BOND-V25-', seedsPerStrategy: count, games: count * 6,
  parameters: BOND_ISSUERS, aggregates, examples,
  methodology: 'Same deterministic seeds, six observable-state policies; C20 four laps; normal engine, no forced rolls/outcomes. Face/coupon/nonnegative/at-most-once invariants checked every game. Seven full-state replay examples.',
  limitations: ['Policies are fixed heuristics, not optimal play or human behavior.', 'Bank starts 30M term2; balanced starts15M term2; others start0. Strategies include different timing/exposure, not isolated asset causal effects.',
    'Win CIs normal approximation; paired proceeds CI estimates seed sampling only, not model uncertainty.', 'No parameter fit to real issuers; not approval or production evidence.'] }
writeFileSync(`${out}/balance-results.json`, JSON.stringify(output, null, 2) + '\n')
writeFileSync(`${out}/balance-runs.json.gz`, gzipSync(JSON.stringify(runs)))
console.table(Object.fromEntries(Object.entries(aggregates).map(([key, value]) => [key, { winRate: value.winRate, mean: Math.round(value.funds.mean), median: value.funds.median, delay: value.holdingDelayRate, default: value.holdingDefaultRate }])))
