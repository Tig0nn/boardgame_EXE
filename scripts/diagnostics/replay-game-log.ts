import assert from 'node:assert/strict'
import { createGame, advance, decide, roll, transact, fundPayment, snapshot } from '../../src/game/engine.ts'
import { createSavingsProfile } from '../../src/game/savings.ts'
import type { Asset, FundingSource, GameState, LogEntry, RebalanceAction, SavingsProfile, Term } from '../../src/game/types.ts'

export interface ReplayLog { schemaVersion: number; seed: string; savingsProfile?: SavingsProfile; entries: LogEntry[]; state: GameState }
export function replayGameLog(data: ReplayLog): GameState {
  assert.ok(data.schemaVersion === 4 || data.schemaVersion === 5, 'Only V2.1/schema4 and V2.2/schema5 are supported')
  const historical = data.schemaVersion === 4
  const profile = historical ? createSavingsProfile('v2.1-standard') : data.savingsProfile
  assert.ok(profile, 'Schema5 requires a savings profile')
  assert.deepEqual(profile, createSavingsProfile(profile.id), 'Saved rates must match the declared versioned profile')
  // Historical logs have no profile fields; every original financial value must still match.
  const comparable = (value: unknown) => JSON.parse(JSON.stringify(value, (key, v) => historical && key === 'savingsProfile' ? undefined : v))
  const initial = data.entries[0].after
  const term = initial.deposits[0] ? initial.deposits[0].maturityLap - initial.deposits[0].startLap + 1 : 1
  let s = createGame(data.seed, initial.portfolio.savings, term as Term, data.state.gameMode, profile.id)
  for (const entry of data.entries) {
    if (!['roll', 'decision', 'rebalancing', 'funding'].includes(entry.kind)) continue
    for (let i = 0; i < 4 && (s.phase !== entry.before.phase || s.lap !== entry.before.lap); i++) s = advance(s)
    assert.deepEqual(comparable(snapshot(s)), comparable(entry.before), `Before action ${entry.sequence}`)
    if (entry.kind === 'roll') s = roll(s)
    else if (entry.kind === 'decision') s = decide(s, entry.decisionId!)
    else if (entry.kind === 'funding') {
      const source = entry.decisionId!.slice(5) as FundingSource
      const lot = entry.before.deposits.find(lot => lot.status === 'active' && entry.after.deposits.find(after => after.id === lot.id)?.status === 'withdrawn')
      s = fundPayment(s, source, source === 'debt' ? entry.after.portfolio.debt - entry.before.portfolio.debt : source === 'savings' ? lot!.principal : entry.forcedAssetSaleAmount, lot?.id)
    } else {
      const [kind, asset] = entry.decisionId!.split('-')
      const after = entry.after; const before = entry.before
      const action: RebalanceAction = { kind: kind as RebalanceAction['kind'], asset: asset === 'bank' ? undefined : asset as Asset,
        amount: kind === 'sell' ? before.portfolio[asset as Asset] : before.portfolio.cash - after.portfolio.cash }
      if (kind === 'deposit') action.term = (after.deposits.at(-1)!.maturityLap - after.lap + 1) as Term
      if (kind === 'buy' && asset === 'stocks') action.symbolId = Object.keys(after.stockHoldings).find(id => after.stockHoldings[id].units > (before.stockHoldings[id]?.units ?? 0))
      if (kind === 'upgrade') action.trend = Object.keys(after.business.upgrades).find(id => after.business.upgrades[id] > (before.business.upgrades[id] ?? 0))
      if (kind === 'sell' && asset !== 'business') action.amount = entry.assetSaleAmounts[asset as 'stocks' | 'gold' | 'bonds']
      if (kind === 'repay') action.amount = before.portfolio.debt - after.portfolio.debt
      s = transact(s, action)
    }
  }
  for (let i = 0; i < 4 && (s.phase !== data.state.phase || s.lap !== data.state.lap); i++) s = advance(s)
  assert.deepEqual(comparable(s), comparable(data.state), 'Complete deterministic replay')
  return s
}
