import { money } from '../../../src/game/format'

interface TopHudProps {
  cash: number
  debt?: number
  lawfulProceeds?: number
  currentFund?: number
  targetGoal?: number
  targetFund?: number
  isMuted?: boolean
  onToggleMute?: () => void
  onToggleSound?: () => void
  onHelp?: () => void
  helpDisabled?: boolean
  onHome?: () => void
  onOpenSettings?: () => void
  lap?: number
  round?: number
  totalLaps?: number
  maxRounds?: number
}

export function TopHud({
  cash,
  debt = 0,
  lawfulProceeds,
  currentFund,
  targetGoal,
  targetFund,
  isMuted,
  onToggleMute,
  onToggleSound,
  onHome,
  onOpenSettings,
  lap,
  round,
  totalLaps,
  maxRounds,
}: TopHudProps) {
  const currentLap = lap ?? round ?? 1
  const maxLap = totalLaps ?? maxRounds ?? 4
  const proceeds = lawfulProceeds ?? currentFund ?? 0
  const goal = targetGoal ?? targetFund ?? 90_000_000
  const progress = Math.max(0, Math.min(100, (proceeds / goal) * 100))
  const toggleAudio = onToggleMute ?? onToggleSound

  return (
    <header
      className="mobile-hud w-full px-3 pt-2 flex flex-col space-y-2 select-none"
      style={{
        position: 'absolute',
        top: 'max(16px, env(safe-area-inset-top, 16px))',
        left: '12px',
        right: '12px',
        zIndex: 30,
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        padding: '0',
        color: '#fcf5e5',
        fontFamily: "'Fredoka', sans-serif",
        boxSizing: 'border-box',
        pointerEvents: 'auto',
        maxWidth: '440px',
        margin: '0 auto',
      }}
    >
      {/* ROW 1: TOP BAR (Home/Logo - Balance Vault Capsule - Sound & Settings Utilities) */}
      <div
        className="hud-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Left Slot: Game Brand / Home Button */}
        <div
          className="hud-logo-slot"
          style={{
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          {onHome ? (
            <button
              onClick={onHome}
              title="Quay lại Bản đồ"
              aria-label="Quay lại Bản đồ"
              className="medieval-icon-btn"
              style={{
                width: 'clamp(36px, 9.5vw, 42px)',
                height: 'clamp(36px, 9.5vw, 42px)',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.5))',
                transition: 'transform 0.12s ease',
              }}
              onPointerDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.92)'
              }}
              onPointerUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              <img
                src="/assets/nut-home.PNG"
                onError={(e) => {
                  e.currentTarget.src = '/assets/nut-home-guide.png'
                }}
                alt="Quay lại Bản đồ"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.45))',
                }}
              />
            </button>
          ) : (
            <img
              src="/assets/cropped/app-logo.png"
              onError={(e) => {
                e.currentTarget.src = '/assets/icon.PNG'
              }}
              alt="Mỏ Hỗn (Xoay Vòng Tiến Lui)"
              style={{
                height: 'clamp(34px, 9.5vw, 42px)',
                width: 'auto',
                objectFit: 'contain',
                flexShrink: 0,
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
              }}
            />
          )}
        </div>

        {/* Center Slot: Glassmorphism Cash Balance Capsule (Đã loại bỏ card bo viền nặng nề) */}
        <div
          className="hud-cash-capsule"
          title={`Tiền mặt hiện có: ${money(cash)}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(6px, 2vw, 10px)',
            background: 'rgba(15, 23, 42, 0.68)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(251, 191, 36, 0.35)',
            borderRadius: '999px',
            padding: '3px clamp(12px, 3.2vw, 18px)',
            boxShadow:
              '0 4px 16px rgba(0, 0, 0, 0.55), 0 0 10px rgba(245, 158, 11, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.15)',
            minWidth: 0,
            flex: '1 1 auto',
            boxSizing: 'border-box',
          }}
        >
          {/* Icon Money chính thức từ app_ui_docs/images/money-icon.png */}
          <img
            src="/assets/money-icon.png"
            alt="Tiền mặt"
            style={{
              width: 'clamp(26px, 6.8vw, 32px)',
              height: 'clamp(26px, 6.8vw, 32px)',
              objectFit: 'contain',
              flexShrink: 0,
              filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.55))',
            }}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontSize: 'clamp(7.5px, 2vw, 9px)',
                letterSpacing: '0.8px',
                color: '#fde68a',
                fontWeight: 800,
                lineHeight: 1,
                fontFamily: "'Fredoka', sans-serif",
                textTransform: 'uppercase',
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              }}
            >
              TIỀN MẶT
            </span>
            <strong
              style={{
                fontSize: 'clamp(12px, 3.3vw, 15px)',
                fontWeight: 900,
                color: '#ffffff',
                textShadow: '0 2px 4px rgba(0,0,0,0.85), 0 0 8px rgba(251, 191, 36, 0.4)',
                letterSpacing: '0.4px',
                fontFamily: "'Fredoka', sans-serif",
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
                lineHeight: 1.2,
              }}
            >
              {money(cash)}
            </strong>
          </div>

          {/* Cảnh báo nợ vay (nếu có nợ khẩn cấp) */}
          {debt > 0 && (
            <div
              title={`Nợ khẩn cấp: ${money(debt)}`}
              style={{
                background: 'rgba(239, 68, 68, 0.9)',
                borderRadius: '999px',
                padding: '1.5px 6px',
                fontSize: 'clamp(8.5px, 2.2vw, 10px)',
                fontWeight: 900,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                flexShrink: 0,
              }}
            >
              <span>Nợ:</span>
              <span>-{money(debt)}</span>
            </div>
          )}
        </div>

        {/* Right Slot: Sound & Settings Action Utility Icons */}
        <div
          className="hud-actions"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'clamp(4px, 1.5vw, 8px)',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          {toggleAudio && (
            <button
              onClick={toggleAudio}
              className="medieval-icon-btn"
              aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              style={{
                position: 'relative',
                width: 'clamp(36px, 9.5vw, 42px)',
                height: 'clamp(36px, 9.5vw, 42px)',
                padding: 0,
                flexShrink: 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.5))',
                transition: 'transform 0.12s ease',
              }}
              onPointerDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.92)'
              }}
              onPointerUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              <img
                src="/assets/cropped/sound-btn.png"
                onError={(e) => {
                  e.currentTarget.src = '/assets/sound-btn.png'
                }}
                alt="Âm thanh"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  filter: isMuted ? 'grayscale(0.8) opacity(0.6)' : 'none',
                }}
              />
              {isMuted && (
                <span
                  style={{
                    position: 'absolute',
                    fontSize: '18px',
                    color: '#ef4444',
                    fontWeight: 900,
                    textShadow: '0 0 4px #000000',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </span>
              )}
            </button>
          )}

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="medieval-icon-btn"
              aria-label="Cài đặt"
              title="Cài đặt"
              style={{
                width: 'clamp(36px, 9.5vw, 42px)',
                height: 'clamp(36px, 9.5vw, 42px)',
                padding: 0,
                flexShrink: 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.5))',
                transition: 'transform 0.12s ease',
              }}
              onPointerDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.92)'
              }}
              onPointerUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              <img
                src="/assets/cropped/setting-btn.png"
                onError={(e) => {
                  e.currentTarget.src = '/assets/setting-btn.png'
                }}
                alt="Cài đặt"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            </button>
          )}
        </div>
      </div>

      {/* ROW 2 & ROW 3: ROUND INDICATOR & TARGET PROGRESSION SECTION */}
      <div
        className="hud-layer2"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          marginTop: '6px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* ROW 2: Vòng Chơi (Trái) & Mục Tiêu 90M (Phải) — Thanh thoát, không card bo viền thô */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {/* Vòng Chơi với run-money-icon.png */}
          <div
            className="hud-round-section"
            data-testid="hud-sectionplay"
            title={`Chặng hành trình 4 vòng: Vòng ${currentLap} / ${maxLap}`}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(15, 23, 42, 0.62)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(192, 132, 252, 0.35)',
              borderRadius: '999px',
              padding: '2.5px clamp(8px, 2.2vw, 12px)',
              boxShadow: '0 3px 10px rgba(0, 0, 0, 0.45)',
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
          >
            <img
              src="/assets/run-money-icon.png"
              alt="Vòng chơi"
              style={{
                width: 'clamp(18px, 4.8vw, 22px)',
                height: 'clamp(18px, 4.8vw, 22px)',
                objectFit: 'contain',
                flexShrink: 0,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
              }}
            />
            <span
              style={{
                fontFamily: "'Fredoka', sans-serif",
                fontWeight: 900,
                fontSize: 'clamp(10px, 2.7vw, 12px)',
                color: '#f3e8ff',
                textShadow: '0 1.5px 3px rgba(0,0,0,0.85)',
                lineHeight: 1,
                letterSpacing: '0.4px',
                whiteSpace: 'nowrap',
              }}
            >
              VÒNG {String(currentLap).padStart(2, '0')} / {String(maxLap).padStart(2, '0')}
            </span>
          </div>

          {/* Mục Tiêu với goal-icon.png & chuẩn hóa XXM / 90M */}
          <div
            className="hud-goal"
            title={`Tiến độ mục tiêu: ${(proceeds / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}M / ${goal / 1_000_000}M`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(15, 23, 42, 0.62)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(251, 191, 36, 0.35)',
              borderRadius: '999px',
              padding: '2.5px clamp(8px, 2.2vw, 12px)',
              boxShadow: '0 3px 10px rgba(0, 0, 0, 0.45)',
              boxSizing: 'border-box',
              minWidth: 0,
            }}
          >
            <img
              src="/assets/goal-icon.png"
              alt="Mục tiêu"
              style={{
                width: 'clamp(18px, 4.8vw, 22px)',
                height: 'clamp(18px, 4.8vw, 22px)',
                objectFit: 'contain',
                flexShrink: 0,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
              }}
            />
            <span
              style={{
                color: '#fde68a',
                letterSpacing: '0.3px',
                textShadow: '0 1.5px 3px rgba(0,0,0,0.85)',
                fontFamily: "'Fredoka', sans-serif",
                fontWeight: 800,
                fontSize: 'clamp(10px, 2.7vw, 12px)',
                whiteSpace: 'nowrap',
              }}
            >
              Mục Tiêu
            </span>
            <strong
              style={{
                color: '#ffffff',
                textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 6px rgba(251, 191, 36, 0.5)',
                fontFamily: "'Fredoka', sans-serif",
                fontWeight: 900,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                fontSize: 'clamp(10.5px, 2.8vw, 12px)',
                letterSpacing: '0.3px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {(proceeds / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/{goal / 1_000_000}M
            </strong>
          </div>
        </div>

        {/* ROW 3: Smooth Animated Target Progress Fill Bar */}
        <div
          style={{
            width: '100%',
            height: '7px',
            background: 'rgba(15, 23, 42, 0.75)',
            borderRadius: '999px',
            border: '1px solid rgba(253, 230, 138, 0.4)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.65), inset 0 1px 3px rgba(0,0,0,0.9)',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #d97706 0%, #f59e0b 40%, #fbbf24 75%, #fde047 100%)',
              boxShadow: '0 0 10px rgba(253, 224, 71, 0.85)',
              borderRadius: '999px',
              transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      </div>
    </header>
  )
}
