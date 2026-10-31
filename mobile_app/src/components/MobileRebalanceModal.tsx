import React, { useState } from 'react'
import type { GameState, RebalanceAction, TradableAsset } from '../../../src/game/types'
import { ASSETS, RULES } from '../../../src/data/config'
import { saleQuote } from '../../../src/game/selectors'
import { money } from '../../../src/game/format'
import { creditBondLots, hasBondCredit } from '../../../src/game/bond-credit'
import { bondIssuer } from '../../../src/data/bond-issuers'
import { investmentLotLabel } from '../../../src/components/player-language'
import { localizeNarrative } from '../../../src/components/glossary'
import { GamifiedModal } from './GamifiedModal'

interface MobileRebalanceModalProps {
  game: GameState
  onTransaction: (action: RebalanceAction) => void
  onContinue: () => void
  onHelp?: () => void
  compact?: boolean
}

export const MobileRebalanceModal: React.FC<MobileRebalanceModalProps> = ({
  game,
  onTransaction,
  onContinue,
  onHelp,
}) => {
  const [asset, setAsset] = useState<TradableAsset>('stocks')
  const [amount, setAmount] = useState<number>(game.portfolio.stocks)

  const lots = hasBondCredit(game)
    ? creditBondLots(game).filter((item) => item.quote.executable)
    : []
  const [lotId, setLotId] = useState<string>(lots[0]?.lot.id ?? '')
  const lot = lots.find((item) => item.lot.id === lotId) ?? lots[0]

  const creditSale = asset === 'bonds' && hasBondCredit(game)
  const available = creditSale ? lot?.quote.gross ?? 0 : game.portfolio[asset]
  const valid = Number.isSafeInteger(amount) && amount > 0 && amount <= available
  const quote = saleQuote(game, asset, valid ? amount : 0, creditSale ? lot?.lot.id : undefined)

  const debtRate = game.lap === game.totalLaps ? 0 : RULES.debtRate
  const repayable = Math.min(game.portfolio.debt, Math.floor(game.portfolio.cash / (1 + debtRate)))

  const handleSelectAsset = (next: TradableAsset) => {
    setAsset(next)
    if (next === 'bonds' && hasBondCredit(game)) {
      setAmount(lot?.quote.gross ?? 0)
    } else {
      setAmount(game.portfolio[next])
    }
  }

  const setPercentAmount = (pct: number) => {
    if (available <= 0) return
    if (pct >= 100) {
      setAmount(available)
      return
    }
    const calculated = Math.floor((available * (pct / 100)) / 1000) * 1000
    setAmount(Math.max(1000, Math.min(available, calculated)))
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, '')
    const num = rawVal ? Math.min(available, Number(rawVal)) : 0
    setAmount(num)
  }

  const lastLog = game.log.at(-1)
  const isLastRebalance = lastLog?.kind === 'rebalancing'

  return (
    <GamifiedModal
      badgeText={`VÒNG ${game.lap} / ${game.totalLaps} · TÁI CÂN BẰNG`}
      title="Ghé ví tại ô Xuất phát"
      titleIcon="/assets/wallet.png"
      onHelp={onHelp}
      primaryAction={{
        label: game.lap === game.totalLaps ? 'Xem kết quả hành trình →' : 'Bắt đầu vòng mới →',
        onClick: onContinue,
      }}
    >
      {/* Thông điệp hướng dẫn ngắn gọn */}
      <div
        style={{
          background: '#FEF9C3',
          border: '1px dashed #F59E0B',
          borderRadius: '12px',
          padding: '6px 8px',
          fontSize: '11px',
          color: '#92400E',
          lineHeight: '1.3',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <img
          src="/assets/warning.png"
          alt=""
          style={{ width: '16px', height: '16px', objectFit: 'contain', flexShrink: 0 }}
        />
        <span>
          <strong>Bán tài sản:</strong> Tùy chọn chuyển Cổ phiếu, Trái phiếu hoặc Vàng lấy tiền mặt.
        </span>
      </div>

      {/* Thông báo kết quả giao dịch vừa thực hiện (nếu có) */}
      {isLastRebalance && lastLog?.consequence && (
        <div
          style={{
            background: '#DCFCE7',
            border: '1.5px solid #22C55E',
            borderRadius: '12px',
            padding: '6px 8px',
            fontSize: '11px',
            color: '#15803D',
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          ✓ {localizeNarrative(lastLog.consequence)}
        </div>
      )}

      {/* Selector Chọn Tài Sản (Thẻ Pastel) */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
          CHỌN TÀI SẢN MUỐN BÁN:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          {(['stocks', 'bonds', 'gold'] as const).map((key) => {
            const isSelected = asset === key
            const val = game.portfolio[key]
            const assetIcons = {
              stocks: '/assets/stock-icon.png',
              bonds: '/assets/bond-icon.png',
              gold: '/assets/gold-icon.png',
            }
            return (
              <button
                key={key}
                onClick={() => handleSelectAsset(key)}
                style={{
                  padding: '6px 2px',
                  borderRadius: '12px',
                  background: isSelected
                    ? 'linear-gradient(180deg, #FDF4FF 0%, #FAE8FF 100%)'
                    : '#FFFFFF',
                  border: isSelected ? '2px solid #C084FC' : '1px solid #E2E8F0',
                  boxShadow: isSelected
                    ? '0 3px 8px rgba(192, 132, 252, 0.3)'
                    : '0 1px 3px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px',
                  boxSizing: 'border-box',
                }}
              >
                <img
                  src={assetIcons[key]}
                  alt={ASSETS[key].label}
                  style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                />
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    color: isSelected ? '#7E22CE' : '#334155',
                  }}
                >
                  {ASSETS[key].label}
                </span>
                <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#64748B' }}>
                  {money(val)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Khoản Trái Phiếu Cụ Thể (nếu chọn Trái phiếu có credit) */}
      {creditSale && lots.length > 0 && (
        <div
          style={{
            background: '#F8FAFC',
            padding: '8px',
            borderRadius: '12px',
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '3px' }}>
            Khoản trái phiếu:
          </div>
          <select
            value={lot?.lot.id ?? ''}
            onChange={(e) => {
              setLotId(e.target.value)
              const selectedLot = lots.find((item) => item.lot.id === e.target.value)
              if (selectedLot) setAmount(selectedLot.quote.gross)
            }}
            style={{
              width: '100%',
              padding: '6px 8px',
              borderRadius: '8px',
              border: '1.5px solid #CBD5E1',
              fontSize: '11px',
              fontFamily: 'inherit',
              fontWeight: 700,
              background: '#FFFFFF',
              boxSizing: 'border-box',
            }}
          >
            {lots.map((item) => (
              <option key={item.lot.id} value={item.lot.id}>
                {bondIssuer(item.lot.credit!.issuerId).name} · {investmentLotLabel('bonds', item.lot.id)} · Nhận {money(item.quote.net)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Input Số Lượng Muốn Bán Kèm Chip Tỉ Lệ */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid #E2E8F0',
          padding: '8px 10px',
          boxSizing: 'border-box',
          boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155' }}>
            Giá trị muốn bán:
          </span>
          <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 700 }}>
            Tối đa: <strong style={{ color: '#0F172A' }}>{money(available)}</strong>
          </span>
        </div>

        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '6px' }}>
          <input
            type="text"
            inputMode="numeric"
            value={amount > 0 ? amount.toLocaleString('vi-VN') : ''}
            onChange={handleAmountChange}
            placeholder="0"
            style={{
              flex: 1,
              padding: '7px 10px',
              borderRadius: '10px',
              border: valid ? '1.5px solid #CBD5E1' : '1.5px solid #F87171',
              fontSize: '13.5px',
              fontWeight: 900,
              color: '#0F172A',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              fontVariantNumeric: 'tabular-nums',
            }}
          />
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#64748B' }}>đ</span>
        </div>

        {/* Quick Percentage Chips */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {[25, 50, 100].map((pct) => {
            const isMatch =
              available > 0 &&
              (pct === 100
                ? amount === available
                : amount === Math.floor((available * (pct / 100)) / 1000) * 1000)
            return (
              <button
                key={pct}
                type="button"
                disabled={available <= 0}
                onClick={() => setPercentAmount(pct)}
                style={{
                  flex: 1,
                  padding: '4px 0',
                  borderRadius: '8px',
                  border: isMatch ? '1.5px solid #F59E0B' : '1px solid #CBD5E1',
                  background: isMatch ? '#FEF3C7' : '#F1F5F9',
                  color: isMatch ? '#B45309' : '#334155',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  cursor: available <= 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {pct === 100 ? 'Tất cả' : `${pct}%`}
              </button>
            )
          })}
        </div>
      </div>

      {/* Bảng Tính Toán Thu Nhận & Phí Thực Tế */}
      <div
        style={{
          background: '#F8FAFC',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          padding: '8px 10px',
          fontSize: '11px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
          <span>Giá trị bán niêm yết:</span>
          <strong style={{ color: '#0F172A' }}>{money(quote.gross)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
          <span>Phí & chênh lệch mua/bán:</span>
          <span style={{ color: '#DC2626', fontWeight: 700 }}>
            -{money(quote.fee + quote.spread)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
          <span>Tiền thực nhận sau phí:</span>
          <strong style={{ color: '#16A34A', fontSize: '12px' }}>
            +{money(quote.net)}
          </strong>
        </div>
        <div
          style={{
            height: '1px',
            background: '#E2E8F0',
            margin: '1px 0',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, color: '#1E293B' }}>Tiền mặt sau bán:</span>
          <strong style={{ color: '#D97706', fontSize: '12.5px', fontWeight: 900 }}>
            {money(game.portfolio.cash + quote.net)}
          </strong>
        </div>
      </div>

      {/* Nút Thực Hiện Bán */}
      <button
        type="button"
        disabled={!valid}
        onClick={() => {
          onTransaction({
            kind: 'sell',
            asset,
            amount,
            ...(creditSale ? { lotId: lot?.lot.id } : {}),
          })
        }}
        style={{
          width: '100%',
          padding: '9px 12px',
          borderRadius: '12px',
          background: !valid
            ? '#CBD5E1'
            : 'linear-gradient(180deg, #A855F7 0%, #7E22CE 100%)',
          color: '#FFFFFF',
          fontSize: '13px',
          fontWeight: 900,
          border: 'none',
          boxShadow: !valid ? 'none' : '0 3px 8px rgba(126, 34, 206, 0.3)',
          cursor: !valid ? 'not-allowed' : 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '0.2px',
        }}
      >
        ✓ Xác nhận bán {ASSETS[asset].label}
      </button>

      {/* Trả Nợ Nếu Có */}
      {game.portfolio.debt > 0 && (
        <div
          style={{
            background: '#FFF1F2',
            border: '1.5px solid #FECDD3',
            borderRadius: '16px',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#9F1239' }}>
              Khoản nợ hiện tại:
            </span>
            <strong style={{ fontSize: '13px', color: '#BE123C' }}>
              {money(game.portfolio.debt)}
            </strong>
          </div>
          <button
            type="button"
            disabled={repayable <= 0}
            onClick={() => onTransaction({ kind: 'repay', amount: repayable })}
            style={{
              padding: '8px 12px',
              borderRadius: '12px',
              background: repayable <= 0 ? '#E2E8F0' : '#E11D48',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 800,
              border: 'none',
              cursor: repayable <= 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Trả {money(repayable)} gốc (Lãi: {money(Math.round(repayable * debtRate))})
          </button>
        </div>
      )}
    </GamifiedModal>
  )
}
