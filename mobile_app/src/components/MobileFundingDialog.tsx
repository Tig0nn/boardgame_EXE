import React, { useState } from 'react'
import type { FundingSource, GameState } from '../../../src/game/types'
import { ASSETS, RULES } from '../../../src/data/config'
import { fundingSources } from '../../../src/game/engine'
import { borrowingAvailable } from '../../../src/game/transactions'
import { lostInterestOnWithdrawal, saleQuote } from '../../../src/game/selectors'
import { money } from '../../../src/game/format'
import { creditBondLots, hasBondCredit } from '../../../src/game/bond-credit'
import { bondIssuer } from '../../../src/data/bond-issuers'
import { investmentLotLabel, maturityLabel } from '../../../src/components/player-language'
import { localizeNarrative } from '../../../src/components/glossary'
import { GamifiedModal } from './GamifiedModal'

interface MobileFundingDialogProps {
  game: GameState
  onFund: (source: FundingSource, amount: number, lotId?: string) => void
  onHelp?: () => void
  compact?: boolean
}

export const MobileFundingDialog: React.FC<MobileFundingDialogProps> = ({
  game,
  onFund,
  onHelp,
}) => {
  const payment = game.pendingPayment!
  const sources = fundingSources(game)
  const [source, setSource] = useState<FundingSource>(sources[0] ?? 'debt')

  const lots = game.deposits.filter((l) => l.status === 'active')
  const [lotId, setLotId] = useState(lots[0]?.id ?? '')
  const lot = lots.find((l) => l.id === lotId)

  const bondLots = hasBondCredit(game)
    ? creditBondLots(game).filter((item) => item.quote.executable)
    : []
  const [bondId, setBondId] = useState(bondLots[0]?.lot.id ?? '')
  const bond = bondLots.find((item) => item.lot.id === bondId) ?? bondLots[0]

  const creditSale = source === 'bonds' && hasBondCredit(game)
  const available =
    source === 'debt'
      ? Math.min(payment.remaining, borrowingAvailable(game))
      : source === 'savings'
        ? lot?.principal ?? 0
        : creditSale
          ? bond?.quote.gross ?? 0
          : game.portfolio[source]

  const [input, setInput] = useState<number>(available)
  const amount = source === 'savings' ? available : input
  const valid = Number.isSafeInteger(amount) && amount > 0 && amount <= available

  const quote =
    source !== 'debt' && source !== 'savings'
      ? saleQuote(game, source, valid ? amount : 0, creditSale ? bond?.lot.id : undefined)
      : { net: valid ? amount : 0, fee: 0, spread: 0 }

  const used = Math.min(payment.remaining, quote.net)

  const handleSelectSource = (s: FundingSource) => {
    setSource(s)
    const nextAvail =
      s === 'debt'
        ? Math.min(payment.remaining, borrowingAvailable(game))
        : s === 'savings'
          ? lot?.principal ?? 0
          : s === 'bonds' && hasBondCredit(game)
            ? bond?.quote.gross ?? 0
            : game.portfolio[s]
    setInput(nextAvail)
  }

  return (
    <GamifiedModal
      badgeText="CẦN BỔ SUNG TIỀN MẶT"
      title={`Còn thiếu ${money(payment.remaining)}`}
      onHelp={onHelp}
      primaryAction={{
        label: `Dùng nguồn tiền này →`,
        disabled: !valid,
        onClick: () =>
          onFund(
            source,
            amount,
            source === 'savings' ? lotId : creditSale ? bond?.lot.id : undefined
          ),
      }}
    >
      {/* Thông điệp tình huống thanh toán */}
      <div
        style={{
          background: '#FEF2F2',
          border: '1.5px solid #FECACA',
          borderRadius: '16px',
          padding: '10px 12px',
          fontSize: '12.5px',
          color: '#991B1B',
          lineHeight: '1.4',
        }}
      >
        ⚠️ <strong>{localizeNarrative(payment.title)}</strong>
        <div style={{ marginTop: '4px', fontSize: '11.5px', color: '#B91C1C' }}>
          Tổng nghĩa vụ: {money(payment.total)} · Tiền mặt hiện tại đã cạn. Hãy chọn nguồn thanh toán để tiếp tục ván chơi!
        </div>
      </div>

      {/* Danh Sách Nguồn Tiền Hợp Lệ (Cards) */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
          CHỌN NGUỒN TIỀN:
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {sources.map((s) => {
            const isSelected = s === source
            const label =
              s === 'debt'
                ? 'Vay nợ'
                : s === 'savings'
                  ? 'Rút tiết kiệm'
                  : ASSETS[s]?.label ?? s
            const icon =
              s === 'debt' ? '💳' : s === 'savings' ? '🏦' : s === 'stocks' ? '📈' : s === 'bonds' ? '📜' : '🪙'
            const maxVal =
              s === 'debt'
                ? borrowingAvailable(game)
                : s === 'savings'
                  ? lot?.principal ?? 0
                  : s === 'bonds' && hasBondCredit(game)
                    ? saleQuote(game, 'bonds').net
                    : game.portfolio[s]

            return (
              <button
                key={s}
                onClick={() => handleSelectSource(s)}
                style={{
                  padding: '10px 8px',
                  borderRadius: '16px',
                  background: isSelected
                    ? 'linear-gradient(180deg, #FDF4FF 0%, #FAE8FF 100%)'
                    : '#FFFFFF',
                  border: isSelected ? '2.5px solid #C084FC' : '1.5px solid #E2E8F0',
                  boxShadow: isSelected
                    ? '0 4px 10px rgba(192, 132, 252, 0.35)'
                    : '0 2px 4px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ fontSize: '20px' }}>{icon}</span>
                <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      color: isSelected ? '#7E22CE' : '#1E293B',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {label}
                  </div>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748B' }}>
                    Tối đa: {money(maxVal)}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Chi Tiết Từng Loại Nguồn */}
      {creditSale && bondLots.length > 0 && (
        <div
          style={{
            background: '#F8FAFC',
            padding: '10px 12px',
            borderRadius: '16px',
            border: '1.5px solid #E2E8F0',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
            Khoản trái phiếu có thể bán:
          </div>
          <select
            value={bond?.lot.id ?? ''}
            onChange={(e) => {
              setBondId(e.target.value)
              const selectedBond = bondLots.find((item) => item.lot.id === e.target.value)
              if (selectedBond) setInput(selectedBond.quote.gross)
            }}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '10px',
              border: '1.5px solid #CBD5E1',
              fontSize: '12px',
              fontFamily: 'inherit',
              fontWeight: 700,
              background: '#FFFFFF',
            }}
          >
            {bondLots.map((item) => (
              <option key={item.lot.id} value={item.lot.id}>
                {bondIssuer(item.lot.credit!.issuerId).name} · {investmentLotLabel('bonds', item.lot.id)} · Nhận tối đa {money(item.quote.net)}
              </option>
            ))}
          </select>
        </div>
      )}

      {source === 'savings' && (
        <div
          style={{
            background: '#F8FAFC',
            padding: '10px 12px',
            borderRadius: '16px',
            border: '1.5px solid #E2E8F0',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
            Khoản tiết kiệm rút toàn bộ:
          </div>
          <select
            value={lotId}
            onChange={(e) => setLotId(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '10px',
              border: '1.5px solid #CBD5E1',
              fontSize: '12px',
              fontFamily: 'inherit',
              fontWeight: 700,
              background: '#FFFFFF',
            }}
          >
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {investmentLotLabel('savings', l.id)} · {money(l.principal)} · {maturityLabel(l.maturityLap)}
              </option>
            ))}
          </select>
          <div style={{ marginTop: '6px', fontSize: '11px', color: '#DC2626', fontWeight: 700 }}>
            ⚠️ Rút sớm sẽ mất {money(lostInterestOnWithdrawal(game, lotId))} tiền lãi tích lũy!
          </div>
        </div>
      )}

      {source !== 'savings' && (
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            border: '1.5px solid #E2E8F0',
            padding: '12px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
              {source === 'debt' ? 'Số tiền muốn vay:' : 'Giá trị muốn bán:'}
            </span>
            <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 700 }}>
              Tối đa: {money(available)}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              type="number"
              step={1000000}
              min={0}
              max={available}
              value={input || ''}
              onChange={(e) => setInput(Number(e.target.value))}
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '12px',
                border: valid ? '2px solid #CBD5E1' : '2px solid #F87171',
                fontSize: '15px',
                fontWeight: 900,
                color: '#0F172A',
                fontFamily: 'inherit',
              }}
            />
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#64748B' }}>đ</span>
          </div>

          {source === 'debt' && (
            <div style={{ marginTop: '6px', fontSize: '11.5px', color: '#D97706', fontWeight: 700 }}>
              💡 Lãi suất vay nợ: {RULES.debtRate * 100}% tính ở kỳ trả kế tiếp.
            </div>
          )}
        </div>
      )}

      {/* Tóm Tắt Sau Quyết Toán Nguồn Tiền */}
      <div
        style={{
          background: '#F8FAFC',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          padding: '10px 12px',
          fontSize: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
          <span>Tiền thu được từ nguồn này:</span>
          <strong style={{ color: '#16A34A' }}>+{money(quote.net)}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
          <span>Còn thiếu sau thanh toán:</span>
          <strong style={{ color: payment.remaining - used > 0 ? '#DC2626' : '#16A34A' }}>
            {money(Math.max(0, payment.remaining - used))}
          </strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
          <span>Tiền dư chuyển vào ví tiền mặt:</span>
          <strong style={{ color: '#D97706' }}>+{money(Math.max(0, quote.net - used))}</strong>
        </div>
      </div>
    </GamifiedModal>
  )
}
