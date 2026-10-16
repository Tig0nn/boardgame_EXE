import { RULES } from '../data/config.ts'
import type { Snapshot } from './types.ts'
import { MULTI_COURSES } from '../data/courses.ts'

type Profile = Pick<Snapshot, 'gameplayProfile' | 'goalRulesVersion'>
export const CORE_MVP_PROFILE = 'core-mvp-b18-v1' as const
export const MULTI_COURSE_PROFILE = 'core-mvp-b18-multi-course-v1' as const
export const CORE_MVP_RULES = Object.freeze({ ...RULES, laps: 4, tiles: 18,
  livingCost: 5_000_000, courseCost: 8_000_000, courseBoost: 4_000_000,
  goal: 90_000_000, cashGoal: 0 })
export const MULTI_COURSE_RULES = Object.freeze({ ...CORE_MVP_RULES,
  // No single-course economics in this profile; the explicit curriculum is authoritative.
  courseCost: undefined, courseBoost: undefined, courses: MULTI_COURSES })
export function isMultiCourse(game: { gameplayProfile?: Snapshot['gameplayProfile'] }) {
  return game.gameplayProfile === MULTI_COURSE_PROFILE
}
export function isCoreMvp(game: { gameplayProfile?: Snapshot['gameplayProfile'] }) {
  if (game.gameplayProfile !== undefined && ![CORE_MVP_PROFILE,MULTI_COURSE_PROFILE].includes(game.gameplayProfile)) throw new Error('Phiên bản gameplay không được hỗ trợ.')
  return game.gameplayProfile !== undefined
}
export function rulesForGame(game: { gameplayProfile?: Snapshot['gameplayProfile'] }) {
  if (isMultiCourse(game)) return MULTI_COURSE_RULES
  return isCoreMvp(game) ? CORE_MVP_RULES : RULES
}
export function goalForGame(game: Profile) {
  if (isCoreMvp(game) ? game.goalRulesVersion !== 'single-90m-v1' : game.goalRulesVersion !== undefined) throw new Error('Mục tiêu không khớp phiên bản gameplay.')
  const rules = rulesForGame(game)
  return { amount: rules.goal, reserve: rules.cashGoal, target: rules.goal + rules.cashGoal, single: isCoreMvp(game) }
}
