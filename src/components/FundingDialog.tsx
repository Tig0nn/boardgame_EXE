import { investmentLotLabel, maturityLabel } from './player-language'
import { FinancialTerm } from './FinancialTerm'
import { localizeNarrative } from './glossary'
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
import { creditBondLots, hasBondCredit } from '../game/bond-credit'
import { bondIssuer } from '../data/bond-issuers'

export function FundingDialog({ game, onFund, compact = false, onHelp }: { game: GameState; onFund: (source: FundingSource, amount: number, lotId?: string) => void; compact?: boolean; onHelp?: () => void }) {
  const payment = game.pendingPayment!
  const cashEntry = game.log.findLast(entry => entry.after.phase === 'funding' && entry.before.phase !== 'funding')
  const cashUsed = cashEntry ? Math.max(0, cashEntry.before.portfolio.cash - cashEntry.after.portfolio.cash) : 0
  const sources = fundingSources(game)
  const [source, setSource] = useState<FundingSource>(sources[0])
  const lots = game.deposits.filter(lot => lot.status === 'active')
  const [lotId, setLotId] = useState(lots[0]?.id ?? '')
  const lot = lots.find(lot => lot.id === lotId)
  const bondLots = hasBondCredit(game) ? creditBondLots(game).filter(item => item.quote.executable) : []
  const [bondId, setBondId] = useState(bondLots[0]?.lot.id ?? '')
  const bond = bondLots.find(item => item.lot.id === bondId) ?? bondLots[0]
  const creditSale = source === 'bonds' && hasBondCredit(game)
  const available = source === 'debt' ? Math.min(payment.remaining, borrowingAvailable(game)) : source === 'savings' ? lot?.principal ?? 0 : creditSale ? bond?.quote.gross ?? 0 : game.portfolio[source]
  const [input, setInput] = useState(available)
  const amount = source === 'savings' ? available : input
  const valid = Number.isSafeInteger(amount) && amount > 0 && amount <= available
  const quote = source !== 'debt' && source !== 'savings' ? saleQuote(game, source, valid ? amount : 0, creditSale ? bond?.lot.id : undefined) : { net: valid ? amount : 0, fee: 0, spread: 0 }
  const used = Math.min(payment.remaining, quote.net)
  return <Modal title="Chọn nguồn thanh toán" onHelp={onHelp} className={compact ? 'compact-funding' : ''}>
    {!compact && <span className="section-kicker"><Icon name="wallet" /> CHỌN NGUỒN THANH TOÁN</span>}<h2>Bạn còn thiếu {money(payment.remaining)}.</h2>
    <p className="modal-lead">{localizeNarrative(payment.title)}{!compact && '. Tiền mặt sẵn có đã dùng trước; chọn lần lượt các nguồn theo ý bạn.'}</p>
    <div className="funding-progress"><span>Tổng cần trả: {money(payment.total)}</span><span>Đã dùng tiền mặt: {money(cashUsed)}</span>{!compact && <span>Đã trả tổng cộng: {money(payment.total - payment.remaining)}</span>}</div>
    <p className="inline-note"><FinancialTerm term="funding" /> · <FinancialTerm term="liquidity" /></p><fieldset className="funding-sources"><legend>Nguồn tiền hợp lệ</legend>{sources.map(item => <button key={item} type="button" className={`funding-source ${item === source ? 'selected' : ''}`} aria-pressed={item === source} onClick={() => {
      setSource(item); setInput(item === 'debt' ? Math.min(payment.remaining, borrowingAvailable(game)) : item === 'bonds' && hasBondCredit(game) ? bond?.quote.gross ?? 0 : game.portfolio[item])
    }}><Icon name={item === 'debt' ? 'receipt' : ASSETS[item].icon} size={18} /><span>{item === 'debt' ? 'Vay phần còn thiếu' : item === 'savings' ? 'Rút toàn khoản tiết kiệm' : `Bán ${ASSETS[item].label.toLowerCase()}`}</span><strong>{money(item === 'debt' ? borrowingAvailable(game) : item === 'bonds' && hasBondCredit(game) ? saleQuote(game, 'bonds').net : game.portfolio[item])}</strong></button>)}</fieldset>
    {creditSale && <><label htmlFor="fund-bond-lot">Khoản trái phiếu có thể bán</label><select id="fund-bond-lot" className="text-input" value={bond?.lot.id ?? ''} onChange={event => { setBondId(event.target.value); setInput(bondLots.find(item => item.lot.id === event.target.value)!.quote.gross) }}>
      {bondLots.map(item => <option key={item.lot.id} value={item.lot.id}>{bondIssuer(item.lot.credit!.issuerId).name} · {investmentLotLabel('bonds', item.lot.id)} · Nhận tối đa {money(item.quote.net)}</option>)}</select></>}
    {source === 'savings' ? <><label htmlFor="fund-lot">Khoản gửi rút toàn bộ</label><select id="fund-lot" className="text-input" value={lotId} onChange={event => setLotId(event.target.value)}>{lots.map(lot => <option key={lot.id} value={lot.id}>{investmentLotLabel('savings', lot.id)} · {money(lot.principal)} · {maturityLabel(lot.maturityLap)}</option>)}</select><p className={compact ? 'inline-note' : 'financial-warning'}>Rút toàn khoản {money(amount)} · Mất {money(lostInterestOnWithdrawal(game, lotId))} lãi chưa nhận.{!compact && ' Các khoản khác giữ nguyên; tiền thừa ở lại tiền mặt.'}</p></> : <><label className="seed-label" htmlFor="fund-amount">{source === 'debt' ? 'Số tiền vay' : 'Giá trị muốn bán'} <span>Tối đa {money(available)}</span></label><MoneyInput id="fund-amount" amount={input} onChange={setInput} invalid={!valid} /></>}
    {!valid && <p className="input-error">Nhập số tiền nguyên dương, tối đa {money(available)}.</p>}
    <div className="decision-preview"><span>{compact ? 'Phí & chênh lệch' : 'Phí và chênh lệch giá mua–bán'}<strong>{money(quote.fee + quote.spread)}</strong></span><span>Thực nhận<strong>{money(quote.net)}</strong></span><span>Còn thiếu sau trả<strong>{money(payment.remaining - used)}</strong></span><span>Tiền dư giữ lại<strong>{money(quote.net - used)}</strong></span></div>
    {source === 'debt' && <p className={compact ? 'inline-note' : 'financial-warning'}>{compact ? `Lãi vay ${RULES.debtRate * 100}% ở kỳ trả kế tiếp; vay tại lần qua ô Xuất phát cuối cộng lãi ngay vào nợ.` : `Vay tối đa phần thiếu và hạn mức còn lại. Lãi ${RULES.debtRate * 100}% tại kỳ trả kế tiếp; vay tại lần qua ô Xuất phát cuối cộng lãi vào nợ cuối màn.`}</p>}
    {!compact && <p className="inline-note">Kinh doanh không được bán khẩn cấp. Báo giá bán giống tại ô Xuất phát. Nếu hết nguồn và hạn mức vay, hành trình kết thúc do mất khả năng thanh toán.</p>}
    <div className="sheet-actions">
      {compact && <small>{source === 'savings' ? `Rút toàn khoản · Mất lãi ${money(lostInterestOnWithdrawal(game, lotId))}` : source === 'debt' ? `Vay ${money(amount)} · Lãi ${RULES.debtRate * 100}%` : `Nhận ${money(quote.net)} · Phí ${money(quote.fee + quote.spread)}`}</small>}
      <button className="button primary full-button" disabled={!valid} onClick={() => onFund(source, amount, source === 'savings' ? lotId : creditSale ? bond?.lot.id : undefined)}>Dùng nguồn tiền này <Icon name="arrow" /></button></div>
    {compact ? <details><summary>Cách xoay tiền</summary><p>Có thể kết hợp nhiều nguồn đến khi trả đủ. Tiền dư giữ lại trong ví; các khoản tiết kiệm khác giữ nguyên. Quán không được bán khẩn cấp. Hết nguồn và hạn mức vay thì hành trình kết thúc.</p><p>Vay tại lần qua ô Xuất phát cuối cộng lãi vào nợ cuối ván; các khoản vay khác chịu lãi ở kỳ trả kế tiếp.</p></details> : <p className="inline-note">Có thể kết hợp nhiều nguồn. Tiếp tục chọn đến khi thanh toán đủ.</p>}
  </Modal>
}
