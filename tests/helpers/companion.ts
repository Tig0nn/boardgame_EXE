import assert from 'node:assert/strict'
import { advance, roll, decide, fundPayment } from '../../src/game/engine.ts'
import { eventsForGame } from '../../src/data/events.ts'
import { fundingSources } from '../../src/game/transactions.ts'
import { createMultiCourseGame } from '../../src/game/new-game.ts'
import type { GameState } from '../../src/game/types.ts'

// Find a naturally revealed repair on the first turn; no injected event/RNG.
export function revealedRepair(lap = 1): GameState {
  for (let index = 0; index < 1000; index++) {
    let game = createMultiCourseGame(`companion-fixture-${index}`, 0)
    for (let step = 0; step < 250 && game.phase !== 'finished'; step++) {
      if (game.eventId === 'repair' && game.phase === 'event' && game.lap === lap) {
        assert.equal(game.position, 3)
        return game
      }
      if (game.lap > lap) break
      game = continueFixtureGame(game)
    }
  }
  throw new Error('No repair fixture found')
}

export function continueFixtureGame(game: GameState): GameState {
  if (game.phase === 'rolling') return roll(game)
  if (game.phase === 'event') {
    const options = eventsForGame(game).find(event => event.id === game.eventId)!.options
    return decide(game, options.find(option => ['skip', 'acknowledge', 'full'].includes(option.id))?.id ?? options[0].id)
  }
  if (game.phase === 'funding') {
    assert.ok(fundingSources(game).includes('debt'), 'Fixture policy requires available debt')
    return fundPayment(game, 'debt', game.pendingPayment!.remaining)
  }
  return advance(game)
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value)
    Object.values(value).forEach(deepFreeze)
  }
  return value
}
