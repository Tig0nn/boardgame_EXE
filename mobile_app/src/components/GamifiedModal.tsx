import React from 'react'
import { sound } from '../utils/audio'

export interface GamifiedModalProps {
  title?: string
  titleIcon?: string
  badgeText?: string
  lap?: number
  onClose?: () => void
  onHelp?: () => void
  primaryAction?: {
    label: string
    onClick: () => void
    disabled?: boolean
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  children: React.ReactNode
  className?: string
}

interface LapThemeConfig {
  cardBorder: string
  cardBg: string
  cardShadow: string
  ribbonBg: string
  ribbonBorder: string
  ribbonShadow: string
  glowFilter: string
}

const getLapTheme = (lap?: number, badgeText?: string): LapThemeConfig => {
  let detectedLap = lap
  if (!detectedLap && badgeText) {
    const match = badgeText.match(/VÒNG\s*(\d)/i)
    if (match) detectedLap = parseInt(match[1], 10)
  }

  switch (detectedLap) {
    case 1:
      // VÒNG 1: Khởi động nhẹ nhàng, tươi mát (Emerald & Mint Jade Glow)
      return {
        cardBorder: '3px solid #86EFAC',
        cardBg: 'linear-gradient(180deg, #A7F3D0 0%, #34D399 26%, #059669 70%, #064E3B 100%)',
        cardShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 26px rgba(16, 185, 129, 0.45)',
        ribbonBg: 'linear-gradient(90deg, #064E3B 0%, #059669 25%, #10B981 50%, #059669 75%, #064E3B 100%)',
        ribbonBorder: '1.5px solid #D1FAE5',
        ribbonShadow: '0 4px 12px rgba(0, 0, 0, 0.5), 0 0 12px rgba(16, 185, 129, 0.55)',
        glowFilter: 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.4))',
      }
    case 2:
      // VÒNG 2: Tăng tốc đậm đà, chiều sâu biển cả (Sapphire Ocean & Azure Glow)
      return {
        cardBorder: '3px solid #7DD3FC',
        cardBg: 'linear-gradient(180deg, #BAE6FD 0%, #38BDF8 26%, #0284C7 70%, #082F49 100%)',
        cardShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 26px rgba(14, 165, 233, 0.45)',
        ribbonBg: 'linear-gradient(90deg, #0C4A6E 0%, #0284C7 25%, #38BDF8 50%, #0284C7 75%, #0C4A6E 100%)',
        ribbonBorder: '1.5px solid #E0F2FE',
        ribbonShadow: '0 4px 12px rgba(0, 0, 0, 0.5), 0 0 12px rgba(14, 165, 233, 0.55)',
        glowFilter: 'drop-shadow(0 0 10px rgba(14, 165, 233, 0.4))',
      }
    case 3:
      // VÒNG 3: Thử thách áp lực, kịch tính thị trường (Royal Amethyst & Violet Glow)
      return {
        cardBorder: '3px solid #D8B4FE',
        cardBg: 'linear-gradient(180deg, #E9D5FF 0%, #C084FC 26%, #7E22CE 70%, #3B0764 100%)',
        cardShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 28px rgba(168, 85, 247, 0.5)',
        ribbonBg: 'linear-gradient(90deg, #4C1D95 0%, #7E22CE 25%, #A855F7 50%, #7E22CE 75%, #4C1D95 100%)',
        ribbonBorder: '1.5px solid #F3E8FF',
        ribbonShadow: '0 4px 12px rgba(0, 0, 0, 0.5), 0 0 14px rgba(168, 85, 247, 0.6)',
        glowFilter: 'drop-shadow(0 0 10px rgba(168, 85, 247, 0.4))',
      }
    case 4:
      // VÒNG 4: Nước rút bùng nổ, rực lửa gamification (Fiery Magma & Solar Gold Flame)
      return {
        cardBorder: '3px solid #FDBA74',
        cardBg: 'linear-gradient(180deg, #FED7AA 0%, #FB923C 24%, #DC2626 68%, #7F1D1D 100%)',
        cardShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 32px rgba(239, 68, 68, 0.65)',
        ribbonBg: 'linear-gradient(90deg, #7F1D1D 0%, #DC2626 25%, #F97316 50%, #DC2626 75%, #7F1D1D 100%)',
        ribbonBorder: '1.5px solid #FEF3C7',
        ribbonShadow: '0 4px 14px rgba(0, 0, 0, 0.6), 0 0 16px rgba(239, 68, 68, 0.7)',
        glowFilter: 'drop-shadow(0 0 12px rgba(239, 68, 68, 0.5))',
      }
    default:
      // Mặc định: Hoàng kim trung cổ (Classic Royal Amber)
      return {
        cardBorder: '3px solid #FCD34D',
        cardBg: 'linear-gradient(180deg, #FDE68A 0%, #F59E0B 28%, #D97706 70%, #92400E 100%)',
        cardShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 24px rgba(245, 158, 11, 0.35)',
        ribbonBg: 'linear-gradient(90deg, #9A3412 0%, #D97706 30%, #F59E0B 50%, #D97706 70%, #9A3412 100%)',
        ribbonBorder: '1.5px solid #FEF3C7',
        ribbonShadow: '0 4px 12px rgba(0, 0, 0, 0.5), 0 0 10px rgba(245, 158, 11, 0.5)',
        glowFilter: 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.35))',
      }
  }
}

