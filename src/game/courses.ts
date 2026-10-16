import { MULTI_COURSES } from '../data/courses.ts'
import { boardFor } from '../data/board.ts'
import { isMultiCourse, rulesForGame } from './rules-profile.ts'
import type { GameState, Snapshot } from './types.ts'

export function validateCourseState(s: Snapshot) {
  if (!isMultiCourse(s)) {
    if (s.courseRulesVersion !== undefined || s.ownedCourses !== undefined) throw Error('Ván cũ không có curriculum hai khóa.')
    return
  }
  if (s.courseRulesVersion !== 'b18-i2-choice-v1' || !Array.isArray(s.ownedCourses) ||
      new Set(s.ownedCourses).size !== s.ownedCourses.length ||
      s.ownedCourses.some(id => !MULTI_COURSES.some(c => c.id === id))) throw Error('Trạng thái khóa học không khớp phiên bản.')
  const boost = MULTI_COURSES.filter(c => s.ownedCourses!.includes(c.id)).reduce((n,c) => n+c.boost,0)
  if (s.coursePurchased !== (s.ownedCourses.length > 0) || s.recurringIncome !== rulesForGame(s).recurringIncome+boost) throw Error('Sở hữu khóa học và lương không khớp.')
}
export function canBuyCourse(s: GameState, optionId: string) {
  if (!isMultiCourse(s)) return false
  validateCourseState(s)
  const c = MULTI_COURSES.find(c => `course-${c.id}` === optionId)
  return !!c && s.phase === 'event' && s.eventId === 'course' && boardFor(s)[s.position].type === 'course' &&
    !s.ownedCourses!.includes(c.id) && s.portfolio.cash >= c.cost &&
    !s.log.some(e => e.kind === 'decision' && e.eventId === 'course' && e.decisionId?.startsWith('course-') && e.turn === s.turn)
}
export function courseChoices(s: GameState) {
  // Potential salary periods if the game reaches every remaining START.
  const remainingStarts = Math.max(0,s.totalLaps-new Set(s.summaries.map(x => x.lap)).size)
  const starts = s.phase === 'event' ? Math.max(0,s.totalLaps-s.lap+1) : remainingStarts
  return MULTI_COURSES.map(c => ({ ...c, owned: s.ownedCourses?.includes(c.id) ?? false,
    canBuy: canBuyCourse(s,`course-${c.id}`), remainingStarts: starts,
    nominalIncome: c.boost*starts, netAfterFee: c.boost*starts-c.cost }))
}
