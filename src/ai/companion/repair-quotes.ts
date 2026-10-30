import { eventsForGame } from '../../data/events.ts'
import type { RepairProfile, RepairQuote, RepairOptionId } from './types.ts'
import { CompanionContractError } from './errors.ts'

export const REPAIR_PROFILE: Readonly<RepairProfile> = Object.freeze({
  gameplayProfile: 'core-mvp-b18-multi-course-v1', boardRevision: 'b18-l3-bonds-v1',
  goalRulesVersion: 'single-90m-v1', encounterRulesVersion: 'b18-tile-trading-v1',
  courseRulesVersion: 'b18-i2-choice-v1', bondRulesVersion: 'v2.5-credit-risk',
  livingExpenseRulesVersion: 'b18-periodic-start-v1', savingsProfileId: 'v2.2-c20',
  adviceRulesVersion: 'b18-repair.v1',
})

export function safeMoney(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new CompanionContractError('INVALID_FINANCIAL_CONTEXT')
  return value
}

/** Quotes only: reading official options never executes a choice, funding or RNG. */
export function repairQuotes(cash: number, obligations: number, lap: number): RepairQuote[] {
  safeMoney(cash); safeMoney(obligations)
  if (!Number.isInteger(lap) || lap < 1 || lap > 4) throw new CompanionContractError('INVALID_FINANCIAL_CONTEXT')
  const event = eventsForGame(REPAIR_PROFILE).find(event => event.id === 'repair')!
  return (['full', 'temporary'] as RepairOptionId[]).map(optionId => {
    const option = event.options.find(option => option.id === optionId)
    if (!option || option.income || option.asset) throw new CompanionContractError('INVALID_OPTIONS')
    const now = safeMoney(option.cost ?? 0), later = safeMoney(option.obligation ?? 0)
    const shortfall = Math.max(0, now - cash)
    return { optionId, engineAction: 'choose', allowed: true, costNowVnd: now,
      obligationAddedVnd: later, totalCommittedCostVnd: safeMoney(now + later),
      cashAfterImmediateVnd: Math.max(0, cash - now),
      obligationsAfterImmediateVnd: safeMoney(obligations + (shortfall ? 0 : later)),
      obligationsAfterResolutionVnd: safeMoney(obligations + later), fundingShortfallVnd: shortfall,
      execution: shortfall ? 'funding-required' : 'cash-sufficient',
      due: later ? 'next-start-settlement' : 'none', dueLap: later ? lap : null }
  })
}
