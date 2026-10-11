import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { replayGameLog } from './diagnostics/replay-game-log.ts'
import { liquidatableFunds } from '../src/game/selectors.ts'

const file = process.argv[2] ?? 'docs/playtests/v2_2-b-log.json'
const data = JSON.parse(readFileSync(file, 'utf8'))
assert.equal(data.schemaVersion, 5)
assert.deepEqual(data.savingsProfile, { id: 'v2.2-c20', rates: { 1: .04, 2: .05, 3: .06 } })
assert.deepEqual(data.financialConfig.ECONOMY.savingsRates, data.savingsProfile.rates)
const s = replayGameLog(data)
assert.equal(s.gameMode, 'experimental-b')
assert.equal(s.boardLayout, 'C20')
assert.equal(s.totalLaps, 4)
assert.equal(s.phase, 'finished')
assert.equal(s.termination, 'completed')
assert.equal(s.seed, 'XVTL-V2-6')
assert.equal(s.turn, 26)
assert.deepEqual(s.deposits.map(l => [l.principal, l.rate, l.maturityLap, l.earnedInterest, l.status]), [
  [30e6, .06, 3, 5.4e6, 'matured'], [5e6, .04, 1, .2e6, 'matured'],
  [5e6, .05, 4, .5e6, 'matured'], [5e6, .04, 4, .2e6, 'matured'],
])
assert.deepEqual(s.summaries.map(x => x.lap), [1, 2, 3, 4])
assert.equal(s.log.filter(x => x.title === 'Nhận lương').length, 4)
assert.equal(s.log.filter(x => x.decisionId === 'settle-lap').length, 4)
assert.equal(liquidatableFunds(s), 102_800_000)
assert.equal(data.finalResult.lawfulProceeds, 102_800_000)
assert.equal(data.finalResult.won, true)
const evidence = { file, schemaVersion: data.schemaVersion, seed: s.seed, mode: s.gameMode,
  board: s.boardLayout, laps: s.totalLaps, profile: s.savingsProfile, rolls: s.turn,
  salaries: 4, settlements: 4, deposits: s.deposits, lawfulProceeds: liquidatableFunds(s),
  remainingAfterPurchase: liquidatableFunds(s) - 80e6, won: true, fullSnapshotReplay: true }
writeFileSync('docs/playtests/v2_2-verified-browser-log.json', JSON.stringify(evidence, null, 2) + '\n')
console.log(JSON.stringify(evidence, null, 2))
