import React, { useState } from 'react';
import { PlayerSession } from '../data/telemetry';

interface PlayersTabProps {
  sessions: PlayerSession[];
  onInspectReplay: (seed: string) => void;
}

export const PlayersTab: React.FC<PlayersTabProps> = ({ sessions, onInspectReplay }) => {
  const [filter, setFilter] = useState<'all' | 'playing' | 'completed' | 'insolvent' | 'dropped'>('all');
  const [selectedSession, setSelectedSession] = useState<PlayerSession | null>(sessions[0] || null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = sessions.filter((s) => {
    const matchFilter = filter === 'all' || s.status === filter;
    const matchQuery =
      s.playerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.seed.toLowerCase().includes(searchQuery.toLowerCase());
    return matchFilter && matchQuery;
  });

  const getStatusTag = (status: PlayerSession['status']) => {
    switch (status) {
      case 'playing':
        return <span className="tag tag-active">Đang chơi</span>;
      case 'completed':
        return <span className="tag tag-completed">Hoàn thành</span>;
      case 'insolvent':
        return <span className="tag tag-insolvent">Vỡ nợ</span>;
      case 'dropped':
        return <span className="tag tag-dropped">Bỏ dở</span>;
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
      {/* Left Column: Player Table & Filters */}
      <div className="panel" style={{ padding: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Danh Sách Phiên Chơi</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Chi tiết trạng thái của người dùng theo thời gian thực</p>
          </div>
          <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {filteredSessions.length} / {sessions.length} phiên
          </span>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Tìm theo tên, ID, mã ván..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              minWidth: '160px',
              padding: '6px 10px',
              borderRadius: 'var(--radius-xs)',
              background: '#ffffff',
              border: '1px solid var(--border-light)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              outline: 'none',
            }}
          />

          <div style={{ display: 'flex', gap: '4px' }}>
            {(['all', 'playing', 'completed', 'insolvent', 'dropped'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                style={{
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '11px',
                  fontWeight: filter === status ? 600 : 400,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: filter === status ? 'var(--text-primary)' : 'var(--border-light)',
                  background: filter === status ? '#0f172a' : '#ffffff',
                  color: filter === status ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                {status === 'all' ? 'Tất cả' : status === 'playing' ? 'Đang chơi' : status === 'completed' ? 'Hoàn thành' : status === 'insolvent' ? 'Vỡ nợ' : 'Bỏ dở'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto', maxHeight: '540px' }}>
          <table>
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Trạng thái</th>
                <th>Vòng / Vị trí</th>
                <th style={{ textAlign: 'right' }}>Huy động hợp lệ</th>
                <th style={{ textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((session) => {
                const isSelected = selectedSession?.id === session.id;
                return (
                  <tr
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? '#f8fafc' : 'transparent',
                    }}
                  >
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{session.playerName}</div>
                      <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {session.id} • {session.startTime}
                      </div>
                    </td>
                    <td>
                      {getStatusTag(session.status)}
                    </td>
                    <td className="mono" style={{ fontSize: '12px' }}>
                      Vòng {session.currentLap}/{session.totalLaps} • Ô #{session.currentTile}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }} className="mono">
                      {(session.lawfulProceeds / 1000000).toFixed(1)}M
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectReplay(session.seed);
                        }}
                        className="btn"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                      >
                        Kiểm tra
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Column: Selected Session Inspector */}
      <div className="panel" style={{ padding: '18px' }}>
        {selectedSession ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedSession.playerName}</h3>
                <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  ID: {selectedSession.id} • Mã ván: {selectedSession.seed}
                </div>
              </div>
              {getStatusTag(selectedSession.status)}
            </div>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '14px 0' }}>
              <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-light)', background: '#f8fafc' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tiền mặt</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }} className="mono">
                  {(selectedSession.cash / 1000000).toFixed(1)}M VND
                </div>
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-light)', background: '#f8fafc' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tài sản ròng</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }} className="mono">
                  {(selectedSession.netWorth / 1000000).toFixed(1)}M VND
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xs)', fontSize: '12px', marginBottom: '14px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Huy động hợp lệ (Mục tiêu 90M):</span>
              <strong className="mono" style={{ color: 'var(--text-primary)' }}>
                {(selectedSession.lawfulProceeds / 1000000).toFixed(1)}M VND
              </strong>
            </div>

            {/* Progress */}
            <div style={{ margin: '14px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Tiến độ ván đấu:</span>
                <span className="mono">Vòng {selectedSession.currentLap}/4 • Ô #{selectedSession.currentTile}</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: '#f1f5f9', borderRadius: 'var(--radius-xs)' }}>
                <div
                  style={{
                    width: `${((selectedSession.currentLap - 1) * 25) + (selectedSession.currentTile / 20 * 25)}%`,
                    height: '100%',
                    background: '#0f172a',
                    borderRadius: 'var(--radius-xs)',
                  }}
                />
              </div>
            </div>

            {/* Timeline */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Nhật ký sự kiện ({selectedSession.timeline.length} lượt)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                {selectedSession.timeline.map((step) => (
                  <div
                    key={step.turn}
                    style={{
                      padding: '6px 8px',
                      borderRadius: 'var(--radius-xs)',
                      background: '#ffffff',
                      border: '1px solid var(--border-light)',
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }} className="mono">
                      <span>Lượt #{step.turn} (V{step.lap} • Ô #{step.tile})</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {step.delta >= 0 ? '+' : ''}{(step.delta / 1000000).toFixed(1)}M
                      </span>
                    </div>
                    <div style={{ color: 'var(--text-primary)', marginTop: '2px', fontWeight: 500 }}>{step.action}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{step.note}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Replay inspect button */}
            <button
              onClick={() => onInspectReplay(selectedSession.seed)}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '14px' }}
            >
              Mở kiểm tra mã ván này
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0' }}>
            Chọn một phiên chơi từ danh sách để xem chi tiết
          </div>
        )}
      </div>
    </div>
  );
};
