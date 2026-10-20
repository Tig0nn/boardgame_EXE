import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
import { createMultiCourseGame } from '../../src/game/new-game.ts'
import { advance, decide, roll, transact, fundPayment, snapshot } from '../../src/game/engine.ts'
import { serializeLog } from '../../src/game/log.ts'
import type { FundingSource, Term } from '../../src/game/types.ts'
import { replayGameLog } from './replay-game-log.ts'

const out = 'docs/playtests/b18-course-layout/checkpoints'
mkdirSync(out, { recursive: true })
const sources = [
  ...readdirSync('docs/playtests/b18-release-qa/gameplay').filter(p => p.startsWith('mobile-') && p.endsWith('.gz')).map(p => `docs/playtests/b18-release-qa/gameplay/${p}`),
  ...readdirSync('docs/playtests/core-mvp-b18-multi-course').filter(p => p.startsWith('frozen-') && p.endsWith('.gz')).map(p => `docs/playtests/core-mvp-b18-multi-course/${p}`),
]
const found = new Set(), provenance = []
for (const source of sources) {
  const data = JSON.parse(gunzipSync(readFileSync(source)).toString())
  const first = data.entries[0].after, deposit = first.deposits[0]
  let s = createMultiCourseGame(data.seed, first.portfolio.savings, (deposit ? deposit.maturityLap - deposit.startLap + 1 : 1) as Term)
  const inspect = () => {
    if (s.phase !== 'event' || s.eventId !== 'course') return
    const owned = s.ownedCourses!
    const label = owned.length === 2 ? 'both-learned' : owned.includes('basic') ? 'basic-learned' : owned.includes('advanced') ? 'advanced-learned'
      : s.portfolio.cash >= 10e6 ? 'available' : s.portfolio.cash < 6e6 ? 'insufficient' : 'basic-only-affordable'
    if (found.has(label)) return
    found.add(label)
    const serialized = serializeLog(s)
    replayGameLog(JSON.parse(serialized))
    const path = `${out}/${label}.json.gz`
    writeFileSync(path, gzipSync(serialized + '\n'))
    provenance.push({ label, path, source, seed: s.seed, lap: s.lap, turn: s.turn, cash: s.portfolio.cash, owned,
      method: 'Exact legal replay prefix of an archived game. Imported through UI; no injected save fields and no new balance simulation.' })
  }
  for (const e of data.entries) {
    if (!['roll', 'decision', 'rebalancing', 'funding'].includes(e.kind)) continue
    for (let i = 0; i < 4 && (s.phase !== e.before.phase || s.lap !== e.before.lap); i++) { s = advance(s); inspect() }
    assert.deepEqual(snapshot(s), e.before)
    inspect()
    if (e.kind === 'roll') s = roll(s)
    else if (e.kind === 'decision') s = decide(s, e.decisionId)
    else if (e.kind === 'rebalancing') s = transact(s, e.action)
    else {
      const kind = e.decisionId.slice(5) as FundingSource
      const lot = e.before.deposits.find((l: { id: string; status: string }) => l.status === 'active' && e.after.deposits.find((a: { id: string }) => a.id === l.id)?.status === 'withdrawn')
      s = fundPayment(s, kind, kind === 'debt' ? e.after.portfolio.debt - e.before.portfolio.debt : kind === 'savings' ? lot.principal : e.forcedAssetSaleAmount, kind === 'bonds' ? e.fundingLotId : lot?.id)
    }
    inspect()
  }
}
for (const label of ['available', 'insufficient', 'basic-learned', 'advanced-learned', 'both-learned']) assert.ok(found.has(label), `Missing ${label}`)
writeFileSync(`${out}/provenance.json`, JSON.stringify(provenance, null, 2) + '\n')
console.log(JSON.stringify({ checkpoints: found.size, labels: [...found] }))
