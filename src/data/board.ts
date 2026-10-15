import type { Category, TileType, BoardLayoutId, BoardRevision, LivingExpenseRulesVersion } from '../game/types.ts'
import { hasPeriodicLiving, validateLivingBoard } from '../game/living-expenses.ts'

const layout: [TileType, Category, string, string][] = [
  ['start', 'income', 'Xuất phát', 'flag'], ['bank', 'investment', 'Ngân hàng', 'bank'],
  ['stocks', 'investment', 'Cổ phiếu', 'chart'], ['living', 'obligation', 'Sinh hoạt', 'receipt'],
  ['course', 'income', 'Đầu tư bản thân', 'leaf'], ['macro', 'shock', 'Kinh tế', 'bolt'],
  ['bonds', 'investment', 'Trái phiếu', 'receipt'], ['personal', 'shock', 'Biến cố cá nhân', 'bolt'],
  ['business', 'investment', 'Kinh doanh', 'shop'], ['gold', 'investment', 'Vàng', 'gold'],
  ['obligation', 'obligation', 'Dòng tiền', 'wallet'], ['stocks', 'investment', 'Cổ phiếu', 'chart'],
  ['bank', 'investment', 'Ngân hàng', 'bank'], ['macro', 'shock', 'Kinh tế', 'bolt'],
  ['living', 'obligation', 'Sinh hoạt', 'receipt'], ['business', 'investment', 'Kinh doanh', 'shop'],
  ['course', 'income', 'Đầu tư bản thân', 'leaf'], ['personal', 'shock', 'Biến cố cá nhân', 'bolt'],
  ['gold', 'investment', 'Vàng', 'gold'], ['bonds', 'investment', 'Trái phiếu', 'receipt'],
]
export const BOARD = layout.map(([type, category, label, icon], index) => {
  const [row, col] = index < 6 ? [1, index + 1] : index < 11 ? [index - 4, 6]
    : index < 16 ? [6, 16 - index] : [21 - index, 1]
  return { index, type, category, label, icon, row, col }
})

// Same perimeter and positions. Tile 14 (index 13) is the sole C20 difference.
export const C20_BOARD = BOARD.map(tile => tile.index === 13
  ? { ...tile, type:'business' as const, category:'investment' as const, label:'Kinh doanh', icon:'shop' }
  : { ...tile })
// Separate immutable meaning: legacy C20 is never redefined by a new candidate.
export const PERIODIC_C20_BOARD = C20_BOARD.map(tile => tile.index === 3
  ? { ...tile, type: 'stocks' as const, category: 'investment' as const, label: 'Cổ phiếu', icon: 'chart' }
  : tile.index === 14
    ? { ...tile, type: 'gold' as const, category: 'investment' as const, label: 'Vàng', icon: 'gold' }
    : { ...tile })
export function boardFor(game: { boardLayout: BoardLayoutId; livingExpenseRulesVersion?: LivingExpenseRulesVersion; boardRevision?: BoardRevision }) {
  validateLivingBoard(game)
  if (hasPeriodicLiving(game)) return PERIODIC_C20_BOARD
  return game.boardLayout === 'C20' ? C20_BOARD : BOARD
}
