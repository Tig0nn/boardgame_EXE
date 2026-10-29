import React from 'react';
import { sound } from '../utils/audio';

export type MapTab = 'inventory' | 'rules' | null;

interface MapBottomDockProps {
  onOpenInventory: () => void;
  onOpenRules: () => void;
}

export const MapBottomDock: React.FC<MapBottomDockProps> = ({
  onOpenInventory,
  onOpenRules,
}) => {
  return (
    <div
      className="map-bottom-dock-container select-none pointer-events-none"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        width: '940px',
        zIndex: 50,
        fontFamily: "'Fredoka', 'Baloo 2', system-ui, sans-serif",
      }}
    >
      {/* NÚT TÚI ĐỒ (INVENTORY / PORTFOLIO) NEO GÓC DƯỚI CÙNG BÊN TRÁI - KHÔNG VIỀN THẺ HỘP THÔ CỨNG */}
      <button
        onClick={() => {
          sound.playClick();
          onOpenInventory();
        }}
        aria-label="Mở Túi Đồ Danh Mục"
        title="Túi đồ"
        className="pointer-events-auto"
        style={{
          position: 'absolute',
          bottom: '32px',
          left: '36px',
          background: 'none',
          border: 'none',
          outline: 'none',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          filter: 'drop-shadow(0 10px 22px rgba(0, 0, 0, 0.8))',
          transition: 'transform 0.15s ease',
        }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(0.92)';
        }}
        onPointerUp={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
      >
        <img
          src="/assets/cropped/tuido-icon.png"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/assets/tuido-icon.png';
          }}
          alt="Túi Đồ"
          style={{
            width: '120px',
            height: '120px',
            objectFit: 'contain',
            display: 'block',
          }}
        />
        <span
          style={{
            marginTop: '4px',
            fontSize: '22px',
            fontWeight: 900,
            color: '#fef3c7',
            letterSpacing: '0.5px',
            textShadow: '0 2px 6px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.9)',
          }}
        >
          Túi Đồ
        </span>
      </button>

      {/* NÚT KIẾN THỨC (KNOWLEDGE / RULEBOOK) NEO GÓC DƯỚI CÙNG BÊN PHẢI - KHÔNG VIỀN THẺ HỘP THÔ CỨNG */}
      <button
        onClick={() => {
          sound.playClick();
          onOpenRules();
        }}
        aria-label="Mở Sổ Tay Kiến Thức & Luật Chơi"
        title="Kiến thức"
        className="pointer-events-auto"
        style={{
          position: 'absolute',
          bottom: '32px',
          right: '36px',
          background: 'none',
          border: 'none',
          outline: 'none',
          cursor: 'pointer',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          filter: 'drop-shadow(0 10px 22px rgba(0, 0, 0, 0.8))',
          transition: 'transform 0.15s ease',
        }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(0.92)';
        }}
        onPointerUp={(e) => {
          (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
      >
        <img
          src="/assets/cropped/sotay-full-icon.png"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/assets/sotay.PNG';
          }}
          alt="Kiến Thức"
          style={{
            width: '120px',
            height: '120px',
            objectFit: 'contain',
            display: 'block',
          }}
        />
        <span
          style={{
            marginTop: '4px',
            fontSize: '22px',
            fontWeight: 900,
            color: '#d1fae5',
            letterSpacing: '0.5px',
            textShadow: '0 2px 6px rgba(0,0,0,0.95), 0 0 10px rgba(0,0,0,0.9)',
          }}
        >
          Kiến Thức
        </span>
      </button>
    </div>
  );
};
