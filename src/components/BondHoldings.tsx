import { bondIssuer } from '../data/bond-issuers'
import { creditBondLots, creditIssuer } from '../game/bond-credit'
import { money } from '../game/format'
import type { GameState } from '../game/types'
import './BondCredit.css'
import { FinancialTerm } from './FinancialTerm'

export function BondHoldings({ game }: { game: GameState }) {
  const holdings = creditBondLots(game)
  return <div className="bond-holdings" aria-label="Các khoản trái phiếu">{holdings.length === 0 ? <p>Chưa có khoản trái phiếu.</p> : holdings.map(({ lot, quote }) => {
    const c = lot.credit!, issuer = creditIssuer(game, c.issuerId)
    const status = lot.status === 'sold' ? 'Đã bán' : lot.status === 'matured' ? 'Đã tất toán'
      : issuer.status === 'defaulted' ? 'Đang thu hồi' : issuer.status === 'delayed' ? 'Chậm trả'
        : lot.maturityLap <= game.lap + 1 ? 'Sắp đến hạn' : 'Đang hoạt động'
    return <article key={lot.id}><strong>{bondIssuer(c.issuerId).name} · {lot.id}</strong><small>{issuer.status === 'defaulted' && lot.status === 'active' ? <><FinancialTerm term="default" /> · </> : null}{status} · <FinancialTerm term="rating" /> {issuer.rating} · <FinancialTerm term="maturity" /> START {lot.maturityLap}</small>
      <p>Gốc còn giữ {money(lot.principal)} · Bán thực nhận {money(quote.net)}{!quote.executable && lot.status === 'active' ? ' · Chưa có giá bán' : ''}</p>
      <p>Lãi trái phiếu định kỳ đã nhận {money(c.history.reduce((n, h) => n + h.couponPaid, 0))} · Gốc đã nhận {money(c.principalPaid)}</p>
      {(c.outstandingCoupon + c.outstandingPrincipal > 0) && <p>Chưa nhận: lãi trái phiếu định kỳ {money(c.outstandingCoupon)} · gốc {money(c.outstandingPrincipal)}</p>}
      {c.principalLost + c.couponLost > 0 && <p>Mất gốc {money(c.principalLost)} · lãi trái phiếu định kỳ không thu hồi {money(c.couponLost)}</p>}
    </article>
  })}</div>
}
