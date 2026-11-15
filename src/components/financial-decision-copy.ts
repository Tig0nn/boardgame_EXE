import type { GameEvent, Option } from '../game/types.ts'
import { money as formatMoney } from '../game/format.ts'

// Keep the currency with its amount when a narrow decision card wraps.
const money = (amount: number) => formatMoney(amount).replace(' ₫', '\u00a0₫')

/** Payment wording only. Never rewrite the option, obligation or saved narrative. */
export function paymentOptionCopy(event: GameEvent, option: Option) {
  if (!['family', 'medical', 'repair', 'bills', 'contract'].includes(event.id) || option.income) return undefined
  const now = option.cost ?? 0, later = option.obligation ?? 0
  if (now + later <= 0) return undefined
  if (!later) return { label: `${event.id === 'repair' ? 'Sửa ngay' : 'Trả ngay'} — ${money(now)}`, detail: undefined, comparison: undefined }
  const immediate = event.options.find(item => (item.cost ?? 0) > 0 && !item.obligation && !item.income)
  const total = now + later, difference = immediate ? total - immediate.cost! : null
  const comparison = difference === null ? undefined : difference > 0
    ? now > 0 ? `Tốn thêm ${money(difference)} nếu trả sau.` : `Chi phí trả sau cao hơn ${money(difference)}.`
    : difference < 0 ? `Chi phí trả sau thấp hơn ${money(-difference)}.` : 'Chi phí bằng trả ngay.'
  return {
    label: `${now > 0 ? event.id === 'repair' ? 'Sửa tạm, trả sau' : 'Trả một phần, hẹn phần còn lại' : 'Trả cuối vòng'} — ${money(total)}`,
    detail: now > 0 ? `Trả ${money(now)} ngay, ${money(later)} cuối vòng.` : undefined,
    comparison,
  }
}
