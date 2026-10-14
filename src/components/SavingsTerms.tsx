import type { Term } from '../game/types'

// Presentation only: rates are supplied by the official profile for the current game.
export function SavingsTerms({ name, term, rates, onChange }: {
  name: string; term: Term; rates: Record<Term, number>; onChange: (term: Term) => void
}) {
  return <fieldset className="savings-terms"><legend>Kỳ hạn (lần qua START)</legend>
    <div>{([1, 2, 3] as Term[]).map(value => <label key={value} className={term === value ? 'selected' : ''}>
      <input type="radio" name={name} value={value} checked={term === value} onChange={() => onChange(value)}
        aria-label={`${value} START · ${Math.round(rates[value] * 100)}% mỗi START · ${Math.round(rates[value] * value * 100)}% cuối kỳ`} />
      <span>{value} START</span><strong>{Math.round(rates[value] * 100)}% / START</strong>
      <small>Tổng {Math.round(rates[value] * value * 100)}% cuối kỳ</small>
    </label>)}</div>
  </fieldset>
}
