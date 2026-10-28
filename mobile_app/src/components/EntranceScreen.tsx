import React, { useState } from 'react';
import { sound } from '../utils/audio';
import { SettingsModal } from './SettingsModal';

interface EntranceScreenProps {
  onPlay: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  onRestart?: () => void;
  onHelp?: () => void;
}

export const EntranceScreen: React.FC<EntranceScreenProps> = ({
  onPlay,
  isMuted = false,
  onToggleMute,
  onRestart,
  onHelp,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handlePlayClick = () => {
    sound.unlockAudio();
    sound.playClick();
    if (!sound.isMuted) sound.startBgm();
    onPlay();
  };

  const handleToggleSound = () => {
    sound.playClick();
    onToggleMute?.();
  };

  const handleOpenSettings = () => {
    sound.playClick();
    setSettingsOpen(true);
  };

  return (
    <div
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
        zIndex: 100,
        fontFamily: "'Cinzel', 'Playfair Display', serif",
        userSelect: 'none',
      }}
    >
      {/* 1. Nền Màn Hình Chờ Trung Cổ trang-cho.png */}
      <img
        src="/assets/trang-cho.png"
        alt="Màn hình chờ Xoay Vòng Tiến Lui Trung Cổ"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* 2. Top Action Bar: Sound Button & Setting Button */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Nút Âm Thanh Góc Trái */}
        <button
          onClick={handleToggleSound}
          className="medieval-icon-btn"
          aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          style={{
            width: '84px',
            height: '88px',
            position: 'relative',
          }}
        >
          <img
            src="/assets/cropped/sound-btn.png"
            alt="Âm thanh"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter: isMuted ? 'grayscale(0.8) opacity(0.6)' : 'none',
            }}
          />
          {isMuted && (
            <span
              style={{
                position: 'absolute',
                fontSize: '32px',
                color: '#991b1b',
                fontWeight: 900,
                textShadow: '0 0 6px #ffffff',
              }}
            >
              ✕
            </span>
          )}
        </button>

        {/* Nút Cài Đặt Góc Phải */}
        <button
          onClick={handleOpenSettings}
          className="medieval-icon-btn"
          aria-label="Mở Cài Đặt"
          title="Mở Cài Đặt"
          style={{
            width: '76px',
            height: '88px',
          }}
        >
          <img
            src="/assets/cropped/setting-btn.png"
            alt="Cài Đặt"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        </button>
      </div>

      {/* 3. Nút "CHƠI" Play Icon Nổi Bật Ở Khu Vực Hành Động Phía Dưới (Không viền trắng, trong suốt 100%) */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <button
          onClick={handlePlayClick}
          aria-label="Bắt đầu phiêu lưu"
          className="medieval-play-btn"
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: 0,
            cursor: 'pointer',
          }}
        >
          <img
            src="/assets/cropped/play-icon.png"
            alt="Bắt đầu chơi"
            style={{
              width: '480px',
              height: 'auto',
              maxHeight: '165px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 14px 28px rgba(0, 0, 0, 0.6))',
            }}
          />
        </button>
      </div>

      {/* Cửa sổ Cài Đặt Trung Cổ */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isMuted={isMuted}
        onToggleMute={onToggleMute || (() => {})}
        onRestart={onRestart}
        onHelp={onHelp}
      />
    </div>
  );
};
