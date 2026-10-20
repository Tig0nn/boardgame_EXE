import type { GameEvent, Option } from '../game/types.ts'
import { money } from '../game/format.ts'

/** Payment wording only. Never rewrite the option, obligation or saved narrative. */
export function paymentOptionCopy(event: GameEvent, option: Option) {
  if (!['family', 'medical', 'repair', 'bills', 'contract'].includes(event.id) || option.income) return undefined
  const now = option.cost ?? 0, later = option.obligation ?? 0
  if (now + later <= 0) return undefined
  if (!later) return { label: 'Trả ngay', detail: `Bây giờ phải trả ${money(now)}.`, comparison: undefined }
  const immediate = event.options.find(item => (item.cost ?? 0) > 0 && !item.obligation && !item.income)
  const total = now + later, difference = immediate ? total - immediate.cost! : null
  const comparison = difference === null ? undefined : difference > 0 ? `nhiều hơn trả ngay ${money(difference)}`
    : difference < 0 ? `ít hơn trả ngay ${money(-difference)}` : 'bằng số tiền trả ngay'
  return {
    label: now > 0 ? 'Trả một phần ngay, phần còn lại sau' : 'Trả sau',
    detail: `Bây giờ trả ${money(now)}; phải trả ${money(later)} khi qua ô Xuất phát.`,
    comparison: comparison ? `Tổng trả ${money(total)}, ${comparison}.` : `Tổng trả ${money(total)}.`,
  }
}
