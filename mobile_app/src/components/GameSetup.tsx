import { useState } from 'react'
import { Modal } from '../../../src/components/Modal'
import { MoneyInput } from '../../../src/components/MoneyInput'
import { money } from '../../../src/game/format'
import { RULES } from '../../../src/data/config'
import { savingsProfileForMode } from '../../../src/game/savings'
import type { Term } from '../../../src/game/types'

export function GameSetup({
  onStart,
  onOpenRulebook,
}: {
  onStart: (seed: string, savings: number, term: Term) => void
  onOpenRulebook?: () => void
}) {
  const [savings, setSavings] = useState(20_000_000)
  const [term, setTerm] = useState<Term>(1)
  const [seed, setSeed] = useState('')
  const valid = Number.isSafeInteger(savings) && savings >= 0 && savings <= RULES.startingCapital
  const rates = savingsProfileForMode('experimental-b').rates
  const cashRemaining = valid ? RULES.startingCapital - savings : 0

  return (
    <Modal title="Bắt đầu hành trình">
      <div className="setup-hero-banner">
        <span className="setup-badge">Hành Trình Tài Chính · 4 Vòng</span>
        <h2 className="setup-title">Xoay Vòng Tiến Lui</h2>
      </div>

      <div className="setup-goal-card">
        <div className="goal-col">
          <span className="goal-lbl">Vốn Khởi Đầu</span>
          <strong className="goal-val text-accent">{money(RULES.startingCapital)}</strong>
        </div>
        <div className="goal-divider">➔</div>
        <div className="goal-col">
          <span className="goal-lbl">Mục Tiêu Đạt</span>
          <strong className="goal-val text-success">{money(RULES.goal + RULES.cashGoal)}</strong>
        </div>
      </div>

      <div className="setup-field-group">
        <label htmlFor="initial-savings" className="setup-field-label">
          Phân bổ Tiền Gửi Tiết Kiệm Ban Đầu:
        </label>
        <MoneyInput id="initial-savings" amount={savings} onChange={setSavings} invalid={!valid} />

        <div className="setup-preset-chips">
          {[10_000_000, 20_000_000, 30_000_000].map(amt => (
            <button
              key={amt}
              type="button"
              className={`preset-chip ${savings === amt ? 'active' : ''}`}
              onClick={() => setSavings(amt)}
            >
              {money(amt)}
            </button>
          ))}
        </div>
      </div>

      <div className="setup-field-group">
        <label className="setup-field-label">Kỳ hạn gửi tiết kiệm ban đầu:</label>
        <div className="setup-term-grid">
          {([1, 2, 3] as Term[]).map(val => (
            <button
              key={val}
              type="button"
              className={`setup-term-card ${term === val ? 'selected' : ''}`}
              onClick={() => setTerm(val)}
            >
              <span className="term-num">{val} Vòng</span>
              <strong className="term-pct">{Math.round(rates[val] * 100)}%/vòng</strong>
            </button>
          ))}
        </div>
      </div>

      <div className="setup-balance-summary">
        <div className="summary-row">
          <span>Tiền mặt cầm tay khi xuất phát:</span>
          <strong className="text-primary">{valid ? money(cashRemaining) : 'Không hợp lệ'}</strong>
        </div>
        <div className="summary-row">
          <span>Tiết kiệm sinh lãi ban đầu:</span>
          <strong>{valid ? money(savings) : '0 đ'}</strong>
        </div>
      </div>

      <button
        className="button primary full-button setup-start-btn"
        disabled={!valid}
        onClick={() => onStart(seed, savings, term)}
      >
        Bắt đầu hành trình
      </button>

      {onOpenRulebook && (
        <button
          type="button"
          className="button secondary full-button"
          onClick={onOpenRulebook}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <span>📖</span> Sổ tay luật chơi
        </button>
      )}

      <details className="setup-advanced-toggle">
        <summary>Tùy chọn kiểm thử</summary>
        <div className="setup-seed-box">
          <label htmlFor="mobile-seed">Seed cố định</label>
          <input
            id="mobile-seed"
            className="text-input"
            value={seed}
            placeholder="Để trống: ván ngẫu nhiên mới"
            maxLength={128}
            onChange={e => setSeed(e.target.value)}
          />
        </div>
      </details>
    </Modal>
  )
}
