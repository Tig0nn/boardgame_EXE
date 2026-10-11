import { useState } from 'react'
import { ASSETS, RULES } from '../data/config'
import { saleQuote } from '../game/selectors'
import { money } from '../game/format'
import type { GameState, RebalanceAction, TradableAsset } from '../game/types'
import { Modal } from './Modal'
import { Icon } from './Icon'
import { GoalChecks } from './GoalChecks'
import { MarketDetails } from './MarketDetails'
import { MoneyInput } from './MoneyInput'

export function RebalanceDialog({ game, onTransaction, onContinue }: { game: GameState; onTransaction: (action: RebalanceAction) => void; onContinue: () => void }) {
  const [asset, setAsset] = useState<TradableAsset>('stocks')
  const [amount, setAmount] = useState(game.portfolio.stocks)
  const valid = Number.isSafeInteger(amount) && amount > 0 && amount <= game.portfolio[asset]
  const quote = saleQuote(game, asset, valid ? amount : 0)
  const debtRate = game.lap === game.totalLaps ? 0 : RULES.debtRate
  const repayable = Math.min(game.portfolio.debt, Math.floor(game.portfolio.cash / (1 + debtRate)))
  return <Modal title="Quyền bán tại START">
    <span className="section-kicker"><Icon name="refresh" /> START SAU VÒNG {game.lap}</span>
    <h2>Quyền bán tại START</h2><p className="modal-lead">Được bán cổ phiếu, trái phiếu, vàng theo báo giá sau quyết toán. Mua tài sản và gửi tiết kiệm tại đúng ô tương ứng. Kinh doanh chỉ bán tại ô Kinh doanh.</p>
    <div className="rebalance-balances">{Object.entries(ASSETS).map(([key, meta]) => <div key={key}><span>{meta.label}</span><strong>{money(game.portfolio[key as keyof typeof ASSETS])}</strong></div>)}</div>
    <label className="seed-label" htmlFor="sell-asset">Tài sản muốn bán</label><select id="sell-asset" className="text-input" value={asset} onChange={event => { const next = event.target.value as TradableAsset; setAsset(next); setAmount(game.portfolio[next]) }}>{(['stocks', 'bonds', 'gold'] as const).map(key => <option key={key} value={key}>{ASSETS[key].label}</option>)}</select>
    <label className="seed-label" htmlFor="sell-amount">Giá trị niêm yết muốn bán <span>Tối đa {money(game.portfolio[asset])}</span></label><MoneyInput id="sell-amount" amount={amount} onChange={setAmount} invalid={!valid} />
    {!valid && <p className="input-error">{game.portfolio[asset] === 0 ? 'Chưa có tài sản này để bán; chọn tài sản khác hoặc tiếp tục.' : 'Nhập số tiền nguyên dương trong số dư tài sản.'}</p>}
    <div className="decision-preview"><span>Giá trị bán<strong>{money(quote.gross)}</strong></span><span>Phí và spread<strong>{money(quote.fee + quote.spread)}</strong></span><span>Thực nhận<strong>{money(quote.net)}</strong></span><span>Tiền mặt sau bán<strong>{money(game.portfolio.cash + quote.net)}</strong></span></div>
    <button className="button secondary full-button" disabled={!valid} onClick={() => onTransaction({ kind: 'sell', asset, amount })}>Xác nhận bán <Icon name="check" size={17} /></button>
    <details className="trade-details"><summary>Báo giá và thông tin tài sản</summary><MarketDetails game={game} asset={asset} /></details>
    {game.portfolio.debt > 0 && <><p className="financial-warning">Nợ {money(game.portfolio.debt)} đã trừ khỏi nguồn huy động. {game.lap === game.totalLaps ? 'Khoản vay mới tại START cuối đã bao gồm lãi, không tính thêm khi trả.' : `Trả trước chịu ${RULES.debtRate * 100}% lãi theo hợp đồng.`}</p>
      <button className="button secondary full-button" disabled={repayable <= 0} onClick={() => onTransaction({ kind: 'repay', amount: repayable })}>Trả {money(repayable)} gốc · Lãi thêm {money(Math.round(repayable * debtRate))}</button>
    </>}
    {game.log.at(-1)?.kind === 'rebalancing' && <p className="transaction-feedback" role="status">{game.log.at(-1)!.consequence}</p>}
    <GoalChecks game={game} />
    <div className="sheet-actions"><button className="button primary full-button" onClick={onContinue}>{game.lap === game.totalLaps ? 'Xem kết quả hành trình' : 'Hoàn tất · Xem dự báo'} <Icon name="arrow" /></button></div>
  </Modal>
}
