import type { BoardLayoutId, GameModeId } from '../game/types.ts'

export const GAME_MODES: { id: GameModeId; label: string; boardLayout: BoardLayoutId; totalLaps: number; description: string }[] = [
  { id:'original', label:'Original', boardLayout:'A20', totalLaps:3, description:'Bản gốc · 3 vòng · Bàn A20' },
  { id:'experimental-a', label:'Experimental A', boardLayout:'A20', totalLaps:4, description:'Thử nghiệm A · 4 vòng · Bàn A20' },
  { id:'experimental-b', label:'Experimental B', boardLayout:'C20', totalLaps:4, description:'Thử nghiệm B · 4 vòng · Bàn C20 · Ô 14 là Kinh doanh' },
]
export function gameMode(id: GameModeId) {
  const mode = GAME_MODES.find(mode=>mode.id===id)
  if (!mode) throw new Error('Chế độ chơi không hợp lệ.')
  return mode
}
