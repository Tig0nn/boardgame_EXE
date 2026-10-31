import React, { useState } from 'react';
import { Character3D } from './Character3D';
import { Modal } from '../../../src/components/Modal';
import { tileInformation } from '../../../src/components/tile-information';
import { GlossaryText } from '../../../src/components/FinancialTerm';
import { tileDisplayLabel } from '../../../src/components/player-language';
import type { GameState, TileType } from '../../../src/game/types';

interface BoardViewProps {
  currentTileIndex: number;
  tileCoordinates: Array<{ index?: number; type?: string; x: number; y: number; label: string; category?: string }>;
  lap?: number;
  totalLaps?: number;
  isPawnMoving?: boolean;
  isDancing?: boolean;
  shakeScreen?: boolean;
  children?: React.ReactNode;
  game?: GameState;
}

export const BoardView: React.FC<BoardViewProps> = ({
  currentTileIndex,
  tileCoordinates,
  lap = 1,
  totalLaps = 4,
  isPawnMoving = false,
  isDancing = false,
  shakeScreen = false,
  children,
  game,
}) => {
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
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

      {/* 1. Nền Cỏ Game (Layer 1 - Tối ưu WebP Q88 kèm fallback) */}
      <img
        src="/assets/main-background.webp"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = '/assets/main-background.png';
        }}
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

      {/* 2. Bàn Cờ Isometric Playboard-4 Fit Bãi Cỏ (Layer 2) */}
      <img
        src="/assets/playboard-4.PNG"
        alt="Bàn cờ góc nhìn nghiêng"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '940px',
          height: '1672px',
          objectFit: 'contain',
          pointerEvents: 'none',
          filter: 'drop-shadow(0 20px 32px rgba(0, 0, 0, 0.4))',
        }}
      />

      {/* 4-Lap Journey Layout Anchor: Ensures vertical clearance for 3D character pawns without distortion */}
      <div
        className="board-journey-indicator"
        data-lap={lap}
        data-total-laps={totalLaps}
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '320px',
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          zIndex: 10,
          opacity: 0,
        }}
      />

      {/* 18 Ô Bàn Cờ Tương Tác & Đo Đạc (Interactive Tile Anchors for Accessibility & Inspection) */}
      {tileCoordinates.map((tile, i) => (
        <button
          key={i}
          data-b18-tile={i}
          aria-label={`Ô ${i + 1}: ${tileDisplayLabel(tile.label)}`}
          aria-current={currentTileIndex === i ? 'step' : undefined}
          onClick={() => setSelectedTile(i)}
          style={{
            position: 'absolute',
            left: `${tile.x}px`,
            top: `${tile.y}px`,
            transform: 'translate(-50%, -50%)',
            width: '56px',
            height: '40px',
            background: 'transparent',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            zIndex: 21,
            outline: 'none',
          }}
        />
      ))}

      {/* Vòng Hào Quang Tỏa Sáng Tại Tâm Ô Đang Dừng (Pulse Glow Ring) */}
      <div style={{
        position: 'absolute',
        left: `${currentCoord.x}px`,
        top: `${currentCoord.y}px`,
        transform: 'translate(-50%, -50%)',
        width: '68px',
        height: '38px',
        borderRadius: '50%',
        background: isDangerTile 
          ? 'radial-gradient(ellipse, rgba(239, 68, 68, 0.7) 0%, rgba(239, 68, 68, 0) 70%)'
          : 'radial-gradient(ellipse, rgba(251, 191, 36, 0.8) 0%, rgba(251, 191, 36, 0) 70%)',
        boxShadow: isDangerTile
          ? '0 0 25px rgba(239, 68, 68, 0.6)'
          : '0 0 30px rgba(251, 191, 36, 0.7)',
        zIndex: 22,
        pointerEvents: 'none',
        animation: 'tilePulse 1.6s ease-in-out infinite',
      }} />

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

      {/* Modal Chi Tiết Ô Khi Bấm Vào (Tile Inspection Modal) */}
      {selectedTile !== null && (
        <Modal
          title={`Ô ${selectedTile + 1}: ${tileDisplayLabel(tileCoordinates[selectedTile]?.label || '')}`}
          onClose={() => setSelectedTile(null)}
        >
          <h2>{tileCoordinates[selectedTile]?.type === 'start' ? 'Ô Xuất phát' : tileDisplayLabel(tileCoordinates[selectedTile]?.label || '')}</h2>
          <p>
            <GlossaryText text={tileInformation((tileCoordinates[selectedTile]?.type || 'start') as TileType, game)} />
          </p>
          <button className="button primary full-button" onClick={() => setSelectedTile(null)}>
            Trở về bàn
          </button>
        </Modal>
      )}

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
