import { saleQuote } from '../../../src/game/selectors.ts'
import type { GameState, LogEntry } from '../../../src/game/types.ts'
import type { WorkBudget } from './endgame-whatif-contract.ts'
import { GOLD_LIMITS } from './endgame-whatif-gold-contract.ts'
import type { GoldQuote } from './endgame-whatif-gold-contract.ts'
import { finishRecordedPair, pairReason, stepRecordedPair } from './endgame-whatif-paired.ts'
import type { PairPolicy, PairStats, ReplayPair, StoppedPair } from './endgame-whatif-paired.ts'

export type GoldPair = ReplayPair
export type GoldStats = PairStats
export type GoldStopped = StoppedPair & { quote: GoldQuote | null }
export type GoldStep = GoldStopped | (GoldPair & { ok: true; quote: GoldQuote | null; alternativeQuote: GoldQuote | null })
export const goldPairReason = pairReason

const goldPolicy: PairPolicy = {
  prefix: 'gold', advancesPerGap: GOLD_LIMITS.advancesPerGap, advances: GOLD_LIMITS.advances,
}

/** Preserve the Gold full-sale restriction and quote attribution around the shared replay kernel. */
export function stepGoldPair(actual: GameState, alternative: GameState, entry: LogEntry,
  sourceEntries: LogEntry[], work: WorkBudget, stats: GoldStats,
): GoldStep {
  let quote: GoldQuote | null = null
  let alternativeAtCommand = alternative
  const result = stepRecordedPair(actual, alternative, entry, sourceEntries, work, stats, {
    ...goldPolicy,
    beforeCommand(a, b) {
      alternativeAtCommand = b
      quote = entry.kind === 'rebalancing' && entry.action?.kind === 'sell' && entry.action.asset === 'gold'
        ? saleQuote(a, 'gold', entry.action.amount) : null
      return quote && entry.action!.amount !== a.portfolio.gold ? 'partial-gold-sale-unsupported' : null
    },
  })
  if (!result.ok) return { ...result, quote: result.reason === 'illegal-recorded-action' ? quote : null }
  return { ...result, quote, alternativeQuote: quote ? saleQuote(alternativeAtCommand, 'gold', entry.action!.amount) : null }
}

export function finishGoldPair(actual: GameState, alternative: GameState, work: WorkBudget, stats: GoldStats) {
  return finishRecordedPair(actual, alternative, work, stats, goldPolicy)
}
