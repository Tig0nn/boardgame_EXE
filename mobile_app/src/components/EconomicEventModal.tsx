import React from 'react'
import { percent, signedMoney } from '../../../src/game/format'
import type { GameState } from '../../../src/game/types'
import { buildEconomicEventImpact } from '../game/economic-event'
import type { EventPriceImpact } from '../game/economic-event'
import { issuerPressureChange, issuerPressureDetails } from './market-language'
import { GamifiedModal } from './GamifiedModal'

function Movement({ rate }: { rate: number | null }) {
  const isUp = rate !== null && rate > 0
  const isDown = rate !== null && rate < 0
  const label =
    rate === null
      ? 'Chưa đủ dữ liệu'
      : rate > 0
        ? `+${percent(rate)}`
        : percent(rate)

  return (
    <strong
      style={{
        fontSize: '13px',
        fontWeight: 900,
        color: isUp ? '#16A34A' : isDown ? '#DC2626' : '#64748B',
      }}
    >
      {rate === null ? label : `${isUp ? '↑ ' : isDown ? '↓ ' : '↔ '}${label}`}
    </strong>
  )
}

const statusText: Record<string, string> = {
  performing: 'Đang trả đúng hạn',
  delayed: 'Đang chậm trả',
  defaulted: 'Đang thu hồi vốn',
  resolved: 'Đã xử lý thu hồi',
}

function CreditNote({ item, expanded = false }: { item: EventPriceImpact; expanded?: boolean }) {
  if (!item.credit) return null
  const credit = item.credit
  return (
    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
      {expanded
        ? issuerPressureDetails(credit.stressBefore, credit.stressAfter)
        : issuerPressureChange(credit.stressBefore, credit.stressAfter)}
      {credit.statusAfter !== 'performing' && (
        <span style={{ color: '#DC2626', fontWeight: 700, marginLeft: '4px' }}>
          • {statusText[credit.statusAfter]}
        </span>
      )}
    </div>
  )
}

export const EconomicEventModal: React.FC<{
  game: GameState
  onChoose: (id: string) => void
  onHelp?: () => void
}> = ({ game, onChoose, onHelp }) => {
  const impact = buildEconomicEventImpact(game)
  if (!impact) return null

  const hasAssets =
    Object.values(game.stockHoldings).some((item) => item.units > 0) ||
    game.bondLots.some((item) => item.status === 'active' && item.units > 0) ||
    game.goldUnits > 0 ||
    game.business.capital > 0

  return (
    <GamifiedModal
      badgeText={`VÒNG ${impact.lap} · Ô ${impact.tile} · BIẾN CỐ KINH TẾ`}
      title={`⚡ ${impact.headline}!`}
      onHelp={onHelp}
      primaryAction={{
        label: 'ĐÃ HIỂU · TIẾP TỤC →',
        onClick: () => onChoose('acknowledge'),
      }}
    >
      {/* 1. BỐI CẢNH SỰ KIỆN (Context Card) */}
      <div
        style={{
          background: 'linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 100%)',
          border: '1.5px solid #FECDD3',
          borderRadius: '18px',
          padding: '10px 12px',
          fontSize: '12.5px',
          color: '#9F1239',
          lineHeight: '1.4',
        }}
      >
        {impact.context}
      </div>

      {/* 2. BIẾN ĐỘNG GIÁ TÀI SẢN (Market Impacts) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
          Biến động giá sau sự kiện:
        </div>

        {impact.groups.map((group) => {
          const assetIcons: Record<string, string> = { stocks: '/assets/stock-icon.png', bonds: '/assets/bond-icon.png', gold: '/assets/gold-icon.png' }
          return (
            <div
              key={group.asset}
              style={{
                background: '#FFFFFF',
                border: '1.5px solid #E2E8F0',
                borderRadius: '16px',
                padding: '10px 12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 900, color: '#1E1B4B', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {assetIcons[group.asset] && <img src={assetIcons[group.asset]} alt="" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />}
                  <span>{group.label}</span>
                </span>
                {group.asset !== 'bonds' || !impact.credit ? (
                  <Movement rate={group.returnRate} />
                ) : null}
              </div>

              {group.asset === 'bonds' && impact.credit && (
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: '#F8FAFC',
                        borderRadius: '10px',
                        padding: '6px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                          {item.id === 'an-tam' ? 'An Tâm' : 'Bứt Phá'}
                        </span>
                        <Movement rate={item.returnRate} />
                      </div>
                      <CreditNote item={item} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 3. TÁC ĐỘNG TỚI DANH MỤC CÁ NHÂN */}
      <div
        style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '16px',
          padding: '10px 12px',
          fontSize: '12px',
          color: '#334155',
          lineHeight: '1.4',
        }}
      >
        <span style={{ fontWeight: 800, color: '#1E1B4B' }}>Tác động danh mục của bạn: </span>
        {!hasAssets
          ? 'Bạn hiện chưa nắm giữ tài sản nào bị tác động bởi sự kiện này.'
          : impact.portfolio.length > 0
            ? impact.portfolio.map((item) => `${item.label} ${signedMoney(item.delta)}`).join('; ')
            : 'Chưa đủ dữ liệu tính toán.'}
      </div>

      {/* 4. GÓC NHÌN TÀI CHÍNH (Warm Yellow Lesson Box) */}
      <div
        style={{
          background: '#FEF9C3',
          border: '1.5px dashed #F59E0B',
          borderRadius: '16px',
          padding: '10px 12px',
          fontSize: '12px',
          color: '#92400E',
          lineHeight: '1.4',
        }}
      >
        💡 <strong>Góc nhìn tài chính:</strong> {impact.lesson}
      </div>

      {/* 5. CHI TIẾT THỊ TRƯỜNG */}
      <details
        style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          padding: '8px 10px',
          fontSize: '11.5px',
          color: '#475569',
        }}
      >
        <summary style={{ fontWeight: 800, cursor: 'pointer' }}>
          Xem chi tiết cổ phiếu theo ngành
        </summary>
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {impact.sectors.map((sector) => (
            <div key={sector.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{sector.label}</span>
              <Movement rate={sector.returnRate} />
            </div>
          ))}
        </div>
      </details>
    </GamifiedModal>
  )
}
