import { ECONOMY } from '../data/config.ts'
import type { GameState } from './types.ts'

export function businessIncome(s: GameState): number {
  if (s.business.capital <= 0) return 0
  const config = ECONOMY.business
  const upgrades = Object.values(s.business.upgrades).reduce((sum, count) => sum + count, 0)
  const trend = config.trendIncome[s.scenarioId as keyof typeof config.trendIncome] ?? 1
  return Math.round(config.baseIncome * trend + upgrades * config.baseUplift +
    (s.business.upgrades[s.scenarioId] ?? 0) * config.matchingBonus +
    (s.business.economicMultiplier - 1) * config.economicIncomeImpact)
}
export const businessSaleQuote = (s: GameState): number => Math.max(0, Math.round(s.business.recoverableCapital))

export const businessUpgradeUnlocked = (s: GameState): boolean =>
  s.business.capital > 0 && s.businessPurchaseTurn !== null && s.turn > s.businessPurchaseTurn
