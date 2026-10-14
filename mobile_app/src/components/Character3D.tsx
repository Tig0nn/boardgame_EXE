import React, { useRef, useEffect, useState } from 'react';
import { sound } from '../utils/audio';

interface Character3DProps {
  x: number;
  y: number;
  isMoving: boolean;
  isDancing?: boolean;
  currentTileIndex?: number;
  tileCoordinates?: Array<{ x: number; y: number; label: string; category?: string }>;
}

export const Character3D: React.FC<Character3DProps> = ({
  x,
  y,
  isMoving,
  isDancing = false,
  currentTileIndex = 0,
  tileCoordinates = [],
}) => {
  const modelViewerRef = useRef<HTMLElement | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const [isWaving, setIsWaving] = useState(false);

  // Expose the real custom-element load result as DOM evidence. Browser DOM snapshots
  // do not necessarily expose model-viewer's JavaScript-only `loaded` getter.
  useEffect(() => {
    const viewer = modelViewerRef.current as (HTMLElement & { loaded?: boolean }) | null;
    if (!viewer) return;
    const ready = () => { viewer.dataset.modelStatus = 'ready'; viewer.dataset.modelLoaded = String(viewer.loaded === true); };
    const failed = () => { viewer.dataset.modelStatus = 'error'; viewer.dataset.modelLoaded = 'false'; };
    viewer.addEventListener('load', ready);
    viewer.addEventListener('error', failed);
    if (viewer.loaded) ready();
    return () => { viewer.removeEventListener('load', ready); viewer.removeEventListener('error', failed); };
  }, []);

  // Tính toán góc nhìn camera-orbit để mặt và mắt nhân vật luôn hướng về phía ô cờ tiếp theo
  const getOrbitThetaForDirection = (dx: number, dy: number): number => {
    // Sector 1: Lên-Trái (Tiles 0 -> 5)
    if (dx < 0 && dy <= 0) return 65;
    // Sector 2: Lên-Phải (Tiles 5 -> 10)
    if (dx > 0 && dy <= 0) return -65;
    // Sector 3: Xuống-Phải (Tiles 10 -> 15)
    if (dx >= 0 && dy > 0) return -20;
    // Sector 4: Xuống-Trái (Tiles 15 -> 0)
    if (dx <= 0 && dy > 0) return 20;
    return 20; // Góc Isometric mặc định
  };

  // Tự động xoay hướng mắt/mặt về phía các ô tiếp theo khi di chuyển
  useEffect(() => {
    if (!modelViewerRef.current) return;

    if (isMoving && tileCoordinates.length > 0) {
      const nextIdx = (currentTileIndex + 1) % tileCoordinates.length;
      const curr = tileCoordinates[currentTileIndex] || { x, y };
      const next = tileCoordinates[nextIdx];
      if (next) {
        const dx = next.x - curr.x;
        const dy = next.y - curr.y;
        const targetTheta = getOrbitThetaForDirection(dx, dy);
        modelViewerRef.current.setAttribute('camera-orbit', `${targetTheta}deg 74deg 135%`);
      }
    }
  }, [isMoving, currentTileIndex, tileCoordinates, x, y]);

  // Chọn animation phù hợp với trạng thái của trò chơi
  const animationName = isDancing
    ? 'CharacterArmature|Jump'
    : isWaving
    ? 'CharacterArmature|Wave'
    : isMoving
    ? 'CharacterArmature|Run'
    : 'CharacterArmature|Idle';

  // Chân nhân vật tiếp đất chuẩn xác tâm bề mặt ô cờ Isometric
  const pawnX = x;
  const pawnY = y - 14;

  // Xử lý khi người chơi chạm vào nhân vật: Vẫy tay chào và cho phép xoay tự do
  const handleInteraction = () => {
    sound.playMascotHello();
    setIsWaving(true);
    window.setTimeout(() => setIsWaving(false), 2200);

    // Hủy timer cũ nếu có
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
    }

    // Tự động hồi phục camera về góc nghiêng chuẩn bàn cờ sau 4 giây đứng yên
    resetTimerRef.current = window.setTimeout(() => {
      if (modelViewerRef.current && !isMoving) {
        modelViewerRef.current.setAttribute('camera-orbit', '20deg 74deg 135%');
      }
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${pawnX}px`,
        top: `${pawnY}px`,
        transform: 'translate(-50%, -88%)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        transition: 'left 0.26s cubic-bezier(0.25, 1, 0.5, 1), top 0.26s cubic-bezier(0.25, 1, 0.5, 1)',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <style>{`
        model-viewer {
          --poster-color: transparent !important;
          --progress-bar-color: transparent !important;
          outline: none !important;
          border: none !important;
          box-shadow: none !important;
          background: transparent !important;
          -webkit-tap-highlight-color: transparent !important;
        }
        model-viewer:focus,
        model-viewer:focus-visible,
        model-viewer:active,
        model-viewer:focus-within {
          outline: none !important;
          border: none !important;
          box-shadow: none !important;
        }
      `}</style>

      {/* Đĩa bóng đổ elip tiếp xúc mềm mại (Soft Contact Shadow) hòa tan vào mặt ô cờ */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '56px',
          height: '18px',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.5) 0%, rgba(15, 23, 42, 0.15) 50%, transparent 75%)',
          filter: 'blur(2px)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* Khung chứa Quân cờ 3D: Căn chỉnh tỷ lệ thanh mảnh, vừa vặn không che xúc xắc */}
      <div
        style={{
          position: 'relative',
          width: '124px',
          height: '144px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
          cursor: 'grab',
          pointerEvents: 'auto',
          touchAction: 'none',
          outline: 'none',
          border: 'none',
          zIndex: 2,
        }}
        onPointerDown={handleInteraction}
      >
        <model-viewer
          ref={modelViewerRef}
          data-model-status="loading"
          src="/assets/character.glb"
          alt="3D Young Student Mascot"
          autoplay
          animation-name={animationName}
          camera-controls
          camera-orbit="20deg 74deg 135%"
          camera-target="auto auto auto"
          field-of-view="auto"
          shadow-intensity="1.2"
          shadow-softness="0.9"
          exposure="1.08"
          interpolation-decay="150"
          disable-zoom
          disable-pan
          interaction-prompt="none"
          tabIndex={-1}
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: 'transparent',
            outline: 'none',
            border: 'none',
          }}
        />
      </div>
    </div>
  );
};



