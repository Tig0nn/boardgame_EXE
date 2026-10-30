import { parseRepairContext } from './contracts.ts'
import type { RepairContext } from './types.ts'

export interface AdviceFact {
  kind: 'money' | 'rule' | 'concept'
  value: number | string
  provenance: 'official-rules' | 'client-state-unverified' | 'derived-from-client-state'
}
export type FactRegistry = Readonly<Record<string, Readonly<AdviceFact>>>

export function buildRepairFacts(input: RepairContext): FactRegistry {
  const context = parseRepairContext(input)
  const facts: Record<string, Readonly<AdviceFact>> = {}
  const add = (id: string, kind: AdviceFact['kind'], value: number | string, provenance: AdviceFact['provenance']) => {
    facts[id] = Object.freeze({ kind, value, provenance })
  }
  add('ctx.cash', 'money', context.financial.cashVnd, 'client-state-unverified')
  add('ctx.obligations', 'money', context.financial.obligationsVnd, 'client-state-unverified')
  for (const quote of context.options) {
    add(`${quote.optionId}.now`, 'money', quote.costNowVnd, 'official-rules')
    add(`${quote.optionId}.later`, 'money', quote.obligationAddedVnd, 'official-rules')
    add(`${quote.optionId}.total`, 'money', quote.totalCommittedCostVnd, 'official-rules')
    add(`${quote.optionId}.cashAfter`, 'money', quote.cashAfterImmediateVnd, 'derived-from-client-state')
    add(`${quote.optionId}.shortfall`, 'money', quote.fundingShortfallVnd, 'derived-from-client-state')
    add(`${quote.optionId}.obligationsAfter`, 'money', quote.obligationsAfterResolutionVnd, 'derived-from-client-state')
  }
  const [full, temporary] = context.options
  add('comparison.extraCost', 'money', temporary.totalCommittedCostVnd - full.totalCommittedCostVnd, 'official-rules')
  add('comparison.retainedCash', 'money', temporary.cashAfterImmediateVnd - full.cashAfterImmediateVnd, 'derived-from-client-state')
  add('rule.obligationDue', 'rule', 'next-start-settlement', 'official-rules')
  add('concept.liquidity', 'concept', 'cash-available-now-not-net-worth', 'official-rules')
  return Object.freeze(facts)
}
