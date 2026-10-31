import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { GameState } from '../../../src/game/types';
import { ASSETS, RULES } from '../../../src/data/config';
import { totalWorth } from '../../../src/game/engine';
import { liquidatableFunds, goalProgress } from '../../../src/game/selectors';
import { hasBondCredit } from '../../../src/game/bond-credit';
import { BondHoldings } from '../../../src/components/BondHoldings';
import { GoalChecks } from '../../../src/components/GoalChecks';
import { FinancialTerm } from '../../../src/components/FinancialTerm';
import { investmentLotLabel, maturityLabel, savingsPeriodExplanation } from '../../../src/components/player-language';
import { exportLog } from '../../../src/exportLog';
import { localizeNarrative } from '../../../src/components/glossary';
import { money } from '../../../src/game/format';
import { Icon } from '../../../src/components/Icon';
import { sound } from '../utils/audio';

interface UnifiedManagementSheetProps {
  game: GameState;
  initialTab?: 'portfolio' | 'log';
  onClose: () => void;
  onHelp?: () => void;
}

interface MaskedIconProps {
  src: string;
  alt: string;
  size?: number;
  color: string;
  style?: React.CSSProperties;
}

const MaskedIcon: React.FC<MaskedIconProps> = ({
  src,
  alt,
  size = 18,
  color,
  style = {},
}) => {
  return (
    <span
      role="img"
      aria-label={alt}
      style={{
        display: 'inline-block',
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        WebkitMaskImage: `url(${src})`,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskImage: `url(${src})`,
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        maskSize: 'contain',
        flexShrink: 0,
        verticalAlign: 'middle',
        transition: 'background-color 0.15s ease, transform 0.15s ease',
        ...style,
      }}
    />
  );
};

