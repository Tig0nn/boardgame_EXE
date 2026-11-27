import type { Arena } from './arena-model'
import { art } from './assets'

// Same event headings/artwork as Mobile Web EventModal; no game rules belong here.
export function decisionPresentation(arena: Pick<Arena, 'title' | 'eventId' | 'phase'>) {
  if (arena.phase === 'forecast') return { title: arena.title, icon: art.goal }
  if (arena.phase === 'summary' || arena.phase === 'rebalancing') return { title: arena.title, icon: art.wallet }
  const visual = {
    bank: { title: 'Ngân hàng', icon: art.bank }, stocks: { title: 'Cổ phiếu', icon: art.stocks },
    bonds: { title: 'Trái phiếu', icon: art.bonds }, gold: { title: 'Vàng', icon: art.gold },
    business: { title: 'Quán của bạn', icon: art.shop }, course: { title: 'Đầu tư bản thân', icon: art.knowledge },
    repair: { title: 'Chiếc xe cần sửa', icon: art.repair },
  }
  // Keep the funding overlay's own title instead of the underlying event's title.
  return arena.phase === 'event' && arena.eventId && arena.eventId in visual
    ? visual[arena.eventId as keyof typeof visual] : { title: arena.title, icon: art.money }
}
