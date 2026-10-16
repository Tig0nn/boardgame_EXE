import { RULES } from '../data/config.ts'
import type { Snapshot } from './types.ts'

type Profile = Pick<Snapshot, 'gameplayProfile' | 'goalRulesVersion'>
export const CORE_MVP_PROFILE = 'core-mvp-b18-v1' as const
export const CORE_MVP_RULES = Object.freeze({ ...RULES, laps: 4, tiles: 18,
  livingCost: 5_000_000, courseCost: 8_000_000, courseBoost: 4_000_000,
  goal: 90_000_000, cashGoal: 0 })
export function isCoreMvp(game: { gameplayProfile?: Snapshot['gameplayProfile'] }) {
  if (game.gameplayProfile !== undefined && game.gameplayProfile !== CORE_MVP_PROFILE) throw new Error('Phiên bản gameplay không được hỗ trợ.')
  return game.gameplayProfile === CORE_MVP_PROFILE
}
export function rulesForGame(game: { gameplayProfile?: Snapshot['gameplayProfile'] }) {
  return isCoreMvp(game) ? CORE_MVP_RULES : RULES
}
export function goalForGame(game: Profile) {
  if (isCoreMvp(game) ? game.goalRulesVersion !== 'single-90m-v1' : game.goalRulesVersion !== undefined) throw new Error('Mục tiêu không khớp phiên bản gameplay.')
  const rules = rulesForGame(game)
  return { amount: rules.goal, reserve: rules.cashGoal, target: rules.goal + rules.cashGoal, single: isCoreMvp(game) }
}
