import { eventsForGame } from '../../../../src/data/events.ts'
import { advance, canChoose, decide, fundPayment, roll } from '../../../../src/game/engine.ts'
import { liquidatableFunds, victory } from '../../../../src/game/selectors.ts'
import type { GameState } from '../../../../src/game/types.ts'
import type { GameActionRequest } from '../validation.ts'
import { b18FundingOptions, canFundB18 } from './b18-funding.ts'
import { b18TradingAsset, transitionB18Trade } from './b18-trading.ts'

export function transitionB18(game: GameState, request: GameActionRequest): GameState {
  switch (request.actionId) {
    case 'advance': return advance(game)
    case 'roll': return roll(game)
    case 'trade': return transitionB18Trade(game, request.payload) ?? game
    case 'choose': {
      const { optionId } = request.payload
      return canChoose(game, optionId) ? decide(game, optionId) : game
    }
    case 'fund': {
      const { source, amount } = request.payload
      const lotId = 'lotId' in request.payload ? request.payload.lotId : undefined
      return canFundB18(game, source, amount, lotId) ? fundPayment(game, source, amount, lotId) : game
    }
  }
}

export function publicB18State(game: GameState, active = game.phase !== 'finished') {
  const event = active && game.phase === 'event'
    ? eventsForGame(game).find(item => item.id === game.eventId)
    : undefined
  const options = event?.options.filter(option => canChoose(game, option.id)) ?? []
  const fundingOptions = active ? b18FundingOptions(game) : []
  const tradingAsset = active ? b18TradingAsset(game) : null
  const availableActions: GameActionRequest['actionId'][] = []
  if (active) {
    if (game.phase === 'rolling') availableActions.push('roll')
    if (game.phase === 'forecast' || game.phase === 'summary' || game.phase === 'rebalancing') availableActions.push('advance')
    if (options.length) availableActions.push('choose')
    if (fundingOptions.length) availableActions.push('fund')
    if (tradingAsset) availableActions.push('trade')
  }
  const { stocks, gold, appliedShocks, normalLaps } = game.market
  return {
    boardLayout: game.boardLayout,
    gameplayProfile: game.gameplayProfile,
    goalRulesVersion: game.goalRulesVersion,
    phase: game.phase,
    lap: game.lap,
    totalLaps: game.totalLaps,
    turn: game.turn,
    position: game.position,
    dice: game.dice,
    scenarioId: game.scenarioId,
    eventId: game.eventId,
    pendingLanding: game.pendingLanding,
    portfolio: game.portfolio,
    recurringIncome: game.recurringIncome,
    obligations: game.obligations,
    ownedCourses: game.ownedCourses,
    summaries: game.summaries,
    pendingPayment: game.pendingPayment,
    termination: game.termination,
    availableActions,
    options,
    fundingOptions,
    tradingAsset,
    holdings: {
      stocks: game.stockHoldings,
      gold: { units: game.goldUnits, costBasis: game.goldCostBasis },
      bonds: game.bondLots.map(({ id, units, principal, status, credit }) => ({
        id, units, principal, status, issuerId: credit?.issuerId, costBasis: credit?.costBasis,
      })),
    },
    market: {
      stocks: stocks.map(({ id, currentPrice }) => ({ id, currentPrice })),
      gold: { currentPrice: gold.currentPrice },
      bonds: game.bondCredit?.issuers.map(({ id, currentPrice, rating, status }) => ({ id, currentPrice, rating, status })) ?? [],
      appliedShocks,
      normalLaps,
    },
  }
}

export function officialB18Result(game: GameState) {
  if (game.phase !== 'finished') return null

  const lawfulProceedsVnd = liquidatableFunds(game)
  if (!Number.isSafeInteger(lawfulProceedsVnd) || !game.termination) {
    throw new Error('Invalid terminal B18 state')
  }
  const outcome = game.termination === 'insolvent' ? 'insolvent' : victory(game).won ? 'victory' : 'defeat'
  return { outcome, lawfulProceedsVnd: String(lawfulProceedsVnd) } as const
}
