import { createMultiCourseGame } from '../../src/game/new-game.ts'
import { advance, roll, decide, canChoose } from '../../src/game/engine.ts'
import { eventsForGame } from '../../src/data/events.ts'

/** Checkpoint reached only through engine transitions; no injected snapshot or fixture. */
export function naturalBetaEncounter(eventId: string) {
  for (let seed = 0; seed < 100; seed++) {
    let game = createMultiCourseGame('beta-natural-' + seed, 10_000_000, 1)
    for (let step = 0; step < 100; step++) {
      if (game.phase === 'event' && game.eventId === eventId) return game
      if (game.phase === 'finished' || game.phase === 'funding') break
      if (game.phase === 'rolling') game = roll(game)
      else if (game.phase === 'event') {
        const options = eventsForGame(game).find(x => x.id === game.eventId)?.options ?? []
        const option = options.find(x => x.id === 'skip' && canChoose(game, x.id)) ?? options.find(x => canChoose(game, x.id))
        if (!option) break
        game = decide(game, option.id)
      } else game = advance(game)
    }
  }
  throw Error('No natural encounter: ' + eventId)
}
