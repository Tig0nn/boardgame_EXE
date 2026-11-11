import type { GameState } from '../../../src/game/types.ts'
import { equalData } from './endgame-whatif-identity.ts'

/** Portfolio, wages and ownership are endogenous; market/credit histories and timing are not. */
export function externalState(s: GameState) {
  return { seed: s.seed, rng: s.rng, dice: s.dice, turn: s.turn, lap: s.lap, position: s.position,
    phase: s.phase, eventId: s.eventId, pendingLanding: s.pendingLanding, scenarioId: s.scenarioId,
    market: s.market, bondCredit: s.bondCredit, customerPreferenceId: s.customerPreferenceId,
    businessEconomicMultiplier: s.business.economicMultiplier,
    schedule: { completedLaps: s.summaries.map(x => x.lap), step: s.settlement?.step ?? null } }
}
export const sameExternal = (actual: GameState, alternative: GameState) => equalData(externalState(actual), externalState(alternative))
