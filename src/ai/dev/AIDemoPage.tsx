import { useState } from 'react'
import { AICoachPanel } from '../AICoachPanel.tsx'
import {
  winFixture,
  lockedBusinessLossFixture,
  earlyWithdrawalFixture,
  insolventFixture,
  mockOutputs,
  generateLiveGame,
} from './fixtures.ts'
import { liquidatableFunds, totalWorth, victory } from '../../game/selectors.ts'
import type { GameState } from '../../game/types.ts'

const standardScenarios = [
  { id: 'win', title: '1. Thắng (> 90M)', fixture: winFixture },
  { id: 'locked', title: '2. Thua kẹt kinh doanh', fixture: lockedBusinessLossFixture },
  { id: 'withdraw', title: '3. Rút tiết kiệm sớm', fixture: earlyWithdrawalFixture },
  { id: 'insolvent', title: '4. Phá sản (Insolvent)', fixture: insolventFixture },
]

export function AIDemoPage() {
  const [selectedId, setSelectedId] = useState<string>('win')
  const [mode, setMode] = useState<'mock' | 'live'>('live')
  const [liveCustomGame, setLiveCustomGame] = useState<GameState | null>(null)

  // Xác định game state hiện tại (nếu đang ở chế độ custom thì lấy customGame)
  const currentScenario = standardScenarios.find(s => s.id === selectedId) || standardScenarios[0]
  const game = selectedId === 'custom' && liveCustomGame ? liveCustomGame : currentScenario.fixture

  const vic = victory(game)
  const lawful = liquidatableFunds(game)
  const netWorth = totalWorth(game)

  const handleGenerateLiveGame = () => {
    const generated = generateLiveGame('diversified')
    setLiveCustomGame(generated)
    setSelectedId('custom')
  }

  return (
    <div style={{ maxWidth: 740, margin: '2rem auto', padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: '#0f172a' }}>
          AI Financial Coach — Dev Preview Harness
        </h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
          Môi trường kiểm thử UI độc lập của Phát · Không sửa GameDialogs.tsx
        </p>
      </header>

      {/* Điều khiển: Chế độ phản hồi (Mock vs Live API) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: 10,
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.85rem',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <span style={{ fontWeight: 600, color: '#334155' }}>Chế độ kiểm thử:</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setMode('live')}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 6,
              border: '1.5px solid',
              borderColor: mode === 'live' ? '#2563eb' : '#cbd5e1',
              background: mode === 'live' ? '#eff6ff' : '#ffffff',
              color: mode === 'live' ? '#1d4ed8' : '#64748b',
              fontWeight: mode === 'live' ? 700 : 500,
              cursor: 'pointer',
              fontSize: '0.82rem',
            }}
          >
            Gọi API Gemini Thật (/api/ai-coach)
          </button>
          <button
            type="button"
            onClick={() => setMode('mock')}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 6,
              border: '1.5px solid',
              borderColor: mode === 'mock' ? '#16a34a' : '#cbd5e1',
              background: mode === 'mock' ? '#dcfce7' : '#ffffff',
              color: mode === 'mock' ? '#15803d' : '#64748b',
              fontWeight: mode === 'mock' ? 700 : 500,
              cursor: 'pointer',
              fontSize: '0.82rem',
            }}
          >
            Dữ liệu giả lập (Mock Data)
          </button>
        </div>
      </div>

      {/* Nút sinh ván chơi thật từ engine */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleGenerateLiveGame}
          style={{
            padding: '0.65rem 1.1rem',
            background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.15)',
          }}
        >
          Sinh ván chơi thật mới từ Engine (Seed ngẫu nhiên)
        </button>
        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
          Mô phỏng 1 ván thật 4 vòng với các quyết định và số tiền hoàn toàn động
        </span>
      </div>

      {/* Tabs chuyển đổi kịch bản */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {standardScenarios.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelectedId(s.id)}
            style={{
              padding: '0.55rem 0.95rem',
              borderRadius: 8,
              border: '1.5px solid',
              borderColor: selectedId === s.id ? '#2563eb' : '#cbd5e1',
              background: selectedId === s.id ? '#eff6ff' : '#ffffff',
              color: selectedId === s.id ? '#1d4ed8' : '#334155',
              fontWeight: selectedId === s.id ? 700 : 500,
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            {s.title}
          </button>
        ))}
        {liveCustomGame && (
          <button
            type="button"
            onClick={() => setSelectedId('custom')}
            style={{
              padding: '0.55rem 0.95rem',
              borderRadius: 8,
              border: '1.5px solid',
              borderColor: selectedId === 'custom' ? '#7c3aed' : '#cbd5e1',
              background: selectedId === 'custom' ? '#f5f3ff' : '#ffffff',
              color: selectedId === 'custom' ? '#6d28d9' : '#334155',
              fontWeight: selectedId === 'custom' ? 700 : 500,
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            5. Ván Engine vừa sinh ({game.seed.slice(0, 10)})
          </button>
        )}
      </div>

      {/* Tóm tắt số liệu của ván được chọn */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '1rem',
          marginBottom: '1rem',
          fontSize: '0.85rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div>
          <span style={{ color: '#64748b', display: 'block' }}>Kết quả</span>
          <strong style={{ color: vic.won ? '#16a34a' : '#dc2626' }}>
            {game.termination === 'insolvent' ? 'PHÁ SẢN' : vic.won ? 'THẮNG CUỘC' : 'CHƯA ĐẠT'}
          </strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block' }}>Huy động hợp lệ</span>
          <strong>{lawful.toLocaleString('vi-VN')} đ</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block' }}>Tài sản ròng</span>
          <strong>{netWorth.toLocaleString('vi-VN')} đ</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block' }}>Tiền mặt</span>
          <strong>{game.portfolio.cash.toLocaleString('vi-VN')} đ</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block' }}>Vốn kinh doanh</span>
          <strong>{game.portfolio.business.toLocaleString('vi-VN')} đ</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', display: 'block' }}>Nợ vay</span>
          <strong>{game.portfolio.debt.toLocaleString('vi-VN')} đ</strong>
        </div>
      </div>

      {/* Component AI Coach */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: '#1e293b' }}>
          Mô phỏng vị trí trong Result Modal:
        </h2>
        {/* Render AICoachPanel với key để reset trạng thái khi đổi kịch bản hoặc chế độ */}
        <AICoachPanel
          key={`${selectedId}-${mode}-${game.seed}`}
          game={game}
          mockOutput={mode === 'mock' ? mockOutputs[selectedId] : undefined}
        />
      </div>
    </div>
  )
}
