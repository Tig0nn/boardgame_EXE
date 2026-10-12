import React from 'react';

interface Dice3DProps {
  value?: number;
  isRolling: boolean;
  onRollClick: () => void;
  disabled?: boolean;
  isPawnMoving?: boolean;
  isUpOnLawn?: boolean;
}

export const Dice3D: React.FC<Dice3DProps> = ({
  value = 1,
  isRolling,
  onRollClick,
  disabled = false,
  isPawnMoving = false,
  isUpOnLawn,
}) => {
  // Hàm kiến trúc Dynamic Face Mapping:
  // Đảm bảo Mặt trên cùng (Top Face) LUÔN LUÔN hiển thị 100% chính xác bằng `value`.
  // Các mặt đối diện luôn có tổng bằng 7 chuẩn xác như xúc xắc thật ngoài đời.
  const getDiceFaceNumbers = (val: number) => {
    const top = Math.min(Math.max(val || 1, 1), 6);
    const bottom = 7 - top;

    let front = 1;
    let right = 3;
    if (top === 1 || top === 6) {
      front = 2;
      right = 3;
    } else if (top === 2 || top === 5) {
      front = 1;
      right = 3;
    } else if (top === 3 || top === 4) {
      front = 1;
      right = 2;
    }
    const back = 7 - front;
    const left = 7 - right;

    return { top, bottom, front, back, right, left };
  };

  const faces = getDiceFaceNumbers(value);

  // Render các chấm tròn trên từng mặt xúc xắc
  const renderDots = (count: number, isTopHighlight = false) => {
    const isRed = count === 1;
    const dotColor = isRed ? '#EF4444' : '#1E293B';
    const dotSize = isRed ? '18px' : '11px';

    const getDotPositions = () => {
      switch (count) {
        case 1:
          return [{ top: '50%', left: '50%' }];
        case 2:
          return [
            { top: '25%', left: '25%' },
            { top: '75%', left: '75%' },
          ];
        case 3:
          return [
            { top: '22%', left: '22%' },
            { top: '50%', left: '50%' },
            { top: '78%', left: '78%' },
          ];
        case 4:
          return [
            { top: '24%', left: '24%' },
            { top: '24%', left: '76%' },
            { top: '76%', left: '24%' },
            { top: '76%', left: '76%' },
          ];
        case 5:
          return [
            { top: '22%', left: '22%' },
            { top: '22%', left: '78%' },
            { top: '50%', left: '50%' },
            { top: '78%', left: '22%' },
            { top: '78%', left: '78%' },
          ];
        case 6:
          return [
            { top: '20%', left: '28%' },
            { top: '50%', left: '28%' },
            { top: '80%', left: '28%' },
            { top: '20%', left: '72%' },
            { top: '50%', left: '72%' },
            { top: '80%', left: '72%' },
          ];
        default:
          return [];
      }
    };

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {getDotPositions().map((pos, idx) => (
          <div
            key={idx}
            style={{
              position: 'absolute',
              top: pos.top,
              left: pos.left,
              transform: 'translate(-50%, -50%)',
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              backgroundColor: dotColor,
              boxShadow: isTopHighlight
                ? 'inset 0 1px 2px rgba(0, 0, 0, 0.4), 0 0 4px rgba(56, 189, 248, 0.3)'
                : 'inset 0 1px 2px rgba(0, 0, 0, 0.4)',
            }}
          />
        ))}
      </div>
    );
  };

  const baseFaceStyle: React.CSSProperties = {
    position: 'absolute',
    width: '68px',
    height: '68px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
  };

  // Trạng thái: Nằm trên sân cỏ hay ở hốc Footer
  const isUp = isUpOnLawn !== undefined ? isUpOnLawn : (isRolling || isPawnMoving);
  const currentTop = isUp ? '945px' : '1600px';

  return (
    <div
      onClick={!disabled && !isRolling ? onRollClick : undefined}
      style={{
        position: 'absolute',
        top: currentTop,
        left: '470px',
        transform: `translate(-50%, -50%) scale(${isUp ? 1 : 0.88})`,
        zIndex: 55,
        cursor: disabled || isRolling ? 'default' : 'pointer',
        perspective: '1200px',
        transition: 'top 0.65s cubic-bezier(0.22, 1, 0.36, 1), transform 0.4s ease',
      }}
    >
      {/* Container chuyển động ném hoặc bồng bềnh */}
      <div className={isRolling ? 'dice-toss-animation' : isUp ? 'dice-idle-float' : 'dice-footer-dock'}>
        {/* Badge số kết quả gieo được lơ lửng rõ ràng trên đầu xúc xắc */}
        {isUp && !isRolling && (
          <div style={{
            position: 'absolute',
            top: '-42px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
            border: '1.5px solid #38BDF8',
            color: '#FFFFFF',
            padding: '3px 12px',
            borderRadius: '999px',
            fontSize: '13px',
            fontWeight: 800,
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.6)',
            whiteSpace: 'nowrap',
            animation: 'popBadge 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            pointerEvents: 'none',
            zIndex: 60,
          }}>
            🎲 {value} Bước
          </div>
        )}

        {/* Bóng đổ trên mặt cỏ (chỉ hiện khi xúc xắc ở trên sân cỏ) */}
        {isUp && (
          <div className={`dice-ground-shadow ${isRolling ? 'shadow-bounce' : ''}`} />
        )}

        {/* Khối Lập Phương 3D CSS Cube với góc phối cảnh Isometric hoàn hảo */}
        <div
          className={`dice-cube ${isRolling ? 'cube-tumbling' : ''}`}
          style={{
            transform: !isRolling
              ? 'rotateX(-30deg) rotateY(-22deg) rotateZ(0deg)'
              : undefined,
          }}
        >
          {/* Mặt Top: LUÔN LÀ VALUE (Mặt kết quả ngửa lên trên mắt người chơi) */}
          <div
            style={{
              ...baseFaceStyle,
              background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 60%, #F1F5F9 100%)',
              border: '1.5px solid #CBD5E1',
              boxShadow: 'inset 0 0 10px rgba(56, 189, 248, 0.2), 0 1px 3px rgba(0, 0, 0, 0.2)',
              transform: 'rotateX(90deg) translateZ(34px)',
            }}
          >
            {renderDots(faces.top, true)}
          </div>

          {/* Mặt Bottom: Đối diện mặt Top (Tổng = 7) */}
          <div
            style={{
              ...baseFaceStyle,
              background: '#CBD5E1',
              border: '1px solid #94A3B8',
              transform: 'rotateX(-90deg) translateZ(34px)',
            }}
          >
            {renderDots(faces.bottom)}
          </div>

          {/* Mặt Front: Hướng trực diện phía dưới */}
          <div
            style={{
              ...baseFaceStyle,
              background: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)',
              border: '1px solid #CBD5E1',
              boxShadow: 'inset 0 0 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.2)',
              transform: 'rotateY(0deg) translateZ(34px)',
            }}
          >
            {renderDots(faces.front)}
          </div>

          {/* Mặt Back: Đối diện mặt Front (Tổng = 7) */}
          <div
            style={{
              ...baseFaceStyle,
              background: '#CBD5E1',
              border: '1px solid #94A3B8',
              transform: 'rotateY(180deg) translateZ(34px)',
            }}
          >
            {renderDots(faces.back)}
          </div>

          {/* Mặt Right: Phía bên phải (Có bóng đổ nhẹ tạo chiều sâu 3D) */}
          <div
            style={{
              ...baseFaceStyle,
              background: 'linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)',
              border: '1px solid #94A3B8',
              boxShadow: 'inset 0 0 8px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.2)',
              transform: 'rotateY(90deg) translateZ(34px)',
            }}
          >
            {renderDots(faces.right)}
          </div>

          {/* Mặt Left: Đối diện mặt Right (Tổng = 7) */}
          <div
            style={{
              ...baseFaceStyle,
              background: '#CBD5E1',
              border: '1px solid #94A3B8',
              transform: 'rotateY(-90deg) translateZ(34px)',
            }}
          >
            {renderDots(faces.left)}
          </div>
        </div>
      </div>

      <style>{`
        .dice-cube {
          width: 68px;
          height: 68px;
          position: relative;
          transform-style: preserve-3d;
          transition: transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28);
        }

        .dice-ground-shadow {
          position: absolute;
          left: 50%;
          bottom: -18px;
          transform: translateX(-50%);
          width: 64px;
          height: 18px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.45);
          filter: blur(5px);
          transition: all 0.2s ease;
        }

        /* Khi ở Footer Dock: Nhịp thở mời gọi người chơi chạm vào gieo */
        .dice-footer-dock {
          position: relative;
          animation: diceFooterPulse 2.2s ease-in-out infinite;
        }

        @keyframes diceFooterPulse {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 4px 10px rgba(56, 189, 248, 0.45));
          }
          50% {
            transform: scale(1.06);
            filter: drop-shadow(0 8px 18px rgba(56, 189, 248, 0.8));
          }
        }

        /* Khi Idle trên bãi cỏ: Nổi bồng bềnh nhẹ trên bãi cỏ */
        .dice-idle-float {
          position: relative;
          animation: diceHover 2.5s ease-in-out infinite;
        }

        @keyframes diceHover {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        /* Hoạt họa bắn từ nút GIEO ở đáy bay vút lên bãi cỏ và nảy 2 nhịp */
        .dice-toss-animation {
          position: relative;
          animation: diceTossAndBounce 0.8s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }

        @keyframes diceTossAndBounce {
          0% {
            /* Xuất phát từ vị trí nút GIEO ở đáy */
            transform: translateY(480px) scale(0.65);
            opacity: 0.8;
          }
          45% {
            /* Đạt đỉnh đường bay trên cao bãi cỏ */
            transform: translateY(-90px) scale(1.15);
            opacity: 1;
          }
          70% {
            /* Tiếp đất nhịp 1 */
            transform: translateY(0px) scale(1);
          }
          85% {
            /* Nảy lên nhịp 2 */
            transform: translateY(-28px) scale(1.04);
          }
          100% {
            /* Nằm yên vững chãi trên bãi cỏ */
            transform: translateY(0px) scale(1);
          }
        }

        /* Xoay lộn 3 trục X, Y, Z tít mù khi bay */
        .cube-tumbling {
          animation: cubeTumbleRoll 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        @keyframes cubeTumbleRoll {
          0% {
            transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg);
          }
          35% {
            transform: rotateX(540deg) rotateY(720deg) rotateZ(360deg);
          }
          70% {
            transform: rotateX(810deg) rotateY(1080deg) rotateZ(540deg);
          }
          100% {
            /* Tiếp đất mượt mà tại góc Isometric chuẩn: -30deg (690deg), -22deg (1058deg), 0deg (360deg) */
            transform: rotateX(690deg) rotateY(1058deg) rotateZ(360deg);
          }
        }

        /* Bóng đổ co giãn theo độ cao bay */
        .shadow-bounce {
          animation: shadowBounce 0.8s ease forwards;
        }

        @keyframes shadowBounce {
          0% {
            transform: translateX(-50%) scale(0.3);
            opacity: 0.1;
          }
          45% {
            transform: translateX(-50%) scale(0.5);
            opacity: 0.2;
          }
          70% {
            transform: translateX(-50%) scale(1.3);
            opacity: 0.65;
          }
          85% {
            transform: translateX(-50%) scale(0.8);
            opacity: 0.35;
          }
          100% {
            transform: translateX(-50%) scale(1);
            opacity: 0.5;
          }
        }

        @keyframes popBadge {
          from {
            transform: translateX(-50%) scale(0.5);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
