import React from 'react';

interface PortfolioDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cash: number;
  debt: number;
  netWorth: number;
  targetGoal: number;
}

export const PortfolioDrawer: React.FC<PortfolioDrawerProps> = ({
  isOpen,
  onClose,
  cash,
  debt,
  netWorth,
  targetGoal,
}) => {
  if (!isOpen) return null;

  const formatVND = (val: number) => {
    return val.toLocaleString('vi-VN') + ' ₫';
  };

  const progressPercent = Math.min(Math.round((netWorth / targetGoal) * 100), 100);

  const stocks = [
    { symbol: 'FPT', name: 'Công nghệ FPT', price: 125000, quantity: 0 },
    { symbol: 'VNM', name: 'Vinamilk', price: 68000, quantity: 0 },
    { symbol: 'HPG', name: 'Thép Hòa Phát', price: 29000, quantity: 0 },
    { symbol: 'MWG', name: 'Thế Giới Di Động', price: 54000, quantity: 0 },
    { symbol: 'VCB', name: 'Vietcombank', price: 92000, quantity: 0 },
    { symbol: 'VIC', name: 'Vingroup', price: 43000, quantity: 0 },
  ];

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 100,
      background: 'rgba(0, 0, 0, 0.45)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      animation: 'fadeIn 0.25s ease',
    }}>
      {/* Vùng bấm ra ngoài để đóng */}
      <div 
        onClick={onClose}
        style={{ flex: 1, width: '100%' }}
      />

      {/* Sheet Thẻ Danh Mục Bật Lên Đồng Bộ Chuẩn Thiết Kế Của App */}
      <div style={{
        width: '100%',
        maxHeight: '84%',
        background: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
        borderTopLeftRadius: '36px',
        borderTopRightRadius: '36px',
        borderTop: '3px solid #3B82F6',
        boxShadow: '0 -20px 60px rgba(59, 130, 246, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Handle Bar & Header */}
        <div style={{
          padding: '16px 28px 14px',
          borderBottom: '1.5px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(15, 23, 42, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
        }}>
          {/* Thanh gạt nhỏ trên đỉnh */}
          <div style={{
            width: '52px',
            height: '5px',
            borderRadius: '999px',
            background: 'rgba(255, 255, 255, 0.3)',
            marginBottom: '12px',
          }} />

          <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
                border: '1.5px solid #60A5FA',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.45)',
              }}>
                💼
              </div>
              <div>
                <h3 className="font-display" style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF' }}>
                  Danh Mục Tài Sản & Nợ
                </h3>
                <p style={{ fontSize: '13px', color: '#94A3B8' }}>
                  Tài sản ròng: <strong style={{ color: '#38BDF8' }}>{formatVND(netWorth)}</strong> ({progressPercent}% mục tiêu)
                </p>
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
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Nội dung danh mục dạng Thẻ Bài Màu Sắc Sáng Rực Rỡ */}
        <div style={{
          padding: '20px 24px 40px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}>
          {/* Mục 1: Tiền mặt */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.28) 0%, rgba(5, 150, 105, 0.45) 100%)',
            border: '2px solid #34D399',
            borderRadius: '22px',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 6px 20px rgba(16, 185, 129, 0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '32px' }}>💰</span>
              <div>
                <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '16px' }}>Tiền Mặt Khả Dụng</div>
                <div style={{ fontSize: '12px', color: '#A7F3D0' }}>Thanh toán chi phí & cơ hội đầu tư ô dừng</div>
              </div>
            </div>
            <div className="font-display" style={{ fontSize: '22px', fontWeight: 800, color: '#34D399', textShadow: '0 2px 8px rgba(16, 185, 129, 0.5)' }}>
              {formatVND(cash)}
            </div>
          </div>

          {/* Mục 2: Tiết kiệm Ngân hàng */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.28) 0%, rgba(37, 99, 235, 0.45) 100%)',
            border: '2px solid #60A5FA',
            borderRadius: '22px',
            padding: '16px 20px',
            boxShadow: '0 6px 20px rgba(59, 130, 246, 0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '30px' }}>🏦</span>
                <div>
                  <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '16px' }}>Tiền Gửi Tiết Kiệm</div>
                  <div style={{ fontSize: '12px', color: '#BAE6FD' }}>Kỳ hạn 1, 2, 3 vòng đáo hạn tại vạch START</div>
                </div>
              </div>
              <div className="font-display" style={{ fontSize: '20px', fontWeight: 800, color: '#60A5FA' }}>
                0 ₫
              </div>
            </div>
          </div>

          {/* Mục 3: Cổ phiếu 6 mã (Thẻ Bài VN30) */}
          <div style={{
            background: 'rgba(30, 41, 59, 0.75)',
            border: '2px solid rgba(147, 197, 253, 0.45)',
            borderRadius: '22px',
            padding: '16px 18px',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '26px' }}>📈</span>
                <span style={{ fontWeight: 800, color: '#F8FAFC', fontSize: '15px' }}>Cổ Phiếu VN30 (6 Mã)</span>
              </div>
              <span style={{ fontSize: '12px', color: '#94A3B8' }}>Nắm giữ: 0 CP</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {stocks.map(s => (
                <div key={s.symbol} style={{
                  background: 'linear-gradient(180deg, #334155 0%, #1E293B 100%)',
                  padding: '10px 6px',
                  borderRadius: '14px',
                  border: '1.5px solid rgba(148, 163, 184, 0.35)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontWeight: 900, color: '#38BDF8', fontSize: '14px' }}>{s.symbol}</div>
                  <div style={{ fontSize: '11px', color: '#E2E8F0' }}>{s.price.toLocaleString()} ₫</div>
                  <div style={{ fontSize: '11px', color: '#34D399', marginTop: '2px', fontWeight: 700 }}>0 CP</div>
                </div>
              ))}
            </div>
          </div>

          {/* Mục 4: Trái phiếu & Vàng */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Trái phiếu */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.28) 0%, rgba(126, 34, 206, 0.45) 100%)',
              border: '2px solid #C084FC',
              borderRadius: '20px',
              padding: '14px 16px',
              boxShadow: '0 6px 16px rgba(168, 85, 247, 0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '26px' }}>📜</span>
                <span style={{ fontWeight: 800, fontSize: '14px', color: '#FFFFFF' }}>Trái Phiếu</span>
              </div>
              <div style={{ fontSize: '11px', color: '#E9D5FF' }}>Lãi suất 5%/vòng</div>
              <div className="font-display" style={{ fontSize: '18px', fontWeight: 800, color: '#E879F9', marginTop: '4px' }}>
                0 ₫
              </div>
            </div>

            {/* Vàng SJC */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.28) 0%, rgba(217, 119, 6, 0.45) 100%)',
              border: '2px solid #FBBF24',
              borderRadius: '20px',
              padding: '14px 16px',
              boxShadow: '0 6px 16px rgba(245, 158, 11, 0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '26px' }}>🪙</span>
                <span style={{ fontWeight: 800, fontSize: '14px', color: '#FFFFFF' }}>Vàng SJC</span>
              </div>
              <div style={{ fontSize: '11px', color: '#FEF08A' }}>Phòng thủ lạm phát</div>
              <div className="font-display" style={{ fontSize: '18px', fontWeight: 800, color: '#FBBF24', marginTop: '4px' }}>
                0 chỉ
              </div>
            </div>
          </div>

          {/* Mục 5: Cơ sở kinh doanh Quán Cà Phê */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.28) 0%, rgba(194, 65, 12, 0.45) 100%)',
            border: '2px solid #FB923C',
            borderRadius: '22px',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 6px 16px rgba(249, 115, 22, 0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '28px' }}>☕</span>
              <div>
                <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '15px' }}>Quán Cà Phê Khởi Nghiệp</div>
                <div style={{ fontSize: '12px', color: '#FED7AA' }}>Doanh thu tự động tại vạch START</div>
              </div>
            </div>
            <span style={{
              fontSize: '12px',
              fontWeight: 800,
              padding: '4px 12px',
              borderRadius: '999px',
              background: 'rgba(249, 115, 22, 0.4)',
              color: '#FFEDD5',
              border: '1px solid rgba(251, 146, 60, 0.6)',
            }}>
              Chưa sở hữu
            </span>
          </div>

          {/* Mục 6: Nợ vay & Hạn mức */}
          <div style={{
            background: debt > 0
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.35) 0%, rgba(185, 28, 28, 0.5) 100%)'
              : 'rgba(30, 41, 59, 0.6)',
            border: debt > 0 ? '2px solid #F87171' : '1.5px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '22px',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 6px 16px rgba(0, 0, 0, 0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '28px' }}>💳</span>
              <div>
                <div style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '15px' }}>Dư Nợ Vay Khẩn Cấp</div>
                <div style={{ fontSize: '12px', color: debt > 0 ? '#FECACA' : '#94A3B8' }}>Hạn mức 30M (lãi 10%/vòng)</div>
              </div>
            </div>
            <div className="font-display" style={{ fontSize: '20px', fontWeight: 800, color: debt > 0 ? '#F87171' : '#94A3B8' }}>
              {formatVND(debt)}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
