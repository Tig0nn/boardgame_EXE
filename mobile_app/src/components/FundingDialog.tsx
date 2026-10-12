import React, { useState } from 'react';

interface FundingDialogProps {
  isOpen: boolean;
  requiredAmount: number;
  currentCash: number;
  currentDebt: number;
  maxDebtLimit: number;
  onBorrow: (amount: number) => void;
  onClose: () => void;
}

export const FundingDialog: React.FC<FundingDialogProps> = ({
  isOpen,
  requiredAmount,
  currentCash,
  currentDebt,
  maxDebtLimit,
  onBorrow,
  onClose,
}) => {
  const [borrowInput, setBorrowInput] = useState<number>(10_000_000);

  if (!isOpen) return null;

  const deficit = Math.max(requiredAmount - currentCash, 0);
  const availableCredit = Math.max(maxDebtLimit - currentDebt, 0);

  const formatVND = (v: number) => v.toLocaleString('vi-VN') + ' ₫';

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 110,
      background: 'rgba(15, 10, 20, 0.88)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      animation: 'fadeIn 0.25s ease',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: 'linear-gradient(180deg, #2D1515 0%, #150A0A 100%)',
        border: '2px solid #EF4444',
        borderRadius: '32px',
        padding: '28px 24px',
        boxShadow: '0 20px 60px rgba(239, 68, 68, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {/* Header Cảnh Báo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            boxShadow: '0 4px 16px rgba(239, 68, 68, 0.5)',
          }}>
            ⚠️
          </div>
          <div>
            <h3 className="font-display" style={{ fontSize: '22px', fontWeight: 800, color: '#F87171' }}>
              Thiếu Hụt Thanh Khoản!
            </h3>
            <p style={{ fontSize: '13px', color: '#FECACA' }}>
              Cần thêm <strong style={{ color: '#FFFFFF' }}>{formatVND(deficit)}</strong> để thanh toán.
            </p>
          </div>
        </div>

        {/* Thông tin hạn mức vay */}
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '16px',
          padding: '14px',
          fontSize: '13px',
          color: '#E2E8F0',
          lineHeight: 1.5,
        }}>
          <div>• Hạn mức vay khẩn cấp còn lại: <strong style={{ color: '#34D399' }}>{formatVND(availableCredit)}</strong></div>
          <div>• Lãi suất vay nợ: <strong style={{ color: '#F87171' }}>10% / vòng</strong> (trả tại START).</div>
        </div>

        {/* Nút vay nợ khẩn cấp */}
        {availableCredit > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[5_000_000, 10_000_000, 20_000_000].map(amt => (
                <button
                  key={amt}
                  onClick={() => setBorrowInput(amt)}
                  disabled={amt > availableCredit}
                  style={{
                    flex: 1,
                    padding: '8px',
                    borderRadius: '10px',
                    border: borrowInput === amt ? '2px solid #EF4444' : '1px solid rgba(255, 255, 255, 0.15)',
                    background: borrowInput === amt ? 'rgba(239, 68, 68, 0.25)' : 'rgba(15, 23, 42, 0.5)',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '12px',
                    cursor: amt <= availableCredit ? 'pointer' : 'not-allowed',
                  }}
                >
                  {amt / 1_000_000}M ₫
                </button>
              ))}
            </div>

            <button
              onClick={() => onBorrow(borrowInput)}
              style={{
                padding: '14px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                color: '#FFFFFF',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                fontSize: '15px',
                boxShadow: '0 6px 20px rgba(239, 68, 68, 0.4)',
              }}
            >
              Vay Khẩn Cấp {borrowInput / 1_000_000}M ₫ (Lãi 10%)
            </button>
          </div>
        ) : (
          <div style={{
            color: '#F87171',
            fontWeight: 800,
            textAlign: 'center',
            padding: '12px',
            background: 'rgba(239, 68, 68, 0.2)',
            borderRadius: '14px',
          }}>
            ⛔ Đã chạm kịch trần hạn mức vay nợ (30.000.000 ₫)!
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94A3B8',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          Đóng cửa sổ
        </button>
      </div>
    </div>
  );
};
