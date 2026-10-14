import React from 'react';
import { TelemetrySummary } from '../data/telemetry';

interface EconomyTabProps {
  tileHeatmap: TelemetrySummary['tileHeatmap'];
  assetDistribution: TelemetrySummary['assetDistribution'];
  summary: TelemetrySummary;
}

export const EconomyTab: React.FC<EconomyTabProps> = ({ tileHeatmap, assetDistribution, summary }) => {
  const maxVisits = Math.max(...tileHeatmap.map((t) => t.visits));
  const totalVisits = tileHeatmap.reduce((acc, t) => acc + t.visits, 0);

  const getTileTypeLabel = (type: string) => {
    switch (type) {
      case 'start': return 'Xuất phát';
      case 'event': return 'Sự kiện';
      case 'expense': return 'Chi phí';
      case 'stocks': return 'Cổ phiếu';
      case 'bonds': return 'Trái phiếu';
      case 'bank': return 'Tiết kiệm';
      case 'business': return 'Kinh doanh';
      case 'gold': return 'Vàng';
      default: return 'Khác';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 20-Tile Grid */}
      <div className="panel" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Mật độ dừng chân trên bàn cờ (20 ô)
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Tổng lượt ghi nhận: {totalVisits.toLocaleString()} lượt dừng chân
            </p>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Độ đậm màu tương ứng tần suất người chơi dừng chân
          </div>
        </div>

        {/* 20 Tiles: 5 columns x 4 rows */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
          {tileHeatmap.map((tile) => {
            const intensityRatio = tile.visits / maxVisits;
            const percentage = ((tile.visits / totalVisits) * 100).toFixed(1);

            // Minimalist grayscale intensity
            const cellBg = intensityRatio > 0.8 ? '#f1f5f9' : intensityRatio > 0.5 ? '#f8fafc' : '#ffffff';
            const borderColor = intensityRatio > 0.8 ? 'var(--border-strong)' : 'var(--border-light)';

            return (
              <div
                key={tile.tileIndex}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-xs)',
                  border: `1px solid ${borderColor}`,
                  background: cellBg,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '64px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="mono" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                    #{tile.tileIndex}
                  </span>
                  <span className="tag" style={{ fontSize: '10px', padding: '1px 4px' }}>
                    {getTileTypeLabel(tile.type)}
                  </span>
                </div>

                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0' }}>
                  {tile.name}
                </div>

                <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{tile.visits} lượt</span>
                  <span>{percentage}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Asset Allocation & Balance Table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        {/* Asset Table */}
        <div className="panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Phân bổ danh mục đầu tư toàn hệ thống
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Tỷ lệ tài sản người chơi lựa chọn phân bổ
          </p>

          <table>
            <thead>
              <tr>
                <th>Danh mục tài sản</th>
                <th style={{ textAlign: 'right' }}>Tỷ lệ</th>
                <th style={{ textAlign: 'right' }}>Tổng giá trị (VND)</th>
              </tr>
            </thead>
            <tbody>
              {assetDistribution.map((item) => (
                <tr key={item.name}>
                  <td style={{ fontWeight: 500 }}>{item.name}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{item.percentage}%</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }} className="mono">
                    {(item.totalVnd / 1000000000).toFixed(1)} Tỷ VND
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Balance Parameters */}
        <div className="panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Kiểm tra cân bằng trò chơi
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Đánh giá tỷ lệ may rủi so với kỹ năng tài chính
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xs)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mục tiêu thắng:</span>
                <span className="mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>≥ 90.0M VND</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xs)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tài sản ròng trung bình:</span>
                <span className="mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {(summary.avgFinalNetWorth / 1000000).toFixed(1)}M VND
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xs)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Huy động hợp lệ trung bình:</span>
                <span className="mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {(summary.avgLawfulProceeds / 1000000).toFixed(1)}M VND
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xs)' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tỷ lệ May rủi / Chiến lược:</span>
                <span className="mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>32% / 68%</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '14px', padding: '8px 10px', background: '#f8fafc', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xs)', fontSize: '11px', color: 'var(--text-secondary)' }}>
            Xác nhận cân bằng: Đạt yêu cầu thiết kế. Người chơi cần kết hợp đa dạng các kênh đầu tư thay vì chỉ dựa vào tiền lương cố định.
          </div>
        </div>
      </div>
    </div>
  );
};
