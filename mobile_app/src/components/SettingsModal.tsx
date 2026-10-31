import React, { useState, useRef, useEffect } from 'react';
import { sound } from '../utils/audio';
import { GamifiedModal } from './GamifiedModal';
import { isAutoShowRulesEnabled, setAutoShowRulesEnabled } from '../game/rules-settings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onRestart?: () => void;
  onHelp?: () => void;
}

interface MaskedSettingIconProps {
  src: string;
  alt: string;
  size?: number;
  color: string;
  glowColor?: string;
  style?: React.CSSProperties;
}

const MaskedSettingIcon: React.FC<MaskedSettingIconProps> = ({
  src,
  alt,
  size = 24,
  color,
  glowColor,
  style = {},
}) => {
  return (
    <span
      role="img"
      aria-label={alt}
      style={{
        display: 'inline-block',
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        WebkitMaskImage: `url(${src})`,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskImage: `url(${src})`,
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        maskSize: 'contain',
        flexShrink: 0,
        verticalAlign: 'middle',
        filter: glowColor ? `drop-shadow(0 2px 5px ${glowColor})` : undefined,
        transition: 'background-color 0.2s ease, transform 0.2s ease',
        ...style,
      }}
    />
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isMuted,
  onToggleMute,
  onRestart,
  onHelp,
}) => {
  const [autoRules, setAutoRules] = useState(() => isAutoShowRulesEnabled());
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Dọn dẹp timer khi modal đóng hoặc unmount
  useEffect(() => {
    return () => {
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setConfirmingRestart(false);
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleSound = () => {
    sound.playClick();
    onToggleMute();
  };

  const handleToggleAutoRules = () => {
    sound.playClick();
    const next = !autoRules;
    setAutoRules(next);
    setAutoShowRulesEnabled(next);
  };

  const handleRestartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playClick();

    if (!confirmingRestart) {
      // Bước 1: Kích hoạt trạng thái cảnh báo xác nhận nội bộ 2 bước
      setConfirmingRestart(true);
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
      }
      // Tự động hoàn nguyên sau 4.5 giây nếu người chơi không bấm xác nhận
      restartTimerRef.current = setTimeout(() => {
        setConfirmingRestart(false);
      }, 4500);
    } else {
      // Bước 2: Người chơi đã bấm xác nhận lần thứ 2 -> thực thi reset
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
      }
      setConfirmingRestart(false);
      onRestart?.();
      onClose();
    }
  };

  const handleCancelRestart = (e: React.MouseEvent) => {
    e.stopPropagation();
    sound.playClick();
    setConfirmingRestart(false);
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
    }
  };

  return (
    <GamifiedModal
      badgeText="CÀI ĐẶT TRÒ CHƠI"
      title="Tùy Chọn Trải Nghiệm"
      onClose={onClose}
      primaryAction={{
        label: 'Đóng Cài Đặt',
        onClick: onClose,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          fontFamily: "'Fredoka', sans-serif",
        }}
      >
        {/* 1. THẺ CÀI ĐẶT ÂM THANH (EMERALD MINT THEME) */}
        <div
          onClick={handleToggleSound}
          role="button"
          tabIndex={0}
          aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          style={{
            background: isMuted ? '#F8FAFC' : 'linear-gradient(135deg, #FFFFFF 0%, #F0FDF4 100%)',
            border: isMuted ? '1.5px solid #E2E8F0' : '1.5px solid #BBF7D0',
            borderRadius: '20px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: isMuted ? '0 2px 6px rgba(0,0,0,0.02)' : '0 4px 12px rgba(16, 185, 129, 0.12)',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            userSelect: 'none',
          }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <MaskedSettingIcon
                src="/assets/sound-new-icon.png"
                alt="Âm thanh"
                size={28}
                color={isMuted ? '#64748B' : '#059669'}
                glowColor={isMuted ? undefined : 'rgba(16, 185, 129, 0.45)'}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: '14.5px',
                  fontWeight: 900,
                  color: isMuted ? '#334155' : '#065F46',
                  letterSpacing: '0.2px',
                }}
              >
                Âm Thanh & Hiệu Ứng
              </div>
              <div style={{ fontSize: '11.5px', color: isMuted ? '#64748B' : '#047857', fontWeight: 600 }}>
                {isMuted ? 'Đang tắt tiếng toàn bộ trò chơi' : 'Bật nhạc nền & âm thanh xúc xắc'}
              </div>
            </div>
          </div>

          {/* Gamified Toggle Switch */}
          <div
            style={{
              width: '54px',
              height: '32px',
              borderRadius: '9999px',
              background: isMuted ? '#CBD5E1' : '#10B981',
              padding: '3px',
              display: 'flex',
              alignItems: 'center',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
              transition: 'background 0.2s ease',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: '#FFFFFF',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                transform: isMuted ? 'translateX(0)' : 'translateX(22px)',
                transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            />
          </div>
        </div>

        {/* 2. THẺ BẬT/TẮT TỰ ĐỘNG MỞ LUẬT CHƠI (ROYAL PURPLE THEME) */}
        <div
          onClick={handleToggleAutoRules}
          role="button"
          tabIndex={0}
          aria-label={autoRules ? 'Tắt tự động mở luật chơi' : 'Bật tự động mở luật chơi'}
          style={{
            background: !autoRules ? '#F8FAFC' : 'linear-gradient(135deg, #FFFFFF 0%, #F5F3FF 100%)',
            border: !autoRules ? '1.5px solid #E2E8F0' : '1.5px solid #DDD6FE',
            borderRadius: '20px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: !autoRules ? '0 2px 6px rgba(0,0,0,0.02)' : '0 4px 12px rgba(124, 58, 237, 0.12)',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            userSelect: 'none',
          }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <MaskedSettingIcon
                src="/assets/knowledge-icon.png"
                alt="Tự động mở luật chơi"
                size={28}
                color={!autoRules ? '#64748B' : '#7C3AED'}
                glowColor={!autoRules ? undefined : 'rgba(124, 58, 237, 0.45)'}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: '14.5px',
                  fontWeight: 900,
                  color: !autoRules ? '#334155' : '#5B21B6',
                  letterSpacing: '0.2px',
                }}
              >
                Tự Động Mở Luật Chơi
              </div>
              <div style={{ fontSize: '11.5px', color: !autoRules ? '#64748B' : '#6D28D9', fontWeight: 600 }}>
                {autoRules ? 'Tự động mở quy tắc khi chọn Chương' : 'Vào thẳng ván đấu không mở luật'}
              </div>
            </div>
          </div>

          {/* Gamified Toggle Switch */}
          <div
            style={{
              width: '54px',
              height: '32px',
              borderRadius: '9999px',
              background: !autoRules ? '#CBD5E1' : '#8B5CF6',
              padding: '3px',
              display: 'flex',
              alignItems: 'center',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
              transition: 'background 0.2s ease',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: '#FFFFFF',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                transform: !autoRules ? 'translateX(0)' : 'translateX(22px)',
                transition: 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            />
          </div>
        </div>

        {/* 3. THẺ HƯỚNG DẪN & SỔ TAY LUẬT CHƠI (WARM AMBER GOLD THEME) */}
        {onHelp && (
          <button
            onClick={() => {
              sound.playClick();
              onClose();
              onHelp();
            }}
            type="button"
            aria-label="Mở Sổ Tay Luật Chơi & Chiến Lược"
            style={{
              background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
              border: '1.5px solid #FDE68A',
              borderRadius: '20px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(217, 119, 6, 0.12)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              fontFamily: "'Fredoka', sans-serif",
            }}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
            }}
            onPointerUp={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <MaskedSettingIcon
                  src="/assets/guide-new-icon.png"
                  alt="Sổ tay luật chơi"
                  size={28}
                  color="#B45309"
                  glowColor="rgba(217, 119, 6, 0.45)"
                />
              </div>
              <div>
                <div style={{ fontSize: '14.5px', fontWeight: 900, color: '#78350F', letterSpacing: '0.2px' }}>
                  Sổ Tay Luật Chơi
                </div>
                <div style={{ fontSize: '11.5px', color: '#92400E', fontWeight: 600 }}>
                  Tra cứu quy tắc 20 ô cờ & mục tiêu 90M
                </div>
              </div>
            </div>

            {/* Mũi tên phong cách Badge Gamified */}
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#FDE68A',
                border: '1px solid #F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#78350F',
                fontSize: '15px',
                fontWeight: 900,
                boxShadow: '0 2px 4px rgba(217, 119, 6, 0.2)',
                flexShrink: 0,
              }}
            >
              ➔
            </div>
          </button>
        )}

        {/* 4. THẺ KHỞI ĐỘNG LẠI VÁN CHƠI (RUBY CRIMSON VỚI XÁC NHẬN 2 BƯỚC AN TOÀN) */}
        {onRestart && (
          <div
            onClick={handleRestartClick}
            role="button"
            tabIndex={0}
            aria-label="Khởi động lại ván chơi"
            style={{
              background: confirmingRestart
                ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                : 'linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 100%)',
              border: confirmingRestart ? '2px solid #FCA5A5' : '1.5px solid #FECDD3',
              borderRadius: '20px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: confirmingRestart
                ? '0 6px 18px rgba(220, 38, 38, 0.4), 0 0 12px rgba(239, 68, 68, 0.5)'
                : '0 4px 12px rgba(225, 29, 72, 0.1)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
              userSelect: 'none',
              animation: confirmingRestart ? 'animeWarningPulse 1.2s infinite ease-in-out' : 'none',
            }}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)';
            }}
            onPointerUp={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <MaskedSettingIcon
                  src="/assets/reset-play.png"
                  alt="Khởi động lại"
                  size={28}
                  color={confirmingRestart ? '#FFFFFF' : '#DC2626'}
                  glowColor={confirmingRestart ? 'rgba(255, 255, 255, 0.6)' : 'rgba(220, 38, 38, 0.4)'}
                />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: '14.5px',
                    fontWeight: 900,
                    color: confirmingRestart ? '#FFFFFF' : '#9F1239',
                    letterSpacing: '0.2px',
                  }}
                >
                  {confirmingRestart ? 'BẤM LẦN NỮA ĐỂ XÁC NHẬN!' : 'Bắt Đầu Lại Từ Đầu'}
                </div>
                <div
                  style={{
                    fontSize: '11.5px',
                    color: confirmingRestart ? '#FEE2E2' : '#BE123C',
                    fontWeight: 600,
                    lineHeight: 1.3,
                  }}
                >
                  {confirmingRestart
                    ? 'Toàn bộ tiến trình ván chơi sẽ được làm mới'
                    : 'Thiết lập lại ván chơi mới từ đầu'}
                </div>
              </div>
            </div>

            {/* Trạng thái xác nhận hoặc nút Hủy */}
            {confirmingRestart ? (
              <button
                type="button"
                onClick={handleCancelRestart}
                title="Hủy bỏ thao tác làm mới"
                style={{
                  background: 'rgba(255, 255, 255, 0.25)',
                  border: '1.5px solid #FFFFFF',
                  color: '#FFFFFF',
                  borderRadius: '12px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  marginLeft: '8px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              >
                HỦY
              </button>
            ) : (
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#FECDD3',
                  border: '1px solid #F43F5E',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9F1239',
                  fontSize: '15px',
                  fontWeight: 900,
                  boxShadow: '0 2px 4px rgba(225, 29, 72, 0.2)',
                  flexShrink: 0,
                }}
              >
                ➔
              </div>
            )}
          </div>
        )}
      </div>
    </GamifiedModal>
  );
};
