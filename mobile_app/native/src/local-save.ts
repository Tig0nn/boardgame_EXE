import { saveGameLocally } from '../../../src/game/saved-game.ts'
import type { GameState } from '../../../src/game/types.ts'

// Share one queue across screen mounts because all local games use one save slot.
export function createLocalSaveQueue(write: (payload: string) => Promise<void>) {
  let pending = Promise.resolve()
  return (state: GameState) => {
    let payload = ''
    if (!saveGameLocally(state, { setItem(_key, value) { payload = value } })) {
      return Promise.reject(new Error('Cannot serialize local game'))
    }
    pending = pending.catch(() => {}).then(() => write(payload))
    return pending
  }
}
