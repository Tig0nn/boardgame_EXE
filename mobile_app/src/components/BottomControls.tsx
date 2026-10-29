import React from 'react';
import { sound } from '../utils/audio';

export interface BottomControlsProps {
  onRollClick?: () => void;
  onBagClick?: () => void;
  onPortfolioClick?: () => void;
  onGuideClick?: () => void;
  onLogClick?: () => void;
  lastDiceValue?: number;
  disabled?: boolean;

  // Interface contract props
  onRollDice?: () => void;
  canRoll?: boolean;
  isRolling?: boolean;
  onOpenBag?: () => void;
  onOpenGuide?: () => void;
}

export const BottomControls: React.FC<BottomControlsProps> = ({
  onRollClick,
  onBagClick,
  onPortfolioClick,
  onGuideClick,
  onLogClick,
  lastDiceValue,
  disabled,
  onRollDice,
  canRoll,
  isRolling,
  onOpenBag,
  onOpenGuide,
}) => {
  const handleBag = onOpenBag || onBagClick || onPortfolioClick || (() => {});
  const handleGuide = onOpenGuide || onGuideClick || onLogClick || (() => {});
  const handleRoll = onRollDice || onRollClick || (() => {});

  const isDisabled =
    disabled !== undefined
      ? disabled
      : (canRoll !== undefined ? !canRoll : false) || (isRolling ?? false);

  const onBagPress = () => {
    sound.playClick();
    sound.triggerHaptic('light');
    handleBag();
  };

  const onGuidePress = () => {
    sound.playClick();
    sound.triggerHaptic('light');
    handleGuide();
  };

  const onRollPress = () => {
    if (isDisabled) return;
    sound.playDiceRoll();
    sound.triggerHaptic('medium');
    handleRoll();
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        width: '100%',
        maxWidth: '440px',
        margin: '0 auto',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'none',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* Badge hiển thị kết quả vừa gieo phong cách Retro Game Badge */}
      {lastDiceValue && (
        <div
          style={{
            background: 'linear-gradient(180deg, #1e1b4b 0%, #0f172a 100%)',
            color: '#fde68a',
            padding: '4px 14px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 900,
            border: '2px solid #f59e0b',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.65), 0 0 10px rgba(245, 158, 11, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '6px',
            pointerEvents: 'auto',
            animation: 'fadeIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            fontFamily: "'Fredoka', 'Baloo 2', sans-serif",
            textShadow: '0 0 8px rgba(251, 191, 36, 0.8), 2px 2px 0px rgba(0,0,0,0.8)',
          }}
        >
          <span style={{ fontSize: '18px', display: 'inline-block', transform: 'rotate(-5deg)' }}>🎲</span>
          <span style={{ letterSpacing: '1px', fontWeight: 800 }}>: {lastDiceValue}</span>
        </div>
      )}

      {/* Floating Controls Row */}
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          margin: '0 auto',
          padding: '0 clamp(8px, 2.5vw, 16px) max(8px, env(safe-area-inset-bottom)) clamp(8px, 2.5vw, 16px)',
          paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          pointerEvents: 'auto',
        }}
      >
        {/* Bên Trái: Nút Túi Đồ (Icon Huy Hiệu Gỗ Túi Đồ To Đẹp) */}
        <button
          onClick={onBagPress}
          title="Túi Đồ (Ví Tài Sản & Nhật Ký)"
          aria-label="Túi Đồ"
          className="medieval-icon-btn"
          style={{
            background: 'none',
            border: 'none',
            padding: '2px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none',
            marginBottom: '4px',
            minWidth: '48px',
            minHeight: '48px',
            width: 'clamp(56px, 16vw, 68px)',
            height: 'clamp(56px, 16vw, 68px)',
            boxSizing: 'border-box',
            filter: 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.55))',
            transition: 'transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.92)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onTouchStart={(e) => {
            e.currentTarget.style.transform = 'scale(0.92)';
          }}
          onTouchEnd={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <img
            src="/assets/cropped/tuido-icon.png"
            alt="Túi Đồ"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              pointerEvents: 'none',
            }}
            onError={(e) => {
              if (!e.currentTarget.src.includes('tui-do.png')) {
                e.currentTarget.src = '/assets/tui-do.png';
              }
            }}
          />
        </button>

        {/* Ở Giữa: Nút Lắc Xúc Xắc Nằm Sát Đáy Chân Thực, To Rõ Dễ Bấm */}
        <button
          onClick={onRollPress}
          disabled={isDisabled}
          title={isDisabled ? 'Đang thực hiện lượt...' : 'Chạm để Gieo Xúc Xắc'}
          aria-label="Lắc Xúc Xắc"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            opacity: isDisabled ? 0.65 : 1,
            outline: 'none',
            transition: 'transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1)',
            filter: 'drop-shadow(0 10px 24px rgba(0, 0, 0, 0.6))',
            animation: !isDisabled ? 'nutlacBreathe 2.4s infinite ease-in-out' : 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '-4px',
            minWidth: '48px',
            minHeight: '48px',
            width: 'clamp(128px, 34vw, 156px)',
            height: 'clamp(68px, 18vw, 86px)',
            boxSizing: 'border-box',
          }}
          onMouseDown={(e) => {
            if (!isDisabled) e.currentTarget.style.transform = 'scale(0.92)';
          }}
          onMouseUp={(e) => {
            if (!isDisabled) e.currentTarget.style.transform = 'scale(1)';
          }}
          onTouchStart={(e) => {
            if (!isDisabled) e.currentTarget.style.transform = 'scale(0.92)';
          }}
          onTouchEnd={(e) => {
            if (!isDisabled) e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <img
            src="/assets/cropped/nutlac-btn.webp"
            alt="Lắc Xúc Xắc"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              pointerEvents: 'none',
            }}
            onError={(e) => {
              if (!e.currentTarget.src.includes('nutlac-btn.png')) {
                e.currentTarget.src = '/assets/cropped/nutlac-btn.png';
              } else if (!e.currentTarget.src.includes('nutlac.PNG')) {
                e.currentTarget.src = '/assets/nutlac.PNG';
              }
            }}
          />
        </button>

        {/* Bên Phải: Nút Sổ Tay (Kiến Thức) (Icon Huy Hiệu Gỗ To Đẹp) */}
        <button
          onClick={onGuidePress}
          title="Sổ Tay Chiến Lược (Kiến Thức)"
          aria-label="Sổ Tay"
          className="medieval-icon-btn"
          style={{
            background: 'none',
            border: 'none',
            padding: '2px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none',
            marginBottom: '4px',
            minWidth: '48px',
            minHeight: '48px',
            width: 'clamp(56px, 16vw, 68px)',
            height: 'clamp(56px, 16vw, 68px)',
            boxSizing: 'border-box',
            filter: 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.55))',
            transition: 'transform 0.12s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.92)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          onTouchStart={(e) => {
            e.currentTarget.style.transform = 'scale(0.92)';
          }}
          onTouchEnd={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <img
            src="/assets/cropped/sotay-full-icon.png"
            alt="Sổ Tay"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              pointerEvents: 'none',
            }}
            onError={(e) => {
              if (!e.currentTarget.src.includes('sotay.PNG')) {
                e.currentTarget.src = '/assets/sotay.PNG';
              }
            }}
          />
        </button>
      </div>

      <style>{`
        @keyframes nutlacBreathe {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
};

