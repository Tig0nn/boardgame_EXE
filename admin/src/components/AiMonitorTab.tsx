import React, { useState } from 'react';
import { TelemetrySummary, PlayerSession } from '../data/telemetry';

interface AiMonitorTabProps {
  aiMetrics: TelemetrySummary['aiMetrics'];
  recentSessions: PlayerSession[];
}

export const AiMonitorTab: React.FC<AiMonitorTabProps> = ({ aiMetrics, recentSessions }) => {
  const [filterMode, setFilterMode] = useState<'all' | 'requested' | 'not_requested'>('all');

  const filteredSessions = recentSessions.filter((s) => {
    if (filterMode === 'requested') return s.aiCoachRequested;
    if (filterMode === 'not_requested') return !s.aiCoachRequested;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 4 AI Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        {/* Metric 1 */}
        <div className="panel" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
            Tổng số yêu cầu AI Coach
          </div>
          <div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }} className="mono">
            {aiMetrics.totalRequests.toLocaleString()}
          </div>
          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Mô hình áp dụng: <code className="mono">{aiMetrics.modelInUse}</code>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="panel" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
            Thời gian phản hồi trung bình
          </div>
          <div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }} className="mono">
            {aiMetrics.avgLatencyMs} ms
          </div>
          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Thành công: <strong className="mono">{aiMetrics.successCount}</strong> ({((aiMetrics.successCount / aiMetrics.totalRequests) * 100).toFixed(1)}%)
          </div>
        </div>

        {/* Metric 3 */}
        <div className="panel" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
            Tổng số Token ước tính
          </div>
          <div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }} className="mono">
            {(aiMetrics.estimatedTokens / 1000).toFixed(1)}k
          </div>
          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Áp dụng bộ nhớ ngữ cảnh và lược đồ luật chơi
          </div>
        </div>

        {/* Metric 4 */}
        <div className="panel" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
            Chi phí API & Giới hạn
          </div>
          <div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }} className="mono">
            ${aiMetrics.estimatedCostUsd.toFixed(3)}
          </div>
          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Giới hạn tần suất: <strong className="mono">{aiMetrics.rateLimitedCount}</strong> • Dự phòng: <strong className="mono">{aiMetrics.fallbackCount}</strong>
          </div>
        </div>
      </div>

      {/* AI Log Table & Filter */}
      <div className="panel" style={{ padding: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Nhật ký phân tích tài chính cuối trận (/api/ai-coach)
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Theo dõi việc người chơi yêu cầu báo cáo nhận xét sau khi hoàn thành ván đấu
            </p>
          </div>

          <div style={{ display: 'flex', gap: '4px' }}>
            {(['all', 'requested', 'not_requested'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilterMode(mode)}
                style={{
                  padding: '5px 8px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '11px',
                  fontWeight: filterMode === mode ? 600 : 400,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: filterMode === mode ? 'var(--text-primary)' : 'var(--border-light)',
                  background: filterMode === mode ? '#0f172a' : '#ffffff',
                  color: filterMode === mode ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                {mode === 'all' ? 'Tất cả ván' : mode === 'requested' ? 'Có gọi AI' : 'Không gọi AI'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Trạng thái ván</th>
                <th style={{ textAlign: 'right' }}>Huy động hợp lệ</th>
                <th style={{ textAlign: 'right' }}>Tài sản ròng</th>
                <th style={{ textAlign: 'center' }}>Trạng thái AI</th>
                <th style={{ textAlign: 'center' }}>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map((session) => (
                <tr key={session.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{session.playerName}</div>
                    <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{session.id}</div>
                  </td>
                  <td>
                    <span className="tag">
                      {session.status === 'completed' ? 'Hoàn thành' : session.status === 'playing' ? 'Đang chơi' : session.status === 'insolvent' ? 'Vỡ nợ' : 'Bỏ dở'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }} className="mono">
                    {(session.lawfulProceeds / 1000000).toFixed(1)}M
                  </td>
                  <td style={{ textAlign: 'right' }} className="mono">
                    {(session.netWorth / 1000000).toFixed(1)}M
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {session.aiCoachRequested ? (
                      <span className="tag tag-active">Đã hoàn thành</span>
                    ) : (
                      <span className="tag">Không yêu cầu</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--text-muted)' }} className="mono">
                    {session.startTime}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
