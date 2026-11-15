import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
import { createGame, advance, roll, decide, transact, fundPayment, snapshot } from '../../src/game/engine.ts'
import { serializeLog } from '../../src/game/log.ts'
import type { FundingSource, Term } from '../../src/game/types.ts'
import { replayGameLog } from './replay-game-log.ts'

const out = 'docs/playtests/b18-compact-financial-ui/checkpoints'
mkdirSync(out, { recursive: true })
const found = new Set(), provenance = []
const originals = [
 ...['family','medical','repair','bank'].map(id=>({id,source:`docs/playtests/b18-financial-decision-copy/checkpoints/${id}.json.gz`})),
 ...['bonds','gold'].map(id=>({id,source:`docs/playtests/b18-mobile-ux-writing/checkpoints/${id}.json.gz`}))
]
for(const item of originals) copyFileSync(item.source,`${out}/${item.id}.json.gz`)
writeFileSync(`${out}/copied-provenance.json`,JSON.stringify(originals,null,2)+'\n')
const sources = JSON.parse(readFileSync('docs/playtests/b18-language-cleanup/after-replay-verification.json','utf8')).results.map((item: {path:string}) => item.path)
for (const source of sources) {
  const raw=readFileSync(source), data = JSON.parse((source.endsWith('.gz') ? gunzipSync(raw) : raw).toString())
  if(data.state.gameplayProfile !== 'core-mvp-b18-multi-course-v1') continue
  replayGameLog(data)
  const first = data.entries[0].after, deposit = first.deposits[0]
  let s = createGame(data.seed, first.portfolio.savings, (deposit ? deposit.maturityLap - deposit.startLap + 1 : 1) as Term,
    data.state.gameMode, data.savingsProfile.id, data.businessRulesVersion, data.encounterRulesVersion,
    data.stockCatalogVersion, data.bondRulesVersion, data.livingExpenseRulesVersion, data.gameplayProfile)
  const inspect = () => {
    const primary = s.phase === 'event' && s.eventId === 'gold' && s.portfolio.gold > 0 ? 'gold-owned' : s.phase === 'event' && s.eventId === 'bank' && s.lap === 4 ? 'bank-late' : s.phase === 'event' && s.eventId === 'bonds' && s.lap === 4 ? 'bonds-late' : null
    const extra = null
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
for (const label of ['gold-owned', 'bank-late', 'bonds-late']) assert.ok(found.has(label), `Missing ${label}`)
writeFileSync(`${out}/additional-provenance.json`, JSON.stringify(provenance, null, 2) + '\n')
console.log(JSON.stringify({ checkpoints: found.size, labels: [...found] }))
