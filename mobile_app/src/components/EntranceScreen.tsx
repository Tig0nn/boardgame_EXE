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
        width: '940px',
        height: '1672px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '36px 32px 140px 32px',
        boxSizing: 'border-box',
        zIndex: 10,
        fontFamily: "'Cinzel', 'Playfair Display', serif",
        userSelect: 'none',
        writingMode: 'horizontal-tb',
        pointerEvents: 'auto',
      }}
    >
      {/* 1. Nền Màn Hình Chờ Trung Cổ splash-game.png */}
      <img
        src="/assets/splash-game.png"
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
              filter: isMuted ? 'grayscale(0.8) opacity(0.6)' : 'none',
              pointerEvents: 'none',
            }}
          />
          {isMuted && (
            <span
              className="pointer-events-none select-none"
              style={{
                position: 'absolute',
                fontSize: '32px',
                color: '#991b1b',
                fontWeight: 900,
                textShadow: '0 0 6px #ffffff',
                pointerEvents: 'none',
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
              pointerEvents: 'none',
            }}
          />
        </button>
      </div>

      {/* 3. Nút "CHƠI" Play Icon Nổi Bật Ở Khu Vực Hành Động Phía Dưới (Không viền trắng, trong suốt 100%) */}
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
          }}
        >
          <img
            src="/assets/cropped/play-icon.png"
            alt="Bắt đầu chơi"
            className="pointer-events-none select-none"
            style={{
              width: '480px',
              height: 'auto',
              maxHeight: '165px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 14px 28px rgba(0, 0, 0, 0.6))',
              pointerEvents: 'none',
            }}
          />
        </button>
      </div>

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
