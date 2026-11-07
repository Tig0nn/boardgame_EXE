import type { Term } from '../game/types'

export function SavingsExplanation() {
  return <><p className="savings-period-note">Rút trước hạn để trả khoản bắt buộc: mất lãi chưa nhận.</p>
    <details className="trade-details"><summary>Cách nhận lãi</summary><p>Khi hết kỳ hạn, bạn nhận lại tiền đã gửi và toàn bộ tiền lãi. Lãi chỉ tính trên số tiền gửi ban đầu.</p>
      <p>Nếu phải rút trước hạn để thanh toán khoản bắt buộc, bạn sẽ mất phần lãi chưa nhận. Rút toàn khoản; không tự tái tục.</p></details></>
}

// Presentation only: rates are supplied by the official profile for the current game.
export function SavingsTerms({ name, term, rates, onChange }: {
  name: string; term: Term; rates: Record<Term, number>; onChange: (term: Term) => void
}) {
  return <fieldset className="savings-terms"><legend>Kỳ hạn gửi tiết kiệm</legend>
    <div>{([1, 2, 3] as Term[]).map(value => <label key={value} className={term === value ? 'selected' : ''}>
      <input type="radio" name={name} value={value} checked={term === value} onChange={() => onChange(value)}
        aria-label={`${value} kỳ · Lãi suất ${Math.round(rates[value] * 100)}% mỗi kỳ · Tổng ${Math.round(rates[value] * value * 100)}% cuối kỳ hạn`} />
      <span>{value} kỳ</span><strong>{Math.round(rates[value] * 100)}% mỗi kỳ</strong>
      <small>Tổng {Math.round(rates[value] * value * 100)}% cuối kỳ hạn</small>
    </label>)}</div><SavingsExplanation />
  </fieldset>
}
