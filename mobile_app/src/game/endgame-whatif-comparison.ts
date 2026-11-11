import { totalWorth, liquidatableFunds, goalProgress, victory } from '../../../src/game/selectors.ts'
import type { GameState } from '../../../src/game/types.ts'
import { ENDGAME_PROFILE } from './endgame-whatif-contract.ts'
import type { EndingFacts, Metrics, Delta } from './endgame-whatif-contract.ts'
import { sameExternal } from './endgame-whatif-fairness.ts'

export const endingFacts = (s: GameState): EndingFacts => ({ termination: s.termination, phase: s.phase,
  lap: s.lap, turn: s.turn, summaries: s.summaries.map(x => x.lap), shortfall: s.pendingPayment?.remaining ?? 0 })
export function completedFour(s: GameState) {
  return s.gameplayProfile === ENDGAME_PROFILE && s.goalRulesVersion === 'single-90m-v1'
    && s.courseRulesVersion === 'b18-i2-choice-v1' && s.boardLayout === 'B18' && s.boardRevision === 'b18-l3-bonds-v1'
    && s.phase === 'finished' && s.termination === 'completed' && s.totalLaps === 4 && s.lap === 4
    && s.summaries.length === 4 && new Set(s.summaries.map(x => x.lap)).size === 4
    && [1, 2, 3, 4].every(lap => s.summaries.some(x => x.lap === lap))
    && !s.pendingPayment && !s.settlement && s.pendingCost === 0 && s.position === 0 && !s.pendingLanding
}
export const comparableEndings = (a: GameState, b: GameState) => completedFour(a) && completedFour(b) && sameExternal(a, b)
/** Called only after independent replay; selectors quote goal funds, never execute a terminal sale. */
export function endingMetrics(s: GameState): Metrics {
  const goal = goalProgress(s)
  return { cash: s.portfolio.cash, totalWorth: totalWorth(s), liquidatableFunds: liquidatableFunds(s),
    debt: s.portfolio.debt, obligations: s.obligations, goalFunds: goal.funds, goalTarget: goal.target,
    goalPercent: goal.percent, goalRemaining: goal.remaining, won: victory(s).won,
    courses: [...(s.ownedCourses ?? [])], recurringIncome: s.recurringIncome,
    salaryAtStarts: s.summaries.map(summary => ({ lap: summary.lap,
      base: summary.lines.find(line => line.label === 'Lương cơ bản tại START')?.amount ?? 0,
      courseBoost: summary.lines.find(line => line.label === 'Tăng lương từ khóa học')?.amount ?? 0 })) }
}
export function signedMetrics(a: Metrics, b: Metrics): Delta {
  return { cash: b.cash - a.cash, totalWorth: b.totalWorth - a.totalWorth,
    liquidatableFunds: b.liquidatableFunds - a.liquidatableFunds, debt: b.debt - a.debt,
    obligations: b.obligations - a.obligations, goalFunds: b.goalFunds - a.goalFunds,
    goalPercent: b.goalPercent - a.goalPercent, goalRemaining: b.goalRemaining - a.goalRemaining,
    recurringIncome: b.recurringIncome - a.recurringIncome }
}
