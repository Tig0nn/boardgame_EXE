import { useState } from 'react'
import { courseChoices } from '../../../src/game/courses'
import { money } from '../../../src/game/format'
import type { GameState } from '../../../src/game/types'
import { sound } from '../utils/audio'

interface MobileCourseChoicesProps {
  game: GameState
  onChoose: (id: string) => void
}

export const MobileCourseChoices: React.FC<MobileCourseChoicesProps> = ({ game, onChoose }) => {
  const choices = courseChoices(game)
  const [showForecast, setShowForecast] = useState<string | null>(null)

  if (choices.every((c) => c.owned)) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '20px 8px',
          gap: '12px',
        }}
      >
        <img
          src="/assets/winner-goal-icon.png"
          alt="Hoàn thành"
          style={{ width: '40px', height: '40px', objectFit: 'contain' }}
        />
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#1E293B' }}>
          Đã hoàn thành cả hai khóa
        </h3>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
          Lương hiện tại:{' '}
          <strong style={{ color: '#16A34A', fontWeight: 900 }}>
            {money(game.recurringIncome)} / lần qua START
          </strong>
        </p>
        <button
          onClick={() => {
            sound.playClick()
            onChoose('skip')
          }}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '16px',
            background: 'linear-gradient(180deg, #FBBF24 0%, #F97316 48%, #EA580C 100%)',
            color: '#FFFFFF',
            fontSize: '15px',
            fontWeight: 900,
            border: 'none',
            boxShadow: '0 4px 12px rgba(234, 88, 12, 0.35)',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          Tiếp tục hành trình →
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        gap: '10px',
        boxSizing: 'border-box',
      }}
    >
      {/* Thông tin tiền mặt hiện có */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '14px',
          padding: '8px 12px',
          fontSize: '12px',
          fontWeight: 700,
        }}
      >
        <span style={{ color: '#64748B' }}>Tiền mặt hiện có:</span>
        <strong style={{ color: '#D97706', fontSize: '13.5px', fontWeight: 900 }}>
          {money(game.portfolio.cash)}
        </strong>
      </div>

      {/* Danh sách Thẻ Khóa Học Quest Style */}
      {choices.map((choice) => {
        const canAfford = game.portfolio.cash >= choice.cost
        const isCompleted = choice.owned
        const isForecastOpen = showForecast === choice.id

        return (
          <div
            key={choice.id}
            style={{
              background: isCompleted ? '#F8FAFC' : '#FFFFFF',
              border: isCompleted
                ? '1px solid #E2E8F0'
                : canAfford
                  ? '1.5px solid #86EFAC'
                  : '1px solid #CBD5E1',
              borderRadius: '16px',
              padding: '9px 10px',
              boxShadow: isCompleted ? 'none' : '0 2px 6px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              boxSizing: 'border-box',
            }}
          >
            {/* Header Thẻ: Tên Khóa Học + Status Pill */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <img
                  src={choice.id === 'basic' ? '/assets/basic-course.png' : '/assets/knowledge-icon.png'}
                  alt=""
                  style={{ width: '18px', height: '18px', objectFit: 'contain' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 900, color: '#1E293B' }}>
                  {choice.name}
                </span>
              </div>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: isCompleted ? '#F1F5F9' : '#DCFCE7',
                  color: isCompleted ? '#64748B' : '#15803D',
                  border: isCompleted ? '1px solid #CBD5E1' : '1px solid #86EFAC',
                }}
              >
                {isCompleted ? '✓ Đã hoàn thành' : 'Chưa học'}
              </span>
            </div>

            {/* Chi Tiết Học Phí & Lương Tăng */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                background: '#F8FAFC',
                borderRadius: '10px',
                padding: '6px 8px',
                gap: '6px',
              }}
            >
              <div>
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>Học phí:</div>
                <div style={{ fontSize: '12px', fontWeight: 900, color: '#DC2626', marginTop: '1px' }}>
                  {money(choice.cost)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>Lương tăng / vòng:</div>
                <div style={{ fontSize: '12px', fontWeight: 900, color: '#16A34A', marginTop: '1px' }}>
                  +{money(choice.boost)}
                </div>
              </div>
            </div>

            {/* Xem Dự Báo Thu Nhập */}
            {!isCompleted && (
              <button
                type="button"
                onClick={() => setShowForecast(isForecastOpen ? null : choice.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4F46E5',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  padding: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>{isForecastOpen ? '▼' : '▶'}</span>
                <span>Xem chi tiết thu nhập dự kiến</span>
              </button>
            )}

            {isForecastOpen && !isCompleted && (
              <div
                style={{
                  background: '#EEF2FF',
                  borderRadius: '8px',
                  padding: '6px 8px',
                  fontSize: '10px',
                  color: '#3730A3',
                  lineHeight: '1.35',
                }}
              >
                <div>• Lương mới mỗi lần qua START: <strong>{money(choice.nominalIncome)}</strong></div>
                <div>• Thu nhập ròng dự kiến còn lại: <strong>{money(choice.netAfterFee)}</strong></div>
                <div>• Số lần nhận lương còn lại: <strong>{choice.remainingStarts}</strong></div>
              </div>
            )}

            {/* Nút Mua Khóa Học (3D Game Style) */}
            {!isCompleted && (
              <button
                disabled={!choice.canBuy}
                onClick={() => {
                  sound.playClick()
                  onChoose(`course-${choice.id}`)
                }}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '14px',
                  background: !choice.canBuy
                    ? '#CBD5E1'
                    : 'linear-gradient(180deg, #FBBF24 0%, #F97316 48%, #EA580C 100%)',
                  color: '#FFFFFF',
                  fontSize: '13.5px',
                  fontWeight: 900,
                  border: 'none',
                  boxShadow: !choice.canBuy ? 'none' : '0 4px 10px rgba(234, 88, 12, 0.35)',
                  cursor: !choice.canBuy ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px',
                  transition: 'transform 0.12s ease',
                  fontFamily: "'Fredoka', sans-serif",
                }}
                onPointerDown={(e) => {
                  if (choice.canBuy) (e.currentTarget as HTMLElement).style.transform = 'scale(0.96)'
                }}
                onPointerUp={(e) => {
                  if (choice.canBuy) (e.currentTarget as HTMLElement).style.transform = 'scale(1)'
                }}
              >
                {choice.canBuy ? `Mua ${choice.name}` : canAfford ? 'Không thể mua lượt này' : 'Chưa đủ tiền mặt'}
              </button>
            )}
          </div>
        )
      })}

      {/* Link Phụ: Bỏ Qua Khóa Học */}
      <button
        onClick={() => {
          sound.playClick()
          onChoose('skip')
        }}
        style={{
          background: 'none',
          border: 'none',
          color: '#64748B',
          fontSize: '13px',
          fontWeight: 800,
          padding: '8px 0',
          cursor: 'pointer',
          textAlign: 'center',
          marginTop: '4px',
          fontFamily: "'Fredoka', sans-serif",
        }}
      >
        Bỏ qua cơ hội này (Tiếp tục lượt)
      </button>
    </div>
  )
}
