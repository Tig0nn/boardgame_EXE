import { useState } from 'react'
import { ASSETS, RULES } from '../../../src/data/config'
import { saleQuote } from '../../../src/game/selectors'
import { money } from '../../../src/game/format'
import type { GameState, RebalanceAction, TradableAsset } from '../../../src/game/types'
import { Modal } from '../../../src/components/Modal'
import { MoneyInput } from '../../../src/components/MoneyInput'

export function RebalanceModal({
  game,
  onTransaction,
  onContinue,
}: {
  game: GameState
  onTransaction: (action: RebalanceAction) => void
  onContinue: () => void
}) {
  const [asset, setAsset] = useState<TradableAsset>('stocks')
  const [amount, setAmount] = useState(game.portfolio.stocks)
  const valid = Number.isSafeInteger(amount) && amount > 0 && amount <= game.portfolio[asset]
  const quote = saleQuote(game, asset, valid ? amount : 0)
  const debtRate = game.lap === game.totalLaps ? 0 : RULES.debtRate
  const repayable = Math.min(game.portfolio.debt, Math.floor(game.portfolio.cash / (1 + debtRate)))

  const isFinalLap = game.lap === game.totalLaps

  return (
    <Modal title="Tái Cơ Cấu Danh Mục">
      <div className="event-kicker-bar">
        <span className="event-kicker-pill">Trạm START · Vòng {game.lap}/{game.totalLaps}</span>
        <span className="event-cash-badge">💰 {money(game.portfolio.cash)}</span>
      </div>

      <h2 className="event-title">Tái Cơ Cấu Danh Mục</h2>
      <p className="event-description">
        Bạn có thể bán cổ phiếu, trái phiếu hoặc vàng để thu hồi tiền mặt hoặc chốt lời trước khi bước vào vòng tiếp theo.
      </p>

      <div className="rebalance-assets-pills">
        {(['stocks', 'bonds', 'gold'] as const).map(key => (
          <button
            key={key}
            type="button"
            className={`asset-pill-btn ${asset === key ? 'active' : ''}`}
            onClick={() => {
              setAsset(key)
              setAmount(game.portfolio[key])
            }}
          >
            <span className="asset-lbl">{ASSETS[key].label}</span>
            <strong className="asset-val">{money(game.portfolio[key])}</strong>
          </button>
        ))}
      </div>

      <div className="trade-card">
        <label htmlFor="mobile-rebalance-amount" className="trade-label">
          Số tiền muốn bán:
        </label>
        <MoneyInput id="mobile-rebalance-amount" amount={amount} onChange={setAmount} invalid={!valid} />

        <div className="trade-preview-box">
          <div className="preview-row">
            <span>Giá trị bán:</span>
            <strong>{money(quote.gross)}</strong>
          </div>
          <div className="preview-row">
            <span>Phí giao dịch:</span>
            <span>-{money(quote.fee + quote.spread)}</span>
          </div>
          <div className="preview-row highlight">
            <span>Thực nhận về ví:</span>
            <strong className="text-success">+{money(quote.net)}</strong>
          </div>
        </div>

        <button
          className="button secondary full-button"
          disabled={!valid}
          onClick={() => onTransaction({ kind: 'sell', asset, amount })}
        >
          Xác nhận bán {ASSETS[asset].label}
        </button>
      </div>

      {game.portfolio.debt > 0 && (
        <div className="trade-card debt-card">
          <div className="trade-card-header">
            <span className="trade-badge text-danger">Khoản Vay Còn Lại</span>
            <h4>Dư nợ: {money(game.portfolio.debt)}</h4>
          </div>
          <button
            className="button secondary full-button"
            disabled={repayable <= 0}
            onClick={() => onTransaction({ kind: 'repay', amount: repayable })}
          >
            Trả {money(repayable)} gốc (+{money(Math.round(repayable * debtRate))} phí/lãi)
          </button>
        </div>
      )}

      {game.log.at(-1)?.kind === 'rebalancing' && (
        <div className="mobile-trade-feedback" role="status">
          <span>✅ {game.log.at(-1)!.consequence}</span>
        </div>
      )}

      <button className="button primary full-button mt-3" onClick={onContinue}>
        {isFinalLap ? 'Xem Kết Quả Ván Đấu 🏆' : 'Hoàn Tất · Sang Vòng Tiếp Theo ➔'}
      </button>
    </Modal>
  )
}