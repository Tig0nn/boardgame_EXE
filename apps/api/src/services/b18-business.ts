import { boardFor } from '../../../../src/data/board.ts'
import { ECONOMY } from '../../../../src/data/config.ts'
import { CUSTOMER_PREFERENCES } from '../../../../src/data/customer-preferences.ts'
import { businessPurchaseCompletes, encounterActionUsed } from '../../../../src/game/encounters.ts'
import { businessSaleQuote, businessUpgradeUnlocked } from '../../../../src/game/business.ts'
import { currentCustomerPreference } from '../../../../src/game/customer-preferences.ts'
import { transact } from '../../../../src/game/engine.ts'
import { businessOverview, liquidatableFunds, netWorth, purchasePreview, totalWorth } from '../../../../src/game/selectors.ts'
import type { GameState } from '../../../../src/game/types.ts'
import type { BusinessPayload } from '../validation.ts'

function businessActions(game: GameState, active: boolean): BusinessPayload[] {
  if (!active || game.phase !== 'event' || game.eventId !== 'business' ||
      boardFor(game)[game.position].type !== 'business') return []

  const { cost, upgradeCost, maxUpgrades } = ECONOMY.business
  if (game.business.capital <= 0) {
    return purchasePreview(game, cost).valid ? [{ kind: 'buy', asset: 'business', amount: cost }] : []
  }

  const actions: BusinessPayload[] = []
  if (!businessPurchaseCompletes(game) || game.businessPurchaseTurn !== game.turn) {
    actions.push({ kind: 'sell', asset: 'business', amount: game.portfolio.business })
  }
  if (businessUpgradeUnlocked(game) && !encounterActionUsed(game, 'upgrade') &&
      businessOverview(game).levels < maxUpgrades && purchasePreview(game, upgradeCost).valid) {
    actions.push({ kind: 'upgrade', asset: 'business', amount: upgradeCost })
  }
  return actions
}

export function transitionB18Business(game: GameState, action: BusinessPayload) {
  const allowed = businessActions(game, true).some(item => item.kind === action.kind && item.amount === action.amount)
  return allowed ? transact(game, action) : null
}

export function publicBusinessState(game: GameState, active: boolean) {
  const preference = currentCustomerPreference(game)
  const view = businessOverview(game)
  const actions = businessActions(game, active)
  return {
    owned: game.business.capital > 0,
    capital: view.locked,
    currentSaleValue: view.sale,
    currentStartIncome: view.income,
    upgrades: game.business.upgrades,
    levels: view.levels,
    maxUpgrades: ECONOMY.business.maxUpgrades,
    purchaseCost: ECONOMY.business.cost,
    initialSaleValue: view.initialSale,
    upgradeCost: ECONOMY.business.upgradeCost,
    currentCustomerPreference: preference,
    specializations: CUSTOMER_PREFERENCES.map(item => ({
      ...item,
      currentStartIncomeIncrease: businessOverview(game, item.id).incrementalIncome,
    })),
    actions,
  }
}

export function quoteB18Business(game: GameState, action: BusinessPayload) {
  const next = transitionB18Business(game, action)
  if (!next) return null
  const cashDelta = next.portfolio.cash - game.portfolio.cash
  return {
    cashPaid: action.kind === 'sell' ? 0 : -cashDelta,
    cashReceived: action.kind === 'sell' ? businessSaleQuote(game) : 0,
    cashAfter: next.portfolio.cash,
    phaseAfter: next.phase,
    businessAfter: publicBusinessState(next, true),
    netWorthAfter: netWorth(next.portfolio),
    totalWorthAfter: totalWorth(next),
    liquidatableFundsAfter: liquidatableFunds(next),
  }
}
