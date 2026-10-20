import type { GameState, Term } from '../game/types'
import { depositPreview, purchasePreview } from '../game/selectors'
import { money } from '../game/format'
import { maturityLabel } from './player-language'
import './savings-preview.css'

/** Display the existing quote only for a valid cash purchase. No state mutation. */
export function SavingsPreview({ game, amount, term }: { game: GameState; amount: number; term: Term }) {
  if (!purchasePreview(game, amount).valid) return null
  const preview = depositPreview(game, amount, term)
  return <section className="savings-preview" aria-label="Dự kiến khi khoản tiết kiệm đến hạn">
    <dl>
      <div><dt>Tiền gửi ban đầu</dt><dd>{money(amount)}</dd></div>
      <div><dt>Tổng tiền lãi</dt><dd>{money(preview.interest)}</dd></div>
      <div className="savings-total"><dt>Tổng nhận khi đến hạn</dt><dd>{money(amount + preview.interest)}</dd></div>
    </dl>
    <p>{maturityLabel(preview.maturityLap)}</p>
    {preview.maturityLap > game.totalLaps && <p className="inline-note">Đến hạn sau khi hết ván; cuối ván không tính lãi chưa nhận.</p>}
  </section>
}
