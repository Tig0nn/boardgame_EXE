import { evaluateFinancialHealth } from '../../../src/game/financial-health.ts'
import { financialReview } from '../../../src/components/financial-review.ts'
import type { Arena } from './arena-model.ts'

// Only the complete local state supports the same retrospective as the Web app.
// A server portfolio is not a substitute for missing history in GameState.
export function resultReview(arena: Arena) {
  const decisions = arena.journal.filter(entry => ['decision', 'funding', 'rebalancing'].includes(entry.kind))
  if (arena.local) return {
    source: 'local' as const, health: evaluateFinancialHealth(arena.local),
    facts: financialReview(arena.local), decisions, limitation: null,
  }
  return {
    source: 'server' as const, health: null, facts: [], decisions,
    limitation: 'Cloud Save hiện chưa đủ dữ liệu cho điểm tổng, xếp hạng và bốn trụ cột. Chỉ hiển thị kết quả chính thức, tài sản và quyết định được server cung cấp.',
  }
}
