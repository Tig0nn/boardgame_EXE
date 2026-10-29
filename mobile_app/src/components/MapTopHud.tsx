import React from 'react';
import { sound } from '../utils/audio';

interface MapTopHudProps {
  onBack?: () => void;
  onOpenSettings: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

export const MapTopHud: React.FC<MapTopHudProps> = ({
  onBack,
  onOpenSettings,
  isMuted = false,
  onToggleMute,
}) => {
  return (
    <div
      className="map-top-bar w-full select-none"
      style={{
        position: 'absolute',
        top: '28px',
        left: 0,
        right: 0,
        width: '940px',
        zIndex: 50,
        padding: '0 36px',
        boxSizing: 'border-box',
        pointerEvents: 'auto',
        fontFamily: "'Fredoka', 'Baloo 2', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        {/* GÓC NGOÀI CÙNG BÊN TRÁI: LOGO THƯƠNG HIỆU CHÍNH THỨC "MỎ HỖN" */}
        <div
          onClick={() => {
            if (onBack) {
              sound.playClick();
              onBack();
            }
          }}
          role={onBack ? 'button' : undefined}
          aria-label={onBack ? 'Quay lại màn hình chính' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.65))',
            cursor: onBack ? 'pointer' : 'default',
            pointerEvents: 'auto',
            transition: 'transform 0.12s ease',
          }}
          onPointerDown={(e) => {
            if (onBack) (e.currentTarget as HTMLElement).style.transform = 'scale(0.94)';
          }}
          onPointerUp={(e) => {
            if (onBack) (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
          }}
        >
          <img
            src="/assets/cropped/app-logo.png"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/assets/icon.PNG';
            }}
            alt="Mỏ Hỗn (Xoay Vòng Tiến Lui)"
            style={{
              height: '74px',
              width: 'auto',
              maxWidth: '180px',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </div>

        {/* KHOẢNG TRỐNG CHÍNH GIỮA: HOÀN TOÀN TRỐNG ĐỂ TRÁNH DYNAMIC ISLAND & KHÔNG BỊ RỐI BỞI TIỀN/TIÊU ĐỀ */}
        <div style={{ flex: 1 }} />

        {/* GÓC NGOÀI CÙNG BÊN PHẢI: ĐỒNG BỘ 2 NÚT ĐIỀU KHIỂN (ÂM THANH + CÀI ĐẶT) CÙNG SIZE 74x74px */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {onToggleMute && (
            <button
              onClick={() => {
                sound.playClick();
                onToggleMute();
              }}
              aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              style={{
                width: '74px',
                height: '74px',
                position: 'relative',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
                transition: 'transform 0.12s ease',
              }}
              onPointerDown={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(0.92)';
              }}
              onPointerUp={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              }}
            >
              <img
                src="/assets/cropped/sound-btn.png"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/assets/sound-btn.png';
                }}
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
                    color: '#ef4444',
                    fontWeight: 900,
                    textShadow: '0 0 6px #000000',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </span>
              )}
            </button>
          )}

          {/* Nút Cài đặt (⚙️) Đồng Bộ Kích Thước 74x74px */}
          <button
            onClick={() => {
              sound.playClick();
              onOpenSettings();
            }}
            aria-label="Cài đặt game"
            title="Cài đặt"
            style={{
              width: '74px',
              height: '74px',
              position: 'relative',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
              transition: 'transform 0.12s ease',
            }}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(0.92)';
            }}
            onPointerUp={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
          >
            <img
              src="/assets/cropped/setting-btn.png"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/assets/setting-btn.png';
              }}
              alt="Cài đặt"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
