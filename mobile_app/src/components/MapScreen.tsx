import React, { useState, useRef, useEffect } from 'react';
import {
  MAP_1_NODES,
  type MapNodeConfig,
  type PlayerMapProgress,
  loadMapProgress,
} from '../game/map-progress';
import { MapTopHud } from './MapTopHud';
import { MapBottomDock } from './MapBottomDock';
import { UnifiedGameGuide } from './UnifiedGameGuide';
import { UnifiedManagementSheet } from './UnifiedManagementSheet';
import type { GameState } from '../../../src/game/types';
import { createMvpMobileGame } from '../game/session';
import { loadGameLocally } from '../../../src/game/saved-game';
import { sound } from '../utils/audio';

interface MapScreenProps {
  onBack: () => void;
  onPlayNode: (node: MapNodeConfig) => void;
  onOpenSettings: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  game?: GameState;
  onOpenInventory?: () => void;
  onOpenRules?: () => void;
}

export const MapScreen: React.FC<MapScreenProps> = ({
  onBack,
  onPlayNode,
  onOpenSettings,
  isMuted = false,
  onToggleMute,
  game,
  onOpenInventory,
  onOpenRules,
}) => {
  const [activeGame] = useState<GameState>(() => game || loadGameLocally() || createMvpMobileGame());
  const [progress] = useState<PlayerMapProgress>(() => loadMapProgress());
  const [showInventory, setShowInventory] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleOpenInventory = () => {
    if (onOpenInventory) onOpenInventory();
    else setShowInventory(true);
  };

  const handleOpenRules = () => {
    if (onOpenRules) onOpenRules();
    else setShowRules(true);
  };

  // Tự động định vị camera cuộn về Node 1 (vùng xuất phát) khi mở màn hình
  useEffect(() => {
    if (scrollContainerRef.current) {
      // Chiều cao canvas 2400px, viewport 1672px -> max scroll là 728px.
      // Cuộn xuống 728px sẽ đưa Node 1 (ở 86.5%) vào vị trí quan sát lý tưởng
      scrollContainerRef.current.scrollTop = 728;
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2400);
  };

  const getNodeStatus = (node: MapNodeConfig): 'completed' | 'active' | 'locked' => {
    // Chỉ duy nhất Chương 1 (Node 1 / id: '1.1') là mở khóa để chơi (gồm 4 vòng). Các Chương 2-5 đang cập nhật.
    if (node.id === progress.activeNodeId || node.stageNumber === 1) return 'active';
    return 'locked';
  };

  // Chạm trực tiếp vào Node: Nếu active/completed -> vào thẳng ván game ngay lập tức!
  const handleNodeClick = (node: MapNodeConfig) => {
    const status = getNodeStatus(node);
    sound.playClick();
    if (status === 'locked') {
      showToast(`Chương ${node.stageNumber}: Đang cập nhật!`);
      return;
    }
    // Chạm Node mở là vào thẳng game loop, không qua popup trung gian
    onPlayNode(node);
  };

  return (
    <div
      className="map-screen-root relative select-none overflow-hidden"
      style={{
        position: 'absolute',
        inset: 0,
        width: '940px',
        height: '1672px',
        overflow: 'hidden',
        background: '#0ea5e9',
        fontFamily: "'Fredoka', 'Baloo 2', system-ui, sans-serif",
        userSelect: 'none',
        boxSizing: 'border-box',
        pointerEvents: 'auto',
      }}
    >
      {/* 1. KHUNG CUỘN DỌC BẢN ĐỒ (SCROLLABLE MAP CANVAS 940x2400px) */}
      <div
        ref={scrollContainerRef}
        className="map-scroll-viewport select-none"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          zIndex: 1,
        }}
      >
        <div
          className="map-canvas-content relative"
          style={{
            position: 'relative',
            width: '940px',
            height: '2400px',
            background: '#0284c7',
          }}
        >
          {/* HÌNH NỀN BẢN ĐỒ TỐI ƯU map-no-nodes.webp (1080x2160, ~160KB) */}
          <img
            src="/assets/map-no-nodes.webp"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/assets/map-no-nodes.jpg';
            }}
            alt="Bản đồ phiêu lưu Chương 1"
            className="pointer-events-none select-none"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'fill',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />

          {/* ĐÈN CHIẾU & ĐÁM MÂY TRANG TRÍ TRÊN BẢN ĐỒ */}
          <div
            style={{
              position: 'absolute',
              top: '5%',
              left: '10%',
              width: '320px',
              height: '160px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0) 70%)',
              pointerEvents: 'none',
              filter: 'blur(20px)',
            }}
          />

          {/* 4 INTERACTIVE LEVEL NODES (VÒNG 1 -> VÒNG 4) TRÊN 4 HÒN ĐẢO */}
          {MAP_1_NODES.map((node) => {
            const status = getNodeStatus(node);
            const isCompleted = status === 'completed';
            const isActive = status === 'active';
            const isLocked = status === 'locked';

            return (
              <div
                key={node.id}
                data-node-id={node.id}
                data-testid={`map-node-${node.id}`}
                onClick={() => handleNodeClick(node)}
                style={{
                  position: 'absolute',
                  top: `${node.y}%`,
                  left: `${node.x}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isActive ? 30 : 20,
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                {/* Ghim Map Pin "BẠN ĐANG Ở ĐÂY" bồng bềnh trên Node Active */}
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-84px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      animation: 'activePinFloat 1.2s infinite ease-in-out alternate',
                      zIndex: 35,
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#ffffff',
                        fontSize: '18px',
                        fontWeight: 900,
                        padding: '5px 18px',
                        borderRadius: '22px',
                        border: '2.5px solid #a7f3d0',
                        boxShadow: '0 6px 18px rgba(0,0,0,0.65), 0 0 12px rgba(16, 185, 129, 0.7)',
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.6px',
                      }}
                    >
                      BẠN ĐANG Ở ĐÂY
                    </div>
                    <div
                      style={{
                        width: 0,
                        height: 0,
                        borderLeft: '10px solid transparent',
                        borderRight: '10px solid transparent',
                        borderTop: '11px solid #059669',
                      }}
                    />
                  </div>
                )}

                {/* Vòng hào quang lan tỏa (Halo Pulse Ring) cho Node Active */}
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      width: '176px',
                      height: '176px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, rgba(34, 197, 94, 0.45) 0%, rgba(34, 197, 94, 0) 70%)',
                      animation: 'pulseHalo 1.8s infinite ease-out',
                      pointerEvents: 'none',
                    }}
                  />
                )}

                {/* KHỐI FLOATING NODE SẠCH SẼ - KHÔNG VIỀN CARD THÔ HỘP */}
                <div
                  className={`floating-node-container ${isActive ? 'active-floating-node' : ''}`}
                  style={{
                    position: 'relative',
                    width: '136px',
                    height: '136px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.3s ease',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    animation: isActive ? 'nodePulseGlow 2.2s infinite ease-in-out alternate' : 'none',
                    filter: isActive
                      ? 'drop-shadow(0 0 20px rgba(34, 197, 94, 0.85)) drop-shadow(0 8px 16px rgba(0, 0, 0, 0.55))'
                      : isLocked
                        ? 'brightness(0.18) contrast(1.15) grayscale(100%) drop-shadow(0 6px 14px rgba(0, 0, 0, 0.75))'
                        : 'drop-shadow(0 0 16px rgba(245, 158, 11, 0.75)) drop-shadow(0 8px 16px rgba(0, 0, 0, 0.55))',
                    opacity: isLocked ? 0.78 : 1,
                  }}
                  onPointerDown={(e) => {
                    if (!isLocked) (e.currentTarget as HTMLElement).style.transform = 'scale(0.92)';
                  }}
                  onPointerUp={(e) => {
                    if (!isLocked) (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  }}
                >
                  {/* Ảnh Icon Node PNG / WebP Tối Ưu Nổi Tự Nhiên */}
                  <img
                    src={`/assets/map-chapter-${node.stageNumber}.png`}
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement;
                      if (!img.src.endsWith('.webp')) {
                        img.src = `/assets/map-chapter-${node.stageNumber}.webp`;
                      } else {
                        img.src = `/assets/nodes/node-${node.stageNumber}.png`;
                      }
                    }}
                    alt={`Chương ${node.stageNumber}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* TUYỆT ĐỐI KHÔNG HIỂN THỊ ICON Ổ KHÓA 🔒 Ở ĐÂY */}

                  {/* Huy Hiệu Hoàn Thành (Completed State) */}
                  {isCompleted && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '4px',
                        right: '4px',
                        background: '#f59e0b',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid #ffffff',
                        boxShadow: '0 3px 8px rgba(0,0,0,0.6)',
                        pointerEvents: 'none',
                      }}
                    >
                      <span style={{ fontSize: '18px', lineHeight: 1 }}>🏆</span>
                    </div>
                  )}
                </div>

                {/* Nhãn Tên Chương Dưới Node */}
                <div
                  style={{
                    marginTop: '8px',
                    background: isCompleted
                      ? 'linear-gradient(180deg, #d97706 0%, #b45309 100%)'
                      : isActive
                        ? 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)'
                        : 'rgba(15, 23, 42, 0.88)',
                    border: isCompleted
                      ? '2px solid #fde68a'
                      : isActive
                        ? '2.5px solid #86efac'
                        : '1.5px solid #334155',
                    padding: isActive ? '3px 16px 4px 16px' : '4px 16px',
                    borderRadius: '16px',
                    boxShadow: isActive
                      ? '0 4px 14px rgba(0,0,0,0.7), 0 0 10px rgba(34, 197, 94, 0.4)'
                      : '0 4px 10px rgba(0,0,0,0.6)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1px',
                  }}
                >
                  <span
                    style={{
                      color: isCompleted ? '#fef3c7' : isActive ? '#ffffff' : '#64748b',
                      fontSize: '18px',
                      fontWeight: 900,
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.4px',
                      lineHeight: 1.2,
                    }}
                  >
                    Chương {node.stageNumber}
                  </span>
                  {isActive ? (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#bbf7d0',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        lineHeight: 1.1,
                      }}
                    >
                      {activeGame && activeGame.lap > 0 ? `VÒNG ${activeGame.lap}/4` : '4 VÒNG'}
                    </span>
                  ) : isLocked ? (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#fbbf24',
                        letterSpacing: '0.3px',
                        lineHeight: 1.1,
                      }}
                    >
                      Đang cập nhật
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. HIỆU ỨNG MỜ GRADIENT ĐẦU TRANG ĐẢM BẢO HUD LUÔN RÕ RÀNG */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '180px',
          background: 'linear-gradient(180deg, rgba(10, 25, 45, 0.78) 0%, rgba(10, 25, 45, 0) 100%)',
          pointerEvents: 'none',
          zIndex: 35,
        }}
      />

      {/* 3. TOP HUD CỐ ĐỊNH (TỐI GIẢN: LOGO MỎ HỖN + ÂM THANH + CÀI ĐẶT) */}
      <MapTopHud
        onBack={onBack}
        onOpenSettings={onOpenSettings}
        isMuted={isMuted}
        onToggleMute={onToggleMute}
      />

      {/* 4. BOTTOM UTILITY DOCK CỐ ĐỊNH (TÚI ĐỒ VÀ KIẾN THỨC NEO 2 GÓC BIÊN, KHÔNG VIỀN THẺ) */}
      <MapBottomDock
        onOpenInventory={handleOpenInventory}
        onOpenRules={handleOpenRules}
      />

      {/* 6. TOAST THÔNG BÁO NHANH */}
      {toastMessage && (
        <div
          style={{
            position: 'absolute',
            bottom: '150px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.96)',
            color: '#fef3c7',
            padding: '12px 26px',
            borderRadius: '24px',
            border: '2.5px solid #f59e0b',
            boxShadow: '0 12px 30px rgba(0,0,0,0.8)',
            fontSize: '20px',
            fontWeight: 800,
            zIndex: 100,
            whiteSpace: 'nowrap',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* 7. MODAL TÚI ĐỒ (FALLBACK NẾU KHÔNG CÓ onOpenInventory TỪ ROOT LAYER) */}
      {!onOpenInventory && showInventory && (
        <UnifiedManagementSheet
          game={activeGame}
          initialTab="portfolio"
          onClose={() => setShowInventory(false)}
          onHelp={() => handleOpenRules()}
        />
      )}

      {/* 8. MODAL KIẾN THỨC & LUẬT CHƠI (FALLBACK NẾU KHÔNG CÓ onOpenRules TỪ ROOT LAYER) */}
      {!onOpenRules && showRules && (
        <UnifiedGameGuide firstTime={false} onClose={() => setShowRules(false)} />
      )}

      {/* CSS KEYFRAMES CHO MAP SCREEN VÀ CUỘN MƯỢT MÀ */}
      <style>{`
        .map-scroll-viewport::-webkit-scrollbar {
          display: none;
        }
        @keyframes activePinFloat {
          0% { transform: translateY(0); }
          100% { transform: translateY(-12px); }
        }
        @keyframes pulseHalo {
          0% { transform: scale(0.9); opacity: 0.85; }
          100% { transform: scale(1.42); opacity: 0; }
        }
        @keyframes nodePulseGlow {
          0% {
            transform: scale(1);
            filter: drop-shadow(0 0 16px rgba(34, 197, 94, 0.75)) drop-shadow(0 8px 16px rgba(0, 0, 0, 0.55));
          }
          100% {
            transform: scale(1.04);
            filter: drop-shadow(0 0 28px rgba(34, 197, 94, 0.95)) drop-shadow(0 10px 20px rgba(0, 0, 0, 0.6));
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
};

// Export tương thích
export const MapSelectScreen = MapScreen;
