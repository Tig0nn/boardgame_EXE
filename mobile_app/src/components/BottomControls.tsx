import React from 'react';
import { Dice3D } from './Dice3D';

interface BottomControlsProps {
  onRollClick: () => void;
  onPortfolioClick: () => void;
  onLogClick: () => void;
  lastDiceValue?: number;
  disabled?: boolean;
}

export const BottomControls: React.FC<BottomControlsProps> = ({
  onRollClick,
  onPortfolioClick,
  onLogClick,
  lastDiceValue,
  disabled = false,
}) => {
  return (
    <div style={{
      position: 'absolute',
      bottom: '36px',
      left: '16px',
      right: '16px',
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px',
    }}>
      {/* Badge hiển thị kết quả vừa gieo nếu có */}
      {lastDiceValue && (
        <div style={{
          background: 'rgba(14, 40, 70, 0.55)',
          color: '#38BDF8',
          padding: '4px 14px',
          borderRadius: '999px',
          fontSize: '12px',
          fontWeight: 800,
          border: '1.5px solid rgba(56, 189, 248, 0.45)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
          backdropFilter: 'blur(8px)',
        }}>
          🎲 Vừa Gieo: {lastDiceValue}
        </div>
      )}

      {/* Thanh điều khiển chính: Khung board kính đại dương trong trẻo, các icon nằm trực tiếp không viền bo */}
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'linear-gradient(180deg, rgba(14, 40, 70, 0.45) 0%, rgba(8, 25, 48, 0.55) 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(56, 189, 248, 0.45)',
        borderRadius: '38px',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        boxShadow: '0 10px 32px rgba(0, 0, 0, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.2)',
      }}>
        {/* Nút Ví Tài Sản (Icon Trực Tiếp, Bỏ Viền Bo Vuông) */}
        <button
          onClick={onPortfolioClick}
          title="Ví Tài Sản"
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: '8px',
            fontSize: '34px',
            lineHeight: 1,
            filter: 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.4))',
            transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.88)'; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.88)'; }}
          onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          💼
        </button>

        {/* Vùng Bấm Gieo Xúc Xắc Tại Footer (Trong Suốt, Bỏ Vòng Bo Tròn Bao Quanh) */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={!disabled ? onRollClick : undefined}
            disabled={disabled}
            title="Chạm vào để Gieo Xúc Xắc"
            aria-label="Gieo xúc xắc"
            style={{
              width: '74px',
              height: '74px',
              background: 'transparent',
              border: 'none',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              padding: 0,
            }}
          ><Dice3D docked value={lastDiceValue || 1} isRolling={false} disabled onRollClick={onRollClick} isUpOnLawn={false} /></button>
        </div>

        {/* Nút Nhật Ký (Icon Trực Tiếp, Bỏ Viền Bo Vuông) */}
        <button
          onClick={onLogClick}
          title="Nhật Ký Hành Trình"
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: '8px',
            fontSize: '34px',
            lineHeight: 1,
            filter: 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.4))',
            transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.88)'; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          onTouchStart={(e) => { e.currentTarget.style.transform = 'scale(0.88)'; }}
          onTouchEnd={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          📜
        </button>
      </div>

      <style>{`
        @keyframes diceButtonBreathe {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 10px 24px rgba(217, 119, 6, 0.55), inset 0 2px 6px rgba(255, 255, 255, 0.65);
          }
          50% {
            transform: scale(1.08);
            box-shadow: 0 16px 36px rgba(245, 158, 11, 0.85), inset 0 2px 8px rgba(255, 255, 255, 0.85);
          }
        }
      `}</style>
    </div>
  );
};

