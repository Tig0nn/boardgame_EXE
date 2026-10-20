import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync, gzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
import { createMultiCourseGame } from '../../src/game/new-game.ts'
import { advance, decide, roll, transact, fundPayment, snapshot } from '../../src/game/engine.ts'
import { serializeLog } from '../../src/game/log.ts'
import type { FundingSource, Term } from '../../src/game/types.ts'
import { replayGameLog } from './replay-game-log.ts'

const out = 'docs/playtests/b18-financial-decision-copy/checkpoints'
mkdirSync(out, { recursive: true })
const sourceList = [{ path: 'docs/playtests/b18-release-qa/gameplay/mobile-asset-funding.json.gz' },
  ...JSON.parse(readFileSync('docs/playtests/b18-language-cleanup/after-replay-verification.json', 'utf8')).results]
const found = new Set(), provenance = []
for (const { path: source } of sourceList) {
  const bytes = readFileSync(source), data = JSON.parse((source.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString())
  if (data.state.gameplayProfile !== 'core-mvp-b18-multi-course-v1') continue
  const first = data.entries[0].after, deposit = first.deposits[0]
  let s = createMultiCourseGame(data.seed, first.portfolio.savings, (deposit ? deposit.maturityLap - deposit.startLap + 1 : 1) as Term)
  const inspect = () => {
    const id = s.eventId
    if (s.phase !== 'event' || !id || !['family', 'repair', 'medical', 'bank', 'stocks'].includes(id) || found.has(id)) return
    if (id === 'stocks' && new Set(s.market.stocks.map(stock => stock.currentPrice)).size < 2) return
    found.add(id)
    const exported = serializeLog(s), path = `${out}/${id}.json.gz`
    replayGameLog(JSON.parse(exported)); writeFileSync(path, gzipSync(exported + '\n'))
    provenance.push({ id, path, source, seed: s.seed, turn: s.turn, lap: s.lap, cash: s.portfolio.cash,
      method: 'Exact legal archived replay prefix, imported through product UI. No injected state fields.' })
  }
  for (const e of data.entries) {
    if (!['roll', 'decision', 'rebalancing', 'funding'].includes(e.kind)) continue
    for (let i = 0; i < 4 && (s.phase !== e.before.phase || s.lap !== e.before.lap); i++) { s = advance(s); inspect() }
    assert.deepEqual(snapshot(s), e.before); inspect()
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
  if (found.size === 5) break
}
for (const id of ['family', 'repair', 'bank', 'stocks']) assert.ok(found.has(id), `Missing ${id}`)
writeFileSync(`${out}/provenance.json`, JSON.stringify(provenance, null, 2) + '\n')
console.log(JSON.stringify({ checkpoints: found.size, ids: [...found] }))
