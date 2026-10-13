import { createGame } from './engine.ts'
import type { GameModeId, Term } from './types.ts'

// Player entry point. createGame remains the historical/replay API with legacy catalog defaults.
export function createPlayerGame(seed: string, savings: number, term: Term = 1, mode: GameModeId = 'experimental-b') {
  return createGame(seed, savings, term, mode, undefined, 'v2.4-customer-preferences', 'v2.4-business-purchase-complete', 'vn-v1')
}
