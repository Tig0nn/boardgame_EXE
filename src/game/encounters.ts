import type { EncounterRulesVersion, GameState } from './types.ts'

export function encounterRulesForGame(s: { encounterRulesVersion?: EncounterRulesVersion }): EncounterRulesVersion {
  const version = s.encounterRulesVersion ?? 'legacy-multi-action'
  if (!['legacy-multi-action', 'v2.3-single-action', 'v2.4-business-purchase-complete', 'v2.4-atomic-investments','b18-tile-trading-v1'].includes(version)) throw new Error('Phiên bản giới hạn ô không hợp lệ.')
  return version
}

export const singleActionEncounters = (s: GameState) => encounterRulesForGame(s) !== 'legacy-multi-action'
export const tileTradingEnabled = (s: Pick<GameState,'encounterRulesVersion'>) => encounterRulesForGame(s) === 'b18-tile-trading-v1'
export const investmentPurchasesComplete = (s: GameState) => ['v2.4-atomic-investments','b18-tile-trading-v1'].includes(encounterRulesForGame(s))
export const businessPurchaseCompletes = (s: GameState) => ['v2.4-business-purchase-complete', 'v2.4-atomic-investments','b18-tile-trading-v1'].includes(encounterRulesForGame(s))
export function investmentTradeUsed(s: GameState): boolean {
  return tileTradingEnabled(s) && s.log.some(e => e.kind === 'rebalancing' && e.turn === s.turn && e.before.phase === 'event'
    && e.action && ['buy','sell'].includes(e.action.kind) && e.action.asset && ['stocks','bonds','gold'].includes(e.action.asset))
}

// One visit is one turn, regardless of asset/symbol or which financial tile a caller reopens.
export function investmentPurchaseUsed(s: GameState): boolean {
  return investmentPurchasesComplete(s) && s.log.some(entry => entry.kind === 'rebalancing' && entry.turn === s.turn
    && /^buy-(stocks|bonds|gold)(-complete)?$/.test(entry.decisionId ?? ''))
}

// Each roll creates one encounter and increments turn. The persisted transaction log
// keeps this guard intact across JSON continuation, even if an encounter is reopened.
export function encounterActionUsed(s: GameState, kind: 'deposit' | 'upgrade'): boolean {
  // These transaction kinds are Bank/Business-only. Do not rely on the optional
  // action.asset suffix supplied by a direct caller to enforce the limit.
  return singleActionEncounters(s) && s.log.some(entry => entry.kind === 'rebalancing' && entry.turn === s.turn && entry.decisionId?.startsWith(`${kind}-`))
}
