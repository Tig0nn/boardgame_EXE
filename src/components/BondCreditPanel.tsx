import { useState } from 'react'
import type { ReactNode } from 'react'
import { BOND_ISSUERS } from '../data/bond-issuers'
import { creditIssuer } from '../game/bond-credit'
import { money } from '../game/format'
import { purchasePreview } from '../game/selectors'
import type { BondIssuerId, GameState, RebalanceAction } from '../game/types'
import { MoneyInput } from './MoneyInput'
import { BondHoldings } from './BondHoldings'
import './BondCredit.css'

export function BondCreditPanel({ game, onTransaction, onSkip, marketContext }: {
  game: GameState; onTransaction: (action: RebalanceAction) => void; onSkip: () => void
  marketContext?: (asset: 'bonds', issuerId: string) => ReactNode
}) {
  const [issuerId, setIssuerId] = useState<BondIssuerId>('an-tam')
  const [amount, setAmount] = useState(8_000_000)
  const config = BOND_ISSUERS.find(item => item.id === issuerId)!, issuer = creditIssuer(game, issuerId)
  const preview = purchasePreview(game, amount), available = issuer.status === 'performing'
  const face = preview.valid && available ? Math.round(amount / issuer.currentPrice * config.faceValue) : 0
  return <section className="trading-panel bond-credit-panel">
    <fieldset className="bond-issuer-cards"><legend>Bạn cho ai vay vốn?</legend>{BOND_ISSUERS.map(item => {
      const current = creditIssuer(game, item.id)
      return <button key={item.id} type="button" className={`bond-issuer-card ${issuerId === item.id ? 'selected' : ''}`}
        aria-pressed={issuerId === item.id} onClick={() => setIssuerId(item.id)}>
        <strong>{item.name}</strong><span>Hạng {current.rating} · {item.riskLabel}</span>
        <b>{(item.coupon * 100).toLocaleString('vi-VN')}% / START · {item.term} START</b>
        <span>Giá {current.currentPrice ? money(current.currentPrice) : 'Tạm ngừng giao dịch'} · Mệnh giá {money(item.faceValue)}</span>
        <small>{current.status === 'performing' ? `Áp lực ${current.stress}/2 · ${item.id === 'an-tam' ? 'Ít rủi ro hơn, vẫn có thể chậm trả.' : 'Coupon cao, dễ chậm trả hoặc mất vốn.'}` : 'Đang xử lý khoản chậm trả · Tạm ngừng bán mới'}</small>
      </button>
    })}</fieldset>
    <label htmlFor="trade-amount">Số tiền mua</label><MoneyInput id="trade-amount" amount={amount} onChange={setAmount} invalid={!preview.valid} />
    <div className="trade-facts"><div><span>Coupon mỗi START nếu trả đúng hạn</span><strong>{money(Math.round(face * config.coupon))}</strong></div>
      <div><span>Gốc theo hợp đồng</span><strong>{money(face)}</strong><small>Đến hạn START vòng {game.lap + 1}{game.lap + 1 > game.totalLaps ? ' · Sau khi hết ván' : ''}</small></div></div>
    <div className="trade-remaining"><span>Tiền mặt sau giao dịch</span><strong>{preview.cashAfter === null ? '—' : money(preview.cashAfter)}</strong></div>
    {!preview.valid && <p className="input-error" role="status">{preview.error}</p>}
    {!available && <p className="input-error" role="status">Nhà phát hành này tạm ngừng bán mới. Hãy chọn thẻ còn lại hoặc bỏ qua.</p>}
    <p className="trade-risk">Có thể chậm trả hoặc mất một phần gốc. Phí bán 1.5%.</p>
    {marketContext?.('bonds', issuerId)}
    <button className="button primary full-button" disabled={!preview.valid || !available} onClick={() => onTransaction({ kind: 'buy', asset: 'bonds', issuerId, amount, completeEncounter: true })}>Mua trái phiếu {preview.valid && available ? money(amount) : ''}</button>
    <button className="button secondary full-button" onClick={onSkip}>Bỏ qua cơ hội</button>
    <details className="trade-details"><summary>Tín dụng, kỳ hạn & cách rút vốn</summary>
      <p>Tiết kiệm nhận lãi cố định khi đến hạn; trái phiếu là khoản cho tổ chức phát hành vay. Coupon cao đi cùng rủi ro tín dụng cao hơn. Hạng AA/B/CCC/D là thang trong game, không phải đánh giá doanh nghiệp thực.</p>
      <p>{config.name}: {issuer.status === 'performing' ? 'Đang trả đúng hạn' : issuer.status === 'delayed' ? 'Có khoản chậm trả' : 'Đang thu hồi vốn'} · Áp lực {issuer.stress}/2. {config.description}</p>
      {issuer.events.length > 0 && <ul>{issuer.events.slice(-3).map(event => <li key={`${event.lap}-${event.turn}`}>START {event.lap}: hạng {event.rating} · {event.to === 'performing' ? 'Trả đúng hạn' : event.to === 'delayed' ? 'Chậm trả' : event.to === 'defaulted' ? 'Tái cơ cấu' : 'Đã thu hồi theo phương án'}</li>)}</ul>}
      <p>Chậm trả: khoản chưa nhận chưa vào ví. Khi tái cơ cấu, coupon chưa trả mất toàn bộ; gốc thu hồi {config.recovery * 100}% ở START tiếp theo, có thể sau khi hết ván. Bán từng khoản tại START hoặc khi cần trả chi phí; giá bán có thể thấp hơn vốn. Khoản vỡ nợ tạm ngừng bán.</p>
      <p>Mua một issuer mỗi lần ghé ô. Các khoản sau vòng 4 không tự được trả sớm; cuối ván chỉ tính giá bán khả dụng sau phí.</p>
      <BondHoldings game={game} />
    </details>
  </section>
}
