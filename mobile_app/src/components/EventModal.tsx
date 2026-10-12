import React, { useState } from 'react';

export interface EventActionPayload {
  type: string;
  cost?: number;
  income?: number;
  obligation?: number;
  recurringBoost?: number;
  assetKey?: string;
  detail: string;
}

interface EventModalProps {
  tile: {
    index: number;
    type: string;
    category: string;
    label: string;
    icon: string;
  } | null;
  cash: number;
  hasCourse: boolean;
  hasBusiness: boolean;
  onConfirmAction: (action: EventActionPayload) => void;
  onClose: () => void;
}

export const EventModal: React.FC<EventModalProps> = ({
  tile,
  cash,
  hasCourse,
  hasBusiness,
  onConfirmAction,
  onClose,
}) => {
  const [selectedStock, setSelectedStock] = useState<string>('FPT');
  const [savingsTerm, setSavingsTerm] = useState<number>(1);

  if (!tile || tile.type === 'start') return null;

  const formatVND = (v: number) => (v / 1_000_000).toLocaleString('vi-VN') + 'M ₫';

  // Render nội dung tương ứng theo loại ô
  const renderContent = () => {
    switch (tile.type) {
      case 'stocks':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>
              Thị trường chứng khoán mở cửa. Bạn có thể giải ngân 1 vé đầu tư trị giá <strong>10.000.000 ₫</strong>.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {['FPT', 'VNM', 'HPG', 'MWG', 'VCB', 'VIC'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedStock(s)}
                  style={{
                    padding: '10px 6px',
                    borderRadius: '12px',
                    border: selectedStock === s ? '2px solid #F59E0B' : '1px solid rgba(255, 255, 255, 0.15)',
                    background: selectedStock === s ? 'rgba(245, 158, 11, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                    color: selectedStock === s ? '#FBBF24' : '#FFFFFF',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                onConfirmAction({
                  type: 'buy_stock',
                  cost: 10_000_000,
                  assetKey: selectedStock,
                  detail: `Mua 10M cổ phiếu ${selectedStock}`,
                });
              }}
              disabled={cash < 10_000_000}
              style={{
                marginTop: '8px',
                padding: '14px',
                borderRadius: '16px',
                background: cash >= 10_000_000 ? 'linear-gradient(135deg, #10B981, #059669)' : '#475569',
                color: '#FFFFFF',
                fontWeight: 800,
                border: 'none',
                cursor: cash >= 10_000_000 ? 'pointer' : 'not-allowed',
                fontSize: '15px',
              }}
            >
              {cash >= 10_000_000 ? `Mua 10M Cổ Phiếu ${selectedStock}` : 'Không đủ tiền mặt (Cần 10M)'}
            </button>
          </div>
        );

      case 'bank':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>
              Gửi tiết kiệm an toàn kỳ hạn 1, 2 hoặc 3 vòng quanh bàn cờ. Số tiền gửi: <strong>10.000.000 ₫</strong>.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3].map((t) => (
                <button
                  key={t}
                  onClick={() => setSavingsTerm(t)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '12px',
                    border: savingsTerm === t ? '2px solid #3B82F6' : '1px solid rgba(255, 255, 255, 0.15)',
                    background: savingsTerm === t ? 'rgba(59, 130, 246, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                    color: savingsTerm === t ? '#60A5FA' : '#FFFFFF',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {t} Vòng ({5 + t}%)
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                onConfirmAction({
                  type: 'deposit_savings',
                  cost: 10_000_000,
                  detail: `Gửi tiết kiệm 10M (Kỳ hạn ${savingsTerm} vòng, lãi ${5 + savingsTerm}%)`,
                });
              }}
              disabled={cash < 10_000_000}
              style={{
                marginTop: '8px',
                padding: '14px',
                borderRadius: '16px',
                background: cash >= 10_000_000 ? 'linear-gradient(135deg, #3B82F6, #2563EB)' : '#475569',
                color: '#FFFFFF',
                fontWeight: 800,
                border: 'none',
                cursor: cash >= 10_000_000 ? 'pointer' : 'not-allowed',
                fontSize: '15px',
              }}
            >
              {cash >= 10_000_000 ? 'Gửi 10M Tiết Kiệm' : 'Không đủ tiền mặt (Cần 10M)'}
            </button>
          </div>
        );

      case 'bonds':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>
              Trái phiếu doanh nghiệp uy tín. Trả coupon <strong>5%/vòng</strong> định kỳ tại START. Giá vé: <strong>8.000.000 ₫</strong>.
            </p>
            <button
              onClick={() => {
                onConfirmAction({
                  type: 'buy_bonds',
                  cost: 8_000_000,
                  detail: 'Mua trái phiếu 8M (Coupon 5%/vòng)',
                });
              }}
              disabled={cash < 8_000_000}
              style={{
                padding: '14px',
                borderRadius: '16px',
                background: cash >= 8_000_000 ? 'linear-gradient(135deg, #8B5CF6, #7C3AED)' : '#475569',
                color: '#FFFFFF',
                fontWeight: 800,
                border: 'none',
                cursor: cash >= 8_000_000 ? 'pointer' : 'not-allowed',
                fontSize: '15px',
              }}
            >
              {cash >= 8_000_000 ? 'Mua 8M Trái Phiếu' : 'Không đủ tiền mặt (Cần 8M)'}
            </button>
          </div>
        );

      case 'gold':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>
              Vàng miếng SJC tài sản trú ẩn an toàn khi có cú sốc kinh tế. Giá vé đầu tư: <strong>6.000.000 ₫</strong> / lượng.
            </p>
            <button
              onClick={() => {
                onConfirmAction({
                  type: 'buy_gold',
                  cost: 6_000_000,
                  detail: 'Mua 1 lượng Vàng 6M VND',
                });
              }}
              disabled={cash < 6_000_000}
              style={{
                padding: '14px',
                borderRadius: '16px',
                background: cash >= 6_000_000 ? 'linear-gradient(135deg, #F59E0B, #D97706)' : '#475569',
                color: '#FFFFFF',
                fontWeight: 800,
                border: 'none',
                cursor: cash >= 6_000_000 ? 'pointer' : 'not-allowed',
                fontSize: '15px',
              }}
            >
              {cash >= 6_000_000 ? 'Mua 1 Lượng Vàng (6M)' : 'Không đủ tiền mặt (Cần 6M)'}
            </button>
          </div>
        );

      case 'business':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>
              {hasBusiness
                ? 'Nâng cấp trang thiết bị quán cà phê (+5M VND) để tăng doanh thu mỗi vòng.'
                : 'Khởi nghiệp nhượng quyền quán cà phê (Vốn 20M VND). Thu về dòng tiền 3M/vòng tại vạch START.'}
            </p>
            {!hasBusiness ? (
              <button
                onClick={() => {
                  onConfirmAction({
                    type: 'buy_business',
                    cost: 20_000_000,
                    detail: 'Mở quán cà phê khởi nghiệp (20M VND)',
                  });
                }}
                disabled={cash < 20_000_000}
                style={{
                  padding: '14px',
                  borderRadius: '16px',
                  background: cash >= 20_000_000 ? 'linear-gradient(135deg, #EA580C, #C2410C)' : '#475569',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  border: 'none',
                  cursor: cash >= 20_000_000 ? 'pointer' : 'not-allowed',
                  fontSize: '15px',
                }}
              >
                {cash >= 20_000_000 ? 'Khởi Nghiệp Quán Cà Phê (20M)' : 'Không đủ vốn (Cần 20M)'}
              </button>
            ) : (
              <button
                onClick={() => {
                  onConfirmAction({
                    type: 'upgrade_business',
                    cost: 5_000_000,
                    detail: 'Nâng cấp cơ sở quán cà phê (+5M VND)',
                  });
                }}
                disabled={cash < 5_000_000}
                style={{
                  padding: '14px',
                  borderRadius: '16px',
                  background: cash >= 5_000_000 ? 'linear-gradient(135deg, #EA580C, #C2410C)' : '#475569',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  border: 'none',
                  cursor: cash >= 5_000_000 ? 'pointer' : 'not-allowed',
                  fontSize: '15px',
                }}
              >
                {cash >= 5_000_000 ? 'Nâng Cấp Quán Cà Phê (5M)' : 'Không đủ tiền (Cần 5M)'}
              </button>
            )}
          </div>
        );

      case 'course':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>
              {hasCourse
                ? 'Bạn đã hoàn thành khóa học này! Lương đã được cộng thêm 3M VND/vòng.'
                : 'Tham gia khóa học nâng cao kỹ năng chuyên môn: Học phí 6M VND. Tăng vĩnh viễn lương +3M VND/vòng từ vạch START kế tiếp!'}
            </p>
            {!hasCourse && (
              <button
                onClick={() => {
                  onConfirmAction({
                    type: 'buy_course',
                    cost: 6_000_000,
                    recurringBoost: 3_000_000,
                    detail: 'Đăng ký khóa học 6M (Lương +3M/vòng)',
                  });
                }}
                disabled={cash < 6_000_000}
                style={{
                  padding: '14px',
                  borderRadius: '16px',
                  background: cash >= 6_000_000 ? 'linear-gradient(135deg, #10B981, #059669)' : '#475569',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  border: 'none',
                  cursor: cash >= 6_000_000 ? 'pointer' : 'not-allowed',
                  fontSize: '15px',
                }}
              >
                {cash >= 6_000_000 ? 'Học Nâng Cao (6M) - Tăng +3M Lương' : 'Không đủ học phí (Cần 6M)'}
              </button>
            )}
          </div>
        );

      case 'living':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', color: '#EF4444', fontWeight: 600 }}>
              Nghĩa vụ chi phí sinh hoạt phát sinh bắt buộc khi dừng đúng ô: <strong>7.000.000 ₫</strong>.
            </p>
            <button
              onClick={() => {
                onConfirmAction({
                  type: 'pay_living',
                  cost: 7_000_000,
                  detail: 'Chi trả chi phí sinh hoạt 7M VND',
                });
              }}
              style={{
                padding: '14px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                color: '#FFFFFF',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                fontSize: '15px',
              }}
            >
              Thanh Toán Bắt Buộc (7M VND)
            </button>
          </div>
        );

      case 'personal':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', color: '#F87171' }}>
              Biến cố tài chính bất ngờ: Hóa đơn y tế hoặc xe cộ cần xử lý gấp.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => {
                  onConfirmAction({
                    type: 'pay_shock_now',
                    cost: 4_000_000,
                    detail: 'Xử lý biến cố: Trả ngay 4M VND',
                  });
                }}
                style={{
                  padding: '12px',
                  borderRadius: '14px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1.5px solid #EF4444',
                  color: '#FECACA',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Thanh Toán Ngay 4.000.000 ₫
              </button>
              <button
                onClick={() => {
                  onConfirmAction({
                    type: 'defer_shock',
                    cost: 1_000_000,
                    obligation: 4_000_000,
                    detail: 'Xử lý tạm: Trả trước 1M + nợ 4M tại START',
                  });
                }}
                style={{
                  padding: '12px',
                  borderRadius: '14px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1.5px solid #F59E0B',
                  color: '#FEF08A',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Trả Trước 1M + Nợ 4M Tại START
              </button>
            </div>
          </div>
        );

      case 'obligation':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>
              Thưởng hợp đồng hoặc nghĩa vụ thanh toán định kỳ.
            </p>
            <button
              onClick={() => {
                onConfirmAction({
                  type: 'receive_bonus',
                  income: 2_000_000,
                  detail: 'Nhận thưởng dự án +2.000.000 ₫',
                });
              }}
              style={{
                padding: '14px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #10B981, #059669)',
                color: '#FFFFFF',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                fontSize: '15px',
              }}
            >
              🎉 Nhận Thưởng Dự Án (+2M VND)
            </button>
          </div>
        );

      case 'macro':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid #F59E0B',
              padding: '12px 16px',
              borderRadius: '14px',
              color: '#FEF08A',
              fontSize: '13px',
              lineHeight: 1.5,
            }}>
              ⚡ <strong>Biến Động Kinh Tế Vĩ Mô:</strong> Lãi suất điều hành tăng nhẹ. Các kênh đầu tư được điều chỉnh giá trị tức thì!
            </div>
            <button
              onClick={() => {
                onConfirmAction({
                  type: 'acknowledge_macro',
                  detail: 'Đã cập nhật biến động vĩ mô',
                });
              }}
              style={{
                padding: '14px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                color: '#FFFFFF',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                fontSize: '15px',
              }}
            >
              Đã Nắm Rõ Tác Động
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 90,
      background: 'rgba(0, 0, 0, 0.1)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      padding: '16px 24px 135px',
      animation: 'fadeIn 0.2s ease',
    }}>
      {/* Khung Floating Card To Rộng Hơn Ở Góc Dưới (Đồng Bộ Thiết Kế Chuẩn Của App) */}
      <div style={{
        width: '100%',
        maxWidth: '560px',
        background: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
        border: '2px solid #3B82F6',
        borderRadius: '32px',
        padding: '24px 24px',
        boxShadow: '0 20px 60px rgba(59, 130, 246, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        animation: 'slideUpCard 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Header Modal */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
              border: '1.5px solid #60A5FA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.45)',
            }}>
              🌟
            </div>
            <div>
              <div style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 700 }}>
                Ô #{tile.index} • {tile.category.toUpperCase()} • Tiền mặt: <span style={{ color: '#34D399' }}>{formatVND(cash)}</span>
              </div>
              <h3 className="font-display" style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF' }}>
                {tile.label}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#94A3B8',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease',
            }}
          >
            ✕
          </button>
        </div>

        {/* Nội dung tương tác */}
        {renderContent()}

        {/* Nút Bỏ Qua Cơ Hội (nếu không phải bắt buộc) */}
        {tile.type !== 'living' && tile.type !== 'personal' && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94A3B8',
              fontSize: '13px',
              fontWeight: 700,
              padding: '4px',
              cursor: 'pointer',
              textDecoration: 'underline',
              textAlign: 'center',
              opacity: 0.9,
            }}
          >
            Bỏ qua cơ hội này, giữ tiền mặt
          </button>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUpCard {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
