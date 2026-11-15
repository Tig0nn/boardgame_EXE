import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
import { createGame, advance, roll, decide, transact, fundPayment, snapshot } from '../../src/game/engine.ts'
import { serializeLog } from '../../src/game/log.ts'
import type { FundingSource, Term } from '../../src/game/types.ts'
import { replayGameLog } from './replay-game-log.ts'

const out = 'docs/playtests/b18-mobile-ux-writing/checkpoints'
mkdirSync(out, { recursive: true })
const found = new Set<string>(), provenance: object[] = []
const sources = [...['mobile-trades', 'mobile-basic-first', 'mobile-business', 'mobile-credit-funding', 'mobile-withdrawal', 'mobile-savings'].map(name => `docs/playtests/b18-release-qa/gameplay/${name}.json.gz`),
  'docs/playtests/core-mvp-b18-multi-course/frozen-holdout-diversified-roi.json.gz',
  'docs/playtests/core-mvp-b18-multi-course/frozen-holdout-cash-roi.json.gz']
for (const source of sources) {
  const data = JSON.parse(gunzipSync(readFileSync(source)).toString())
  replayGameLog(data)
  const first = data.entries[0].after, deposit = first.deposits[0]
  let s = createGame(data.seed, first.portfolio.savings, (deposit ? deposit.maturityLap - deposit.startLap + 1 : 1) as Term,
    data.state.gameMode, data.savingsProfile.id, data.businessRulesVersion, data.encounterRulesVersion,
    data.stockCatalogVersion, data.bondRulesVersion, data.livingExpenseRulesVersion, data.gameplayProfile)
  const inspect = () => {
    const owned = Object.values(s.stockHoldings).some(item => item.units > 0) || s.bondLots.some(item => item.status === 'active' && item.units > 0) || s.goldUnits > 0 || s.business.capital > 0
    const primary = s.phase === 'finished' ? 'result' : s.phase === 'funding' ? 'funding' : s.phase === 'summary' ? 'settlement'
      : s.phase === 'event' ? s.eventId === 'supply-recovery' ? 'economic-event' : ['stocks', 'bonds', 'gold', 'bank', 'business', 'course', 'medical', 'repair', 'family'].includes(s.eventId ?? '') ? s.eventId! : null : null
    const extra = s.phase === 'event' && ['credit-tightening', 'demand-boom', 'supply-recovery'].includes(s.eventId ?? '') ? owned ? 'economic-owned' : 'economic-empty' : null
    for (const label of [primary, extra]) {
      if (!label || found.has(label)) continue
      found.add(label)
      const path = `${out}/${label}.json.gz`, text = serializeLog(s)
      replayGameLog(JSON.parse(text))
      writeFileSync(path, gzipSync(text + '\n'))
      provenance.push({ label, path, source, seed: s.seed, turn: s.turn, lap: s.lap, phase: s.phase, event: s.eventId,
        method: 'Exact legal engine replay prefix of archived UI game; no state injection. Import fixture, not a newly played full UI game.' })
    }
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
  for (let i = 0; i < 4 && (s.phase !== data.state.phase || s.lap !== data.state.lap); i++) { s = advance(s); inspect() }
}
for (const label of ['economic-event', 'bonds', 'stocks', 'result']) assert.ok(found.has(label), `Missing ${label}`)
writeFileSync(`${out}/provenance.json`, JSON.stringify(provenance, null, 2) + '\n')
console.log(JSON.stringify({ checkpoints: found.size, labels: [...found] }))
