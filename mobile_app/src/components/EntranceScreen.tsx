import React, { useState } from 'react';
import { sound } from '../utils/audio';
import { SettingsModal } from './SettingsModal';

interface EntranceScreenProps {
  onPlay: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onRestart?: () => void;
  onHelp?: () => void;
  onOpenSettings?: () => void;
}

export const EntranceScreen: React.FC<EntranceScreenProps> = ({
  onPlay,
  isMuted = false,
  onToggleMute,
  onRestart,
  onHelp,
  onOpenSettings,
}) => {
  const [localSettingsOpen, setLocalSettingsOpen] = useState(false);

  const handlePlayClick = () => {
    try {
      sound.unlockAudio();
      sound.playClick();
      if (!sound.isMuted) sound.startBgm();
    } catch {
      // Audio failure should never block game launch
    }
    onPlay();
  };

  const handleToggleSound = () => {
    try {
      sound.playClick();
      onToggleMute?.();
    } catch {
      // Ignore
    }
  };

  const handleOpenSettings = () => {
    try {
      sound.playClick();
    } catch {
      // Ignore
    }
    if (onOpenSettings) {
      onOpenSettings();
    } else {
      setLocalSettingsOpen(true);
    }
  };

  return (
    <div
      className="entrance-screen-root relative overflow-hidden flex flex-col items-center justify-between"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'max(36px, env(safe-area-inset-top)) 32px max(120px, env(safe-area-inset-bottom)) 32px',
        boxSizing: 'border-box',
        zIndex: 10,
        fontFamily: "'Fredoka', sans-serif",
        userSelect: 'none',
        writingMode: 'horizontal-tb',
        pointerEvents: 'auto',
      }}
    >
      {/* 1. Nền Màn Hình Chờ Xoay Vòng Tiến Lui (WebP Q88 tối ưu hóa kèm fallback) */}
      <img
        src="/assets/splash-game.webp"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = '/assets/splash-game.png';
        }}
        alt="Màn hình chờ Xoay Vòng Tiến Lui"
        className="pointer-events-none select-none"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none',
          zIndex: 0,
          userSelect: 'none',
        }}
      />

      {/* 2. Top Action Bar: Sound Button & Setting Button */}
      <div
        className="pointer-events-auto relative z-50 flex items-center justify-between w-full"
        style={{
          position: 'relative',
          zIndex: 50,
          pointerEvents: 'auto',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Nút Âm Thanh Góc Trái */}
        <button
          type="button"
          onClick={handleToggleSound}
          className="medieval-icon-btn pointer-events-auto relative z-50 cursor-pointer"
          aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          style={{
            width: '84px',
            height: '88px',
            position: 'relative',
            zIndex: 50,
            pointerEvents: 'auto',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            outline: 'none',
            padding: 0,
            transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.88)';
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
          }}
        >
          <img
            src="/assets/cropped/sound-btn.png"
            alt="Âm thanh"
            className="pointer-events-none select-none w-full h-full object-contain"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: isMuted ? 'grayscale(0.8) opacity(0.6)' : 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4))',
              pointerEvents: 'none',
            }}
          />
          {isMuted && (
            <span
              className="pointer-events-none select-none"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: '34px',
                color: '#dc2626',
                fontWeight: 900,
                textShadow: '0 0 8px #ffffff, 0 2px 4px rgba(0, 0, 0, 0.8)',
                pointerEvents: 'none',
                fontFamily: "'Fredoka', sans-serif",
              }}
            >
              ✕
            </span>
          )}
        </button>

        {/* Nút Cài Đặt Góc Phải */}
        <button
          type="button"
          onClick={handleOpenSettings}
          className="medieval-icon-btn pointer-events-auto relative z-50 cursor-pointer"
          aria-label="Mở Cài Đặt"
          title="Mở Cài Đặt"
          style={{
            width: '76px',
            height: '88px',
            position: 'relative',
            zIndex: 50,
            pointerEvents: 'auto',
            cursor: 'pointer',
            background: 'none',
            border: 'none',
            outline: 'none',
            padding: 0,
            transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.88)';
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
          }}
        >
          <img
            src="/assets/cropped/setting-btn.png"
            alt="Cài Đặt"
            className="pointer-events-none select-none w-full h-full object-contain"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4))',
              pointerEvents: 'none',
            }}
          />
        </button>
      </div>

      {/* 3. Nút "CHƠI" Play Icon Nổi Bật Ở Khu Vực Hành Động Phía Dưới (Kèm Hiệu Ứng Thở Breathing Glow) */}
      <div
        className="pointer-events-auto relative z-50 flex flex-col items-center w-full"
        style={{
          position: 'relative',
          zIndex: 50,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          gap: '8px',
        }}
      >
        <button
          type="button"
          onClick={handlePlayClick}
          aria-label="Bắt đầu phiêu lưu"
          className="medieval-play-btn pointer-events-auto relative z-50 cursor-pointer"
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
            cursor: 'pointer',
            position: 'relative',
            zIndex: 50,
            pointerEvents: 'auto',
            animation: 'entranceBreathingGlow 2.8s ease-in-out infinite',
            transition: 'transform 0.15s ease',
          }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.93)';
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
          }}
        >
          <img
            src="/assets/cropped/play-icon.png"
            alt="Bắt đầu chơi"
            className="pointer-events-none select-none"
            style={{
              width: 'clamp(280px, 52vw, 480px)',
              height: 'auto',
              maxHeight: '165px',
              objectFit: 'contain',
              pointerEvents: 'none',
            }}
          />
        </button>
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes entranceBreathingGlow {
          0%, 100% {
            transform: scale(1.0);
            filter: drop-shadow(0 14px 28px rgba(0, 0, 0, 0.65)) drop-shadow(0 0 16px rgba(245, 158, 11, 0.45));
          }
          50% {
            transform: scale(1.035);
            filter: drop-shadow(0 18px 36px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 28px rgba(245, 158, 11, 0.8));
          }
        }
      `}</style>

      {/* Fallback Cửa sổ Cài Đặt Trung Cổ nếu không có onOpenSettings từ App */}
      {!onOpenSettings && (
        <SettingsModal
          isOpen={localSettingsOpen}
          onClose={() => setLocalSettingsOpen(false)}
          isMuted={isMuted}
          onToggleMute={onToggleMute || (() => {})}
          onRestart={onRestart}
          onHelp={onHelp}
        />
      )}
    </div>
  );
};
