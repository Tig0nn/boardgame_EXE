import { victory } from '../../../../src/game/selectors.ts'
import type { GameState } from '../../../../src/game/types.ts'
import type { SessionDetail } from '../../../src/game/server-session.ts'
import type { GameSignal } from './schema.ts'

/** Read-only boundary. No amount, journal, auth identity or Cloud Save payload crosses it. */
export function localGameSignal(game: GameState): GameSignal {
  return { key: game.seed, mode: 'local', completedLaps: game.summaries.map(s => s.lap),
    outcome: game.phase === 'finished' ? game.termination === 'insolvent' ? 'insolvent' : victory(game).won ? 'victory' : 'defeat' : undefined }
}
export function cloudGameSignal(detail: SessionDetail): GameSignal {
  return { key: detail.session.id, mode: 'cloud', completedLaps: detail.state.summaries.map(s => s.lap),
    outcome: detail.state.phase === 'finished' ? detail.result?.outcome : undefined }
}
