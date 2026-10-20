import type { Term } from '../game/types'
import { savingsPeriodExplanation } from './player-language'

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
    </label>)}</div><p className="savings-period-note">{savingsPeriodExplanation}</p>
  </fieldset>
}
