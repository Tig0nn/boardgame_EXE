import { serializeLog } from './game/log'
import type { GameState } from './game/types'

export function exportLog(game: GameState) {
  const url = URL.createObjectURL(new Blob([serializeLog(game)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `xoay-vong-tien-lui-${game.gameMode}-log.json`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
