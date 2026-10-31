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
      {/* 1. THẺ CỔ PHIẾU (Medieval Parchment Ledger Row - Không viền bo card) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 2px',
          borderBottom: '1px solid rgba(180, 83, 9, 0.15)',
          boxSizing: 'border-box',
        }}
      >
        <img
          src="/assets/stock-icon.png"
          alt="Cổ Phiếu"
          style={{
            width: '32px',
            height: '32px',
            objectFit: 'contain',
            flexShrink: 0,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.18))',
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 900, color: '#451a03' }}>
              Cổ Phiếu
            </span>
            <small style={{ fontSize: '10px', fontWeight: 700, color: '#b45309' }}>
              Kỳ vọng tăng trưởng
            </small>
          </div>
          <div
            style={{
              fontSize: '11px',
              color: '#5c3513',
              fontWeight: 600,
              marginTop: '1px',
              lineHeight: 1.3,
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

      {/* 2. THẺ TRÁI PHIẾU (Medieval Parchment Ledger Row - Không viền bo card) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 2px',
          borderBottom: '1px solid rgba(180, 83, 9, 0.15)',
          boxSizing: 'border-box',
        }}
      >
        <img
          src="/assets/bond-icon.png"
          alt="Trái Phiếu"
          style={{
            width: '32px',
            height: '32px',
            objectFit: 'contain',
            flexShrink: 0,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.18))',
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 900, color: '#451a03' }}>
              Trái Phiếu
            </span>
            <small style={{ fontSize: '10px', fontWeight: 700, color: '#b45309' }}>
              Coupon định kỳ
            </small>
          </div>
          <div
            style={{
              fontSize: '11px',
              color: '#5c3513',
              fontWeight: 600,
              marginTop: '1px',
              lineHeight: 1.3,
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

      {/* 3. THẺ VÀNG TRÚ ẨN (Medieval Parchment Ledger Row - Không viền bo card) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 2px',
          borderBottom: '1px solid rgba(180, 83, 9, 0.15)',
          boxSizing: 'border-box',
        }}
      >
        <img
          src="/assets/gold-icon.png"
          alt="Vàng Trú Ẩn"
          style={{
            width: '32px',
            height: '32px',
            objectFit: 'contain',
            flexShrink: 0,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.18))',
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 900, color: '#451a03' }}>
              Vàng Trú Ẩn
            </span>
            <small style={{ fontSize: '10px', fontWeight: 700, color: '#b45309' }}>
              Phòng thủ lạm phát
            </small>
          </div>
          <div
            style={{
              fontSize: '11px',
              color: '#5c3513',
              fontWeight: 600,
              marginTop: '1px',
              lineHeight: 1.3,
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

      {/* 4. HỘP TIẾN ĐỘ MỤC TIÊU HUY ĐỘNG (Parchment Quest Target) */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.9)',
          border: '1px solid rgba(180, 83, 9, 0.25)',
          borderRadius: '12px',
          padding: '8px 12px',
          boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <img
              src="/assets/goal-icon.png"
              alt="Mục tiêu"
              style={{ width: '18px', height: '18px', objectFit: 'contain' }}
            />
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 900,
                color: '#451a03',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
              }}
            >
              MỤC TIÊU HUY ĐỘNG: 90M
            </span>
          </div>
          <strong style={{ fontSize: '12px', color: '#b45309', fontWeight: 900 }}>
            {Math.round(progress)}%
          </strong>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            fontSize: '11px',
            margin: '4px 0 2px 0',
          }}
        >
          <span style={{ color: '#5c3513' }}>Nguồn tiền về đích:</span>
          <strong style={{ color: '#2a1506', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
            {money(funds)}
          </strong>
        </div>

        {/* Thanh Tiến Độ */}
        <div
          style={{
            width: '100%',
            height: '6px',
            background: 'rgba(180, 83, 9, 0.12)',
            borderRadius: '9999px',
            overflow: 'hidden',
            margin: '4px 0',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #F59E0B 0%, #D97706 50%, #B45309 100%)',
              borderRadius: '9999px',
              transition: 'width 0.4s ease',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '10px',
            color: '#78350f',
            fontWeight: 700,
          }}
        >
          <span>Cần tích lũy: {money(Math.max(0, goal.target - funds))}</span>
          <span>Còn {game.totalLaps - game.lap + 1} vòng</span>
        </div>
      </div>

      {/* 5. HỘP LƯU Ý VÒNG CHƠI (Parchment Warning Container) */}
      <div
        style={{
          background: 'rgba(254, 243, 199, 0.75)',
          border: '1.5px dashed #F59E0B',
          borderRadius: '12px',
          padding: '8px 10px',
          fontSize: '11px',
          color: '#78350f',
          lineHeight: 1.35,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
        }}
      >
        <img
          src="/assets/warning.png"
          alt="Lưu ý"
          style={{ width: '18px', height: '18px', objectFit: 'contain', flexShrink: 0, marginTop: '1px' }}
        />
        <span>
          <strong>Lưu ý vòng {game.lap}:</strong>{' '}
          {news.headline ? `${news.headline}. ` : ''}
          Theo dõi kỹ báo giá tại ô Xuất phát và chủ động cân đối danh mục trước các biến cố!
        </span>
      </div>
    </GamifiedModal>
  )
}
