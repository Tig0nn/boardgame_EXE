import React from 'react';

interface LapSummaryModalProps {
  isOpen: boolean;
  lap: number;
  totalLaps: number;
  salary: number;
  salaryBonus: number;
  businessIncome: number;
  livingCost: number;
  debtInterest: number;
  onOpenRebalance: () => void;
  onContinue: () => void;
}

export const LapSummaryModal: React.FC<LapSummaryModalProps> = ({
  isOpen,
  lap,
  totalLaps,
  salary,
  salaryBonus,
  businessIncome,
  livingCost,
  debtInterest,
  onOpenRebalance,
  onContinue,
}) => {
  if (!isOpen) return null;

  const totalIncome = salary + salaryBonus + businessIncome;
  const totalExpense = livingCost + debtInterest;
  const netFlow = totalIncome - totalExpense;

  const formatVND = (v: number) => v.toLocaleString('vi-VN') + ' ₫';
  const isFinalLap = lap >= totalLaps;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 105,
      background: 'rgba(0, 0, 0, 0.15)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      animation: 'fadeIn 0.25s ease',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'linear-gradient(180deg, rgba(14, 40, 70, 0.78) 0%, rgba(8, 25, 48, 0.88) 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(56, 189, 248, 0.5)',
        borderRadius: '30px',
        padding: '24px 22px',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        animation: 'zoomIn 0.25s ease',
      }}>
        {/* Header Modal */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(56, 189, 248, 0.2)',
            border: '1.5px solid #38BDF8',
            borderRadius: '999px',
            padding: '4px 16px',
            color: '#BAE6FD',
            fontSize: '12px',
            fontWeight: 800,
            marginBottom: '8px',
          }}>
            🏁 VẠCH XUẤT PHÁT START
          </div>
          <h2 className="font-display" style={{ fontSize: '25px', fontWeight: 800, color: '#F0F9FF', textShadow: '0 2px 4px rgba(0,0,0,0.4)' }}>
            Quyết Toán Tài Chính Vòng {lap} / {totalLaps}
          </h2>
          <p style={{ fontSize: '13px', color: '#BAE6FD' }}>
            Tổng hợp dòng tiền thực tế phát sinh sau khi hoàn thành một vòng quanh bàn cờ.
          </p>
        </div>

        {/* Bảng Dòng Tiền Thu / Chi */}
        <div style={{
          background: 'rgba(8, 25, 48, 0.45)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '18px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          {/* Lương */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#E2E8F0', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>💼</span> Lương định kỳ {salaryBonus > 0 && '(+3M khóa học)'}:
            </span>
            <span className="font-display" style={{ color: '#34D399', fontWeight: 700, fontSize: '15px' }}>
              +{formatVND(salary + salaryBonus)}
            </span>
          </div>

          {/* Thu nhập kinh doanh */}
          {businessIncome > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#E2E8F0', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>☕</span> Lợi nhuận quán cà phê:
              </span>
              <span className="font-display" style={{ color: '#34D399', fontWeight: 700, fontSize: '15px' }}>
                +{formatVND(businessIncome)}
              </span>
            </div>
          )}

          {/* Chi phí sinh hoạt */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#E2E8F0', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🧾</span> Chi phí sinh hoạt vòng:
            </span>
            <span className="font-display" style={{ color: '#F87171', fontWeight: 700, fontSize: '15px' }}>
              -{formatVND(livingCost)}
            </span>
          </div>

          {/* Lãi vay nếu có */}
          {debtInterest > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#E2E8F0', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>💳</span> Lãi vay nợ (10%):
              </span>
              <span className="font-display" style={{ color: '#F87171', fontWeight: 700, fontSize: '15px' }}>
                -{formatVND(debtInterest)}
              </span>
            </div>
          )}

          {/* Đường gạch phân cách */}
          <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />

          {/* Dòng tiền ròng */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '14px' }}>
              Dòng Tiền Ròng Vòng Này:
            </span>
            <span className="font-display" style={{
              color: netFlow >= 0 ? '#34D399' : '#F87171',
              fontWeight: 800,
              fontSize: '18px',
            }}>
              {netFlow >= 0 ? `+${formatVND(netFlow)}` : formatVND(netFlow)}
            </span>
          </div>
        </div>

        {/* Các Nút Hành Động */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Nút Tái cơ cấu bán tài sản */}
          <button
            onClick={onOpenRebalance}
            style={{
              padding: '13px',
              borderRadius: '16px',
              background: 'rgba(217, 119, 6, 0.25)',
              border: '1.5px solid #F59E0B',
              color: '#FEF08A',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span>🔄</span> Bán Tài Sản Tại START (Tái Cơ Cấu)
          </button>

          {/* Nút Tiếp tục vòng kế tiếp hoặc kết thúc */}
          <button
            onClick={onContinue}
            style={{
              padding: '14px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              border: 'none',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '15px',
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(245, 158, 11, 0.4)',
            }}
          >
            {isFinalLap ? '🏆 Xem Kết Quả Chung Cuộc & Gặp AI Coach' : `🚀 Bắt Đầu Vòng ${lap + 1} / ${totalLaps}`}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zoomIn {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
