import { useState } from 'react'
import { ASSETS, RULES } from '../data/config'
import { fundingSources } from '../game/engine'
import { borrowingAvailable } from '../game/transactions'
import { lostInterestOnWithdrawal, saleQuote } from '../game/selectors'
import { money } from '../game/format'
import type { FundingSource, GameState } from '../game/types'
import { Modal } from './Modal'
import { Icon } from './Icon'
import { MoneyInput } from './MoneyInput'

export function FundingDialog({ game, onFund }: { game: GameState; onFund: (source: FundingSource, amount: number, lotId?: string) => void }) {
  const payment = game.pendingPayment!
  const sources = fundingSources(game)
  const [source, setSource] = useState<FundingSource>(sources[0])
  const lots = game.deposits.filter(lot => lot.status === 'active')
  const [lotId, setLotId] = useState(lots[0]?.id ?? '')
  const lot = lots.find(lot => lot.id === lotId)
  const available = source === 'debt' ? Math.min(payment.remaining, borrowingAvailable(game)) : source === 'savings' ? lot?.principal ?? 0 : game.portfolio[source]
  const [input, setInput] = useState(available)
  const amount = source === 'savings' ? available : input
  const valid = Number.isSafeInteger(amount) && amount > 0 && amount <= available
  const quote = source !== 'debt' && source !== 'savings' ? saleQuote(game, source, valid ? amount : 0) : { net: valid ? amount : 0, fee: 0, spread: 0 }
  const used = Math.min(payment.remaining, quote.net)
  return <Modal title="Chọn nguồn thanh toán">
    <span className="section-kicker"><Icon name="wallet" /> CHỌN NGUỒN THANH TOÁN</span><h2>Bạn còn thiếu {money(payment.remaining)}.</h2>
    <p className="modal-lead">{payment.title}. Tiền mặt sẵn có đã dùng trước; chọn lần lượt các nguồn theo ý bạn.</p>
    <div className="funding-progress"><span>Tổng cần trả: {money(payment.total)}</span><span>Đã trả: {money(payment.total - payment.remaining)}</span></div>
    <fieldset className="funding-sources"><legend>Nguồn tiền hợp lệ</legend>{sources.map(item => <button key={item} type="button" className={`funding-source ${item === source ? 'selected' : ''}`} aria-pressed={item === source} onClick={() => {
      setSource(item); setInput(item === 'debt' ? Math.min(payment.remaining, borrowingAvailable(game)) : game.portfolio[item])
    }}><Icon name={item === 'debt' ? 'receipt' : ASSETS[item].icon} size={18} /><span>{item === 'debt' ? 'Vay phần còn thiếu' : item === 'savings' ? 'Rút toàn khoản tiết kiệm' : `Bán ${ASSETS[item].label.toLowerCase()}`}</span><strong>{money(item === 'debt' ? borrowingAvailable(game) : game.portfolio[item])}</strong></button>)}</fieldset>
    {source === 'savings' ? <><label htmlFor="fund-lot">Khoản gửi rút toàn bộ</label><select id="fund-lot" className="text-input" value={lotId} onChange={event => setLotId(event.target.value)}>{lots.map(lot => <option key={lot.id} value={lot.id}>{lot.id} · {money(lot.principal)} · Đáo hạn vòng {lot.maturityLap}</option>)}</select><p className="financial-warning">Rút toàn khoản {money(amount)}, mất {money(lostInterestOnWithdrawal(game, lotId))} lãi kỳ hạn chưa trả. Các khoản khác giữ nguyên; tiền thừa ở lại tiền mặt.</p></> : <><label className="seed-label" htmlFor="fund-amount">{source === 'debt' ? 'Số tiền vay' : 'Giá trị niêm yết bán'} <span>Tối đa {money(available)}</span></label><MoneyInput id="fund-amount" amount={input} onChange={setInput} invalid={!valid} /></>}
    {!valid && <p className="input-error">Nhập số tiền nguyên dương, tối đa {money(available)}.</p>}
    <div className="decision-preview"><span>Phí và spread<strong>{money(quote.fee + quote.spread)}</strong></span><span>Thực nhận<strong>{money(quote.net)}</strong></span><span>Còn thiếu sau trả<strong>{money(payment.remaining - used)}</strong></span><span>Tiền dư giữ lại<strong>{money(quote.net - used)}</strong></span></div>
    {source === 'debt' && <p className="financial-warning">Vay tối đa phần thiếu và hạn mức còn lại. Lãi {RULES.debtRate * 100}% tại kỳ trả kế tiếp; vay tại START cuối cộng lãi vào nợ cuối màn.</p>}
    <p className="inline-note">Kinh doanh không được bán khẩn cấp. Báo giá bán giống tại START. Nếu hết nguồn và hạn mức vay, hành trình kết thúc do mất khả năng thanh toán.</p>
    <div className="sheet-actions"><button className="button primary full-button" disabled={!valid} onClick={() => onFund(source, amount, source === 'savings' ? lotId : undefined)}>Dùng nguồn tiền này <Icon name="arrow" /></button></div>
    <p className="inline-note">Có thể kết hợp nhiều nguồn. Tiếp tục chọn đến khi thanh toán đủ.</p>
  </Modal>
}
