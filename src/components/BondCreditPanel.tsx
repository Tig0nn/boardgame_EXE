import { useState } from 'react'
import type { ReactNode } from 'react'
import { BOND_ISSUERS } from '../data/bond-issuers'
import { ECONOMY } from '../data/config'
import { creditIssuer } from '../game/bond-credit'
import { money } from '../game/format'
import { purchasePreview } from '../game/selectors'
import type { BondIssuerId, GameState, RebalanceAction } from '../game/types'
import { MoneyInput } from './MoneyInput'
import { BondHoldings } from './BondHoldings'
import './BondCredit.css'
import { FinancialTerm, GlossaryText } from './FinancialTerm'
import { localizeNarrative } from './glossary'
import { tileTradingEnabled } from '../game/encounters'

export function BondCreditPanel({ game, onTransaction, onSkip, marketContext }: {
  game: GameState; onTransaction: (action: RebalanceAction) => void; onSkip: () => void
  marketContext?: (asset: 'bonds', issuerId: string) => ReactNode
}) {
  const [issuerId, setIssuerId] = useState<BondIssuerId>('an-tam')
  const [amount, setAmount] = useState(8_000_000)
  const config = BOND_ISSUERS.find(item => item.id === issuerId)!, issuer = creditIssuer(game, issuerId)
  const preview = purchasePreview(game, amount), available = issuer.status === 'performing'
  const face = preview.valid && available ? Math.round(amount / issuer.currentPrice * config.faceValue) : 0
  const maturityLap = game.lap + config.term - 1
  return <section className="trading-panel bond-credit-panel">
    <fieldset className="bond-issuer-cards"><legend>Bạn cho ai vay vốn?</legend>{BOND_ISSUERS.map(item => {
      const current = creditIssuer(game, item.id)
      return <button key={item.id} type="button" className={`bond-issuer-card ${issuerId === item.id ? 'selected' : ''}`}
        aria-pressed={issuerId === item.id} onClick={() => setIssuerId(item.id)}>
        <span className="bond-issuer-heading"><strong>{item.name}</strong><span>Hạng {current.rating}</span></span>
        <span className="bond-issuer-metrics"><span>Lãi mỗi kỳ<b>{(item.coupon * 100).toLocaleString('vi-VN')}%</b></span><span>Thời hạn<b>{item.term} kỳ</b></span></span>
        <span className="bond-issuer-risk">{current.status === 'performing' ? item.id === 'an-tam' ? 'Ít rủi ro hơn; vẫn có thể chậm trả hoặc mất vốn.' : 'Lãi cao hơn; dễ chậm trả hoặc mất vốn hơn.' : 'Có khoản chậm trả · Tạm ngừng bán mới'}</span>
      </button>
    })}</fieldset>
    <label htmlFor="trade-amount">Số tiền mua</label><MoneyInput id="trade-amount" amount={amount} onChange={setAmount} invalid={!preview.valid} />
    <div className="trade-facts"><div><span>Lãi mỗi kỳ nếu trả đúng hạn</span><strong>{preview.valid && available ? money(Math.round(face * config.coupon)) : '—'}</strong></div>
      <div><span>Phí bán</span><strong>{(ECONOMY.tradeFees.bonds * 100).toLocaleString('vi-VN')}%</strong></div></div>
    {maturityLap > game.totalLaps && <p className="inline-note">Đáo hạn sau khi hết ván; không được trả sớm.</p>}
    <div className="trade-remaining"><span>Tiền mặt sau giao dịch</span><strong>{preview.cashAfter === null ? '—' : money(preview.cashAfter)}</strong></div>
    {!preview.valid && <p className="input-error" role="status">{preview.error}</p>}
    {!available && <p className="input-error" role="status">Tổ chức phát hành này tạm ngừng bán mới. Hãy chọn thẻ còn lại hoặc bỏ qua.</p>}
    {marketContext?.('bonds', issuerId)}
    <button className="button primary full-button" disabled={!preview.valid || !available} onClick={() => onTransaction({ kind: 'buy', asset: 'bonds', issuerId, amount, completeEncounter: true })}>Mua trái phiếu {preview.valid && available ? money(amount) : ''}</button>
    <button className="button secondary full-button" onClick={onSkip}>Bỏ qua cơ hội</button>
    <details className="trade-details"><summary>Báo giá, lịch nhận tiền và rủi ro</summary>
      <dl className="bond-contract-facts"><div><dt>Giá một trái phiếu</dt><dd>{issuer.currentPrice ? money(issuer.currentPrice) : 'Tạm ngừng giao dịch'}</dd></div><div><dt>Mệnh giá một trái phiếu</dt><dd>{money(config.faceValue)}</dd></div><div><dt>Mệnh giá đang mua</dt><dd>{preview.valid && available ? money(face) : '—'}</dd></div></dl>
      <p>Kỳ đầu: khi qua ô Xuất phát lần thứ {game.lap}. <FinancialTerm term="maturity" /> khi qua ô Xuất phát lần thứ {maturityLap}{maturityLap > game.totalLaps ? ' · Sau khi hết ván' : ''}. Lãi và gốc có thể chậm trả.</p>
      <p>Tiết kiệm nhận lãi cố định khi đến hạn; trái phiếu là khoản cho tổ chức phát hành vay. Lãi trái phiếu định kỳ cao đi cùng rủi ro tín dụng cao hơn. Hạng AA/B/CCC/D là thang trong trò chơi, không phải đánh giá doanh nghiệp thực.</p>
      <p><FinancialTerm term="issuer" />: {config.name} · {issuer.status === 'performing' ? 'Đang trả đúng hạn' : issuer.status === 'delayed' ? 'Có khoản chậm trả' : <><FinancialTerm term="default" /> · Đang thu hồi vốn</>}. <GlossaryText text={localizeNarrative(config.description)} /></p>
      <p>Áp lực tài chính của bên phát hành: {issuer.stress}/2. Thang trong trò chơi: 0 thấp nhất, 2 cao nhất. Mức 0 vẫn có thể chậm trả hoặc mất vốn; đây không phải nợ của bạn.</p>
      <p><FinancialTerm term="rating" />: {issuer.rating} · Mức mô phỏng trong trò chơi.</p>
      {issuer.events.length > 0 && <ul>{issuer.events.slice(-3).map(event => <li key={`${event.lap}-${event.turn}`}>Qua ô Xuất phát lần thứ {event.lap}: hạng {event.rating} · {event.to === 'performing' ? 'Trả đúng hạn' : event.to === 'delayed' ? 'Chậm trả' : event.to === 'defaulted' ? 'Không trả được nợ · Thu hồi một phần gốc' : 'Đã thu hồi theo phương án'}</li>)}</ul>}
      <p>Chậm trả: tiền đang chờ chưa vào ví. Khi bên phát hành không trả được nợ, lãi trái phiếu chưa trả mất toàn bộ; gốc thu hồi {config.recovery * 100}% ở lần qua ô Xuất phát tiếp theo, có thể sau khi hết ván. {tileTradingEnabled(game) ? 'Bán từng khoản tại ô Trái phiếu, ô Xuất phát hoặc khi cần trả chi phí bắt buộc' : 'Bán từng khoản tại ô Xuất phát hoặc khi cần trả chi phí bắt buộc'}; giá bán có thể thấp hơn vốn. Khoản không trả được nợ tạm ngừng bán.</p>
      <p>Mua một tổ chức phát hành mỗi lần ghé ô. Các khoản sau vòng 4 không tự được trả sớm; cuối ván chỉ tính giá bán khả dụng sau phí.</p>
      <BondHoldings game={game} />
    </details>
  </section>
}