export const UnifiedManagementSheet: React.FC<UnifiedManagementSheetProps> = ({
  game,
  initialTab = 'portfolio',
  onClose,
  onHelp,
}) => {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'log'>(initialTab);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasMore = el.scrollHeight - el.scrollTop - el.clientHeight > 14;
    setCanScrollDown(hasMore);
  }, []);

  useEffect(() => {
    const timer = setTimeout(checkScroll, 100);
    return () => clearTimeout(timer);
  }, [activeTab, game, checkScroll]);

  const switchTab = (tab: 'portfolio' | 'log') => {
    sound.playClick();
    setActiveTab(tab);
  };

  // Financial calculations
  const worth = totalWorth(game);
  const funds = liquidatableFunds(game);
  const goal = goalProgress(game);
  const progress = Math.min(100, Math.max(0, goal.percent));
  const activeDeposits = game.deposits.filter((lot) => lot.status === 'active');

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(12, 10, 8, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease',
        writingMode: 'horizontal-tb',
        textOrientation: 'mixed',
        pointerEvents: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          sound.playClick();
          onClose();
        }
      }}
    >
      {/* Khung Sổ Quản Lý Bìa Giấy Da Cổ Điển (#F5EBE6 / #E3CCA9) — Chuẩn hóa kích thước ôm sát nội dung: min(94%, 440px) x min(88vh, 760px) */}
      <div
        className="w-[94%] max-w-[440px] mx-auto relative overflow-hidden flex flex-col shadow-2xl bg-transparent"
        style={{
          position: 'relative',
          width: 'min(94%, 440px)',
          maxWidth: '440px',
          height: 'min(88vh, 760px)',
          maxHeight: '760px',
          background: 'linear-gradient(175deg, #FDF8F3 0%, #F5EBE6 30%, #ECDCC2 75%, #E3CCA9 100%)',
          border: '3.5px solid #8C5828',
          outline: '2px solid #5C3513',
          borderRadius: '28px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), inset 0 0 25px rgba(184, 144, 91, 0.25)',
          fontFamily: "'Fredoka', sans-serif",
          boxSizing: 'border-box',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'sheetScaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          writingMode: 'horizontal-tb',
          textOrientation: 'mixed',
          pointerEvents: 'auto',
        }}
      >
        {/* Nút đóng góc trên bên phải bằng asset nút exit.png */}
        <button
          onClick={() => {
            sound.playClick();
            onClose();
          }}
          title="Đóng Bảng"
          aria-label="Đóng"
          style={{
            position: 'absolute',
            top: '12px',
            right: '14px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            zIndex: 40,
            transition: 'transform 0.15s ease',
          }}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.88)';
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
          }}
        >
          <img
            src="/assets/cropped/exit-btn.png"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/assets/nut-exit.png';
            }}
            alt="Đóng"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </button>

        {/* VÙNG NỘI DUNG NẰM TRỌN TRONG PARCHMENT (Edge-to-Edge ôm sát, padding chuẩn 12px 14px 10px 14px) */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            padding: '12px 14px 10px 14px',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          {/* Top Header: 2 Tab Chuyển Đổi Ví Tài Sản & Nhật Ký */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingBottom: '8px',
              borderBottom: '1.5px solid rgba(140, 88, 40, 0.28)',
              marginBottom: '6px',
              flexShrink: 0,
              gap: '10px',
              width: '100%',
              paddingRight: '36px', // Khoảng trống cho nút Exit
            }}
          >
            {/* Tab: Ví Tài Sản */}
            <button
              onClick={() => switchTab('portfolio')}
              style={{
                background: activeTab === 'portfolio' ? 'rgba(180, 83, 9, 0.16)' : 'transparent',
                color: activeTab === 'portfolio' ? '#381F0B' : '#8C5828',
                border: 'none',
                borderRadius: '10px',
                borderBottom: activeTab === 'portfolio' ? '3px solid #B45309' : '3px solid transparent',
                padding: '4px 14px',
                fontSize: '13.5px',
                fontWeight: activeTab === 'portfolio' ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
                fontFamily: "'Fredoka', sans-serif",
                whiteSpace: 'nowrap',
              }}
            >
              <MaskedIcon
                src="/assets/wallet.png"
                alt="Ví Tài Sản"
                size={21}
                color={activeTab === 'portfolio' ? '#381F0B' : '#8C5828'}
              />
              <span>Ví Tài Sản</span>
            </button>

            {/* Tab: Nhật Ký */}
            <button
              onClick={() => switchTab('log')}
              style={{
                background: activeTab === 'log' ? 'rgba(180, 83, 9, 0.16)' : 'transparent',
                color: activeTab === 'log' ? '#381F0B' : '#8C5828',
                border: 'none',
                borderRadius: '10px',
                borderBottom: activeTab === 'log' ? '3px solid #B45309' : '3px solid transparent',
                padding: '4px 14px',
                fontSize: '13.5px',
                fontWeight: activeTab === 'log' ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
                fontFamily: "'Fredoka', sans-serif",
                whiteSpace: 'nowrap',
              }}
            >
              <MaskedIcon
                src="/assets/history-icon.png"
                alt="Nhật Ký"
                size={21}
                color={activeTab === 'log' ? '#381F0B' : '#8C5828'}
              />
              <span>Nhật Ký</span>
            </button>
          </div>

          {activeTab === 'portfolio' ? (
            <>
              {/* KHU VỰC CỐ ĐỊNH: TỔNG TÀI SẢN RÒNG & TIẾN ĐỘ 90M VND (Thẻ bo góc ôm sát) */}
              <div
                style={{
                  flexShrink: 0,
                  background: 'rgba(255, 255, 255, 0.72)',
                  border: '1.5px solid rgba(140, 88, 40, 0.22)',
                  borderRadius: '14px',
                  padding: '8px 12px',
                  marginBottom: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                }}
              >
                {/* Net Worth */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '4px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      color: '#78350F',
                      textTransform: 'uppercase',
                    }}
                  >
                    <FinancialTerm term="netWorth">TỔNG TÀI SẢN RÒNG</FinancialTerm>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <strong style={{ fontSize: '19px', color: '#381F0B', fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
                      {money(worth)}
                    </strong>
                    <small
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: worth >= RULES.startingCapital ? '#047857' : '#B91C1C',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {worth >= RULES.startingCapital ? '+' : ''}
                      {money(worth - RULES.startingCapital)}
                    </small>
                  </div>
                </div>

                {/* Goal Track & Progress Bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      fontSize: '11.5px',
                      color: '#451A03',
                    }}
                  >
                    <span>
                      Huy động về đích: <strong style={{ color: '#047857', fontVariantNumeric: 'tabular-nums' }}>{money(funds)}</strong> / <strong>90M</strong>
                    </span>
                    <strong style={{ color: '#B45309', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{Math.round(progress)}%</strong>
                  </div>

                  {/* Stylized Antique Progress Bar */}
                  <div
                    style={{
                      width: '100%',
                      height: '8px',
                      background: 'rgba(184, 144, 91, 0.25)',
                      border: '1px solid rgba(140, 88, 40, 0.45)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                    }}
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Tiến độ tích lũy 90 triệu"
                  >
                    <div
                      style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #10B981 0%, #F59E0B 70%, #D97706 100%)',
                        transition: 'width 0.35s ease',
                      }}
                    />
                  </div>

                  <details style={{ marginTop: '2px', fontSize: '11px', color: '#78350F' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Công thức tính mục tiêu 90M</summary>
                    <div style={{ marginTop: '3px', paddingLeft: '4px' }}>
                      <GoalChecks game={game} />
                    </div>
                  </details>
                </div>
              </div>

              {/* KHU VỰC CUỘN NỘI DUNG (LƯỚI THẺ TÀI SẢN GỌN GÀNG, KHÔNG KHOẢNG TRỐNG THỪA) */}
              <div
                style={{
                  position: 'relative',
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div
                  ref={scrollRef}
                  onScroll={checkScroll}
                  className="medieval-scrollbar"
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehavior: 'contain',
                    paddingRight: '3px',
                    paddingBottom: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                    fontFamily: "'Fredoka', sans-serif",
                    color: '#381F0B',
                  }}
                >
                  {/* DANH SÁCH 6 THẺ TÀI SẢN GỌN GÀNG (COMPACT ASSET CARDS) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {Object.entries(ASSETS).map(([key, asset]) => {
                      const amount = game.portfolio[key as keyof typeof ASSETS];
                      const locked =
                        key !== 'cash' &&
                        key !== 'savings' &&
                        amount === 0 &&
                        !game.unlockedAssets.includes(key as 'stocks' | 'bonds' | 'gold' | 'business');
                      return (
                        <div
                          key={key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: locked ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.85)',
                            border: '1px solid rgba(140, 88, 40, 0.16)',
                            borderRadius: '10px',
                            fontSize: '12.5px',
                            opacity: locked ? 0.65 : 1,
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              minWidth: 0,
                              flex: 1,
                              overflow: 'hidden',
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px',
                                background: 'rgba(180, 83, 9, 0.1)',
                                borderRadius: '8px',
                                color: '#78350F',
                                flexShrink: 0,
                              }}
                            >
                              {key === 'stocks' ? (
                                <img src="/assets/stock-icon.png" alt="Cổ phiếu" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                              ) : key === 'bonds' ? (
                                <img src="/assets/bond-icon.png" alt="Trái phiếu" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                              ) : key === 'gold' ? (
                                <img src="/assets/gold-icon.png" alt="Vàng" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                              ) : key === 'cash' ? (
                                <img src="/assets/money-icon.png" alt="Tiền mặt" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                              ) : (
                                <Icon name={asset.icon} size={21} />
                              )}
                            </span>
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                minWidth: 0,
                                overflow: 'hidden',
                              }}
                            >
                              <span
                                style={{
                                  fontWeight: 600,
                                  color: '#381F0B',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  fontSize: '13px',
                                }}
                              >
                                {asset.label}
                              </span>
                              {key === 'cash' && (
                                <small style={{ fontSize: '10.5px', color: '#047857', fontWeight: 500 }}>Tiền mặt sẵn sàng dùng ngay</small>
                              )}
                              {key === 'savings' && (
                                <small style={{ fontSize: '10.5px', color: '#6D4C41' }}>
                                  {activeDeposits.length} khoản tiền gửi chưa đáo hạn
                                </small>
                              )}
                              {key === 'business' && amount > 0 && (
                                <small style={{ fontSize: '10.5px', color: '#B45309' }}>Quán kinh doanh (Chỉ bán tại ô Shop)</small>
                              )}
                              {locked && (
                                <small style={{ fontSize: '10.5px', color: '#8D6E63' }}>Chờ cơ hội giao dịch trên bàn cờ</small>
                              )}
                            </div>
                          </div>
                          <strong
                            style={{
                              fontSize: '13.5px',
                              color: locked ? '#8D6E63' : '#381F0B',
                              fontVariantNumeric: 'tabular-nums',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              marginLeft: '8px',
                              fontWeight: 700,
                            }}
                          >
                            {locked ? '—' : money(amount)}
                          </strong>
                        </div>
                      );
                    })}
                  </div>

                  {/* KHOẢN TIẾT KIỆM ĐANG GỬI */}
                  {activeDeposits.length > 0 && (
                    <div
                      style={{
                        padding: '6px 10px',
                        background: 'rgba(255, 255, 255, 0.75)',
                        borderRadius: '10px',
                        border: '1px solid rgba(140, 88, 40, 0.2)',
                        marginTop: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#78350F', textTransform: 'uppercase' }}>
                        Khoản gửi tiết kiệm đang hoạt động:
                      </span>
                      {activeDeposits.map((lot) => (
                        <div
                          key={lot.id}
                          style={{
                            fontSize: '12px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '3px 0',
                            borderBottom: '1px dashed rgba(140, 88, 40, 0.15)',
                            gap: '6px',
                          }}
                        >
                          <span style={{ fontWeight: 500, color: '#451A03' }}>{investmentLotLabel('savings', lot.id)}:</span>
                          <strong style={{ marginLeft: 'auto', textAlign: 'right', color: '#047857', fontVariantNumeric: 'tabular-nums' }}>
                            {money(lot.principal)} (lãi {Math.round(lot.rate * 100)}%, {maturityLabel(lot.maturityLap)})
                          </strong>
                        </div>
                      ))}
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#78350F', fontStyle: 'italic' }}>
                        {savingsPeriodExplanation}
                      </p>
                    </div>
                  )}

                  {/* TRÁI PHIẾU THEO TỔ CHỨC PHÁT HÀNH */}
                  {hasBondCredit(game) && game.bondLots.length > 0 && (
                    <details
                      style={{
                        fontSize: '12px',
                        color: '#451A03',
                        background: 'rgba(255, 255, 255, 0.7)',
                        border: '1px solid rgba(140, 88, 40, 0.2)',
                        borderRadius: '10px',
                        padding: '6px 10px',
                        marginTop: '4px',
                      }}
                    >
                      <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#78350F' }}>
                        Chi tiết lô trái phiếu nắm giữ ({game.bondLots.length} lô)
                      </summary>
                      <div style={{ marginTop: '4px' }}>
                        <BondHoldings game={game} />
                      </div>
                    </details>
                  )}

                  {/* NỢ VAY CỦA BẠN (NẾU CÓ) */}
                  {game.portfolio.debt > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: 'rgba(254, 226, 226, 0.9)',
                        border: '1.5px solid rgba(239, 68, 68, 0.45)',
                        borderRadius: '10px',
                        marginTop: '4px',
                        boxShadow: '0 1px 3px rgba(239, 68, 68, 0.1)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#991B1B' }}>Nợ vay khẩn cấp</span>
                        <small style={{ fontSize: '11px', color: '#B91C1C' }}>Lãi suất 10%/vòng tại ô Xuất phát</small>
                      </div>
                      <strong style={{ fontSize: '14px', color: '#991B1B', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                        -{money(game.portfolio.debt)}
                      </strong>
                    </div>
                  )}

                  {/* HƯỚNG DẪN CHIẾN LƯỢC / TRỢ GIÚP */}
                  {onHelp && (
                    <div style={{ marginTop: '8px', textAlign: 'center' }}>
                      <button
                        onClick={() => {
                          sound.playClick();
                          onHelp();
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.65)',
                          border: '1.5px dashed rgba(140, 88, 40, 0.45)',
                          borderRadius: '8px',
                          padding: '6px 14px',
                          fontSize: '12px',
                          color: '#78350F',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontFamily: "'Fredoka', sans-serif",
                          transition: 'all 0.15s ease',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <MaskedIcon
                          src="/assets/read-icon.png"
                          alt="Sổ Tay"
                          size={20}
                          color="#78350F"
                        />
                        <span>Xem Sổ Tay Chiến Lược & Luật Chơi</span>
                      </button>
                    </div>
                  )}
                </div>

                {canScrollDown && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '24px',
                      pointerEvents: 'none',
                      background: 'linear-gradient(to top, rgba(246, 226, 189, 0.95) 0%, rgba(246, 226, 189, 0) 100%)',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      paddingBottom: '2px',
                      transition: 'opacity 0.2s ease',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '9.5px',
                        color: '#b45309',
                        fontWeight: 900,
                        animation: 'bounceHint 1.4s infinite ease-in-out',
                        opacity: 0.8,
                      }}
                    >
                      ▼ Cuộn xem thêm
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* TAB 1: NHẬT KÝ VÁN CHƠI (FLAT LOG ENTRIES) */
            <div
              style={{
                position: 'relative',
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Header của Tab Nhật Ký: Số sự kiện & Nút xuất file */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '4px',
                  marginBottom: '4px',
                  borderBottom: '1px solid rgba(184, 144, 91, 0.3)',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#78350f' }}>
                  Đã ghi nhận: <strong>{game.log.length}</strong> biến cố
                </span>
                <button
                  onClick={() => {
                    sound.playClick();
                    exportLog(game);
                  }}
                  title="Tải lịch sử ván chơi về máy để phân tích"
                  style={{
                    background: 'rgba(180, 83, 9, 0.1)',
                    border: '1px solid rgba(180, 83, 9, 0.35)',
                    borderRadius: '4px',
                    padding: '3px 9px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#78350f',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <img
                    src="/assets/export-globe.png"
                    alt="Xuất Nhật Ký"
                    style={{
                      width: '18px',
                      height: '18px',
                      objectFit: 'contain',
                      flexShrink: 0,
                      verticalAlign: 'middle',
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))',
                    }}
                  />
                  <span>Xuất Nhật Ký</span>
                </button>
              </div>

              {/* Danh sách nhật ký cuộn phẳng (Flat Log List) */}
              <div
                ref={scrollRef}
                onScroll={checkScroll}
                className="medieval-scrollbar"
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehavior: 'contain',
                  paddingRight: '4px',
                  paddingBottom: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  fontFamily: "'Fredoka', sans-serif",
                }}
              >
                {game.log.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#8c5828', fontSize: '12px' }}>
                    Chưa có sự kiện nào. Hãy gieo xúc xắc để bắt đầu hành trình!
                  </div>
                ) : (
                  game.log.toReversed().map((entry) => (
                    <details
                      key={entry.sequence}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px dashed rgba(184, 144, 91, 0.3)',
                        borderRadius: 0,
                        padding: '4px 0',
                        color: '#2b1103',
                        boxShadow: 'none',
                      }}
                    >
                      <summary
                        style={{
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '12px',
                          color: '#78350f',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontFamily: "'Fredoka', sans-serif", whiteSpace: 'nowrap' }}>
                          #{entry.sequence} · Vòng {entry.before.lap}
                        </span>
                        <strong
                          style={{
                            marginLeft: '6px',
                            color: '#2b1103',
                            fontFamily: "'Fredoka', sans-serif",
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '65%',
                          }}
                        >
                          {localizeNarrative(entry.title)}
                        </strong>
                      </summary>
                      <div
                        style={{
                          marginTop: '3px',
                          fontSize: '11.5px',
                          lineHeight: 1.45,
                          color: '#3e2723',
                          paddingLeft: '6px',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                        }}
                      >
                        <p style={{ margin: '2px 0', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                          <b>Quyết định:</b> {localizeNarrative(entry.decision)}
                        </p>
                        <p style={{ margin: '2px 0', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                          <b>Hệ quả:</b> {localizeNarrative(entry.consequence)}
                        </p>
                        <p style={{ margin: '2px 0', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                          <b>Tài sản ròng:</b> {money(totalWorth(entry.before))} → {money(totalWorth(entry.after))}
                        </p>
                      </div>
                    </details>
                  ))
                )}
              </div>

              {canScrollDown && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '24px',
                    pointerEvents: 'none',
                    background: 'linear-gradient(to top, rgba(246, 226, 189, 0.95) 0%, rgba(246, 226, 189, 0) 100%)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    paddingBottom: '2px',
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  <span
                    style={{
                      fontSize: '9.5px',
                      color: '#b45309',
                      fontWeight: 900,
                      animation: 'bounceHint 1.4s infinite ease-in-out',
                      opacity: 0.8,
                    }}
                  >
                    ▼ Cuộn xem thêm
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes sheetScaleUp {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes bounceHint {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(2.5px); }
        }
      `}</style>
    </div>
  );
};
