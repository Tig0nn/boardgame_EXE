import React from 'react';

interface TopHudProps {
  cash: number;
  debt: number;
  netWorth: number;
  lawfulProceeds: number;
  targetGoal: number;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onOpenRulebook?: () => void;
}

export const TopHud: React.FC<TopHudProps> = ({
  cash,
  debt,
  netWorth,
  lawfulProceeds,
  targetGoal,
  isMuted = false,
  onToggleMute,
  onOpenRulebook,
}) => {
  const formatMoney = (val: number) => {
    return (val / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + 'M ₫';
  };

  const progressPercent = Math.max(0, Math.min(Math.round((lawfulProceeds / targetGoal) * 100), 100));

  return (
    <div style={{
      position: 'absolute',
      top: '24px',
      left: '16px',
      right: '16px',
      zIndex: 30,
    }}>
      {/* 1 Khung Board Kính Trong Suốt Đại Dương (Cyan / Ocean Glassmorphism) */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(14, 40, 70, 0.45) 0%, rgba(8, 25, 48, 0.55) 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(56, 189, 248, 0.45)',
        borderRadius: '26px',
        padding: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '9px',
      }}>
        {/* Hàng 1: User Profile, Tiến Độ & Nút Âm Thanh */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* User Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
              border: '1.5px solid #38BDF8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
            }}>
              🎯
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#F0F9FF', whiteSpace: 'nowrap' }}>
                Nhà Đầu Tư
              </div>
              <div style={{ fontSize: '11px', color: '#BAE6FD' }}>
                Mục tiêu: <span style={{ color: '#FDE047', fontWeight: 700 }}>{formatMoney(targetGoal)}</span>
              </div>
            </div>
          </div>

          {/* Cụm Phải: Thanh tiến độ, Nút Sổ tay & Nút âm thanh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '6px', flexShrink: 0 }}>
            <div style={{ width: 'clamp(36px, 14vw, 75px)' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                fontWeight: 700,
                marginBottom: '3px',
                color: '#E0F2FE',
              }}>
                <span>Tiến độ</span>
                <span style={{ color: '#38BDF8' }}>{progressPercent}%</span>
              </div>
              <div style={{
                height: '7px',
                background: 'rgba(0, 0, 0, 0.35)',
                borderRadius: '999px',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #06B6D4, #38BDF8)',
                  borderRadius: '999px',
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>

            {/* Nút Sổ Tay Luật Chơi */}
            {onOpenRulebook && (
              <button
                onClick={onOpenRulebook}
                style={{
                  width: '36px',
                  height: '36px',
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#FFFFFF',
                  boxShadow: 'none',
                  transition: 'transform 0.15s ease, opacity 0.15s ease',
                  flexShrink: 0,
                  padding: 0,
                }}
                aria-label="Sổ tay luật chơi"
                title="Sổ tay luật chơi"
              >
                📖
              </button>
            )}

            {/* Nút Âm Thanh */}
            {onToggleMute && (
              <button
                onClick={onToggleMute}
                style={{
                  width: '36px',
                  height: '36px',
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '19px',
                  cursor: 'pointer',
                  color: '#FFFFFF',
                  boxShadow: 'none',
                  transition: 'transform 0.15s ease, opacity 0.15s ease',
                  flexShrink: 0,
                  padding: 0,
                  opacity: isMuted ? 0.65 : 1,
                }}
                title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
            )}
          </div>
        </div>

        {/* Hàng 2: 3 Chỉ Số Tài Chính Tích Hợp (Tiền mặt, Nợ vay, Tài sản ròng) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          paddingTop: '6px',
          borderTop: '1px solid rgba(56, 189, 248, 0.2)',
        }}>
          {/* Tiền mặt */}
          <div style={{
            background: 'rgba(8, 25, 48, 0.4)',
            border: '1px solid rgba(52, 211, 153, 0.35)',
            borderRadius: '14px',
            padding: '6px 8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '11px', color: '#A7F3D0', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
              <span>💵</span> Tiền mặt
            </div>
            <div className="font-display" style={{ fontSize: '17px', fontWeight: 800, color: '#34D399', marginTop: '1px' }}>
              {formatMoney(cash)}
            </div>
          </div>

          {/* Nợ vay */}
          <div style={{
            background: 'rgba(8, 25, 48, 0.4)',
            border: '1px solid rgba(248, 113, 113, 0.35)',
            borderRadius: '14px',
            padding: '6px 8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '11px', color: '#FECACA', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
              <span>💳</span> Nợ vay
            </div>
            <div className="font-display" style={{ fontSize: '17px', fontWeight: 800, color: '#F87171', marginTop: '1px' }}>
              {formatMoney(debt)}
            </div>
          </div>

          {/* Tài sản ròng */}
          <div style={{
            background: 'rgba(8, 25, 48, 0.4)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '14px',
            padding: '6px 8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '11px', color: '#BAE6FD', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
              <span>📊</span> Tài sản ròng
            </div>
            <div className="font-display" style={{ fontSize: '17px', fontWeight: 800, color: '#38BDF8', marginTop: '1px' }}>
              {formatMoney(netWorth)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
