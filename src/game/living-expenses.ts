import type { BoardLayoutId, BoardRevision, LivingExpenseRulesVersion, GameplayProfile, GoalRulesVersion } from './types.ts'
import { isCoreMvp, rulesForGame, goalForGame } from './rules-profile.ts'

// Candidate parameter, frozen for this explicit version. Research copies may vary
// this constant in isolation; the playable candidate never reads research settings.
export const PERIODIC_LIVING_COST = 7_000_000
export const PERIODIC_BOARD_REVISION = 'c20-v2.6-a' as const

export function livingExpenseRulesForGame(game: { livingExpenseRulesVersion?: LivingExpenseRulesVersion }) {
  const version = game.livingExpenseRulesVersion ?? 'v2.4-on-landing'
  if (!['v2.4-on-landing','v2.6-periodic-start','b18-periodic-start-v1'].includes(version)) throw new Error('Phiên bản sinh hoạt không hợp lệ.')
  return version
}
export function hasPeriodicLiving(game: { livingExpenseRulesVersion?: LivingExpenseRulesVersion }) {
  return livingExpenseRulesForGame(game) !== 'v2.4-on-landing'
}
export function livingCostForGame(game: { gameplayProfile?: GameplayProfile; livingExpenseRulesVersion?: LivingExpenseRulesVersion }) {
  return isCoreMvp(game) ? rulesForGame(game).livingCost : PERIODIC_LIVING_COST
}
export function validateLivingBoard(game: { livingExpenseRulesVersion?: LivingExpenseRulesVersion; boardRevision?: BoardRevision; boardLayout: BoardLayoutId; gameplayProfile?: GameplayProfile; goalRulesVersion?: GoalRulesVersion }) {
  if (isCoreMvp(game)) {
    goalForGame(game)
    if (game.boardLayout !== 'B18' || game.boardRevision !== 'b18-core-v1' || game.livingExpenseRulesVersion !== 'b18-periodic-start-v1') throw new Error('Bàn cờ không khớp phiên bản B18.')
    return
  }
  if (game.boardLayout === 'B18' || game.goalRulesVersion !== undefined || game.livingExpenseRulesVersion === 'b18-periodic-start-v1') throw new Error('Thiếu metadata của B18.')
  const periodic = hasPeriodicLiving(game)
  if (periodic ? game.boardLayout !== 'C20' || game.boardRevision !== PERIODIC_BOARD_REVISION : game.boardRevision !== undefined) {
    throw new Error('Bàn cờ không khớp phiên bản sinh hoạt.')
  }
}
