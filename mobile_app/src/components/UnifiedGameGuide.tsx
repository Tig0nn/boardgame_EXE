import { useState, useRef } from 'react';
import { GlossaryText, FinancialGlossary } from '../../../src/components/FinancialTerm';
import { CustomerPreferenceCard } from '../../../src/components/CustomerPreferenceCard';
import { livingPresentation } from '../game/living-presentation';
import { goalForGame } from '../../../src/game/rules-profile';
import { goalProgress } from '../../../src/game/selectors';
import { boardFor, MULTI_COURSE_B18_BOARD } from '../../../src/data/board';
import { tileDisplayLabel } from '../../../src/components/player-language';
import type { GameState } from '../../../src/game/types';
import { sound } from '../utils/audio';

// Hàm rút gọn số tiền sang đơn vị M/k giúp tiết kiệm diện tích tối đa trên giao diện giấy kem
const formatCompactMoney = (value: number): string => {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return `${Number.isInteger(k) ? k : k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `${value} ₫`;
};

interface UnifiedGameGuideProps {
  firstTime?: boolean;
  onClose: () => void;
  game?: GameState;
  initialTab?: number;
}

interface ChapterIconProps {
  src: string;
  alt: string;
  size?: number;
  glowColor?: string;
  style?: React.CSSProperties;
}

const ChapterIcon: React.FC<ChapterIconProps> = ({
  src,
  alt,
  size = 28,
  glowColor,
  style = {},
}) => {
  return (
    <img
      src={src}
      alt={alt}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        objectFit: 'contain',
        flexShrink: 0,
        verticalAlign: 'middle',
        filter: glowColor
          ? `drop-shadow(0 3px 6px ${glowColor}) drop-shadow(0 1px 2px rgba(0,0,0,0.3))`
          : 'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
        transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
        ...style,
      }}
    />
  );
};

const chapters = [
  {
    id: 0,
    tabNum: '1',
    tabColorClass: 'tab-red',
    chapterLabel: 'CHƯƠNG 1',
    title: 'Đích Đến 90M',
    icon: '🏆',
    iconAsset: '/assets/champion-icon.png',
    primaryColor: '#e11d48',
    gradient: 'linear-gradient(135deg, #ff2e93 0%, #e11d48 100%)',
    borderColor: '#fda4af',
    glowColor: 'rgba(255, 46, 147, 0.45)',
    accentBg: 'rgba(255, 241, 242, 0.95)',
  },
  {
    id: 1,
    tabNum: '2',
    tabColorClass: 'tab-green',
    chapterLabel: 'CHƯƠNG 2',
    title: 'Bàn Cờ Cơ Hội',
    icon: '🗺️',
    iconAsset: '/assets/game-category-icon.png',
    primaryColor: '#059669',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    borderColor: '#a7f3d0',
    glowColor: 'rgba(16, 185, 129, 0.45)',
    accentBg: 'rgba(240, 253, 244, 0.95)',
  },
  {
    id: 2,
    tabNum: '3',
    tabColorClass: 'tab-blue',
    chapterLabel: 'CHƯƠNG 3',
    title: 'Quy Trình Lượt Chơi',
    icon: '⚡',
    iconAsset: '/assets/game-rule.png',
    primaryColor: '#2563eb',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
    borderColor: '#bae6fd',
    glowColor: 'rgba(14, 165, 233, 0.45)',
    accentBg: 'rgba(240, 249, 255, 0.95)',
  },
  {
    id: 3,
    tabNum: '4',
    tabColorClass: 'tab-amber',
    chapterLabel: 'CHƯƠNG 4',
    title: 'Phân Bổ Danh Mục',
    icon: '📖',
    iconAsset: '/assets/knowledge-icon.png',
    primaryColor: '#7c3aed',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
    borderColor: '#e9d5ff',
    glowColor: 'rgba(168, 85, 247, 0.45)',
    accentBg: 'rgba(250, 245, 255, 0.95)',
  },
  {
    id: 4,
    tabNum: '5',
    tabColorClass: 'tab-slate',
    chapterLabel: 'CHƯƠNG 5',
    title: 'Phòng Thủ & Về Đích',
    icon: '🔥',
    iconAsset: '/assets/game-defense-icon.png',
    primaryColor: '#ea580c',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
    borderColor: '#fde68a',
    glowColor: 'rgba(245, 158, 11, 0.45)',
    accentBg: 'rgba(255, 251, 235, 0.95)',
  },
];

export function UnifiedGameGuide({ firstTime = false, onClose, game, initialTab = 0 }: UnifiedGameGuideProps) {
  const [currentTab, setCurrentTab] = useState(initialTab);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const living = livingPresentation(game);
  const board = game ? boardFor(game) : MULTI_COURSE_B18_BOARD;

  const activeChapter = chapters[currentTab];

  const navigateTo = (tabIndex: number) => {
    const valid = Math.max(0, Math.min(chapters.length - 1, tabIndex));
    sound.playClick();
    setCurrentTab(valid);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    headingRef.current?.focus({ preventScroll: true });
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 0,
        background: 'rgba(10, 18, 30, 0.78)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        animation: 'fadeIn 0.2s ease',
        writingMode: 'horizontal-tb',
        textOrientation: 'mixed',
        pointerEvents: 'auto',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !firstTime) {
          sound.playClick();
          onClose();
        }
      }}
    >
      {/* Khung Sổ Tay / Bảng Gỗ Luật Chơi luat-choi.webp (Chuẩn hóa kích thước đồng bộ: min(92%, 400px) x min(86vh, 700px)) */}
      <div
        className="guide-board-wrapper w-[92%] max-w-[400px] mx-auto relative flex flex-col shadow-2xl bg-transparent"
        style={{
          position: 'relative',
          width: 'min(92%, 400px)',
          maxWidth: '400px',
          height: 'min(86vh, 700px)',
          maxHeight: '700px',
          marginTop: '-4px',
          backgroundImage: 'url(/assets/luat-choi.webp)',
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'top center',
          filter: 'drop-shadow(0 20px 45px rgba(0, 0, 0, 0.85)) drop-shadow(0 0 16px rgba(245, 158, 11, 0.25))',
          boxSizing: 'border-box',
          fontFamily: "'Fredoka', sans-serif",
          animation: 'guideScaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          flexDirection: 'column',
          userSelect: 'none',
          overflow: 'hidden',
          writingMode: 'horizontal-tb',
          textOrientation: 'mixed',
          pointerEvents: 'auto',
        }}
      >
        {/* Nút Thoát / Bỏ Qua (Icon exit chính thức) hiển thị gọn gàng góc trên phải */}
        <button
          onClick={() => {
            sound.playClick();
            onClose();
          }}
          title={firstTime ? 'Bỏ qua hướng dẫn' : 'Đóng Sổ Tay'}
          aria-label={firstTime ? 'Bỏ qua' : 'Đóng'}
          style={{
            position: 'absolute',
            top: '5.2%',
            right: '5.8%',
            width: '40px',
            height: '40px',
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
            src="/assets/nut-exit.png"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/assets/cropped/exit-btn.png';
            }}
            alt={firstTime ? 'Bỏ qua' : 'Đóng'}
            style={{
              width: '36px',
              height: '36px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.45))',
            }}
          />
        </button>

        {/* Nút Mũi Tên Trái (Left Arrow) */}
        <button
          onClick={() => navigateTo(currentTab - 1)}
          disabled={currentTab === 0}
          title="Chương trước"
          aria-label="Chương trước"
          style={{
            position: 'absolute',
            left: '2%',
            top: '49%',
            transform: 'translateY(-50%)',
            width: '36px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: currentTab === 0 ? 'default' : 'pointer',
            opacity: currentTab === 0 ? 0.2 : 0.95,
            padding: 0,
            zIndex: 35,
            transition: 'opacity 0.2s ease, transform 0.15s ease',
          }}
          onPointerDown={(e) => {
            if (currentTab > 0) (e.currentTarget as HTMLElement).style.transform = 'translateY(-50%) scale(0.9)';
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-50%) scale(1)';
          }}
        >
          <img
            src="/assets/cropped/left-btn.png"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/assets/left-button.PNG';
            }}
            alt="Trước"
            style={{ width: '26px', height: '34px', objectFit: 'contain' }}
          />
        </button>

        {/* Nút Mũi Tên Phải (Right Arrow) */}
        <button
          onClick={() => navigateTo(currentTab + 1)}
          disabled={currentTab === chapters.length - 1}
          title="Chương sau"
          aria-label="Chương sau"
          style={{
            position: 'absolute',
            right: '2%',
            top: '49%',
            transform: 'translateY(-50%)',
            width: '36px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: currentTab === chapters.length - 1 ? 'default' : 'pointer',
            opacity: currentTab === chapters.length - 1 ? 0.2 : 0.95,
            padding: 0,
            zIndex: 35,
            transition: 'opacity 0.2s ease, transform 0.15s ease',
          }}
          onPointerDown={(e) => {
            if (currentTab < chapters.length - 1)
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-50%) scale(0.9)';
          }}
          onPointerUp={(e) => {
            (e.currentTarget as HTMLElement).style.transform = 'translateY(-50%) scale(1)';
          }}
        >
          <img
            src="/assets/cropped/right-btn.png"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/assets/right-button.PNG';
            }}
            alt="Sau"
            style={{ width: '26px', height: '34px', objectFit: 'contain' }}
          />
        </button>

        {/* VÙNG NỘI DUNG NẰM HOÀN TOÀN TRONG PHẦN GIẤY PARCHMENT CỦA BẢNG - KHÔNG TRÀN RA NGOÀI */}
        {/* Bounds: Top 16.5%, Bottom 26%, Left 13.5%, Right 13.5% */}
        <div
          style={{
            position: 'absolute',
            top: '16.5%',
            bottom: '26%',
            left: '13.5%',
            right: '13.5%',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            overflow: 'hidden',
            padding: '2px 4px',
            fontFamily: "'Fredoka', sans-serif",
          }}
        >
          {/* Thanh Tab Đánh Số Chương (1, 2, 3, 4, 5) Phong Cách Arcade 3D Rực Rỡ */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'clamp(4px, 1.2vw, 8px)',
              paddingBottom: '5px',
              borderBottom: '1px solid rgba(184, 144, 91, 0.35)',
              flexShrink: 0,
            }}
            role="tablist"
            aria-label="Các chương luật chơi"
          >
            {chapters.map((ch, idx) => {
              const active = currentTab === idx;
              return (
                <button
                  key={ch.id}
                  role="tab"
                  id={`guide-tab-${ch.id}`}
                  aria-selected={active}
                  onClick={() => navigateTo(idx)}
                  title={ch.title}
                  style={{
                    width: active ? 'clamp(32px, 7.8vw, 36px)' : 'clamp(26px, 6.2vw, 29px)',
                    height: 'clamp(24px, 5.8vw, 27px)',
                    borderRadius: '8px',
                    border: active ? '2px solid #ffffff' : `1.5px solid ${ch.borderColor}`,
                    background: active ? ch.gradient : 'rgba(255, 255, 255, 0.7)',
                    color: active ? '#ffffff' : ch.primaryColor,
                    fontWeight: 900,
                    fontSize: 'clamp(11.5px, 3vw, 13px)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: active
                      ? `0 3px 8px ${ch.glowColor}, 0 0 10px ${ch.primaryColor}`
                      : '0 1px 3px rgba(0,0,0,0.06)',
                    transform: active ? 'scale(1.08)' : 'scale(1)',
                    transition: 'all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    fontFamily: "'Fredoka', sans-serif",
                  }}
                >
                  <span>{ch.tabNum}</span>
                </button>
              );
            })}
          </div>

          {/* Tiêu Đề Chương Phân Tầng: Title (Chương X) + Sub Title (Icon & Tựa Đề) */}
          <div style={{ padding: '4px 0 2px', textAlign: 'center', flexShrink: 0 }}>
            {/* Title: Chỉ hiện Chương x */}
            <span
              style={{
                fontSize: 'clamp(9.5px, 2.5vw, 11px)',
                fontWeight: 900,
                color: activeChapter.primaryColor,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                display: 'inline-block',
                background: activeChapter.accentBg,
                border: `1.5px solid ${activeChapter.borderColor}`,
                borderRadius: '999px',
                padding: '1.5px 10px',
                boxShadow: `0 1px 4px ${activeChapter.glowColor}`,
                fontFamily: "'Fredoka', sans-serif",
              }}
            >
              {activeChapter.chapterLabel}
            </span>

            {/* Sub Title: Gồm icon và tựa đề */}
            <h2
              ref={headingRef}
              tabIndex={-1}
              style={{
                margin: '2px 0 0',
                fontSize: 'clamp(14px, 4vw, 16.5px)',
                fontWeight: 900,
                color: '#1e1b4b',
                lineHeight: 1.25,
                textShadow: '0 1px 0 rgba(255, 255, 255, 0.8)',
                fontFamily: "'Fredoka', sans-serif",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <ChapterIcon
                src={activeChapter.iconAsset}
                alt={activeChapter.title}
                size={28}
                glowColor={activeChapter.glowColor}
              />
              <span>{activeChapter.title}</span>
            </h2>
          </div>

          {/* Vùng Cuộn Nội Dung Chính (Scrollable Narrative Content Area) */}
          <div
            ref={scrollRef}
            className="arcade-scrollbar guide-antique-narrative-area"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
              padding: '4px 2px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              color: '#2b1406',
              fontSize: 'clamp(11.5px, 3.1vw, 12.5px)',
              lineHeight: 1.45,
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              fontFamily: "'Fredoka', sans-serif",
            }}
          >
            {/* CHƯƠNG 1: ĐÍCH ĐẾN 90M (90M GOAL) */}
            {currentTab === 0 && (
              <>
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 241, 242, 0.95) 0%, rgba(254, 205, 211, 0.9) 100%)',
                    border: '1.5px solid #ff2e93',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    textAlign: 'center',
                    boxShadow: '0 2px 8px rgba(255, 46, 147, 0.2)',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '12px', color: '#881337', fontWeight: 700, lineHeight: 1.45 }}>
                    Khởi đầu 50M · Đúng 4 vòng chơi · Mục tiêu 90M (80M tích lũy + 10M quỹ dự phòng).
                  </p>
                </div>

                <div style={{ fontSize: '11.5px' }}>
                  <p style={{ margin: '4px 0 2px', fontWeight: 800, color: '#4c0519' }}>
                    Công thức nguồn tiền về đích hợp lệ:
                  </p>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.85)',
                      border: '1px dashed #f43f5e',
                      borderRadius: '8px',
                      padding: '5px 8px',
                      lineHeight: 1.45,
                      color: '#4c0519',
                      fontWeight: 600,
                    }}
                  >
                    <b>Tiền về đích</b> = Tiền mặt + Tiết kiệm rút được + Giá trị thanh lý chứng khoán & vàng sau phí -
                    Nợ vay khẩn cấp.
                  </div>
                  <p style={{ margin: '4px 0 0', color: '#e11d48', fontSize: '11px', fontWeight: 700 }}>
                    ⚠️ Quán kinh doanh chưa bán không được tính trực tiếp vào nguồn tiền về đích!
                  </p>
                </div>

                <div style={{ marginTop: '4px' }}>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid rgba(225, 29, 72, 0.3)',
                      borderRadius: '8px',
                      padding: '6px 8px',
                      fontSize: '11px',
                      color: '#4c0519',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}>
                      <span>🚩</span>
                      <span>
                        Tích lũy đủ{' '}
                        <strong style={{ color: '#be123c' }}>
                          {game ? formatCompactMoney(goalForGame(game).target) : '90M'}
                        </strong>{' '}
                        sau {game?.totalLaps ?? 4} vòng.
                      </span>
                    </div>
                    {game && (() => {
                      const progress = goalProgress(game);
                      if (!progress) return null;
                      return (
                        <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                          Hiện có thể huy động{' '}
                          <strong style={{ color: '#059669' }}>{formatCompactMoney(progress.funds)}</strong> ·{' '}
                          {progress.remaining > 0
                            ? `Còn ${formatCompactMoney(progress.remaining)} để đạt mục tiêu.`
                            : 'Đã đạt ngưỡng tài chính; hoàn thành các vòng để về đích!'}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}

            {/* CHƯƠNG 2: BÀN CỜ CƠ HỘI (BOARD & RULES) */}
            {currentTab === 1 && (
              <>
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(240, 253, 244, 0.95) 0%, rgba(187, 247, 208, 0.9) 100%)',
                    border: '1.5px solid #10b981',
                    borderRadius: '10px',
                    padding: '8px 10px',
                    fontSize: '11.5px',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.2)',
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 800, color: '#065f46' }}>
                    🎮 <b>Bàn cờ {game?.boardLayout ?? 'B18'} Isometric ({board.length} ô):</b>
                  </p>
                  <ul style={{ margin: '4px 0 0', paddingLeft: '16px', color: '#064e3b', fontWeight: 600 }}>
                    <li>Bàn cờ khép kín {board.length} ô chạy theo chiều kim đồng hồ.</li>
                    <li>
                      Lương <b>14M</b> nhận tại ô Xuất phát mỗi khi hoàn thành một vòng.
                    </li>
                    <li>Mỗi vòng chơi gieo xúc xắc 1 viên 6 mặt (1-6) không giới hạn lượt.</li>
                    <li>Chạm vào từng ô trên bàn cờ để tra cứu nhanh thông tin cơ hội.</li>
                  </ul>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: '4px',
                    marginTop: '2px',
                  }}
                >
                  {board.map((t) => (
                    <div
                      key={t.index}
                      style={{
                        background: 'rgba(255, 255, 255, 0.85)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        borderRadius: '6px',
                        padding: '3px 6px',
                        fontSize: 'clamp(9.5px, 2.6vw, 11px)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        overflow: 'hidden',
                        minWidth: 0,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      <strong style={{ color: '#059669', flexShrink: 0 }}>{t.index + 1}.</strong>
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          minWidth: 0,
                          flex: 1,
                          fontWeight: 700,
                          color: '#064e3b',
                        }}
                      >
                        {tileDisplayLabel(t.label)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* CHƯƠNG 3: QUY TRÌNH LƯỢT CHƠI (TURN WORKFLOW) */}
            {currentTab === 2 && (
              <>
                <p style={{ margin: '0 0 4px', fontSize: '11.5px', fontWeight: 700, color: '#1e3a8a' }}>
                  <GlossaryText text="Quy trình mỗi lượt chơi gồm 3 bước tuần tự rõ ràng:" />
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.88)',
                      border: '1.5px solid #38bdf8',
                      borderRadius: '8px',
                      padding: '6px 8px',
                      boxShadow: '0 2px 6px rgba(14, 165, 233, 0.15)',
                    }}
                  >
                    <b style={{ color: '#0284c7' }}>1. Gieo xúc xắc:</b> Chạm nút xúc xắc trung tâm để nhận bước tiến ngẫu nhiên từ 1 đến 6.
                  </div>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.88)',
                      border: '1.5px solid #34d399',
                      borderRadius: '8px',
                      padding: '6px 8px',
                      boxShadow: '0 2px 6px rgba(16, 185, 129, 0.15)',
                    }}
                  >
                    <b style={{ color: '#059669' }}>2. Di chuyển quân cờ:</b> Nhân vật nhảy nhót trực quan qua từng ô theo chiều kim đồng hồ.
                  </div>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.88)',
                      border: '1.5px solid #818cf8',
                      borderRadius: '8px',
                      padding: '6px 8px',
                      boxShadow: '0 2px 6px rgba(99, 102, 241, 0.15)',
                    }}
                  >
                    <b style={{ color: '#4338ca' }}>3. Hành động ô dừng chân:</b> Chỉ ô bạn dừng chân mới kích hoạt sự kiện; đi ngang qua không kích hoạt. Mỗi lần ghé ô Cổ phiếu, Vàng hoặc Trái phiếu được tối đa 1 giao dịch mua hoặc bán.
                  </div>
                </div>

                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(240, 249, 255, 0.95) 0%, rgba(224, 242, 254, 0.9) 100%)',
                    border: '1px dashed #0284c7',
                    borderRadius: '8px',
                    padding: '5px 8px',
                    fontSize: '11px',
                    marginTop: '2px',
                    color: '#075985',
                    fontWeight: 600,
                  }}
                >
                  📰 <b>Đầu mỗi vòng mới:</b> Bản tin thị trường mở ra để dự báo biến động giá và lãi suất toàn thị trường.
                </div>
              </>
            )}

            {/* CHƯƠNG 4: PHÂN BỔ DANH MỤC (FINANCIAL PORTFOLIO) */}
            {currentTab === 3 && (
              <>
                <p style={{ margin: '0 0 4px', fontSize: '11.5px', fontWeight: 700, color: '#581c87' }}>
                  Hệ thống Drawer Portfolio gồm 6 kênh tài chính chính thức:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.88)',
                      border: '1px solid #86efac',
                      borderRadius: '6px',
                      padding: '4px 6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#14532d',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <img src="/assets/money-icon.png" alt="" style={{ width: '16px', height: '16px', objectFit: 'contain', flexShrink: 0 }} />
                    <span><b style={{ color: '#16a34a' }}>Tiền mặt:</b> Dùng ngay, thanh toán sinh hoạt phí và chớp cơ hội mua tài sản giá tốt.</span>
                  </div>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.88)',
                      border: '1px solid #93c5fd',
                      borderRadius: '6px',
                      padding: '4px 6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#1e3a8a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <img src="/assets/wallet.png" alt="" style={{ width: '16px', height: '16px', objectFit: 'contain', flexShrink: 0 }} />
                    <span><b style={{ color: '#2563eb' }}>Tiết kiệm:</b> Kỳ hạn 1 / 2 / 3 vòng, lãi suất 4% - 18%, an toàn tuyệt đối.</span>
                  </div>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.88)',
                      border: '1px solid #c084fc',
                      borderRadius: '6px',
                      padding: '4px 6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#581c87',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <img src="/assets/stock-icon.png" alt="" style={{ width: '16px', height: '16px', objectFit: 'contain', flexShrink: 0 }} />
                    <span><b style={{ color: '#9333ea' }}>Cổ phiếu:</b> Sinh lời cao theo sóng thị trường, thanh khoản linh hoạt sau phí bán.</span>
                  </div>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.88)',
                      border: '1px solid #fcd34d',
                      borderRadius: '6px',
                      padding: '4px 6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#78350f',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <img src="/assets/bond-icon.png" alt="" style={{ width: '16px', height: '16px', objectFit: 'contain', flexShrink: 0 }} />
                    <span><b style={{ color: '#d97706' }}>Trái phiếu:</b> Lãi coupon định kỳ tại ô Xuất phát, chú ý rủi ro tổ chức phát hành.</span>
                  </div>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.88)',
                      border: '1px solid #fdba74',
                      borderRadius: '6px',
                      padding: '4px 6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#7c2d12',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <img src="/assets/gold-icon.png" alt="" style={{ width: '16px', height: '16px', objectFit: 'contain', flexShrink: 0 }} />
                    <span><b style={{ color: '#ea580c' }}>Vàng:</b> Kênh trú ẩn phòng thủ an toàn khi kinh tế gặp cú sốc vĩ mô.</span>
                  </div>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.88)',
                      border: '1px solid #f472b6',
                      borderRadius: '6px',
                      padding: '4px 6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#831843',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <img src="/assets/shop-icon.png" alt="" style={{ width: '16px', height: '16px', objectFit: 'contain', flexShrink: 0 }} />
                    <span><b style={{ color: '#db2777' }}>Quán F&B:</b> Mua 20M, nâng cấp tối đa 6 tầng (+5M/tầng) đem lại dòng tiền thụ động lớn.</span>
                  </div>
                </div>

                {game && <CustomerPreferenceCard game={game} showUpgrades />}
                <FinancialGlossary />
              </>
            )}

            {/* CHƯƠNG 5: PHÒNG THỦ & VỀ ĐÍCH (STRATEGIES & RISK) */}
            {currentTab === 4 && (
              <>
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 251, 235, 0.95) 0%, rgba(254, 243, 199, 0.9) 100%)',
                    border: '1.5px solid #f59e0b',
                    borderRadius: '10px',
                    padding: '6px 8px',
                    fontSize: '11.5px',
                    boxShadow: '0 2px 8px rgba(245, 158, 11, 0.2)',
                  }}
                >
                  <p style={{ margin: '0 0 3px', fontWeight: 800, color: '#92400e' }}>
                    🛡️ Quản trị sinh hoạt phí & Nợ vay:
                  </p>
                  <p style={{ margin: '0 0 3px', color: '#78350f', fontWeight: 600 }}>
                    Sinh hoạt phí định kỳ: <strong style={{ color: '#b91c1c' }}>{formatCompactMoney(living.amount)}</strong>. Hãy luôn giữ tiền mặt dự phòng trước khi qua ô Xuất phát.
                  </p>
                  <p style={{ margin: 0, color: '#78350f', fontWeight: 600 }}>
                    Hạn mức vay khẩn cấp tối đa <b>30M</b> với lãi suất <b>10%/vòng</b>. Nếu hết hạn mức vay và không còn tài sản thanh lý, bạn sẽ rơi vào tình trạng vỡ nợ (Insolvency).
                  </p>
                </div>

                <div
                  style={{
                    background: 'rgba(254, 242, 242, 0.92)',
                    border: '1px solid #f87171',
                    borderRadius: '8px',
                    padding: '5px 8px',
                    fontSize: '11px',
                    color: '#7f1d1d',
                  }}
                >
                  <b style={{ color: '#b91c1c' }}>⚡ 3 Cú sốc vĩ mô cần lưu ý:</b>
                  <ul style={{ margin: '2px 0 0', paddingLeft: '14px', fontWeight: 600 }}>
                    <li><b>Thắt chặt tín dụng:</b> Cổ phiếu & trái phiếu giảm; vàng tăng mạnh.</li>
                    <li><b>Bùng nổ nhu cầu:</b> Cổ phiếu tăng, quán đông khách; vàng giảm.</li>
                    <li><b>Phục hồi cung ứng:</b> Thị trường phân hóa, lạm phát hạ nhiệt.</li>
                  </ul>
                </div>

                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 237, 213, 0.95) 0%, rgba(254, 215, 170, 0.9) 100%)',
                    border: '1.5px solid #ea580c',
                    borderRadius: '8px',
                    padding: '5px 8px',
                    fontSize: '11.5px',
                    color: '#7c2d12',
                    fontWeight: 700,
                  }}
                >
                  <b>💡 Bí quyết về đích 90M:</b> Đầu tư quán F&B vòng 1-2 để lấy dòng tiền; vòng 3 lướt sóng tài chính; vòng 4 chốt lời toàn bộ và trả sạch nợ vay!
                </div>
              </>
            )}

            {/* Nút Hành Động (CTA Button) Cuộn Mượt Cùng Nội Dung Chương */}
            <div
              style={{
                paddingTop: '8px',
                paddingBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 'auto',
              }}
            >
              <button
                onClick={() => {
                  sound.playClick();
                  if (currentTab === chapters.length - 1) {
                    onClose();
                  } else {
                    navigateTo(currentTab + 1);
                  }
                }}
                style={{
                  background:
                    currentTab === chapters.length - 1
                      ? 'linear-gradient(180deg, #FCD34D 0%, #F59E0B 45%, #D97706 100%)'
                      : activeChapter.gradient,
                  color: currentTab === chapters.length - 1 ? '#381F0B' : '#ffffff',
                  border: currentTab === chapters.length - 1 ? '2px solid #FEF3C7' : '2px solid #ffffff',
                  borderRadius: '999px',
                  padding: currentTab === chapters.length - 1 ? '8px 28px' : '7px 22px',
                  fontSize: currentTab === chapters.length - 1 ? '13.5px' : '12.5px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow:
                    currentTab === chapters.length - 1
                      ? '0 4px 16px rgba(245, 158, 11, 0.6), 0 2px 6px rgba(0,0,0,0.3)'
                      : `0 4px 10px ${activeChapter.glowColor}, 0 2px 4px rgba(0,0,0,0.25)`,
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  textShadow:
                    currentTab === chapters.length - 1
                      ? '0 1px 1px rgba(255,255,255,0.6)'
                      : '0 1px 2px rgba(0,0,0,0.35)',
                  fontFamily: "'Fredoka', sans-serif",
                }}
                onPointerDown={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(0.94)';
                }}
                onPointerUp={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                }}
              >
                {currentTab === chapters.length - 1
                  ? 'BƯỚC VÀO BÀN CỜ ➔'
                  : 'Chương Tiếp Theo ➔'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes guideScaleUp {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
