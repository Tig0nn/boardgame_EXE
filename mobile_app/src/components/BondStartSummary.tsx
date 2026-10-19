import { FinancialTerm, GlossaryText } from '../../../src/components/FinancialTerm'
import { money, signedMoney } from '../../../src/game/format'
import type { BondStartSummary as IssuerSummary } from '../game/start-summary'
import { cashTone } from '../game/start-summary'

const statusCopy: Record<string, string> = {
  paid: 'Đã thanh toán đúng hạn', cured: 'Đã trả khoản chậm', delayed: 'Đang chậm trả',
  loss: 'Không trả đủ theo hợp đồng', holding: 'Chưa đến kỳ thanh toán',
}
const paymentCopy: Record<string, string> = {
  performing: 'Trả đúng hạn', delayed: 'Đang chậm trả', defaulted: 'Vỡ nợ · Đang thu hồi vốn', resolved: 'Đã hoàn tất',
}

function CashRow({ label, amount }: { label: string; amount: number }) {
  return <div><dt><GlossaryText text={label} /></dt><dd className={cashTone(amount)}>{signedMoney(amount)}</dd></div>
}

export function BondStartCards({ issuers }: { issuers: IssuerSummary[] }) {
  return <div className="start-bonds">{issuers.map(issuer => {
    const waiting = issuer.outstandingCoupon + issuer.outstandingPrincipal
    const lost = issuer.principalLost + issuer.couponLost
    return <article className={`start-issuer ${issuer.status}`} key={issuer.id} aria-label={`Trái phiếu · ${issuer.name}`}>
      <h3><small>Trái phiếu</small>{issuer.name}</h3>
      <p className="start-credit-status">{statusCopy[issuer.status]}</p>
      {issuer.couponPaid + issuer.principalPaid > 0 ? <dl className="start-money-rows">
        {issuer.couponPaid > 0 && <CashRow label="Lãi trái phiếu định kỳ đã nhận" amount={issuer.couponPaid} />}
        {issuer.principalPaid > 0 && <CashRow label="Gốc đã thu hồi" amount={issuer.principalPaid} />}
      </dl> : <p className="start-no-receipt neutral">Chưa nhận tiền tại START này · {money(0)}</p>}
      {waiting > 0 && <div className="start-claim"><span>Khoản còn chờ</span><strong>{money(waiting)}</strong></div>}
      {waiting > 0 && <p className="start-caption">{issuer.status === 'loss' ? 'Khoản chờ thu hồi' : 'Các khoản chưa nhận'} chưa được cộng vào tiền mặt.</p>}
      {lost > 0 && <div className="start-loss"><span>Khoản không thu hồi được</span><strong>{money(lost)}</strong>
        <small>Đã xác nhận mất{issuer.newLoss === 0 ? ' từ START trước' : ''}; không phải tiền chi thêm.</small></div>}
    </article>
  })}</div>
}

export function BondStartDetails({ issuers }: { issuers: IssuerSummary[] }) {
  if (!issuers.length) return null
  return <details className="start-details"><summary>Chi tiết các khoản trái phiếu</summary>
    <p className="start-caption">Đến hạn khác với thực nhận. Khoản còn chờ và khoản mất không nằm trong tiền đã nhận.</p>
    {issuers.flatMap(issuer => issuer.lots.map(lot => <article className="start-lot" key={`${issuer.id}-${lot.id}`}>
      <h3>{issuer.name} · {lot.id}</h3>
      <p className={lot.status === 'delayed' || lot.outstandingPrincipal + lot.outstandingCoupon > 0 ? 'start-amber' : 'neutral'}><GlossaryText text={paymentCopy[lot.status]} /></p>
      <dl className="start-money-rows">
        <div><dt><FinancialTerm term="coupon" /> đến hạn tại START này</dt><dd>{money(lot.couponDue)}</dd></div>
        <CashRow label="Lãi trái phiếu định kỳ đã nhận" amount={lot.couponPaid} />
        <div><dt>Gốc đến hạn tại START này</dt><dd>{money(lot.principalDue)}</dd></div>
        <CashRow label="Gốc đã nhận / thu hồi" amount={lot.principalPaid} />
        <div className={lot.outstandingCoupon > 0 ? 'start-amber' : 'neutral'}><dt><FinancialTerm term="coupon" /> còn chờ</dt><dd>{money(lot.outstandingCoupon)}</dd></div>
        <div className={lot.outstandingPrincipal > 0 ? 'start-amber' : 'neutral'}><dt>Gốc còn chờ / chờ thu hồi</dt><dd>{money(lot.outstandingPrincipal)}</dd></div>
        <div className={cashTone(-lot.couponLost)}><dt><FinancialTerm term="coupon" /> không thu hồi được · lũy kế</dt><dd>{money(lot.couponLost)}</dd></div>
        <div className={cashTone(-lot.principalLost)}><dt>Gốc không thu hồi được · lũy kế</dt><dd>{money(lot.principalLost)}</dd></div>
        {lot.newLoss > 0 && <div className="negative"><dt>Mất được xác nhận tại START này</dt><dd>{money(lot.newLoss)}</dd></div>}
      </dl>
    </article>))}
  </details>
}
