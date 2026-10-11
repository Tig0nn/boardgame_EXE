import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { ECONOMY, RULES } from '../src/data/config.ts'
import { playDiagnostic, distribution } from './diagnostics/game-length-model.ts'
import { fundConservatively } from './diagnostics/mechanics-model.ts'
import type { SavingsProfileId } from '../src/game/types.ts'

const n = Number(process.argv[2] ?? 1000)
assert.ok(Number.isSafeInteger(n) && n >= 10 && n <= 1000)
const before = JSON.stringify({ RULES, ECONOMY })
const policies = ['initial-40M', 'initial-30M', 'debt-first-40M'] as const
const results: Record<string, unknown> = {}
const rows: { policy: string; profile: SavingsProfileId; seed: string; funds: number; won: boolean;
  interest: number; debtInterest: number; shortages: number; borrowed: boolean }[] = []
for (const policy of policies) {
  const groups = (['v2.1-standard', 'v2.2-c20'] as SavingsProfileId[]).map(profile => {
    const runs = Array.from({ length: n }, (_, index) => {
      const { run } = playDiagnostic(`XVTL-V2-${index}`, 'saving-heavy', 4, {
        mode: 'experimental-b', savingsProfileId: profile, initialSavings: policy === 'initial-30M' ? 30e6 : 40e6,
        ...(policy === 'debt-first-40M' ? { fund: s => fundConservatively(s, true) } : {}),
      })
      assert.equal(run.accountingResidual, 0)
      assert.equal(run.termination, 'completed')
      rows.push({ policy, profile, seed: run.seed, funds: run.funds, won: run.won, interest: run.savingsInterest,
        debtInterest: run.debtInterest, shortages: run.shortageEpisodes, borrowed: run.everBorrowed })
      return run
    })
    return { profile, runs, summary: { funds: distribution(runs.map(r => r.funds)), winRate: runs.filter(r => r.won).length / n,
      savingsInterest: distribution(runs.map(r => r.savingsInterest)), debtInterest: distribution(runs.map(r => r.debtInterest)),
      shortageEpisodes: distribution(runs.map(r => r.shortageEpisodes)), everBorrowedRate: runs.filter(r => r.everBorrowed).length / n,
      courseRate: runs.filter(r => r.course).length / n } }
  })
  const delta = groups[1].runs.map((r, i) => {
    assert.equal(r.seed, groups[0].runs[i].seed)
    assert.deepEqual(r.path, groups[0].runs[i].path)
    return r.funds - groups[0].runs[i].funds
  })
  const d = distribution(delta)!
  const half = 1.96 * Math.sqrt(delta.reduce((sum, x) => sum + (x - d.mean) ** 2, 0) / (n - 1) / n)
  results[policy] = { profiles: groups.map(g => ({ profile: g.profile, ...g.summary })), paired: {
    deltaFunds: d, meanNormal95: [d.mean - half, d.mean + half], identicalPaths: n } }
  console.log(policy, groups.map(g => `${g.profile}: ${(g.summary.winRate * 100).toFixed(2)}%, median ${(g.summary.funds!.median / 1e6).toFixed(3)}M`).join(' | '))
}
assert.equal(JSON.stringify({ RULES, ECONOMY }), before)
writeFileSync('docs/simulations/v2_2-approved-savings-comparison.json', JSON.stringify({ seedCount: n, totalGames: n * 6,
  board: 'C20', laps: 4, goal: 90e6, globalConfigUnchanged: true,
  policy: 'Initial term3, reserve10M, bank85% excess term=min(3,remaining STARTs); course when>=2 STARTs and affordable; pay obligations immediately; no other investments; default funding whole savings then assets then debt, debt-first variant borrows only the compulsory shortfall with fallback.',
  results, rows }, null, 2) + '\n')
