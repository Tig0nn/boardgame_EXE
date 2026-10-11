import type { EncounterRulesVersion, GameState } from './types.ts'

export function encounterRulesForGame(s: { encounterRulesVersion?: EncounterRulesVersion }): EncounterRulesVersion {
  const version = s.encounterRulesVersion ?? 'legacy-multi-action'
  if (!['legacy-multi-action', 'v2.3-single-action', 'v2.4-business-purchase-complete'].includes(version)) throw new Error('Phiên bản giới hạn ô không hợp lệ.')
  return version
}

export const singleActionEncounters = (s: GameState) => encounterRulesForGame(s) !== 'legacy-multi-action'
export const businessPurchaseCompletes = (s: GameState) => encounterRulesForGame(s) === 'v2.4-business-purchase-complete'

// Each roll creates one encounter and increments turn. The persisted transaction log
// keeps this guard intact across JSON continuation, even if an encounter is reopened.
export function encounterActionUsed(s: GameState, kind: 'deposit' | 'upgrade'): boolean {
  // These transaction kinds are Bank/Business-only. Do not rely on the optional
  // action.asset suffix supplied by a direct caller to enforce the limit.
  return singleActionEncounters(s) && s.log.some(entry => entry.kind === 'rebalancing' && entry.turn === s.turn && entry.decisionId?.startsWith(`${kind}-`))
}