export interface BookHelpButtonProps {
  onClick: () => void
  className?: string
  style?: React.CSSProperties
}

/**
 * Standalone High-Quality Gamified 3D Book Icon Button (Sổ Tay Chiến Lược)
 * Removes the old plain circular border/badge and floats a vibrant 3D fantasy tome with drop-shadow.
 */
export const BookHelpButton: React.FC<BookHelpButtonProps> = ({
  onClick,
  className = '',
  style,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Xem Sổ Tay Chiến Lược & Luật Chơi"
      aria-label="Sổ tay"
      className={`hover:scale-110 active:scale-95 transition-transform duration-150 cursor-pointer ${className}`}
      style={{
        position: 'absolute',
        top: '10px',
        right: '12px',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        padding: 0,
        zIndex: 35,
        filter: 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.25))',
        cursor: 'pointer',
        transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
        ...style,
      }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(0.92)'
      }}
      onPointerUp={(e) => {
        (e.currentTarget as HTMLElement).style.transform = 'scale(1)'
      }}
    >
      <img
        src="/assets/guide-new-icon.png"
        alt="Sổ tay"
        onError={(e) => {
          e.currentTarget.src = '/assets/cropped/sotay-full-icon.png'
        }}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
        }}
      />
    </button>
  )
}

export const GamifiedModal: React.FC<GamifiedModalProps> = ({
  title,
  titleIcon,
  badgeText,
  lap,
  onClose,
  onHelp,
  primaryAction,
  secondaryAction,
  children,
  className = '',
}) => {
  const theme = getLapTheme(lap, badgeText)

  return (
    <div
      className="gamified-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 15, 29, 0.82)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        padding: '8px',
        animation: 'fadeIn 0.18s ease-out',
        boxSizing: 'border-box',
        writingMode: 'horizontal-tb',
        textOrientation: 'mixed',
        pointerEvents: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          sound.playClick()
          onClose()
        }
      }}
    >
      {/* Khung Tinh Gọn Chuẩn Di Động Medieval Fantasy (w-[92%] max-w-[370px] h-[82vh] max-h-[690px]) */}
      <div
        className={`gamified-modal-card w-[92%] max-w-[370px] h-[82vh] max-h-[690px] mx-auto rounded-[28px] shadow-2xl flex flex-col relative overflow-visible ${className}`}
        style={{
          position: 'relative',
          width: '92%',
          maxWidth: '370px',
          height: '82vh',
          maxHeight: '690px',
          display: 'flex',
          flexDirection: 'column',
          background: theme.cardBg,
          border: theme.cardBorder,
          borderRadius: '28px',
          boxShadow: theme.cardShadow,
          fontFamily: "'Fredoka', sans-serif",
          boxSizing: 'border-box',
          writingMode: 'horizontal-tb',
          textOrientation: 'mixed',
          animation: 'animePopupScale 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
          userSelect: 'none',
          overflow: 'visible',
          pointerEvents: 'auto',
        }}
      >
        {/* Ruy Băng Hoàng Kim Quý Phái (Royal Ribbon theo vòng) */}
        {badgeText && (
          <div
            style={{
              position: 'absolute',
              top: '-13px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 30,
              background: theme.ribbonBg,
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '11px',
              padding: '3px 16px',
              borderRadius: '9999px',
              border: theme.ribbonBorder,
              boxShadow: theme.ribbonShadow,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              textAlign: 'center',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)',
              fontFamily: "'Fredoka', sans-serif",
            }}
          >
            {badgeText}
          </div>
        )}

        {/* Lòng Thẻ Giấy Da Cừu Phong Hóa (Parchment Base Canvas) */}
        <div
          className="flex-1 flex flex-col overflow-hidden rounded-[24px]"
          style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '24px',
            background: '#FAF6F0',
            margin: '4px',
            marginTop: badgeText ? '16px' : '4px',
            padding: '12px 14px 12px 14px',
            boxSizing: 'border-box',
            border: '1px solid rgba(180, 83, 9, 0.25)',
            boxShadow: 'inset 0 2px 8px rgba(184, 144, 91, 0.15)',
            color: '#381F0B',
            fontFamily: "'Fredoka', sans-serif",
            writingMode: 'horizontal-tb',
            textOrientation: 'mixed',
          }}
        >
          {/* Nút Sổ Tay Chiến Lược 3D Gamified NẰM GỌN TRONG KHUNG TRẮNG (Áp sát góc trên phải) */}
          {onHelp && (
            <BookHelpButton
              onClick={() => {
                sound.playClick()
                onHelp()
              }}
              style={{
                position: 'absolute',
                top: '10px',
                right: '12px',
                width: '32px',
                height: '32px',
                zIndex: 35,
              }}
            />
          )}

          {/* 1. HEADER ZONE (FIXED - flex-shrink-0) */}
          {title && (
            <div
              className="flex-shrink-0 pb-1.5 text-center"
              style={{
                flexShrink: 0,
                paddingBottom: '6px',
                paddingLeft: onHelp ? '36px' : '10px',
                paddingRight: onHelp ? '36px' : '10px',
                textAlign: 'center',
                writingMode: 'horizontal-tb',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 900,
                  color: '#1E1B4B',
                  letterSpacing: '-0.2px',
                  writingMode: 'horizontal-tb',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {titleIcon && (
                  <img
                    src={titleIcon}
                    alt=""
                    style={{
                      width: '20px',
                      height: '20px',
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
                    }}
                  />
                )}
                <span>{title}</span>
              </h2>
            </div>
          )}

          {/* 2. BODY CONTENT (SCROLLABLE - flex-1 overflow-y-auto min-h-0) */}
          <div
            className="flex-1 overflow-y-auto min-h-0 anime-slim-scroll flex flex-col gap-2.5"
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              minHeight: 0,
              paddingRight: '2px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxSizing: 'border-box',
              writingMode: 'horizontal-tb',
              textOrientation: 'mixed',
            }}
          >
            {children}
          </div>

          {/* 3. FOOTER / CTA (FIXED - flex-shrink-0 pt-2) */}
          {(primaryAction || secondaryAction) && (
            <div
              className="flex-shrink-0 mt-1.5 pt-2 border-t border-dashed border-slate-200 flex flex-col items-center gap-1"
              style={{
                flexShrink: 0,
                marginTop: '6px',
                paddingTop: '6px',
                borderTop: '1px dashed #E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {primaryAction && (
                <button
                  disabled={primaryAction.disabled}
                  onClick={() => {
                    sound.playClick()
                    primaryAction.onClick()
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    borderRadius: '14px',
                    background: primaryAction.disabled
                      ? 'linear-gradient(180deg, #94A3B8 0%, #64748B 100%)'
                      : 'linear-gradient(180deg, #FBBF24 0%, #F97316 48%, #EA580C 100%)',
                    color: '#FFFFFF',
                    fontSize: '13.5px',
                    fontWeight: 900,
                    border: 'none',
                    boxShadow: primaryAction.disabled
                      ? 'none'
                      : '0 3.5px 0 #9A3412, 0 5px 12px rgba(234, 88, 12, 0.35)',
                    cursor: primaryAction.disabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.1s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
                    boxSizing: 'border-box',
                  }}
                >
                  {primaryAction.label}
                </button>
              )}

              {secondaryAction && (
                <button
                  onClick={() => {
                    sound.playClick()
                    secondaryAction.onClick()
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748B',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    cursor: 'pointer',
                  }}
                >
                  {secondaryAction.label}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
