import React from 'react';

interface RebalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockHoldings: number;
  goldHoldings: number;
  bondHoldings: number;
  onSellStock: () => void;
  onSellGold: () => void;
  onSellBond: () => void;
}

export const RebalanceModal: React.FC<RebalanceModalProps> = ({
  isOpen,
  onClose,
  stockHoldings,
  goldHoldings,
  bondHoldings,
  onSellStock,
  onSellGold,
  onSellBond,
}) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 110,
      background: 'rgba(10, 15, 29, 0.88)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
        border: '2px solid #3B82F6',
        borderRadius: '32px',
        padding: '26px 22px',
        boxShadow: '0 20px 60px rgba(59, 130, 246, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 className="font-display" style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF' }}>
              Tái Cơ Cấu Danh Mục Tại START
            </h3>
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>
              Bán tài sản tài chính để gom tiền mặt chuẩn bị cho vòng chơi tiếp theo.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#94A3B8',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Danh sách các tài sản có thể bán */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Cổ phiếu */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '14px' }}>📈 Cổ Phiếu VN30</div>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>Đang sở hữu: {stockHoldings} lô (10M/lô)</div>
            </div>
            <button
              onClick={onSellStock}
              disabled={stockHoldings <= 0}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                background: stockHoldings > 0 ? '#10B981' : '#475569',
                color: '#FFFFFF',
                fontWeight: 700,
                border: 'none',
                cursor: stockHoldings > 0 ? 'pointer' : 'not-allowed',
                fontSize: '12px',
              }}
            >
              Bán 1 Lô (+10M ₫)
            </button>
          </div>

          {/* Vàng SJC */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '14px' }}>🟡 Vàng Miếng SJC</div>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>Đang sở hữu: {goldHoldings} lượng (6M/lượng)</div>
            </div>
            <button
              onClick={onSellGold}
              disabled={goldHoldings <= 0}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                background: goldHoldings > 0 ? '#F59E0B' : '#475569',
                color: '#FFFFFF',
                fontWeight: 700,
                border: 'none',
                cursor: goldHoldings > 0 ? 'pointer' : 'not-allowed',
                fontSize: '12px',
              }}
            >
              Bán 1 Lượng (+6M ₫)
            </button>
          </div>

          {/* Trái phiếu */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '14px' }}>📜 Trái Phiếu Doanh Nghiệp</div>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>Đang sở hữu: {bondHoldings} lô (8M/lô)</div>
            </div>
            <button
              onClick={onSellBond}
              disabled={bondHoldings <= 0}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                background: bondHoldings > 0 ? '#8B5CF6' : '#475569',
                color: '#FFFFFF',
                fontWeight: 700,
                border: 'none',
                cursor: bondHoldings > 0 ? 'pointer' : 'not-allowed',
                fontSize: '12px',
              }}
            >
              Bán 1 Lô (+8M ₫)
            </button>
          </div>
        </div>

        {/* Nút Hoàn tất */}
        <button
          onClick={onClose}
          style={{
            padding: '13px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
            border: 'none',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            textAlign: 'center',
            marginTop: '4px',
          }}
        >
          Xác Nhận & Quay Lại Báo Cáo Vòng
        </button>
      </div>
    </div>
  );
};
