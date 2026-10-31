import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { advance, roll } from '../../../src/game/engine.ts'

/** Natural first-turn encounter. Only the setup allocation varies; no state or RNG injection. */
export function createRepairDemo(savings = 0) {
  const game = roll(advance(createMultiCourseGame('whatif-demo-2', savings, 1)))
  if (game.phase !== 'event' || game.eventId !== 'repair') throw Error('Repair fixture no longer matches the engine.')
  return game
}
