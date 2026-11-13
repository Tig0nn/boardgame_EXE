import { eventsForGame } from '../../../../src/data/events.ts'
import { advance, canChoose, decide, roll } from '../../../../src/game/engine.ts'
import { liquidatableFunds, victory } from '../../../../src/game/selectors.ts'
import type { GameState } from '../../../../src/game/types.ts'
import type { GameActionRequest } from '../validation.ts'

export const supportedChoices = ['skip', 'acknowledge', 'defer', 'temporary'] as const

export function transitionB18(game: GameState, request: GameActionRequest): GameState {
  switch (request.actionId) {
    case 'advance': return advance(game)
    case 'roll': return roll(game)
    case 'choose': {
      const { optionId } = request.payload
      return canChoose(game, optionId) ? decide(game, optionId) : game
    }
  }
}

export function publicB18State(game: GameState) {
  const event = game.phase === 'event'
    ? eventsForGame(game).find(item => item.id === game.eventId)
    : undefined
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
    options: event?.options.filter(option =>
      supportedChoices.some(id => id === option.id) && canChoose(game, option.id)) ?? [],
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
