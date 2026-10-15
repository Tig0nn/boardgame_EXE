import { createGame } from './engine.ts'
import { generateGameSeed } from './seed.ts'
import type { BondRulesVersion, GameModeId, Term } from './types.ts'

// Player entry point. createGame remains the historical/replay API with legacy catalog defaults.
export function createPlayerGame(seed: string | undefined, savings: number, term: Term = 1, mode: GameModeId = 'experimental-b', bondRulesVersion: BondRulesVersion = 'v2.5-credit-risk') {
  return createGame(seed?.trim() || generateGameSeed(), savings, term, mode, undefined, 'v2.4-customer-preferences', 'v2.4-atomic-investments', 'vn-v1', bondRulesVersion)
}
