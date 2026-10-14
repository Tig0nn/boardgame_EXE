import { useRef, useState, type ReactNode } from 'react'
import { ECONOMY, SECTORS } from '../../../src/data/config'
import { CUSTOMER_PREFERENCES } from '../../../src/data/customer-preferences'
import { currentCustomerPreference } from '../../../src/game/customer-preferences'
import { businessUpgradeUnlocked } from '../../../src/game/business'
import { encounterActionUsed } from '../../../src/game/encounters'
import { money, percent } from '../../../src/game/format'
import { savingsProfileForGame } from '../../../src/game/savings'
import { businessOverview, depositPreview, purchasePreview, stockQuote } from '../../../src/game/selectors'
import type { Asset, CustomerPreferenceId, GameState, RebalanceAction, Term } from '../../../src/game/types'
import { MoneyInput } from '../../../src/components/MoneyInput'

interface MobileTradingPanelProps {
  game: GameState
  onTransaction: (action: RebalanceAction) => boolean | void
  onSkip?: () => void
  compact?: boolean
}

export function MobileTradingPanel({ game, onTransaction, onSkip }: MobileTradingPanelProps) {
  const tile = game.eventId as Asset | 'bank'
  const [amount, setAmount] = useState(
    tile === 'bonds' ? ECONOMY.bondTicket : tile === 'gold' ? ECONOMY.goldTicket : ECONOMY.stockTicket
  )
  const [symbolId, setSymbolId] = useState(game.market.stocks[0].id)
  const [term, setTerm] = useState<Term>(1)
  const preference = currentCustomerPreference(game)
  const [selectedPreference, setSelectedPreference] = useState<CustomerPreferenceId>(preference.id)

  const submitLock = useRef(false)
  const submit = (action: RebalanceAction) => {
    if (submitLock.current) return
    submitLock.current = true
    try {
      if (onTransaction(action) === false) {
        submitLock.current = false
      }
    } catch (error) {
      submitLock.current = false
      throw error
    }
  }

  const rates = savingsProfileForGame(game).rates
  const quote = stockQuote(game, symbolId)
  const deposit = depositPreview(game, amount, term)
  const purchase = purchasePreview(game, amount)

  // Transaction feedback
  const last = game.log.at(-1)
  const feedback: ReactNode =
    last?.kind === 'rebalancing' && last.turn === game.turn ? (
      <div className="mobile-trade-feedback" role="status">
        <span>✅ Đã thực hiện: {last.decision}</span>
      </div>
    ) : null

  // 1. BUSINESS TILE
  if (tile === 'business') {
    const config = ECONOMY.business
    const view = businessOverview(game, selectedPreference)
    const owned = view.locked > 0
    const selection = CUSTOMER_PREFERENCES.find(p => p.id === selectedPreference)!
    const upgradeReason = encounterActionUsed(game, 'upgrade')
      ? 'Đã nâng cấp tại ô này. Hãy gặp lại ở vòng sau.'
      : !businessUpgradeUnlocked(game)
      ? 'Chỉ có thể nâng cấp từ lượt sau khi mua.'
      : view.levels >= config.maxUpgrades
      ? `Đã đạt tối đa ${config.maxUpgrades} tầng.`
      : game.portfolio.cash < config.upgradeCost
      ? 'Chưa đủ tiền mặt để nâng cấp.'
      : ''

    return (
      <section className="mobile-trading-panel">
        {feedback}
        {!owned ? (
          <div className="trade-card">
            <div className="trade-card-header">
              <span className="trade-badge">Cơ Hội Khởi Nghiệp</span>
              <h4>Mở Quán Kinh Doanh</h4>
            </div>

            <div className="trade-stat-row">
              <div className="stat-item">
                <span className="lbl">Vốn mở quán</span>
                <strong className="val text-accent">{money(config.cost)}</strong>
              </div>
              <div className="stat-item">
                <span className="lbl">Thu nhập / START</span>
                <strong className="val text-success">+{money(config.baseIncome)}</strong>
              </div>
            </div>

            <p className="trade-hint">
              Nhận tiền lời tự động mỗi khi qua ô START. Có thể nâng cấp để tăng thêm doanh thu.
            </p>

            <button
              className="button primary full-button"
              disabled={game.portfolio.cash < config.cost}
              onClick={() => submit({ kind: 'buy', asset: 'business', amount: config.cost })}
            >
              Đầu tư mở quán ({money(config.cost)})
            </button>
            {game.portfolio.cash < config.cost && (
              <p className="trade-error">Cần thêm {money(config.cost - game.portfolio.cash)} để mở quán.</p>
            )}
          </div>
        ) : (
          <div className="trade-card">
            <div className="trade-card-header">
              <span className="trade-badge">Quán Đang Vận Hành</span>
              <h4>Cửa Hàng Của Bạn</h4>
            </div>

            <div className="trade-stat-row">
              <div className="stat-item">
                <span className="lbl">Thu nhập mỗi START</span>
                <strong className="val text-success">+{money(view.income)}</strong>
              </div>
              <div className="stat-item">
                <span className="lbl">Giá trị thanh lý</span>
                <strong className="val">{money(view.sale)}</strong>
              </div>
            </div>

            <div className="trend-banner">
              <span className="trend-lbl">Khách hàng vòng {game.lap} chuộng:</span>
              <strong className="trend-val">🌟 {preference.label}</strong>
            </div>

            <fieldset className="mobile-specializations">
              <legend>Nâng cấp theo sở thích ({view.levels}/{config.maxUpgrades} tầng):</legend>
              <div className="spec-grid">
                {CUSTOMER_PREFERENCES.map(p => (
                  <label
                    key={p.id}
                    className={`spec-pill ${selectedPreference === p.id ? 'active' : ''}`}
                    onClick={() => setSelectedPreference(p.id)}
                  >
                    <input
                      type="radio"
                      name="mobile-preference"
                      value={p.id}
                      checked={selectedPreference === p.id}
                      onChange={() => setSelectedPreference(p.id)}
                    />
                    <div className="spec-info">
                      <strong>{p.label}</strong>
                      <small>+{money(config.baseUplift)}/START {p.id === preference.id ? '🔥 Hot' : ''}</small>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>

            {upgradeReason && <p className="trade-error">{upgradeReason}</p>}

            <div className="trade-btn-stack">
              <button
                className="button primary full-button"
                disabled={!!upgradeReason}
                onClick={() =>
                  submit({
                    kind: 'upgrade',
                    asset: 'business',
                    amount: config.upgradeCost,
                    customerPreferenceId: selectedPreference,
                  })
                }
              >
                Nâng cấp {selection.label} ({money(config.upgradeCost)})
              </button>
              <button
                className="button secondary full-button"
                onClick={() => submit({ kind: 'sell', asset: 'business', amount: game.portfolio.business })}
              >
                Bán quán nhận {money(view.sale)}
              </button>
            </div>
          </div>
        )}

        <details className="trade-details-clean">
          <summary>ℹ️ Chi tiết & rủi ro</summary>
          <p>
            Cơ sở kinh doanh tạo dòng tiền thụ động mỗi vòng. Giá trị thanh lý có khấu hao theo vòng và chịu ảnh hưởng của xu hướng thị trường. Chỉ được nâng cấp 1 lần mỗi lần ghé ô.
          </p>
        </details>

        {onSkip && (
          <button className="button secondary full-button mt-2" onClick={onSkip}>
            Hoàn tất / Rời đi
          </button>
        )}
      </section>
    )
  }

  // 2. STOCKS TILE
  if (tile === 'stocks') {
    return (
      <section className="mobile-trading-panel">
        {feedback}
        <div className="trade-card">
          <label htmlFor="mobile-trade-symbol" className="trade-label">
            Chọn mã cổ phiếu:
          </label>
          <select
            id="mobile-trade-symbol"
            className="mobile-select"
            value={symbolId}
            onChange={e => setSymbolId(e.target.value)}
          >
            {game.market.stocks.map(s => (
              <option key={s.id} value={s.id}>
                {s.id} · {s.name} ({SECTORS[s.sector]})
              </option>
            ))}
          </select>

          <div className="trade-stat-row">
            <div className="stat-item">
              <span className="lbl">Giá hiện tại</span>
              <strong className="val">{money(quote.stock.currentPrice)}</strong>
            </div>
            <div className="stat-item">
              <span className="lbl">Biến động</span>
              <strong className={`val ${quote.recent.returnRate >= 0 ? 'text-success' : 'text-danger'}`}>
                {percent(quote.recent.returnRate)}
              </strong>
            </div>
            <div className="stat-item">
              <span className="lbl">Đang giữ</span>
              <strong className="val">{quote.units.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} cp</strong>
            </div>
          </div>

          <label htmlFor="mobile-trade-amount" className="trade-label">
            Số tiền giao dịch:
          </label>
          <MoneyInput id="mobile-trade-amount" amount={amount} onChange={setAmount} invalid={!purchase.valid} />

          <div className="quick-amount-tags">
            {[5_000_000, 10_000_000, 20_000_000].map(val => (
              <button
                key={val}
                type="button"
                className={`tag-btn ${amount === val ? 'selected' : ''}`}
                onClick={() => setAmount(val)}
              >
                {money(val)}
              </button>
            ))}
            <button
              type="button"
              className="tag-btn"
              onClick={() => setAmount(game.portfolio.cash)}
            >
              Tất cả
            </button>
          </div>

          <div className="trade-btn-stack">
            <button
              className="button primary full-button"
              disabled={!purchase.valid}
              onClick={() => submit({ kind: 'buy', asset: 'stocks', amount, symbolId })}
            >
              Mua cổ phiếu {quote.stock.id}
            </button>
            {quote.units > 0 && (
              <button
                className="button secondary full-button"
                onClick={() => submit({ kind: 'sell', asset: 'stocks', amount: game.portfolio.stocks, symbolId })}
              >
                Bán toàn bộ {quote.stock.id} ({money(game.portfolio.stocks)})
              </button>
            )}
          </div>
        </div>

        <details className="trade-details-clean">
          <summary>ℹ️ Thông tin thị trường cổ phiếu</summary>
          <p>
            Cổ phiếu biến động theo kịch bản thị trường mỗi vòng. Phí giao dịch {ECONOMY.tradeFees.stocks * 100}%. Bạn có thể lướt sóng chốt lời tại ô START hoặc phiên tái cơ cấu.
          </p>
        </details>

        {onSkip && (
          <button className="button secondary full-button mt-2" onClick={onSkip}>
            Bỏ qua / Tiếp tục
          </button>
        )}
      </section>
    )
  }

  // 3. BANK SAVINGS TILE
  if (tile === 'bank') {
    return (
      <section className="mobile-trading-panel">
        {feedback}
        <div className="trade-card">
          <div className="trade-card-header">
            <span className="trade-badge">Tiết Kiệm Sinh Lời</span>
            <h4>Mở Sổ Tiết Kiệm Mới</h4>
          </div>

          <label htmlFor="mobile-deposit-term" className="trade-label">
            Chọn kỳ hạn gửi:
          </label>
          <div className="term-selector">
            {([1, 2, 3] as Term[]).map(val => (
              <button
                key={val}
                type="button"
                className={`term-btn ${term === val ? 'active' : ''}`}
                onClick={() => setTerm(val)}
              >
                <span className="term-name">{val} Vòng</span>
                <strong className="term-rate">{Math.round(rates[val] * 100)}%/vòng</strong>
              </button>
            ))}
          </div>

          <label htmlFor="mobile-deposit-amount" className="trade-label">
            Số tiền gửi tiết kiệm:
          </label>
          <MoneyInput id="mobile-deposit-amount" amount={amount} onChange={setAmount} invalid={!purchase.valid} />

          <div className="trade-preview-box">
            <div className="preview-row">
              <span>Đáo hạn tại:</span>
              <strong>START Vòng {deposit.maturityLap}</strong>
            </div>
            <div className="preview-row">
              <span>Lãi dự kiến nhận:</span>
              <strong className="text-success">+{money(deposit.interest)}</strong>
            </div>
          </div>

          <button
            className="button primary full-button"
            disabled={!purchase.valid}
            onClick={() => submit({ kind: 'deposit', amount, term })}
          >
            Gửi tiết kiệm ({money(amount)})
          </button>
        </div>

        <details className="trade-details-clean">
          <summary>ℹ️ Quy tắc tiền gửi</summary>
          <p>
            Mỗi lần ghé ngân hàng sẽ mở một sổ tiết kiệm độc lập. Tiền gốc và lãi sẽ tự động trả về tiền mặt khi bạn bước qua ô START của vòng đáo hạn. Rút trước hạn chỉ dùng khi thiếu tiền bắt buộc và sẽ mất phần lãi.
          </p>
        </details>

        {onSkip && (
          <button className="button secondary full-button mt-2" onClick={onSkip}>
            Bỏ qua / Tiếp tục
          </button>
        )}
      </section>
    )
  }

  // 4. BONDS OR GOLD
  const isBonds = tile === 'bonds'
  return (
    <section className="mobile-trading-panel">
      {feedback}
      <div className="trade-card">
        <div className="trade-card-header">
          <span className="trade-badge">{isBonds ? 'Tài Sản An Toàn' : 'Kim Loại Quý'}</span>
          <h4>{isBonds ? 'Trái Phiếu Doanh Nghiệp' : 'Giao Dịch Vàng'}</h4>
        </div>

        <div className="trade-stat-row">
          <div className="stat-item">
            <span className="lbl">{isBonds ? 'Mệnh giá vé' : 'Đơn vị mua'}</span>
            <strong className="val">{money(amount)}</strong>
          </div>
          <div className="stat-item">
            <span className="lbl">Đang nắm giữ</span>
            <strong className="val">{money(game.portfolio[tile])}</strong>
          </div>
        </div>

        <label htmlFor="mobile-fixed-amount" className="trade-label">
          Số tiền đầu tư:
        </label>
        <MoneyInput id="mobile-fixed-amount" amount={amount} onChange={setAmount} invalid={!purchase.valid} />

        <div className="trade-btn-stack">
          <button
            className="button primary full-button"
            disabled={!purchase.valid}
            onClick={() => submit({ kind: 'buy', asset: tile, amount })}
          >
            Mua {isBonds ? 'trái phiếu' : 'vàng'} ({money(amount)})
          </button>
          {game.portfolio[tile] > 0 && (
            <button
              className="button secondary full-button"
              onClick={() => submit({ kind: 'sell', asset: tile, amount: game.portfolio[tile] })}
            >
              Bán toàn bộ {isBonds ? 'trái phiếu' : 'vàng'} ({money(game.portfolio[tile])})
            </button>
          )}
        </div>
      </div>

      <details className="trade-details-clean">
        <summary>ℹ️ Thông tin tài sản</summary>
        <p>
          {isBonds
            ? 'Trái phiếu mang lại thu nhập ổn định và phòng ngừa rủi ro biến động giá cổ phiếu.'
            : 'Vàng là tài sản trú ẩn an toàn, thanh khoản cao, giúp bảo toàn vốn trong các giai đoạn lạm phát.'}
        </p>
      </details>

      {onSkip && (
        <button className="button secondary full-button mt-2" onClick={onSkip}>
          Bỏ qua / Tiếp tục
        </button>
      )}
    </section>
  )
}
