import React from 'react'
import type { GameState } from '../../../src/game/types'
import { goalProgress, liquidatableFunds } from '../../../src/game/selectors'
import { money } from '../../../src/game/format'
import { marketBulletin } from '../game/market-news'
import { sound } from '../utils/audio'
import { GamifiedModal } from './GamifiedModal'
import { assetUrl } from '../utils/assets'

interface RoundChallengeModalProps {
  game: GameState
  onConfirm: () => void
  onHelp?: () => void
}

export const RoundChallengeModal: React.FC<RoundChallengeModalProps> = ({
  game,
  onConfirm,
  onHelp,
}) => {
  const news = marketBulletin(game)
  const funds = liquidatableFunds(game)
  const goal = goalProgress(game)
  const progress = Math.min(100, Math.max(0, goal.percent))

  const stocksNews = news.assets.find((a) => a.asset === 'stocks')
  const bondsNews = news.assets.find((a) => a.asset === 'bonds')
  const goldNews = news.assets.find((a) => a.asset === 'gold')

  const handleContinue = () => {
    sound.playClick()
    onConfirm()
  }

  return (
    <GamifiedModal
      badgeText={news.quarter?.quarterLabel ? `${news.quarter.quarterLabel} · VÒNG ${game.lap}/${game.totalLaps}` : `VÒNG ${game.lap} / ${game.totalLaps} · THÁCH THỨC VÒNG MỚI`}
      title={news.headline || news.quarter?.macroTheme || `Khởi đầu vòng ${game.lap}`}
      onHelp={onHelp}
      primaryAction={{
        label: `BẮT ĐẦU VÒNG ${game.lap} →`,
        onClick: handleContinue,
      }}
    >
      {/* BANNER CHIẾN LƯỢC TRỌNG TÂM THỰC TẾ 2026 (ACTIONABLE RL STRATEGIC ADVICE) */}
      <div
        style={{
          background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
          border: '1.5px solid #93C5FD',
          borderRadius: '14px',
          padding: '10px 12px',
          boxSizing: 'border-box',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '15px' }}>💡</span>
            <span style={{ fontSize: '12px', fontWeight: 900, color: '#1E40AF', letterSpacing: '0.2px' }}>
              {news.quarter?.macroTheme || `CHIẾN LƯỢC QUÝ ${game.lap}/2026`}
            </span>
          </div>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 900,
              padding: '2px 8px',
              borderRadius: '999px',
              background: '#2563EB',
              color: '#FFFFFF',
              letterSpacing: '0.3px',
            }}
          >
            {news.quarter?.recommendedAsset || 'Ưu tiên'}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '11px', color: '#1E3A8A', fontWeight: 600, lineHeight: 1.35 }}>
          {news.quarter?.actionableAdvice}
        </p>
      </div>

      {/* 3 THẺ XU HƯỚNG TÀI SẢN TRỰC QUAN (VISUAL-FIRST GAMIFIED CARDS) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        {/* 1. THẺ CỔ PHIẾU */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1.5px solid #E2E8F0',
            borderRadius: '14px',
            padding: '8px 12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src={assetUrl('assets/stock-icon.png')}
              alt="Cổ Phiếu"
              style={{
                width: '36px',
                height: '36px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 900, color: '#1E293B' }}>Cổ Phiếu</span>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 900,
                    padding: '1px 6px',
                    borderRadius: '999px',
                    background: game.lap === 1 ? '#DCFCE7' : game.lap === 3 ? '#FEE2E2' : '#F1F5F9',
                    color: game.lap === 1 ? '#15803D' : game.lap === 3 ? '#B91C1C' : '#475569',
                    letterSpacing: '0.3px',
                  }}
                >
                  {game.lap === 1 ? 'SÓNG AI TĂNG' : game.lap === 3 ? 'RUNG LẮC CAO' : 'PHÂN HÓA'}
                </span>
              </div>
              <small style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>
                {game.lap === 1 ? 'Sóng công nghệ dẫn dắt thị trường' : 'Sinh lời cao nhưng biến động mạnh'}
              </small>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong style={{ fontSize: '14px', fontWeight: 900, color: game.lap === 1 ? '#16A34A' : game.lap === 3 ? '#DC2626' : '#2563EB', display: 'block' }}>
              {game.lap === 1 ? '▲ +15% ~ +35%' : game.lap === 3 ? '▼ Dễ giảm' : '▲ Tiềm năng'}
            </strong>
            <small style={{ fontSize: '9.5px', color: '#94A3B8', fontWeight: 700 }}>Thanh khoản cao</small>
          </div>
        </div>

        {/* 2. THẺ TRÁI PHIẾU */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1.5px solid #E2E8F0',
            borderRadius: '14px',
            padding: '8px 12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src={assetUrl('assets/bond-icon.png')}
              alt="Trái Phiếu"
              style={{
                width: '36px',
                height: '36px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 900, color: '#1E293B' }}>Trái Phiếu</span>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 900,
                    padding: '1px 6px',
                    borderRadius: '999px',
                    background: '#DBEAFE',
                    color: '#1D4ED8',
                    letterSpacing: '0.3px',
                  }}
                >
                  COUPON ĐỀU
                </span>
              </div>
              <small style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>
                Nhận lãi cố định tại ô Xuất phát
              </small>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong style={{ fontSize: '14px', fontWeight: 900, color: '#2563EB', display: 'block' }}>
              +5.0%/kỳ
            </strong>
            <small style={{ fontSize: '9.5px', color: '#94A3B8', fontWeight: 700 }}>Thu nhập thụ động</small>
          </div>
        </div>

        {/* 3. THẺ VÀNG TRÚ ẨN */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: (game.lap === 2 || game.lap === 4) ? 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)' : 'rgba(255, 255, 255, 0.95)',
            border: (game.lap === 2 || game.lap === 4) ? '1.5px solid #F59E0B' : '1.5px solid #E2E8F0',
            borderRadius: '14px',
            padding: '8px 12px',
            boxShadow: (game.lap === 2 || game.lap === 4) ? '0 4px 12px rgba(245, 158, 11, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.04)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src={assetUrl('assets/gold-icon.png')}
              alt="Vàng Trú Ẩn"
              style={{
                width: '36px',
                height: '36px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 900, color: '#1E293B' }}>Vàng Trú Ẩn</span>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 900,
                    padding: '1px 6px',
                    borderRadius: '999px',
                    background: (game.lap === 2 || game.lap === 4) ? '#FEF3C7' : '#FEF9C3',
                    color: '#B45309',
                    letterSpacing: '0.3px',
                  }}
                >
                  {(game.lap === 2 || game.lap === 4) ? '🔥 LẬP ĐỈNH 2026' : 'PHÒNG THỦ'}
                </span>
              </div>
              <small style={{ fontSize: '10.5px', color: '#64748B', fontWeight: 600 }}>
                {(game.lap === 2 || game.lap === 4) ? 'Kênh trú ẩn số 1 bứt phá lợi nhuận' : 'Bảo vệ tài sản trước biến động'}
              </small>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong style={{ fontSize: '14px', fontWeight: 900, color: (game.lap === 2 || game.lap === 4) ? '#16A34A' : '#D97706', display: 'block' }}>
              {(game.lap === 2 || game.lap === 4) ? '▲ +12% ~ +26%' : 'Ổn Định'}
            </strong>
            <small style={{ fontSize: '9.5px', color: (game.lap === 2 || game.lap === 4) ? '#15803D' : '#94A3B8', fontWeight: 700 }}>
              {(game.lap === 2 || game.lap === 4) ? 'Khuyến nghị gom' : 'Lá chắn rủi ro'}
            </small>
          </div>
        </div>
      </div>

      {/* 4. THANH TIẾN ĐỘ MỤC TIÊU 90M RỰC RỠ */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.6) 0%, rgba(253, 230, 138, 0.4) 100%)',
          border: '1.5px solid #FCD34D',
          borderRadius: '14px',
          padding: '10px 14px',
          boxSizing: 'border-box',
          marginTop: '2px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <img
              src={assetUrl('assets/goal-icon.png')}
              alt="Mục tiêu"
              style={{ width: '20px', height: '20px', objectFit: 'contain' }}
            />
            <span style={{ fontSize: '12px', fontWeight: 900, color: '#78350F', textTransform: 'uppercase' }}>
              MỤC TIÊU VỀ ĐÍCH: 90M
            </span>
          </div>
          <strong style={{ fontSize: '14px', color: '#B45309', fontWeight: 900 }}>
            {Math.round(progress)}%
          </strong>
        </div>

        {/* Thanh Progress Động */}
        <div
          style={{
            width: '100%',
            height: '8px',
            background: 'rgba(180, 83, 9, 0.15)',
            borderRadius: '9999px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #F59E0B 0%, #EA580C 100%)',
              borderRadius: '9999px',
              transition: 'width 0.4s ease',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            marginTop: '6px',
            fontWeight: 700,
          }}
        >
          <span style={{ color: '#78350F' }}>
            Đã có: <b style={{ color: '#0F172A' }}>{money(funds)}</b>
          </span>
          <span style={{ color: '#9A3412' }}>
            Còn lại {game.totalLaps - game.lap + 1} vòng
          </span>
        </div>
      </div>

      {/* 5. KHỐI THU GỌN BẢN TIN VĨ MÔ DÀNH CHO NGƯỜI MUỐN ĐỌC SÂU */}
      <details
        style={{
          background: 'rgba(241, 245, 249, 0.8)',
          border: '1px solid #CBD5E1',
          borderRadius: '12px',
          padding: '6px 10px',
          fontSize: '11px',
          color: '#475569',
          cursor: 'pointer',
          lineHeight: 1.4,
        }}
      >
        <summary style={{ fontWeight: 800, color: '#334155' }}>
          ℹ️ {news.headline ? `${news.headline} · ` : ''}Xem chi tiết dự báo vĩ mô vòng {game.lap}
        </summary>
        <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #CBD5E1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {stocksNews?.forecast && <div>• <b>Cổ phiếu:</b> {stocksNews.forecast}</div>}
          {bondsNews?.forecast && <div>• <b>Trái phiếu:</b> {bondsNews.forecast}</div>}
          {goldNews?.forecast && <div>• <b>Vàng:</b> {goldNews.forecast}</div>}
        </div>
      </details>
    </GamifiedModal>
  )
}
