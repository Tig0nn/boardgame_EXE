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
      className="mobile-hud w-full px-3 pt-2 flex flex-col space-y-2"
      style={{
        position: 'absolute',
        top: 'max(40px, env(safe-area-inset-top, 40px))',
        left: '12px',
        right: '12px',
        zIndex: 30,
        background: 'transparent',
        border: 'none',
        boxShadow: 'none',
        padding: '0',
        color: '#fcf5e5',
        fontFamily: "'Fredoka', 'Baloo 2', system-ui, sans-serif",
        boxSizing: 'border-box',
        pointerEvents: 'auto',
        maxWidth: '440px',
        margin: '0 auto',
      }}
    >
      {/* ROW 1: TOP BAR (Logo - Balance Vault Capsule - Utilities) */}
      <div
        className="hud-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Left Slot: Game Brand / Logo */}
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
                width: 'clamp(32px, 8.5vw, 38px)',
                height: 'clamp(32px, 8.5vw, 38px)',
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
                src="/assets/cropped/home-luat-choi-btn.png"
                onError={(e) => {
                  e.currentTarget.src = '/assets/nut-home-luat-choi.png'
                }}
                alt="Quay lại Bản đồ"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
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

        {/* Center Slot: Glossy Pill-Shaped Gold Coin Vault Container (Current Balance) */}
        <div
          className="hud-cash-capsule"
          title={`Tiền mặt hiện có: ${money(cash)}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 45%, #d97706 80%, #b45309 100%)',
            border: '2px solid #fef08a',
            borderRadius: '999px',
            padding: '2px clamp(8px, 2.5vw, 14px)',
            boxShadow:
              '0 4px 14px rgba(0, 0, 0, 0.65), 0 0 12px rgba(245, 158, 11, 0.45), inset 0 1.5px 2px rgba(255, 255, 255, 0.7)',
            minWidth: 0,
            flex: '1 1 auto',
            maxWidth: 'calc(100% - clamp(120px, 34vw, 150px))',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              fontSize: 'clamp(7.5px, 2.1vw, 9px)',
              letterSpacing: '0.8px',
              color: '#451a03',
              fontWeight: 900,
              lineHeight: 1,
              fontFamily: "'Fredoka', 'Baloo 2', sans-serif",
              textShadow: '0 1px 0 rgba(254, 240, 138, 0.8)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              textTransform: 'uppercase',
            }}
          >
            💰 TIỀN MẶT
          </span>
          <strong
            style={{
              fontSize: 'clamp(11.5px, 3.4vw, 15.5px)',
              fontWeight: 900,
              color: '#ffffff',
              textShadow: '0 2px 4px rgba(69, 26, 3, 0.95), 0 0 5px rgba(0,0,0,0.6)',
              letterSpacing: '0.4px',
              fontFamily: "'Fredoka', 'Baloo 2', sans-serif",
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.25,
            }}
          >
            {money(cash)}
          </strong>
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
                width: 'clamp(32px, 8.5vw, 38px)',
                height: 'clamp(32px, 8.5vw, 38px)',
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
                width: 'clamp(32px, 8.5vw, 38px)',
                height: 'clamp(32px, 8.5vw, 38px)',
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
          gap: '4px',
          marginTop: '6px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* ROW 2: Relocated Current Round Indicator Badge (Left) & Target Completion Metric (Right) */}
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
          {/* Row 3 Indicator Badge: Rich Purple/Magenta Gradient Pill Container with Soft White Glow */}
          <div
            className="hud-round-section"
            data-testid="hud-sectionplay"
            title={`Chặng hành trình 4 vòng: Vòng ${currentLap} / ${maxLap}`}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: 'linear-gradient(180deg, #7c3aed 0%, #6d28d9 45%, #4c1d95 100%)',
              border: '2px solid #e9d5ff',
              borderRadius: '999px',
              padding: '2.5px clamp(8px, 2.2vw, 12px)',
              boxShadow:
                '0 3px 10px rgba(0, 0, 0, 0.6), 0 0 12px rgba(168, 85, 247, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.4)',
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '11.5px', display: 'inline-block' }}>🚩</span>
            <span
              style={{
                fontFamily: "'Fredoka', 'Baloo 2', sans-serif",
                fontWeight: 900,
                fontSize: 'clamp(9.5px, 2.6vw, 11.5px)',
                color: '#ffffff',
                textShadow: '0 1.5px 2px rgba(0,0,0,0.8), 0 0 8px rgba(233, 213, 255, 0.6)',
                lineHeight: 1,
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
              }}
            >
              VÒNG {String(currentLap).padStart(2, '0')} / {String(maxLap).padStart(2, '0')}
            </span>
          </div>

          {/* Target Progress Metric Numbers */}
          <div
            className="hud-goal"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: 'clamp(10px, 2.8vw, 11.5px)',
              boxSizing: 'border-box',
              minWidth: 0,
            }}
          >
            <span
              style={{
                color: '#fde68a',
                letterSpacing: '0.4px',
                textShadow: '0 2px 4px rgba(0,0,0,0.9)',
                fontFamily: "'Fredoka', 'Baloo 2', sans-serif",
                fontWeight: 800,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              🏁 Mục Tiêu
            </span>
            <strong
              style={{
                color: '#ffffff',
                textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 6px rgba(251, 191, 36, 0.5)',
                fontFamily: "'Fredoka', 'Baloo 2', sans-serif",
                fontWeight: 900,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                fontSize: 'clamp(10px, 2.8vw, 11.5px)',
                letterSpacing: '0.3px',
              }}
            >
              {(proceeds / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/{goal / 1_000_000}tr
            </strong>
          </div>
        </div>

        {/* ROW 3: Smooth Animated Target Progress Fill Bar */}
        <div
          style={{
            width: '100%',
            height: '8px',
            background: 'rgba(26, 18, 11, 0.88)',
            borderRadius: '999px',
            border: '1.5px solid rgba(253, 230, 138, 0.65)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.65), inset 0 1px 3px rgba(0,0,0,0.9)',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #b45309 0%, #f59e0b 40%, #fbbf24 75%, #fde047 100%)',
              boxShadow: '0 0 10px rgba(253, 224, 71, 0.85)',
              transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      </div>
    </header>
  )
}
