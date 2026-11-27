import { investmentLotLabel } from './player-language'
import { useState } from 'react'
import { localizeNarrative } from './glossary'
import { ASSETS, RULES } from '../data/config'
import { saleQuote } from '../game/selectors'
import { money } from '../game/format'
import type { GameState, RebalanceAction, TradableAsset } from '../game/types'
import { Modal } from './Modal'
import { Icon } from './Icon'
import { GoalChecks } from './GoalChecks'
import { MarketDetails } from './MarketDetails'
import { MoneyInput } from './MoneyInput'
import { creditBondLots, hasBondCredit } from '../game/bond-credit'
import { bondIssuer } from '../data/bond-issuers'

export function RebalanceDialog({ game, onTransaction, onContinue, compact = false, onHelp }: { game: GameState; onTransaction: (action: RebalanceAction) => void; onContinue: () => void; compact?: boolean; onHelp?: () => void }) {
  const [asset, setAsset] = useState<TradableAsset>('stocks')
  const [amount, setAmount] = useState(game.portfolio.stocks)
  const lots = hasBondCredit(game) ? creditBondLots(game).filter(item => item.quote.executable) : []
  const [lotId, setLotId] = useState(lots[0]?.lot.id ?? '')
  const lot = lots.find(item => item.lot.id === lotId) ?? lots[0]
  const creditSale = asset === 'bonds' && hasBondCredit(game)
  const available = creditSale ? lot?.quote.gross ?? 0 : game.portfolio[asset]
  const valid = Number.isSafeInteger(amount) && amount > 0 && amount <= available
  const quote = saleQuote(game, asset, valid ? amount : 0, creditSale ? lot?.lot.id : undefined)
  const debtRate = game.lap === game.totalLaps ? 0 : RULES.debtRate
  const repayable = Math.min(game.portfolio.debt, Math.floor(game.portfolio.cash / (1 + debtRate)))
  return <Modal title={compact ? 'Ghé ví tại ô Xuất phát' : 'Quyền bán tại ô Xuất phát'} onHelp={onHelp}>
    <span className="section-kicker"><Icon name="refresh" /> XUẤT PHÁT SAU VÒNG {game.lap}</span>
    <h2>{compact ? 'Ghé ví tại ô Xuất phát' : 'Quyền bán tại ô Xuất phát'}</h2><p className="modal-lead">{compact ? 'Bán tài sản để bổ sung tiền mặt, hoặc đi tiếp.' : 'Được bán cổ phiếu, trái phiếu, vàng theo báo giá sau quyết toán. Mua tài sản và gửi tiết kiệm tại đúng ô tương ứng. Kinh doanh chỉ bán tại ô Kinh doanh.'}</p>
    {!compact && <div className="rebalance-balances">{Object.entries(ASSETS).map(([key, meta]) => <div key={key}><span>{meta.label}</span><strong>{money(game.portfolio[key as keyof typeof ASSETS])}</strong></div>)}</div>}
    <label className="seed-label" htmlFor="sell-asset">Tài sản muốn bán</label><select id="sell-asset" className="text-input" value={asset} onChange={event => { const next = event.target.value as TradableAsset; setAsset(next); setAmount(next === 'bonds' && hasBondCredit(game) ? lot?.quote.gross ?? 0 : game.portfolio[next]) }}>{(['stocks', 'bonds', 'gold'] as const).map(key => <option key={key} value={key}>{ASSETS[key].label}</option>)}</select>
    {creditSale && <><label htmlFor="sell-bond-lot">Khoản trái phiếu</label><select id="sell-bond-lot" className="text-input" value={lot?.lot.id ?? ''} onChange={event => { setLotId(event.target.value); setAmount(lots.find(item => item.lot.id === event.target.value)!.quote.gross) }}>
      {lots.map(item => <option key={item.lot.id} value={item.lot.id}>{bondIssuer(item.lot.credit!.issuerId).name} · {investmentLotLabel('bonds', item.lot.id)} · Nhận tối đa {money(item.quote.net)}</option>)}</select>{lots.length === 0 && <p>Chưa có khoản trái phiếu có giá bán khả dụng.</p>}</>}
    <label className="seed-label" htmlFor="sell-amount">Giá trị niêm yết muốn bán <span>Tối đa {money(available)}</span></label><MoneyInput id="sell-amount" amount={amount} onChange={setAmount} invalid={!valid} />
    {!valid && <p className="input-error">{game.portfolio[asset] === 0 ? 'Chưa có tài sản này để bán; chọn tài sản khác hoặc tiếp tục.' : 'Nhập số tiền nguyên dương trong số dư tài sản.'}</p>}
    <div className="decision-preview"><span>Giá trị bán<strong>{money(quote.gross)}</strong></span><span>{compact ? 'Phí & chênh lệch' : 'Phí và chênh lệch giá mua và bán'}<strong>{money(quote.fee + quote.spread)}</strong></span><span>Tiền nhận sau phí<strong>{money(quote.net)}</strong></span><span>Tiền mặt sau bán<strong>{money(game.portfolio.cash + quote.net)}</strong></span></div>
    <button className="button secondary full-button" disabled={!valid} onClick={() => onTransaction({ kind: 'sell', asset, amount, ...(creditSale ? { lotId: lot?.lot.id } : {}) })}>Xác nhận bán <Icon name="check" size={17} /></button>
    <details className="trade-details"><summary>Báo giá và thông tin tài sản</summary><MarketDetails game={game} asset={asset} /></details>
    {game.portfolio.debt > 0 && <><p className={compact ? 'inline-note' : 'financial-warning'}>Nợ {money(game.portfolio.debt)} · {game.lap === game.totalLaps ? 'Đã gồm lãi cuối ván.' : `Lãi trả trước ${RULES.debtRate * 100}%.`}</p>
      <button className="button secondary full-button" disabled={repayable <= 0} onClick={() => onTransaction({ kind: 'repay', amount: repayable })}>Trả {money(repayable)} gốc · Lãi thêm {money(Math.round(repayable * debtRate))}</button>
    </>}
    {game.log.at(-1)?.kind === 'rebalancing' && <p className="transaction-feedback" role="status">{localizeNarrative(game.log.at(-1)!.consequence)}</p>}
    {compact ? <details><summary>Mục tiêu về đích</summary><GoalChecks game={game} /></details> : <GoalChecks game={game} />}
    <div className="sheet-actions"><button className="button primary full-button" onClick={onContinue}>{game.lap === game.totalLaps ? 'Xem kết quả hành trình' : 'Hoàn tất · Xem dự báo'} <Icon name="arrow" /></button></div>
  </Modal>
}
