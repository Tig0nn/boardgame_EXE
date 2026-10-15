import type { BoardLayoutId, BoardRevision, LivingExpenseRulesVersion } from './types.ts'

// Candidate parameter, frozen for this explicit version. Research copies may vary
// this constant in isolation; the playable candidate never reads research settings.
export const PERIODIC_LIVING_COST = 7_000_000
export const PERIODIC_BOARD_REVISION = 'c20-v2.6-a' as const

export function livingExpenseRulesForGame(game: { livingExpenseRulesVersion?: LivingExpenseRulesVersion }) {
  const version = game.livingExpenseRulesVersion ?? 'v2.4-on-landing'
  if (version !== 'v2.4-on-landing' && version !== 'v2.6-periodic-start') throw new Error('Phiên bản sinh hoạt không hợp lệ.')
  return version
}
export function hasPeriodicLiving(game: { livingExpenseRulesVersion?: LivingExpenseRulesVersion }) {
  return livingExpenseRulesForGame(game) === 'v2.6-periodic-start'
}
export function validateLivingBoard(game: { livingExpenseRulesVersion?: LivingExpenseRulesVersion; boardRevision?: BoardRevision; boardLayout: BoardLayoutId }) {
  const periodic = hasPeriodicLiving(game)
  if (periodic ? game.boardLayout !== 'C20' || game.boardRevision !== PERIODIC_BOARD_REVISION : game.boardRevision !== undefined) {
    throw new Error('Bàn cờ không khớp phiên bản sinh hoạt.')
  }
}
