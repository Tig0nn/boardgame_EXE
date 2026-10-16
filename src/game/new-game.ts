import { createGame } from './engine.ts'
import { generateGameSeed } from './seed.ts'
import type { BondRulesVersion, GameModeId, LivingExpenseRulesVersion, Term } from './types.ts'

// Player entry point. createGame remains the historical/replay API with legacy catalog defaults.
export function createPlayerGame(seed: string | undefined, savings: number, term: Term = 1, mode: GameModeId = 'experimental-b', bondRulesVersion: BondRulesVersion = 'v2.5-credit-risk', livingExpenseRulesVersion?: LivingExpenseRulesVersion) {
  return createGame(seed?.trim() || generateGameSeed(), savings, term, mode, undefined, 'v2.4-customer-preferences', 'v2.4-atomic-investments', 'vn-v1', bondRulesVersion, livingExpenseRulesVersion)
}

// The new-player path is explicit; historical APIs never infer B18 from C20.
export function createCoreMvpGame(seed?: string, savings = 0, term: Term = 1) {
  return createGame(seed?.trim() || generateGameSeed(),savings,term,'experimental-b','v2.2-c20','v2.4-customer-preferences','b18-tile-trading-v1','vn-v1','v2.5-credit-risk','b18-periodic-start-v1','core-mvp-b18-v1')
}
