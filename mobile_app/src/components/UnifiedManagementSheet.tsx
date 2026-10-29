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
      {/* Khung Sổ Quản Lý Bìa Giấy Da Cổ Điển (#F5EBE6 / #E3CCA9) — layer-2-clean.png */}
      <div
        className="w-[90%] max-w-[350px] h-[80vh] max-h-[660px] mx-auto relative overflow-hidden flex flex-col shadow-2xl bg-transparent"
        style={{
          position: 'relative',
          width: '90%',
          maxWidth: '350px',
          height: '80vh',
          maxHeight: '660px',
          background: 'linear-gradient(175deg, #FDF8F3 0%, #F5EBE6 30%, #ECDCC2 75%, #E3CCA9 100%)',
          border: '3.5px solid #8C5828',
          outline: '2px solid #5C3513',
          borderRadius: '28px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), inset 0 0 25px rgba(184, 144, 91, 0.25)',
          fontFamily: "'Fredoka', 'Baloo 2', system-ui, sans-serif",
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
            top: '10px',
            right: '12px',
            width: '30px',
            height: '30px',
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
            (e.currentTarget as HTMLElement).style.transform = 'scale(0.9)';
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

        {/* Cặp nút mũi tên Trái & Phải đã được gỡ bỏ hoàn toàn theo yêu cầu UI mới */}
        {/* Navigation arrows stripped per UI overhaul: disabled={activeTab === 'portfolio'}, disabled={activeTab === 'log'} */}

        {/* VÙNG NỘI DUNG NẰM TRỌN TRONG PARCHMENT (Edge-to-Edge cân đối px-4 sm:px-5) */}
        <div
          className="px-4 sm:px-5"
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            padding: '16px 16px 12px 16px',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          {/* Top Header: ONLY the two main tabs centered symmetrically */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingBottom: '8px',
              borderBottom: '1.5px solid rgba(184, 144, 91, 0.4)',
              marginBottom: '6px',
              flexShrink: 0,
              gap: '8px',
              width: '100%',
            }}
          >
            {/* Tab: Ví Tài Sản */}
            <button
              onClick={() => switchTab('portfolio')}
              style={{
                background: activeTab === 'portfolio' ? 'rgba(180, 83, 9, 0.16)' : 'transparent',
                color: activeTab === 'portfolio' ? '#451a03' : '#8c5828',
                border: 'none',
                borderRadius: '8px',
                borderBottom: activeTab === 'portfolio' ? '2.5px solid #b45309' : '2.5px solid transparent',
                padding: '4px 12px',
                fontSize: '13px',
                fontWeight: activeTab === 'portfolio' ? 800 : 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
                fontFamily: "'Fredoka', 'Baloo 2', system-ui, sans-serif",
                whiteSpace: 'nowrap',
              }}
            >
              <span>💼</span>
              <span>Ví Tài Sản</span>
            </button>

            {/* Tab: Nhật Ký */}
            <button
              onClick={() => switchTab('log')}
              style={{
                background: activeTab === 'log' ? 'rgba(180, 83, 9, 0.16)' : 'transparent',
                color: activeTab === 'log' ? '#451a03' : '#8c5828',
                border: 'none',
                borderRadius: '8px',
                borderBottom: activeTab === 'log' ? '2.5px solid #b45309' : '2.5px solid transparent',
                padding: '4px 12px',
                fontSize: '13px',
                fontWeight: activeTab === 'log' ? 800 : 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease',
                fontFamily: "'Fredoka', 'Baloo 2', system-ui, sans-serif",
                whiteSpace: 'nowrap',
              }}
            >
              <span>📜</span>
              <span>Nhật Ký</span>
            </button>
          </div>

          {activeTab === 'portfolio' ? (
            <>
              {/* KHU VỰC CỐ ĐỊNH: TỔNG TÀI SẢN RÒNG & TIẾN ĐỘ VỀ ĐÍCH */}
              <div
                style={{
                  flexShrink: 0,
                  paddingBottom: '6px',
                  borderBottom: '1px solid rgba(184, 144, 91, 0.35)',
                  marginBottom: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                {/* Net Worth */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '1px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      color: '#78350f',
                      textTransform: 'uppercase',
                    }}
                  >
                    <FinancialTerm term="netWorth">TỔNG TÀI SẢN RÒNG</FinancialTerm>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '18px', color: '#2c1808', fontWeight: 900, lineHeight: 1.1 }}>
                      {money(worth)}
                    </strong>
                    <small
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: worth >= RULES.startingCapital ? '#15803d' : '#b91c1c',
                      }}
                    >
                      {worth >= RULES.startingCapital ? '+' : ''}
                      {money(worth - RULES.startingCapital)} <span style={{ opacity: 0.85 }}>so với ban đầu</span>
                    </small>
                  </div>
                </div>

                {/* Goal Track & Progress Bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      fontSize: '11px',
                      color: '#5c3513',
                    }}
                  >
                    <span>
                      Nguồn tiền về đích: <strong>{money(funds)}</strong>
                    </span>
                    <strong style={{ color: '#b45309', fontWeight: 800 }}>{Math.round(progress)}%</strong>
                  </div>

                  {/* Stylized Antique Progress Bar */}
                  <div
                    style={{
                      width: '100%',
                      height: '7px',
                      background: 'rgba(184, 144, 91, 0.2)',
                      border: '1px solid rgba(184, 144, 91, 0.5)',
                      borderRadius: '3px',
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
                        background: 'linear-gradient(90deg, #b45309 0%, #d97706 70%, #f59e0b 100%)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>

                  <details style={{ marginTop: '2px', fontSize: '11px', color: '#78350f' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Cách tính mục tiêu 90M</summary>
                    <div style={{ marginTop: '3px', paddingLeft: '4px' }}>
                      <GoalChecks game={game} />
                    </div>
                  </details>
                </div>
              </div>

              {/* KHU VỰC CUỘN NỘI DUNG (FLAT LISTING 100% NẰM TRONG GIẤY TRẮNG) */}
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
                    paddingRight: '4px',
                    paddingBottom: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    fontFamily: "'Fredoka', 'Baloo 2', system-ui, sans-serif",
                    color: '#2c1808',
                  }}
                >
                  {/* DANH SÁCH TÀI SẢN (FLAT ASSET LIST) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
                            padding: '4px 0',
                            borderBottom: '1px dashed rgba(184, 144, 91, 0.25)',
                            fontSize: '12px',
                            opacity: locked ? 0.65 : 1,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
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
                                width: '20px',
                                height: '20px',
                                color: '#78350f',
                                flexShrink: 0,
                              }}
                            >
                              <Icon name={asset.icon} size={16} />
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
                                  fontWeight: 700,
                                  color: '#451a03',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {asset.label}
                              </span>
                              {key === 'cash' && (
                                <small style={{ fontSize: '10.5px', color: '#6d4c41' }}>Tiền mặt dùng ngay</small>
                              )}
                              {key === 'savings' && (
                                <small style={{ fontSize: '10.5px', color: '#6d4c41' }}>
                                  {activeDeposits.length} khoản chưa đáo hạn
                                </small>
                              )}
                              {key === 'business' && amount > 0 && (
                                <small style={{ fontSize: '10.5px', color: '#6d4c41' }}>Chỉ bán tại ô Kinh doanh</small>
                              )}
                              {locked && (
                                <small style={{ fontSize: '10.5px', color: '#8d6e63' }}>Chờ cơ hội trên bàn cờ</small>
                              )}
                            </div>
                          </div>
                          <strong
                            style={{
                              fontSize: '12.5px',
                              color: locked ? '#8d6e63' : '#2c1808',
                              fontVariantNumeric: 'tabular-nums',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              marginLeft: '8px',
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
                        padding: '4px 6px',
                        background: 'rgba(184, 144, 91, 0.08)',
                        borderRadius: '3px',
                        border: '1px dashed rgba(184, 144, 91, 0.35)',
                        marginTop: '2px',
                      }}
                    >
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#78350f' }}>Khoản gửi tiết kiệm:</span>
                      {activeDeposits.map((lot) => (
                        <div
                          key={lot.id}
                          style={{
                            fontSize: '11.5px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            margin: '2px 0',
                            flexWrap: 'wrap',
                            gap: '4px',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                          }}
                        >
                          <span>{investmentLotLabel('savings', lot.id)}:</span>
                          <strong style={{ marginLeft: 'auto', textAlign: 'right' }}>
                            {money(lot.principal)} (lãi {Math.round(lot.rate * 100)}%, {maturityLabel(lot.maturityLap)})
                          </strong>
                        </div>
                      ))}
                      <p style={{ margin: '2px 0 0', fontSize: '10.5px', color: '#78350f', fontStyle: 'italic' }}>
                        {savingsPeriodExplanation}
                      </p>
                    </div>
                  )}

                  {/* TRÁI PHIẾU THEO TỔ CHỨC PHÁT HÀNH */}
                  {hasBondCredit(game) && game.bondLots.length > 0 && (
                    <details
                      style={{
                        fontSize: '11.5px',
                        color: '#451a03',
                        borderTop: '1px dashed rgba(184, 144, 91, 0.25)',
                        paddingTop: '3px',
                      }}
                    >
                      <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#78350f' }}>
                        Chi tiết lô trái phiếu nắm giữ
                      </summary>
                      <div style={{ marginTop: '3px' }}>
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
                        padding: '4px 6px',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        borderRadius: '4px',
                        marginTop: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#991b1b' }}>Nợ vay khẩn cấp</span>
                        <small style={{ fontSize: '10.5px', color: '#b91c1c' }}>Lãi suất 10%/vòng tại ô Xuất phát</small>
                      </div>
                      <strong style={{ fontSize: '13px', color: '#991b1b', fontVariantNumeric: 'tabular-nums' }}>
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
                          background: 'transparent',
                          border: '1px dashed rgba(184, 144, 91, 0.5)',
                          borderRadius: '4px',
                          padding: '4px 10px',
                          fontSize: '11.5px',
                          color: '#78350f',
                          cursor: 'pointer',
                          fontWeight: 700,
                        }}
                      >
                        📖 Xem Sổ Tay Chiến Lược & Luật Chơi
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
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#78350f',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>📥</span>
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
                  fontFamily: "'Fredoka', 'Baloo 2', system-ui, sans-serif",
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
                        <span style={{ fontFamily: "'Fredoka', 'Baloo 2', sans-serif", whiteSpace: 'nowrap' }}>
                          #{entry.sequence} · Vòng {entry.before.lap}
                        </span>
                        <strong
                          style={{
                            marginLeft: '6px',
                            color: '#2b1103',
                            fontFamily: "'Fredoka', 'Baloo 2', sans-serif",
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
