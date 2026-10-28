import React from 'react'
import { sound } from '../utils/audio'

export interface GamifiedModalProps {
  title?: string
  badgeText?: string
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
        top: '6px',
        right: '10px',
        width: '34px',
        height: '34px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        padding: 0,
        zIndex: 35,
        filter: 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.35))',
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
        src="/assets/cropped/sotay-full-icon.png"
        alt="Sổ tay"
        onError={(e) => {
          if (!e.currentTarget.src.includes('sotay.PNG')) {
            e.currentTarget.src = '/assets/sotay.PNG'
          }
        }}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </button>
  )
}

export const GamifiedModal: React.FC<GamifiedModalProps> = ({
  title,
  badgeText,
  onClose,
  onHelp,
  primaryAction,
  secondaryAction,
  children,
  className = '',
}) => {
  return (
    <div
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
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          sound.playClick()
          onClose()
        }
      }}
    >
      {/* Khung Tinh Gọn Chuẩn Di Động (w-[90%] max-w-[360px] h-[80vh] max-h-[680px]) */}
      <div
        className={`w-[90%] max-w-[360px] h-[80vh] max-h-[680px] mx-auto rounded-[32px] border-4 border-emerald-400 shadow-2xl flex flex-col relative overflow-visible bg-white ${className}`}
        style={{
          position: 'relative',
          width: '90%',
          maxWidth: '360px',
          height: '80vh',
          maxHeight: '680px',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, #6EE7B7 0%, #34D399 35%, #10B981 100%)',
          border: '4px solid #34D399',
          borderRadius: '32px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75), 0 0 20px rgba(52, 211, 153, 0.35)',
          fontFamily: "'Fredoka', 'Baloo 2', system-ui, sans-serif",
          boxSizing: 'border-box',
          animation: 'animePopupScale 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          userSelect: 'none',
          overflow: 'visible',
        }}
      >
        {/* Ruy Băng Hồng Nhỏ Nhắn Tinh Tế (Compact Ribbon) */}
        {badgeText && (
          <div
            style={{
              position: 'absolute',
              top: '-12px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 30,
              background: 'linear-gradient(90deg, #F43F5E 0%, #EC4899 50%, #F43F5E 100%)',
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '11px',
              padding: '3.5px 14px',
              borderRadius: '9999px',
              border: '1.5px solid #FFFFFF',
              boxShadow: '0 3px 10px rgba(225, 29, 72, 0.45)',
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              textAlign: 'center',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
            }}
          >
            {badgeText}
          </div>
        )}

        {/* Nút Sổ Tay Chiến Lược 3D Gamified (Không viền tròn thô, thả nổi tự nhiên) */}
        {onHelp && (
          <BookHelpButton
            onClick={() => {
              sound.playClick()
              onHelp()
            }}
          />
        )}

        {/* Lòng Thẻ Glassmorphic Anime Canvas (Tinh Gọn) */}
        <div
          className="flex-1 flex flex-col overflow-hidden bg-white/95 rounded-[26px] m-1 p-3 px-4 py-3"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: '26px',
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            margin: '4px',
            marginTop: badgeText ? '16px' : '4px',
            padding: '12px 16px 10px 16px',
            boxSizing: 'border-box',
            border: '1.5px solid rgba(255, 255, 255, 0.9)',
            boxShadow: 'inset 0 2px 5px rgba(0, 0, 0, 0.03)',
            color: '#1E1B4B',
          }}
        >
          {/* 1. HEADER ZONE (FIXED - flex-shrink-0) */}
          {title && (
            <div
              className="flex-shrink-0 pb-1.5 text-center"
              style={{
                flexShrink: 0,
                paddingBottom: '6px',
                textAlign: 'center',
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 900,
                  color: '#1E1B4B',
                  letterSpacing: '-0.2px',
                }}
              >
                {title}
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
