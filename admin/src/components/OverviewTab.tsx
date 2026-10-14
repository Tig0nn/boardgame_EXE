import React from 'react';
import { TelemetrySummary } from '../data/telemetry';

interface OverviewTabProps {
  summary: TelemetrySummary;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ summary }) => {
  const funnelSteps = [
    { label: 'Vòng 1 (Bắt đầu)', pct: summary.dropOffFunnel.lap1Start, count: Math.round(summary.totalSessions) },
    { label: 'Vòng 2', pct: summary.dropOffFunnel.lap2Start, count: Math.round(summary.totalSessions * summary.dropOffFunnel.lap2Start / 100) },
    { label: 'Vòng 3', pct: summary.dropOffFunnel.lap3Start, count: Math.round(summary.totalSessions * summary.dropOffFunnel.lap3Start / 100) },
    { label: 'Vòng 4', pct: summary.dropOffFunnel.lap4Start, count: Math.round(summary.totalSessions * summary.dropOffFunnel.lap4Start / 100) },
    { label: 'Về đích hoàn thành', pct: summary.dropOffFunnel.completed, count: Math.round(summary.totalSessions * summary.dropOffFunnel.completed / 100) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 4 KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        {/* KPI 1 */}
        <div className="panel" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
            Người dùng đang kết nối
          </div>
          <div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }} className="mono">
            {summary.activeNow}
          </div>
          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
            DAU: <strong className="mono">{summary.dailyActiveUsers}</strong> • MAU: <strong className="mono">{summary.monthlyActiveUsers}</strong>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="panel" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
            Tổng số ván đã chơi
          </div>
          <div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }} className="mono">
            {summary.totalSessions.toLocaleString()}
          </div>
          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Tỷ lệ hoàn thành: <strong className="mono">{summary.completionRate}%</strong> ({summary.avgSessionDuration} phút/ván)
          </div>
        </div>

        {/* KPI 3 */}
        <div className="panel" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
            Tỷ lệ đạt mục tiêu (≥ 90 triệu VND)
          </div>
          <div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }} className="mono">
            {summary.winRate}%
          </div>
          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Vỡ nợ: <strong className="mono">{summary.insolvencyRate}%</strong> • Chưa đủ vốn: <strong className="mono">{summary.underGoalRate}%</strong>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="panel" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
            Yêu cầu phân tích AI
          </div>
          <div style={{ marginTop: '8px', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }} className="mono">
            {summary.aiMetrics.totalRequests.toLocaleString()}
          </div>
          <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Phản hồi: <strong className="mono">{summary.aiMetrics.avgLatencyMs} ms</strong> • Chi phí: <strong className="mono">${summary.aiMetrics.estimatedCostUsd}</strong>
          </div>
        </div>
      </div>

      {/* Grid: Funnel & Rules Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        {/* Funnel */}
        <div className="panel" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Tiến độ người chơi qua 4 vòng
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Tỷ lệ tiếp tục qua từng chặng của ván đấu
              </p>
            </div>
            <span className="tag">Quy chuẩn 4 vòng</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
            {funnelSteps.map((step, idx) => {
              const prevPct = idx === 0 ? 100 : funnelSteps[idx - 1].pct;
              const dropPct = (prevPct - step.pct).toFixed(1);
              return (
                <div key={step.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{step.label}</span>
                    <span className="mono" style={{ color: 'var(--text-muted)' }}>
                      <strong>{step.count.toLocaleString()}</strong> ({step.pct}%)
                      {idx > 0 && parseFloat(dropPct) > 0 && (
                        <span style={{ color: '#b45309', marginLeft: '6px' }}>
                          (-{dropPct}%)
                        </span>
                      )}
                    </span>
                  </div>

                  <div style={{
                    width: '100%',
                    height: '6px',
                    backgroundColor: '#f1f5f9',
                    borderRadius: 'var(--radius-xs)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${step.pct}%`,
                      height: '100%',
                      backgroundColor: '#334155',
                      borderRadius: 'var(--radius-xs)',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: '16px', padding: '10px 12px', backgroundColor: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xs)', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Ghi chú vận hành: Tỷ lệ hoàn thành đạt 78.4% phản ánh độ dài ván chơi (khoảng 10.8 phút) phù hợp với người dùng. Điểm rơi nhẹ ở Vòng 2 do lần đầu người chơi phát sinh chi phí sinh hoạt.
          </div>
        </div>

        {/* Economy Balancing */}
        <div className="panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Chỉ số cân bằng tài chính
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Tham số kinh tế áp dụng trong phiên bản hiện tại
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-light)', background: '#ffffff' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Vốn khởi đầu & Nhận lương
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Vốn 50.0M VND • Lương qua ô xuất phát 14.0M VND.
                </div>
              </div>

              <div style={{ padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-light)', background: '#ffffff' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Mục tiêu huy động hợp lệ
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Yêu cầu ≥ 90.0M VND (80M mua sắm + 10M quỹ dự phòng).
                </div>
              </div>

              <div style={{ padding: '10px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-light)', background: '#ffffff' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Trung bình ván đấu
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }} className="mono">
                  Huy động hợp lệ TB: {(summary.avgLawfulProceeds / 1000000).toFixed(1)}M VND • Tài sản ròng: {(summary.avgFinalNetWorth / 1000000).toFixed(1)}M VND
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '14px', fontSize: '11px', color: 'var(--text-subtle)' }}>
            Dữ liệu đồng bộ tự động từ động cơ game.
          </div>
        </div>
      </div>
    </div>
  );
};
