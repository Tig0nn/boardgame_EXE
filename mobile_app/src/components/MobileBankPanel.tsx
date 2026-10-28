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
    <div className="flex flex-col gap-2.5 w-full">
      {/* 1. HIGHLIGHT BOX: Tiền mặt hiện có (Warm yellow dashed border, soft organic UI) */}
      <div className="flex justify-between items-center rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-2.5 px-3">
        <span className="text-xs font-bold text-amber-800">Tiền mặt hiện có:</span>
        <strong className="text-sm font-black text-amber-900">{money(game.portfolio.cash)}</strong>
      </div>

      {/* Thông báo kết quả giao dịch nếu vừa gửi xong */}
      {isTraded && (
        <div className="p-2.5 rounded-2xl bg-emerald-100/70 border border-emerald-300 text-center">
          <div className="text-xs font-extrabold text-emerald-800">
            ✓ Đã gửi tiết kiệm thành công!
          </div>
          <div className="text-[11px] text-emerald-700 mt-0.5">
            Tiền gốc và lãi sẽ được tất toán khi đến hạn.
          </div>
        </div>
      )}

      {/* 2. KỲ HẠN GỬI TIẾT KIỆM (3 Distinct Rows Vertical Layout) */}
      <div className="rounded-2xl bg-emerald-50/40 border border-emerald-100/80 p-3">
        <div className="text-xs font-black text-slate-800 mb-2 uppercase tracking-wide">
          Kỳ hạn gửi tiết kiệm
        </div>

        {/* 3 Separate Rows Radio Selection Group - Mandatory Structured Layout */}
        <div
          className="flex flex-col space-y-3 my-2"
          style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '8px 0' }}
        >
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
                className={`flex items-start space-x-3 p-3 rounded-2xl bg-amber-50/60 border border-amber-200 cursor-pointer hover:bg-amber-100/70 transition-all shadow-sm ${
                  isSelected ? 'border-amber-400 bg-amber-100/80 shadow' : ''
                }`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '16px',
                  background: isSelected ? 'rgba(254, 243, 199, 0.85)' : 'rgba(254, 243, 199, 0.45)',
                  border: isSelected ? '1.5px solid #f59e0b' : '1px solid #fde68a',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
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
                  className="mt-1 w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer flex-shrink-0"
                  style={{
                    marginTop: '2px',
                    width: '16px',
                    height: '16px',
                    accentColor: '#059669',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                />
                <span
                  className="text-sm font-bold text-slate-800 leading-snug"
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
        <p className="text-[11px] font-semibold text-amber-800 mt-2">
          Rút trước hạn để trả khoản bắt buộc: mất lãi chưa nhận.
        </p>

        {/* Accordion Cách Nhận Lãi */}
        <details className="mt-1.5 text-xs text-slate-500">
          <summary className="cursor-pointer font-bold text-emerald-700 hover:text-emerald-800 transition-colors">
            ▶ Cách nhận lãi
          </summary>
          <div className="p-2.5 mt-1.5 rounded-xl bg-white/90 border border-emerald-100/70 text-[11px] text-slate-600 leading-relaxed space-y-1">
            <p>
              Khi hết kỳ hạn, bạn nhận lại tiền đã gửi và toàn bộ tiền lãi. Lãi chỉ tính trên số
              tiền gửi ban đầu.
            </p>
            <p>
              Nếu phải rút trước hạn để thanh toán khoản bắt buộc, bạn sẽ mất phần lãi chưa nhận. Rút
              toàn khoản; không tự tái tục.
            </p>
          </div>
        </details>
      </div>

      {!isTraded && (
        <>
          {/* 3. SỐ TIỀN GỬI (Soft Organic Input Container) */}
          <div className="rounded-2xl bg-slate-50/80 border border-slate-200/80 p-3 space-y-2">
            <div className="flex justify-between items-center">
              <label
                htmlFor="mobile-bank-amount"
                className="text-xs font-black text-slate-700 uppercase tracking-wide"
              >
                Số tiền gửi
              </label>
              {!preview.valid && amount > game.portfolio.cash && (
                <span className="text-[11px] font-bold text-rose-600">Vượt quá tiền mặt!</span>
              )}
            </div>

            <div className="relative flex items-center">
              <input
                id="mobile-bank-amount"
                type="text"
                inputMode="numeric"
                value={amount > 0 ? amount.toLocaleString('vi-VN') : ''}
                placeholder="0"
                onChange={handleAmountChange}
                className="w-full text-base font-black text-slate-800 bg-white border border-slate-200 rounded-xl px-3 py-2 pr-8 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none transition-all"
              />
              <span className="absolute right-3 text-sm font-bold text-slate-400 pointer-events-none">
                ₫
              </span>
            </div>

            {/* Quick Percentage Chips */}
            <div className="flex gap-1.5 pt-0.5">
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
                    className="flex-1 py-1 px-2 text-[11px] font-bold rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-colors"
                  >
                    {ratio === 1 ? 'Tối đa' : `${ratio * 100}%`}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 4. DỰ KIẾN KHI KHOẢN TIẾT KIỆM ĐẾN HẠN (Soft Organic Card) */}
          <div className="rounded-2xl bg-emerald-50/50 border border-emerald-200/60 p-3 space-y-2">
            <div className="flex justify-between items-center text-xs font-medium text-slate-600">
              <span>Tiền gửi ban đầu</span>
              <strong className="text-sm font-bold text-slate-800">{money(amount)}</strong>
            </div>
            <div className="flex justify-between items-center text-xs font-medium text-emerald-700">
              <span>Tổng tiền lãi</span>
              <strong className="text-sm font-bold text-emerald-600">
                +{money(depositInfo.interest)}
              </strong>
            </div>
            <div className="border-t border-emerald-200/60 pt-2 flex justify-between items-center text-xs font-extrabold text-slate-900">
              <span>Tổng nhận khi đến hạn</span>
              <strong className="text-sm font-black text-emerald-700">
                {money(amount + depositInfo.interest)}
              </strong>
            </div>

            {preview.valid && (
              <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-dashed border-emerald-100">
                <span>Tiền mặt sau giao dịch:</span>
                <span className="font-semibold text-slate-700">
                  {money(preview.cashAfter ?? 0)}
                </span>
              </div>
            )}
          </div>

          {/* 5. NÚT HÀNH ĐỘNG GỬI TIẾT KIỆM (3D Orange Button) */}
          <button
            type="button"
            disabled={!preview.valid || submitting}
            onClick={handleSubmit}
            className={`w-full py-2.5 px-4 rounded-xl text-sm font-black uppercase tracking-wide text-white transition-all ${
              !preview.valid
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-b from-amber-400 via-orange-500 to-orange-600 shadow-[0_3.5px_0_#9a3412,0_5px_12px_rgba(234,88,12,0.35)] active:translate-y-0.5 active:shadow-[0_1.5px_0_#9a3412] cursor-pointer'
            }`}
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
        className={`w-full py-2 text-xs font-bold transition-colors ${
          isTraded
            ? 'py-2.5 px-4 rounded-xl text-sm font-black uppercase tracking-wide text-white bg-gradient-to-b from-amber-400 via-orange-500 to-orange-600 shadow-[0_3.5px_0_#9a3412,0_5px_12px_rgba(234,88,12,0.35)] cursor-pointer'
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        {isTraded ? 'Hoàn tất · Về bàn chơi →' : 'Bỏ qua cơ hội'}
      </button>

      {/* 6. CÁC KHOẢN GỬI ĐANG HOẠT ĐỘNG (NẾU CÓ) */}
      {activeLots.length > 0 && (
        <details className="mt-1 text-xs text-slate-500">
          <summary className="cursor-pointer font-bold text-slate-600 hover:underline">
            Các khoản gửi đang hoạt động ({activeLots.length})
          </summary>
          <div className="space-y-1.5 mt-2">
            {activeLots.map((lot) => (
              <div
                key={lot.id}
                className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex justify-between items-center text-[11px]"
              >
                <span className="font-semibold text-slate-700">
                  {investmentLotLabel('savings', lot.id)}
                </span>
                <span className="text-slate-600 font-bold">
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
