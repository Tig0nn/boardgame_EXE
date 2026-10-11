import { ECONOMY } from '../data/config.ts'
import type { BusinessRulesVersion, GameState } from './types.ts'

export function businessRulesForGame(s: { businessRulesVersion?: BusinessRulesVersion }): BusinessRulesVersion {
  const version = s.businessRulesVersion ?? 'v2.2-trend-shock'
  if (version !== 'v2.2-trend-shock' && version !== 'v2.3-fixed-income') throw new Error('Phiên bản luật kinh doanh không hợp lệ.')
  return version
}

export function businessIncome(s: GameState): number {
  if (s.business.capital <= 0) return 0
  const config = ECONOMY.business
  const upgrades = Object.values(s.business.upgrades).reduce((sum, count) => sum + count, 0)
  if (businessRulesForGame(s) === 'v2.3-fixed-income') {
    return Math.round(config.baseIncome + upgrades * config.baseUplift +
      (s.business.upgrades[s.scenarioId] ?? 0) * config.matchingBonus)
  }
  const trend = config.trendIncome[s.scenarioId as keyof typeof config.trendIncome] ?? 1
  return Math.round(config.baseIncome * trend + upgrades * config.baseUplift +
    (s.business.upgrades[s.scenarioId] ?? 0) * config.matchingBonus +
    (s.business.economicMultiplier - 1) * config.economicIncomeImpact)
}
export const businessSaleQuote = (s: GameState): number => Math.max(0, Math.round(s.business.recoverableCapital))

export const businessUpgradeUnlocked = (s: GameState): boolean =>
  s.business.capital > 0 && s.businessPurchaseTurn !== null && s.turn > s.businessPurchaseTurn
