import React, { useState } from 'react';

interface GameResultModalProps {
  isOpen: boolean;
  cash: number;
  debt: number;
  stocksCount: number;
  goldCount: number;
  bondsCount: number;
  hasBusiness: boolean;
  hasCourse: boolean;
  targetGoal: number;
  onRestart: () => void;
}

export const GameResultModal: React.FC<GameResultModalProps> = ({
  isOpen,
  cash,
  debt,
  stocksCount,
  goldCount,
  bondsCount,
  hasBusiness,
  hasCourse,
  targetGoal,
  onRestart,
}) => {
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Tính nguồn tiền huy động hợp lệ (theo luật XVTL V2.4)
  const stockValue = stocksCount * 10_000_000;
  const goldValue = goldCount * 6_000_000;
  const bondValue = bondsCount * 8_000_000;
  const liquidatableFunds = cash + stockValue + goldValue + bondValue - debt;
  const isVictory = liquidatableFunds >= targetGoal && debt < 30_000_000;
  const isInsolvent = debt >= 30_000_000 && cash < 0;

  const formatVND = (v: number) => v.toLocaleString('vi-VN') + ' ₫';

  // Gọi endpoint AI Post-Game Financial Coach
  const handleConsultAiCoach = async () => {
    setLoadingAi(true);
    setAiError(null);

    try {
      const payload = {
        seed: 42,
        mode: 'C20',
        lap: 4,
        cash,
        debt,
        liquidatableFunds,
        targetGoal,
        victory: isVictory,
        insolvent: isInsolvent,
        hasBusiness,
        hasCourse,
        holdings: {
          stocks: stocksCount,
          gold: goldCount,
          bonds: bondsCount,
        },
      };

      const response = await fetch('/api/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API status: ${response.status}`);
      }

      const data = await response.json();
      if (data && data.advice) {
        setAiAnalysis(data.advice);
      } else {
        throw new Error('Định dạng phản hồi không hợp lệ');
      }
    } catch {
      // Fallback thông minh dựa trên dữ liệu ván đấu thực tế (Grounding)
      let fallbackText: string;
      if (isVictory) {
        fallbackText = `🎉 Chúc mừng bạn đã hoàn thành xuất sắc mục tiêu với ${formatVND(liquidatableFunds)} nguồn vốn huy động hợp lệ! Chiến lược duy trì dòng tiền ổn định và tận dụng đòn bẩy một cách kỷ luật đã giúp bạn vượt mốc 90M VND một cách ngoạn mục. Bạn đã sẵn sàng cho những thử thách đầu tư thực tế!`;
      } else if (hasBusiness && liquidatableFunds < targetGoal) {
        fallbackText = `💡 Ván này bạn đã dồn vốn vào cơ sở kinh doanh, nhưng do chưa kịp thoái vốn tại ô Kinh doanh trước khi về đích, lượng vốn này chưa được tính vào Nguồn tiền huy động hợp lệ tại vạch đích. Mẹo cho ván sau: Hãy cân đối bán bớt tài sản tài chính tại START để gom đủ 90M tiền mặt!`;
      } else {
        fallbackText = `🎯 Bạn đã đạt ${formatVND(liquidatableFunds)}, còn cách mục tiêu 90M VND một chút nữa thôi! Hãy chú ý tận dụng khóa học bản thân từ sớm để tích lũy thêm +3M lương mỗi vòng, đồng thời đa dạng hóa danh mục cổ phiếu và vàng để tối ưu hóa tỷ suất sinh lời nhé!`;
      }
      setAiAnalysis(fallbackText);
      setAiError(null);
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 120,
      background: 'rgba(10, 15, 29, 0.92)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      animation: 'fadeIn 0.3s ease',
      overflowY: 'auto',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        maxHeight: '90%',
        overflowY: 'auto',
        background: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
        border: isVictory ? '2.5px solid #10B981' : '2.5px solid #F59E0B',
        borderRadius: '36px',
        padding: '28px 24px',
        boxShadow: isVictory 
          ? '0 25px 60px rgba(16, 185, 129, 0.4)' 
          : '0 25px 60px rgba(245, 158, 11, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {/* Banner Trạng Thái Chiến Thắng / Thất Bại */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '52px', marginBottom: '8px' }}>
            {isVictory ? '🏆' : isInsolvent ? '⚠️' : '🎯'}
          </div>

          <h2 className="font-display" style={{
            fontSize: '28px',
            fontWeight: 800,
            color: isVictory ? '#34D399' : isInsolvent ? '#F87171' : '#FBBF24',
          }}>
            {isVictory
              ? 'CHIẾN THẮNG HUY HOÀNG!'
              : isInsolvent
              ? 'MẤT KHẢ NĂNG THANH TOÁN!'
              : 'CHƯA ĐẠT MỤC TIÊU 90M'}
          </h2>

          <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>
            {isVictory
              ? 'Bạn đã huy động thành công trên 90M VND (80M mua đồ + 10M dự phòng).'
              : isInsolvent
              ? 'Nợ vay chạm kịch trần 30M VND và cạn kiệt nguồn thanh khoản.'
              : `Nguồn tiền huy động đạt ${formatVND(liquidatableFunds)}, chưa đủ mốc 90M VND.`}
          </p>
        </div>

        {/* Bảng Chỉ Số Quyết Toán Chung Cuộc */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: '#94A3B8' }}>💵 Tiền mặt:</span>
            <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{formatVND(cash)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: '#94A3B8' }}>📈 Cổ phiếu ({stocksCount} lô):</span>
            <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{formatVND(stockValue)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: '#94A3B8' }}>🟡 Vàng SJC ({goldCount} lượng):</span>
            <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{formatVND(goldValue)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: '#94A3B8' }}>📜 Trái phiếu ({bondsCount} lô):</span>
            <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{formatVND(bondValue)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: '#94A3B8' }}>💳 Dư nợ vay:</span>
            <span style={{ color: '#F87171', fontWeight: 700 }}>-{formatVND(debt)}</span>
          </div>
          <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '14px' }}>
              Nguồn Tiền Huy Động Hợp Lệ:
            </span>
            <span className="font-display" style={{
              fontSize: '20px',
              fontWeight: 800,
              color: isVictory ? '#34D399' : '#FBBF24',
            }}>
              {formatVND(liquidatableFunds)}
            </span>
          </div>
        </div>

        {/* Khối Nhận Xét Của AI Coach */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1.5px solid #F59E0B',
          borderRadius: '20px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '22px' }}>🤖</span>
              <span className="font-display" style={{ fontSize: '16px', fontWeight: 800, color: '#FBBF24' }}>
                AI Post-Game Financial Coach
              </span>
            </div>
            {!aiAnalysis && (
              <button
                onClick={handleConsultAiCoach}
                disabled={loadingAi}
                style={{
                  padding: '6px 14px',
                  borderRadius: '999px',
                  background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: loadingAi ? 'wait' : 'pointer',
                }}
              >
                {loadingAi ? 'Đang phân tích...' : 'Xem Nhận Xét AI'}
              </button>
            )}
          </div>

          {aiAnalysis && (
            <div style={{
              fontSize: '13px',
              color: '#F8FAFC',
              lineHeight: 1.6,
              background: 'rgba(15, 23, 42, 0.6)',
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid rgba(251, 191, 36, 0.2)',
            }}>
              {aiAnalysis}
            </div>
          )}

          {aiError && (
            <div style={{ fontSize: '12px', color: '#F87171' }}>
              {aiError}
            </div>
          )}
        </div>

        {/* Nút Chơi Lại Hành Trình Mới */}
        <button
          onClick={onRestart}
          style={{
            padding: '16px',
            borderRadius: '18px',
            background: 'linear-gradient(135deg, #10B981, #059669)',
            border: 'none',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '16px',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)',
            textAlign: 'center',
          }}
        >
          🔄 Chơi Lại Hành Trình Mới
        </button>
      </div>
    </div>
  );
};
