import React from 'react';
import { Character3D } from './Character3D';

interface BoardViewProps {
  currentTileIndex: number;
  tileCoordinates: Array<{ x: number; y: number; label: string; category?: string }>;
  lap: number;
  totalLaps: number;
  isPawnMoving?: boolean;
  isDancing?: boolean;
  shakeScreen?: boolean;
  children?: React.ReactNode;
  replacementTiles?: number[];
}

export const BoardView: React.FC<BoardViewProps> = ({
  currentTileIndex,
  tileCoordinates,
  lap,
  totalLaps,
  isPawnMoving = false,
  isDancing = false,
  shakeScreen = false,
  children,
  replacementTiles = [],
}) => {
  const currentCoord = tileCoordinates[currentTileIndex] || { x: 470, y: 1120 };
  const currentTile = tileCoordinates[currentTileIndex];
  const isDangerTile = currentTile?.category === 'shock' || currentTile?.category === 'obligation';

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      width: '940px',
      height: '1672px',
      overflow: 'hidden',
      animation: shakeScreen ? 'screenShake 0.35s ease' : 'none',
    }}>
      {/* Lớp Viền Đỏ Chớp Cảnh Báo (Flash Alert Overlay) */}
      {shakeScreen && (
        <div style={{
          position: 'absolute',
          inset: 0,
          border: '12px solid rgba(239, 68, 68, 0.65)',
          borderRadius: '44px',
          boxShadow: 'inset 0 0 60px rgba(239, 68, 68, 0.5)',
          pointerEvents: 'none',
          zIndex: 70,
          animation: 'redFlash 0.35s ease',
        }} />
      )}

      {/* 1. Nền Cỏ Game (Layer 1) */}
      <img
        src="/assets/main-background.png"
        alt="Nền bàn cờ"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '940px',
          height: '1672px',
          objectFit: 'cover',
          pointerEvents: 'none',
        }}
      />

      {/* 2. Bàn Cờ Isometric Playboard (Layer 2) */}
      <img
        src="/assets/playboard.PNG"
        alt="Bàn cờ góc nhìn nghiêng"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '940px',
          height: '1672px',
          objectFit: 'contain',
          pointerEvents: 'none',
          filter: 'drop-shadow(0 25px 40px rgba(0, 0, 0, 0.45))',
        }}
      />

      {/* Temporary rule markers cover obsolete faces without modifying approved art. */}
      {replacementTiles.map(index => {
        const tile = tileCoordinates[index];
        return <div key={index} className={`board-rule-marker marker-${index}`} style={{ left: tile.x, top: tile.y }}
          aria-label={`Ô ${index + 1}: ${tile.label}`}>
          <span aria-hidden="true">{index === 3 ? '↗' : '◆'}</span><b>{index + 1} · {tile.label}</b>
        </div>;
      })}
      {/* Vòng Hào Quang Tỏa Sáng Tại Tâm Ô Đang Dừng (Pulse Glow Ring) */}
      <div style={{
        position: 'absolute',
        left: `${currentCoord.x}px`,
        top: `${currentCoord.y}px`,
        transform: 'translate(-50%, -50%)',
        width: '74px',
        height: '42px',
        borderRadius: '50%',
        background: isDangerTile 
          ? 'radial-gradient(ellipse, rgba(239, 68, 68, 0.7) 0%, rgba(239, 68, 68, 0) 70%)'
          : 'radial-gradient(ellipse, rgba(251, 191, 36, 0.8) 0%, rgba(251, 191, 36, 0) 70%)',
        boxShadow: isDangerTile
          ? '0 0 30px rgba(239, 68, 68, 0.6)'
          : '0 0 35px rgba(251, 191, 36, 0.7)',
        zIndex: 22,
        pointerEvents: 'none',
        animation: 'tilePulse 1.6s ease-in-out infinite',
      }} />

      {/* 3. Bảng Gỗ "Vòng Hiện Tại" (Layer 3) */}
      <img
        src="/assets/sectionplay.PNG"
        alt="Section Play Board"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '940px',
          height: '1672px',
          objectFit: 'contain',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      />

      {/* Text Số Vòng Trong Lòng Bảng Gỗ */}
      <div style={{
        position: 'absolute',
        top: '802px',
        left: '482px',
        transform: 'translate(-50%, -50%)',
        zIndex: 25,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        <span className="font-display" style={{
          fontSize: '34px',
          fontWeight: 900,
          color: '#FEF08A',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.8), 0 0 16px rgba(245, 158, 11, 0.6)',
          letterSpacing: '1px',
        }}>
          {String(lap).padStart(2, '0')} / {String(totalLaps).padStart(2, '0')}
        </span>
      </div>

      {/* Overlay Children (Dice3D, AnchorOverlay, FloatingMoney) */}
      {children}

      {/* Nhân Vật Hoạt Hình 3D Con Người (Bạn Nam Học Sinh Da Trắng Năng Động) */}
      <Character3D
        x={currentCoord.x}
        y={currentCoord.y}
        isMoving={isPawnMoving}
        isDancing={isDancing}
        currentTileIndex={currentTileIndex}
        tileCoordinates={tileCoordinates}
      />

      <style>{`
        @keyframes tilePulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.6;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.35);
            opacity: 0.95;
          }
        }
        @keyframes screenShake {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-8px, 6px); }
          40% { transform: translate(8px, -6px); }
          60% { transform: translate(-6px, -4px); }
          80% { transform: translate(6px, 4px); }
        }
        @keyframes redFlash {
          0%, 100% { opacity: 0; }
          30%, 70% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
