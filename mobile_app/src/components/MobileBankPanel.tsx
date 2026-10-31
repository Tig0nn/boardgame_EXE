import React, { useState, useRef } from 'react'
import type { GameState, RebalanceAction, Term } from '../../../src/game/types'
import { money } from '../../../src/game/format'
import { depositPreview, purchasePreview } from '../../../src/game/selectors'
import { savingsProfileForGame } from '../../../src/game/savings'
import { investmentLotLabel, maturityLabel } from '../../../src/components/player-language'
import { sound } from '../utils/audio'

interface MobileBankPanelProps {
  game: GameState
  onTransaction: (action: RebalanceAction) => boolean | void
  onSkip: () => void
}

export const MobileBankPanel: React.FC<MobileBankPanelProps> = ({
  game,
  onTransaction,
  onSkip,
}) => {
  const [term, setTerm] = useState<Term>(1)
  const defaultAmount = Math.min(10_000_000, game.portfolio.cash)
  const [amount, setAmount] = useState<number>(defaultAmount > 0 ? defaultAmount : 1_000_000)
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)

  const rates = savingsProfileForGame(game).rates
  const preview = purchasePreview(game, amount)
  const depositInfo = depositPreview(game, amount, term)

  const isTraded = game.log.some(
    (e) => e.turn === game.turn && e.kind === 'rebalancing' && e.decisionId?.startsWith('deposit-')
  )
  const activeLots = game.deposits.filter((l) => l.status === 'active')

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    const val = raw ? parseInt(raw, 10) : 0
    setAmount(val)
  }

  const handleSubmit = () => {
    if (submitLock.current || !preview.valid) return
    submitLock.current = true
    setSubmitting(true)
    sound.playCoin()
    try {
      const result = onTransaction({
        kind: 'deposit',
        amount,
        term,
      })
      if (result === false) {
        submitLock.current = false
        setSubmitting(false)
      }
    } catch (err) {
      submitLock.current = false
      setSubmitting(false)
      throw err
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%',
        boxSizing: 'border-box',
        fontFamily: "'Fredoka', sans-serif",
      }}
    >
      {/* 1. HIGHLIGHT BOX: Tiền mặt hiện có (Trang nhã, không dính chữ) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(254, 243, 199, 0.65)',
          border: '1.5px dashed #F59E0B',
          borderRadius: '16px',
          padding: '10px 14px',
          boxSizing: 'border-box',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: '#92400E',
            letterSpacing: '0.3px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <img
            src="/assets/money-icon.png"
            alt=""
            style={{
              width: '18px',
              height: '18px',
              objectFit: 'contain',
              filter: 'sepia(1) saturate(3.5) hue-rotate(335deg) brightness(1.05)',
            }}
          />
          <span>Tiền mặt hiện có:</span>
        </span>
        <strong
          style={{
            fontSize: '15px',
            fontWeight: 900,
            color: '#78350F',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {money(game.portfolio.cash)}
        </strong>
      </div>

      {/* Thông báo kết quả giao dịch nếu vừa gửi xong */}
      {isTraded && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '16px',
            background: 'rgba(209, 250, 229, 0.85)',
            border: '1.5px solid #34D399',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 900, color: '#065F46' }}>
            ✓ Đã gửi tiết kiệm thành công!
          </div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#047857', marginTop: '2px' }}>
            Tiền gốc và lãi sẽ được tất toán khi đến hạn qua ô Xuất phát.
          </div>
        </div>
      )}

      {/* 2. KỲ HẠN GỬI TIẾT KIỆM (3 Dòng độc lập rõ ràng) */}
      <div
        style={{
          borderRadius: '18px',
          background: 'rgba(236, 253, 245, 0.45)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 900,
            color: '#1e293b',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Kỳ hạn gửi tiết kiệm
        </div>

        {/* 3 Separate Rows Radio Selection Group */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {([1, 2, 3] as Term[]).map((val) => {
            const isSelected = term === val
            const ratePct = Math.round(rates[val] * 100)
            const totalPct = Math.round(rates[val] * val * 100)
            return (
              <label
                key={val}
                onClick={() => {
                  sound.playClick()
                  setTerm(val)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '14px',
                  background: isSelected ? 'rgba(254, 243, 199, 0.85)' : 'rgba(255, 255, 255, 0.8)',
                  border: isSelected ? '1.5px solid #F59E0B' : '1px solid rgba(226, 232, 240, 0.9)',
                  cursor: 'pointer',
                  boxShadow: isSelected
                    ? '0 2px 6px rgba(245, 158, 11, 0.2)'
                    : '0 1px 3px rgba(0, 0, 0, 0.04)',
                  boxSizing: 'border-box',
                  width: '100%',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="radio"
                  name="savings_term"
                  value={String(val)}
                  checked={isSelected}
                  onChange={() => setTerm(val)}
                  style={{
                    width: '18px',
                    height: '18px',
                    accentColor: '#059669',
                    flexShrink: 0,
                    cursor: 'pointer',
                    margin: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#1e293b',
                    lineHeight: 1.35,
                    display: 'block',
                  }}
                >
                  {val} kỳ • {ratePct}% mỗi kỳ • Tổng {totalPct}% cuối kỳ hạn
                </span>
              </label>
            )
          })}
        </div>

        {/* Lưu ý rút trước hạn */}
        <p
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#92400E',
            margin: '4px 0 0 0',
            lineHeight: 1.4,
          }}
        >
          Rút trước hạn để trả khoản bắt buộc: mất lãi chưa nhận.
        </p>

        {/* Accordion Cách Nhận Lãi */}
        <details style={{ marginTop: '2px', fontSize: '12px', color: '#64748b' }}>
          <summary
            style={{
              cursor: 'pointer',
              fontWeight: 800,
              color: '#059669',
              listStyle: 'none',
              userSelect: 'none',
            }}
          >
            ▶ Cách nhận lãi
          </summary>
          <div
            style={{
              padding: '8px 12px',
              marginTop: '6px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.92)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              fontSize: '11px',
              color: '#334155',
              lineHeight: 1.5,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <p style={{ margin: 0 }}>
              Khi hết kỳ hạn, bạn nhận lại tiền đã gửi và toàn bộ tiền lãi. Lãi chỉ tính trên số
              tiền gửi ban đầu.
            </p>
            <p style={{ margin: 0 }}>
              Nếu phải rút trước hạn để thanh toán khoản bắt buộc, bạn sẽ mất phần lãi chưa nhận. Rút
              toàn khoản; không tự tái tục.
            </p>
          </div>
        </details>
      </div>

      {!isTraded && (
        <>
          {/* 3. SỐ TIỀN GỬI */}
          <div
            style={{
              borderRadius: '18px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <label
                htmlFor="mobile-bank-amount"
                style={{
                  fontSize: '11px',
                  fontWeight: 900,
                  color: '#334155',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Số tiền gửi
              </label>
              {!preview.valid && amount > game.portfolio.cash && (
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#dc2626' }}>
                  Vượt quá tiền mặt!
                </span>
              )}
            </div>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="mobile-bank-amount"
                type="text"
                inputMode="numeric"
                value={amount > 0 ? amount.toLocaleString('vi-VN') : ''}
                placeholder="0"
                onChange={handleAmountChange}
                style={{
                  width: '100%',
                  fontSize: '16px',
                  fontWeight: 900,
                  color: '#1e293b',
                  background: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '12px',
                  padding: '8px 36px 8px 12px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: "'Fredoka', sans-serif",
                  fontVariantNumeric: 'tabular-nums',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  right: '12px',
                  fontSize: '14px',
                  fontWeight: 800,
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              >
                ₫
              </span>
            </div>

            {/* Quick Percentage Chips */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
              {[0.25, 0.5, 1].map((ratio) => {
                const targetVal = Math.floor((game.portfolio.cash * ratio) / 1000) * 1000
                return (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => {
                      sound.playClick()
                      setAmount(Math.max(1000, targetVal))
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      borderRadius: '10px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#475569',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    }}
                  >
                    {ratio === 1 ? 'Tối đa' : `${ratio * 100}%`}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 4. DỰ KIẾN KHI KHOẢN TIẾT KIỆM ĐẾN HẠN (Breakdown Ledger - Rõ ràng, không dính chữ) */}
          <div
            style={{
              borderRadius: '18px',
              background: 'rgba(236, 253, 245, 0.7)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
                color: '#475569',
              }}
            >
              <span>Tiền gửi ban đầu</span>
              <strong
                style={{
                  fontSize: '13.5px',
                  fontWeight: 800,
                  color: '#1e293b',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {money(amount)}
              </strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
                color: '#059669',
              }}
            >
              <span>Tổng tiền lãi</span>
              <strong
                style={{
                  fontSize: '13.5px',
                  fontWeight: 800,
                  color: '#059669',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                +{money(depositInfo.interest)}
              </strong>
            </div>
            <div
              style={{
                borderTop: '1px solid rgba(16, 185, 129, 0.25)',
                paddingTop: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
                fontWeight: 900,
                color: '#0f172a',
              }}
            >
              <span>Tổng nhận khi đến hạn</span>
              <strong
                style={{
                  fontSize: '14.5px',
                  fontWeight: 900,
                  color: '#047857',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {money(amount + depositInfo.interest)}
              </strong>
            </div>

            {preview.valid && (
              <div
                style={{
                  borderTop: '1px dashed rgba(16, 185, 129, 0.2)',
                  paddingTop: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11.5px',
                  color: '#64748b',
                }}
              >
                <span>Tiền mặt sau giao dịch</span>
                <strong
                  style={{
                    fontSize: '13px',
                    fontWeight: 800,
                    color: '#334155',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {money(preview.cashAfter ?? 0)}
                </strong>
              </div>
            )}
          </div>

          {/* 5. NÚT HÀNH ĐỘNG GỬI TIẾT KIỆM (3D Gamified Button) */}
          <button
            type="button"
            disabled={!preview.valid || submitting}
            onClick={handleSubmit}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '16px',
              fontSize: '14px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
              color: '#ffffff',
              border: 'none',
              cursor: !preview.valid || submitting ? 'not-allowed' : 'pointer',
              background:
                !preview.valid || submitting
                  ? '#cbd5e1'
                  : 'linear-gradient(180deg, #FBBF24 0%, #F97316 50%, #EA580C 100%)',
              boxShadow:
                !preview.valid || submitting
                  ? 'none'
                  : '0 4px 0 #9a3412, 0 6px 14px rgba(234, 88, 12, 0.35)',
              transition: 'transform 0.1s ease, filter 0.1s ease',
              fontFamily: "'Fredoka', sans-serif",
            }}
            onPointerDown={(e) => {
              if (preview.valid && !submitting) {
                e.currentTarget.style.transform = 'translateY(2px)'
                e.currentTarget.style.boxShadow = '0 2px 0 #9a3412'
              }
            }}
            onPointerUp={(e) => {
              if (preview.valid && !submitting) {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow =
                  '0 4px 0 #9a3412, 0 6px 14px rgba(234, 88, 12, 0.35)'
              }
            }}
          >
            Gửi tiết kiệm {preview.valid ? money(amount) : ''} →
          </button>
        </>
      )}

      {/* Nút Tiếp tục / Bỏ qua */}
      <button
        type="button"
        onClick={() => {
          sound.playClick()
          onSkip()
        }}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: '14px',
          fontSize: '13px',
          fontWeight: 800,
          color: isTraded ? '#ffffff' : '#64748b',
          background: isTraded
            ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)'
            : 'transparent',
          border: isTraded ? 'none' : '1px solid rgba(148, 163, 184, 0.35)',
          cursor: 'pointer',
          boxShadow: isTraded ? '0 3px 0 #047857' : 'none',
          transition: 'all 0.12s ease',
          fontFamily: "'Fredoka', sans-serif",
        }}
      >
        {isTraded ? 'Hoàn tất · Về bàn chơi →' : 'Bỏ qua cơ hội'}
      </button>

      {/* 6. CÁC KHOẢN GỬI ĐANG HOẠT ĐỘNG (NẾU CÓ) */}
      {activeLots.length > 0 && (
        <details style={{ marginTop: '2px', fontSize: '12px', color: '#64748b' }}>
          <summary
            style={{
              cursor: 'pointer',
              fontWeight: 800,
              color: '#475569',
              listStyle: 'none',
              userSelect: 'none',
            }}
          >
            Các khoản gửi đang hoạt động ({activeLots.length})
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
            {activeLots.map((lot) => (
              <div
                key={lot.id}
                style={{
                  padding: '8px 12px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11.5px',
                }}
              >
                <span style={{ fontWeight: 700, color: '#334155' }}>
                  {investmentLotLabel('savings', lot.id)}
                </span>
                <span style={{ fontWeight: 800, color: '#475569' }}>
                  {money(lot.principal)} • {maturityLabel(lot.maturityLap)}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
