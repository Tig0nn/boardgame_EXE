import { ECONOMY } from '../data/config'
import { CUSTOMER_PREFERENCES } from '../data/customer-preferences'
import { businessRulesForGame } from '../game/business'
import { currentCustomerPreference } from '../game/customer-preferences'
import { money } from '../game/format'
import type { GameState } from '../game/types'
import './CustomerPreference.css'

// Presentation only: use the saved current lap, never derive another preference.
export function CustomerPreferenceCard({ game, showUpgrades = false }: { game: GameState; showUpgrades?: boolean }) {
  if (businessRulesForGame(game) !== 'v2.4-customer-preferences') return null
  const preference = currentCustomerPreference(game)
  return <section className="customer-preference preference-summary" data-current-preference={preference.id}
    aria-label={`Thị hiếu khách hàng vòng ${game.lap}`}>
    <span>THỊ HIẾU KHÁCH HÀNG · VÒNG {game.lap}</span>
    <strong>{preference.label}</strong>
    <p>{preference.example}</p>
    <p>Nâng cấp phù hợp được thưởng thêm <b>{money(ECONOMY.business.matchingBonus)}/tầng tại START</b>.</p>
    {showUpgrades && game.business.capital > 0 && <ul className="preference-upgrades">
      {CUSTOMER_PREFERENCES.map(p => <li key={p.id}>{p.label} · {game.business.upgrades[p.id] ?? 0} tầng{p.id === preference.id && <b> · Phù hợp vòng này</b>}</li>)}
    </ul>}
  </section>
}
