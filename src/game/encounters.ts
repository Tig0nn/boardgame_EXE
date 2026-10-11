import type { EncounterRulesVersion, GameState } from './types.ts'

export function encounterRulesForGame(s: { encounterRulesVersion?: EncounterRulesVersion }): EncounterRulesVersion {
  const version = s.encounterRulesVersion ?? 'legacy-multi-action'
  if (version !== 'legacy-multi-action' && version !== 'v2.3-single-action') throw new Error('Phiên bản giới hạn ô không hợp lệ.')
  return version
}

export const singleActionEncounters = (s: GameState) => encounterRulesForGame(s) === 'v2.3-single-action'

// Each roll creates one encounter and increments turn. The persisted transaction log
// keeps this guard intact across JSON continuation, even if an encounter is reopened.
export function encounterActionUsed(s: GameState, kind: 'deposit' | 'upgrade'): boolean {
  // These transaction kinds are Bank/Business-only. Do not rely on the optional
  // action.asset suffix supplied by a direct caller to enforce the limit.
  return singleActionEncounters(s) && s.log.some(entry => entry.kind === 'rebalancing' && entry.turn === s.turn && entry.decisionId?.startsWith(`${kind}-`))
}
