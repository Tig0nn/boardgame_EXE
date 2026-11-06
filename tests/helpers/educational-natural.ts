import { createMultiCourseGame } from '../../src/game/new-game.ts'
import { advance, roll, decide, canChoose } from '../../src/game/engine.ts'
import { eventsForGame } from '../../src/data/events.ts'

/** Owner's example reached through real setup, course purchase and subsequent engine rolls. */
export function educationalCourseExample() {
  for (let seed = 0; seed < 1000; seed++) {
    let game = createMultiCourseGame('educational-course-' + seed, 1_200_000, 1)
    for (let step = 0; step < 60; step++) {
      if (game.phase === 'event' && game.eventId === 'course') {
        if (game.portfolio.cash === 42_800_000 && game.ownedCourses?.includes('basic') && !game.ownedCourses.includes('advanced')) return game
        if (canChoose(game, 'course-basic')) { game = decide(game, 'course-basic'); continue }
      }
      if (game.phase === 'funding' || game.phase === 'finished') break
      if (game.phase === 'rolling') game = roll(game)
      else if (game.phase === 'event') {
        const options = eventsForGame(game).find(x => x.id === game.eventId)?.options ?? []
        const option = options.find(x => x.id === 'skip' && canChoose(game, x.id)) ?? options.find(x => canChoose(game, x.id))
        if (!option) break
        game = decide(game, option.id)
      } else game = advance(game)
    }
  }
  throw Error('Natural course example not found')
}
