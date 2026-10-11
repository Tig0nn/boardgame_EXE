import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { replayGameLog } from './diagnostics/replay-game-log.ts'
import { liquidatableFunds, victory } from '../src/game/selectors.ts'

const verified = []
for (const file of ['original-log.json', 'a-log.json', 'b-log.json']) {
  const data = JSON.parse(readFileSync(`docs/playtests/${file}`, 'utf8'))
  const s = replayGameLog(data)
  assert.equal(liquidatableFunds(s), data.finalResult.lawfulProceeds)
  assert.equal(victory(s).won, data.finalResult.won)
  assert.equal(s.summaries.length, s.totalLaps)
  assert.equal(data.playtest.salaryPayments, s.totalLaps)
  assert.equal(data.playtest.diceRolls, s.turn)
  verified.push({ file, mode: data.mode, seed: data.seed, ...data.playtest, finalResult: data.finalResult, deterministicReplay: true })
  console.log(`PASS downloaded ${file}: ${s.turn} rolls, ${s.totalLaps} salaries, lawful proceeds ${liquidatableFunds(s)}`)
}
writeFileSync('docs/playtests/verified-browser-logs.json', JSON.stringify(verified, null, 2) + '\n')
