import React, { useState } from 'react'
import { sound } from '../utils/audio'
import { GamifiedModal } from './GamifiedModal'
import { isTutorialDisabled, setTutorialDisabled } from '../game/onboarding'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  isMuted: boolean
  onToggleMute: () => void
  onRestart?: () => void
  onHelp?: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  isMuted,
  onToggleMute,
  onRestart,
  onHelp,
}) => {
  const [tutDisabled, setTutDisabled] = useState(() => isTutorialDisabled())

  if (!isOpen) return null

  const handleToggleSound = () => {
    sound.playClick()
    onToggleMute()
  }

  const handleToggleTutorial = () => {
    sound.playClick()
    const next = !tutDisabled
    setTutDisabled(next)
    setTutorialDisabled(next)
  }

  const handleRestart = () => {
    sound.playClick()
    if (window.confirm('Bạn có chắc chắn muốn bắt đầu lại ván chơi mới từ đầu?')) {
      onRestart?.()
      onClose()
    }
  }

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
      {/* 1. THẺ CÀI ĐẶT ÂM THANH (Glassmorphic Anime Card) */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1.5px solid #E2E8F0',
          borderRadius: '20px',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: isMuted ? '#F1F5F9' : '#DCFCE7',
              color: isMuted ? '#64748B' : '#15803D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}
          >
            {isMuted ? '🔇' : '🔊'}
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 900, color: '#1E1B4B' }}>
              Âm Thanh & Hiệu Ứng
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600 }}>
              {isMuted ? 'Đang tắt tiếng' : 'Nhạc nền & âm thanh xúc xắc'}
            </div>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={handleToggleSound}
          type="button"
          aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          style={{
            width: '52px',
            height: '30px',
            borderRadius: '9999px',
            background: isMuted ? '#CBD5E1' : '#10B981',
            border: 'none',
            padding: '3px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            transition: 'background 0.2s ease',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.15)',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#FFFFFF',
              boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
              transform: isMuted ? 'translateX(0)' : 'translateX(22px)',
              transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />
        </button>
      </div>

      {/* 2. THẺ BẬT/TẮT HƯỚNG DẪN TÂN BINH */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1.5px solid #E2E8F0',
          borderRadius: '20px',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: tutDisabled ? '#F1F5F9' : '#EDE9FE',
              color: tutDisabled ? '#64748B' : '#7C3AED',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}
          >
            🎓
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 900, color: '#1E1B4B' }}>
              Hướng Dẫn Tân Binh
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600 }}>
              {tutDisabled ? 'Đã tắt tự động' : 'Tự động mở khi bấm Play'}
            </div>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={handleToggleTutorial}
          type="button"
          aria-label={tutDisabled ? 'Bật hướng dẫn' : 'Tắt hướng dẫn'}
          style={{
            width: '52px',
            height: '30px',
            borderRadius: '9999px',
            background: tutDisabled ? '#CBD5E1' : '#8B5CF6',
            border: 'none',
            padding: '3px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            transition: 'background 0.2s ease',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.15)',
          }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#FFFFFF',
              boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
              transform: tutDisabled ? 'translateX(0)' : 'translateX(22px)',
              transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          />
        </button>
      </div>

      {/* 3. THẺ HƯỚNG DẪN & SỔ TAY */}
      {onHelp && (
        <button
          onClick={() => {
            sound.playClick()
            onClose()
            onHelp()
          }}
          style={{
            background: '#FFFFFF',
            border: '1.5px solid #E2E8F0',
            borderRadius: '20px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: '#FEF3C7',
                color: '#B45309',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
              }}
            >
              📖
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#1E1B4B' }}>
                Sổ Tay Luật Chơi
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600 }}>
                Tra cứu quy tắc 20 ô cờ & chiến lược 90M
              </div>
            </div>
          </div>
          <span style={{ fontSize: '16px', color: '#94A3B8', fontWeight: 900 }}>→</span>
        </button>
      )}

      {/* 3. THẺ KHỞI ĐỘNG LẠI VÁN CHƠI */}
      {onRestart && (
        <button
          onClick={handleRestart}
          style={{
            background: '#FFF1F2',
            border: '1.5px solid #FECDD3',
            borderRadius: '20px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: '#FEE2E2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
              }}
            >
              🔄
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 900, color: '#9F1239' }}>
                Bắt Đầu Lại Từ Đầu
              </div>
              <div style={{ fontSize: '11.5px', color: '#E11D48', fontWeight: 600 }}>
                Thiết lập lại ván chơi mới
              </div>
            </div>
          </div>
          <span style={{ fontSize: '16px', color: '#FDA4AF', fontWeight: 900 }}>→</span>
        </button>
      )}
    </GamifiedModal>
  )
}
