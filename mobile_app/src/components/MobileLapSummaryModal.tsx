import React from 'react'
import type { GameState } from '../../../src/game/types'
import { money, signedMoney } from '../../../src/game/format'
import { buildBondStartSummary, buildStartOverview } from '../game/start-summary'
import { BondStartCards, BondStartDetails } from './BondStartSummary'
import { CompactForecastReality } from './MarketNews'
import { GlossaryText } from '../../../src/components/FinancialTerm'
import { localizeNarrative } from '../../../src/components/glossary'
import { goalProgress } from '../../../src/game/selectors'
import { GamifiedModal } from './GamifiedModal'

interface MobileLapSummaryModalProps {
  game: GameState
  onContinue: () => void
  onHelp?: () => void
}

export const MobileLapSummaryModal: React.FC<MobileLapSummaryModalProps> = ({
  game,
  onContinue,
  onHelp,
}) => {
  const summary = game.summaries.at(-1)!
  const issuers = buildBondStartSummary(game, summary.lap)
  const overview = buildStartOverview(game, summary.lap)
  const goal = goalProgress(game)
  const progressPercent = Math.min(100, Math.max(0, goal.percent))

  return (
    <GamifiedModal
      badgeText={`VÒNG ${summary.lap} / ${game.totalLaps} · Ô XUẤT PHÁT`}
      title={`Khép lại vòng ${summary.lap}`}
      onHelp={onHelp}
      primaryAction={{
        label: summary.lap === game.totalLaps ? 'Xem kết quả hành trình →' : 'Ghé ví tại ô Xuất phát →',
        onClick: onContinue,
      }}
    >
      {/* Dashboard Thu & Chi 2 Cột Đối Xứng */}
      {overview ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px',
          }}
        >
          {/* Cột Tiền Đã Nhận */}
          <div
            style={{
              background: '#F0FDF4',
              border: '1.5px solid #86EFAC',
              borderRadius: '12px',
              padding: '6px 8px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#15803D', textTransform: 'uppercase' }}>
              Tiền đã nhận
            </div>
            <div style={{ fontSize: '13.5px', fontWeight: 900, color: '#16A34A', marginTop: '1px' }}>
              +{money(overview.received)}
            </div>
          </div>

          {/* Cột Tiền Đã Chi */}
          <div
            style={{
              background: '#FEF2F2',
              border: '1.5px solid #FECACA',
              borderRadius: '12px',
              padding: '6px 8px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: 800, color: '#B91C1C', textTransform: 'uppercase' }}>
              Tiền đã chi
            </div>
            <div style={{ fontSize: '13.5px', fontWeight: 900, color: '#DC2626', marginTop: '1px' }}>
              -{money(overview.paid)}
            </div>
          </div>
        </div>
      ) : null}

      {/* Chi Tiết Thu Nhập & Chi Phí Danh Sách */}
      {overview && (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: '8px 10px',
            fontSize: '11.5px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748B' }}>Lương khởi điểm:</span>
            <strong style={{ color: '#16A34A' }}>+{money(overview.salary)}</strong>
          </div>
          {overview.courseIncrease > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B' }}>Tăng lương từ khóa học:</span>
              <strong style={{ color: '#16A34A' }}>+{money(overview.courseIncrease)}</strong>
            </div>
          )}
          {(overview.businessRelevant || overview.businessCash !== 0) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B' }}>Kinh doanh · Dòng tiền:</span>
              <strong style={{ color: overview.businessCash >= 0 ? '#16A34A' : '#DC2626' }}>
                {signedMoney(overview.businessCash)}
              </strong>
            </div>
          )}
          {overview.savingsReceived > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B' }}>Tiết kiệm đáo hạn:</span>
              <strong style={{ color: '#16A34A' }}>+{money(overview.savingsReceived)}</strong>
            </div>
          )}
          {overview.bondReceived > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B' }}>Trái phiếu đã nhận:</span>
              <strong style={{ color: '#16A34A' }}>+{money(overview.bondReceived)}</strong>
            </div>
          )}
          {overview.livingPaid !== null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748B' }}>Chi phí sinh hoạt:</span>
              <strong style={{ color: '#DC2626' }}>-{money(overview.livingPaid)}</strong>
            </div>
          )}
          <div style={{ height: '1px', background: '#F1F5F9', margin: '2px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, color: '#1E293B', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <img
                src="/assets/money-icon.png"
                alt=""
                style={{
                  width: '16px',
                  height: '16px',
                  objectFit: 'contain',
                  filter: 'sepia(1) saturate(3.5) hue-rotate(335deg) brightness(1.05)',
                }}
              />
              <span>Tiền mặt hiện có:</span>
            </span>
            <strong style={{ fontSize: '14px', fontWeight: 900, color: '#D97706' }}>
              {money(overview.cashAfter)}
            </strong>
          </div>
        </div>
      )}

      {/* Tiến Độ Tới Mục Tiêu 90 Triệu (Goal Meter) */}
      <div
        style={{
          background: 'linear-gradient(180deg, #FDF4FF 0%, #FAE8FF 100%)',
          border: '1.5px solid #F0ABFC',
          borderRadius: '16px',
          padding: '10px 12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#86198F', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <img
              src="/assets/goal-icon.png"
              alt="Mục tiêu"
              style={{ width: '18px', height: '18px', objectFit: 'contain' }}
            />
            <span>MỤC TIÊU HUY ĐỘNG: 90M</span>
          </span>
          <span style={{ fontSize: '13px', fontWeight: 900, color: '#A21CAF' }}>
            {Math.round(progressPercent)}%
          </span>
        </div>
        <div
          style={{
            height: '10px',
            borderRadius: '9999px',
            background: 'rgba(255,255,255,0.8)',
            border: '1px solid #F0ABFC',
            overflow: 'hidden',
            marginBottom: '6px',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: 'linear-gradient(90deg, #D946EF 0%, #A855F7 100%)',
              borderRadius: '9999px',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#701A75', fontWeight: 700 }}>
          <span>Nguồn tiền về đích: <strong>{money(goal.funds)}</strong></span>
          <span>Còn lại: {summary.lap < game.totalLaps ? `${game.totalLaps - summary.lap} vòng` : 'Vòng cuối'}</span>
        </div>
      </div>

      {/* Thẻ Trái Phiếu (Nếu có) */}
      <BondStartCards issuers={issuers} />

      {/* Thị Trường Vòng Này */}
      <CompactForecastReality game={game} lap={summary.lap} />

      {/* Chi Tiết Trái Phiếu Nâng Cao */}
      <BondStartDetails issuers={issuers} />

      {/* Chi Tiết Nhật Ký Giao Dịch */}
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
        <summary style={{ fontWeight: 800, cursor: 'pointer', outline: 'none' }}>
          Chi tiết dòng tiền toàn vòng
        </summary>
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {summary.lines.map((line, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span><GlossaryText text={localizeNarrative(line.label)} /></span>
              <strong style={{ color: line.amount >= 0 ? '#16A34A' : '#DC2626' }}>
                {signedMoney(line.amount)}
              </strong>
            </div>
          ))}
          <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #E2E8F0', fontWeight: 800 }}>
            Tài sản ròng sau quyết toán: {money(summary.after)}
          </div>
          {summary.fundingNotes.map((note, i) => (
            <p key={i} style={{ margin: '2px 0', color: '#D97706' }}>
              {localizeNarrative(note)}
            </p>
          ))}
        </div>
      </details>
    </GamifiedModal>
  )
}
