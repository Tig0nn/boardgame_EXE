import React from 'react'
import type { GameState } from '../../../src/game/types'
import { goalProgress, liquidatableFunds } from '../../../src/game/selectors'
import { money } from '../../../src/game/format'
import { marketBulletin } from '../game/market-news'
import { sound } from '../utils/audio'
import { GamifiedModal } from './GamifiedModal'

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
      badgeText={`VÒNG ${game.lap} / ${game.totalLaps} · BẢN TIN THỊ TRƯỜNG & THÁCH THỨC`}
      title={news.headline}
      onHelp={onHelp}
      primaryAction={{
        label: `BẮT ĐẦU VÒNG ${game.lap} →`,
        onClick: handleContinue,
      }}
    >
      {/* 1. THẺ CỔ PHIẾU (Pastel Purple Card - Compact) */}
      <div
        style={{
          background: 'linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)',
          border: '1px solid #E9D5FF',
          borderRadius: '14px',
          padding: '7px 9px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 2px 5px rgba(168, 85, 247, 0.06)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #C084FC 0%, #A855F7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(168, 85, 247, 0.25)',
          }}
        >
          📈
        </div>
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            paddingLeft: '0%',
            left: '32%',
            right: '16%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 900, color: '#581C87' }}>
              Cổ Phiếu
            </span>
            <small style={{ fontSize: '10px', fontWeight: 700, color: '#7E22CE' }}>
              Kỳ vọng tăng trưởng
            </small>
          </div>
          <div
            style={{
              fontSize: '10.5px',
              color: '#3B0764',
              fontWeight: 600,
              marginTop: '1px',
              lineHeight: 1.25,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {stocksNews?.forecast || 'Giá biến động theo chu kỳ doanh nghiệp và sóng thị trường.'}
          </div>
        </div>
      </div>

      {/* 2. THẺ TRÁI PHIẾU (Pastel Pink Card - Compact) */}
      <div
        style={{
          background: 'linear-gradient(135deg, #FDF2F8 0%, #FCE7F3 100%)',
          border: '1px solid #FBCFE8',
          borderRadius: '14px',
          padding: '7px 9px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 2px 5px rgba(236, 72, 153, 0.06)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #F472B6 0%, #EC4899 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(236, 72, 153, 0.25)',
          }}
        >
          📜
        </div>
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            paddingLeft: '0%',
            left: '32%',
            right: '16%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 900, color: '#9D174D' }}>
              Trái Phiếu
            </span>
            <small style={{ fontSize: '10px', fontWeight: 700, color: '#BE185D' }}>
              Coupon định kỳ
            </small>
          </div>
          <div
            style={{
              fontSize: '10.5px',
              color: '#831843',
              fontWeight: 600,
              marginTop: '1px',
              lineHeight: 1.25,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {bondsNews?.forecast || 'Thu nhập coupon tại ô Xuất phát; theo dõi rủi ro xếp hạng tín nhiệm.'}
          </div>
        </div>
      </div>

      {/* 3. THẺ VÀNG TRÚ ẨN (Pastel Amber Card - Compact) */}
      <div
        style={{
          background: 'linear-gradient(135deg, #FEFCE8 0%, #FEF9C3 100%)',
          border: '1px solid #FEF08A',
          borderRadius: '14px',
          padding: '7px 9px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 2px 5px rgba(234, 179, 8, 0.06)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #FACC15 0%, #EAB308 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            flexShrink: 0,
            boxShadow: '0 2px 6px rgba(234, 179, 8, 0.25)',
          }}
        >
          🪙
        </div>
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            paddingLeft: '0%',
            left: '32%',
            right: '16%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 900, color: '#854D0E' }}>
              Vàng Trú Ẩn
            </span>
            <small style={{ fontSize: '10px', fontWeight: 700, color: '#A16207' }}>
              Phòng thủ lạm phát
            </small>
          </div>
          <div
            style={{
              fontSize: '10.5px',
              color: '#713F12',
              fontWeight: 600,
              marginTop: '1px',
              lineHeight: 1.25,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {goldNews?.forecast || 'Bảo toàn tài sản khi thị trường biến động tiêu cực.'}
          </div>
        </div>
      </div>

      {/* 4. HỘP TIẾN ĐỘ 90 TRIỆU (Goal Meter - Compact) */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          padding: '7px 10px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.02)',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 900,
              color: '#86198F',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            🎯 Mục Tiêu Huy Động: 90M
          </span>
          <strong style={{ fontSize: '12px', color: '#A21CAF', fontWeight: 900 }}>
            {Math.round(progress)}%
          </strong>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '11px', margin: '2px 0' }}>
          <span style={{ color: '#64748B' }}>Nguồn tiền về đích:</span>
          <strong style={{ color: '#0F172A', fontWeight: 900 }}>
            {money(funds)}
          </strong>
        </div>

        {/* Thanh Tiến Độ */}
        <div
          style={{
            width: '100%',
            height: '6px',
            background: '#F1F5F9',
            borderRadius: '9999px',
            overflow: 'hidden',
            margin: '3px 0 4px 0',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #D946EF 0%, #A855F7 100%)',
              borderRadius: '9999px',
              transition: 'width 0.4s ease',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748B', fontWeight: 700 }}>
          <span>Cần tích lũy: {money(Math.max(0, goal.target - funds))}</span>
          <span>Còn {game.totalLaps - game.lap + 1} vòng</span>
        </div>
      </div>

      {/* 5. HỘP LƯU Ý VÒNG CHƠI (Warm Yellow Container - Compact) */}
      <div
        style={{
          background: '#FEF9C3',
          border: '1px dashed #F59E0B',
          borderRadius: '12px',
          padding: '6px 8px',
          fontSize: '10.5px',
          color: '#92400E',
          lineHeight: 1.3,
          overflow: 'hidden',
          minHeight: '44px',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span>
          📌 <strong>Lưu ý vòng {game.lap}:</strong>{' '}
          {news.headline ? `${news.headline}. ` : ''}
          Theo dõi kỹ báo giá tại ô Xuất phát và chủ động cân đối danh mục trước các biến cố!
        </span>
      </div>
    </GamifiedModal>
  )
}
