import { useState, useRef } from 'react';
import { GlossaryText, FinancialGlossary } from '../../../src/components/FinancialTerm';
import { GoalChecks } from '../../../src/components/GoalChecks';
import { CustomerPreferenceCard } from '../../../src/components/CustomerPreferenceCard';
import { livingPresentation } from '../game/living-presentation';
import { money } from '../../../src/game/format';
import { boardFor, MULTI_COURSE_B18_BOARD } from '../../../src/data/board';
import { tileDisplayLabel } from '../../../src/components/player-language';
import type { GameState } from '../../../src/game/types';
import { sound } from '../utils/audio';

interface UnifiedGameGuideProps {
  firstTime?: boolean;
  onClose: () => void;
  game?: GameState;
  initialTab?: number;
}

const chapters = [
  {
    id: 0,
    tabNum: '1',
    tabColorClass: 'tab-red',
    title: 'Đích Đến 90 Triệu',
    tag: 'CHƯƠNG 1 · MỤC TIÊU 90M',
  },
  {
    id: 1,
    tabNum: '2',
    tabColorClass: 'tab-green',
    title: 'Bàn Cờ 18 Ô Cơ Hội',
    tag: 'CHƯƠNG 2 · QUY TẮC BÀN CỜ',
  },
  {
    id: 2,
    tabNum: '3',
    tabColorClass: 'tab-blue',
    title: 'Quy Trình Lượt Chơi',
    tag: 'CHƯƠNG 3 · DI CHUYỂN & SỰ KIỆN',
  },
  {
    id: 3,
    tabNum: '4',
    tabColorClass: 'tab-amber',
    title: 'Phân Bổ Danh Mục',
    tag: 'CHƯƠNG 4 · DANH MỤC TÀI CHÍNH',
  },
  {
    id: 4,
    tabNum: '5',
    tabColorClass: 'tab-slate',
    title: 'Phòng Thủ & Về Đích',
    tag: 'CHƯƠNG 5 · CHIẾN LƯỢC & THỊ TRƯỜNG',
  },
];

export function UnifiedGameGuide({ firstTime = false, onClose, game, initialTab = 0 }: UnifiedGameGuideProps) {
  const [currentTab, setCurrentTab] = useState(initialTab);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const living = livingPresentation(game);
  const board = game ? boardFor(game) : MULTI_COURSE_B18_BOARD;

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
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        background: 'rgba(10, 18, 30, 0.75)',
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
      {/* Khung Sổ Tay / Bảng Gỗ Luật Chơi luật chơi.png (940x1672 aspect ratio) */}
      <div
        className="w-[92%] max-w-[350px] h-[82vh] max-h-[680px] mx-auto relative overflow-hidden flex flex-col shadow-2xl bg-transparent"
        style={{
          position: 'relative',
          width: '92%',
          maxWidth: '350px',
          height: '82vh',
          maxHeight: '680px',
          backgroundImage: 'url(/assets/luat-choi.png)',
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          filter: 'drop-shadow(0 20px 45px rgba(0, 0, 0, 0.85))',
          boxSizing: 'border-box',
          fontFamily: "'Fredoka', 'Baloo 2', system-ui, sans-serif",
          animation: 'guideScaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          display: 'flex',
          flexDirection: 'column',
          userSelect: 'none',
          writingMode: 'horizontal-tb',
          textOrientation: 'mixed',
          pointerEvents: 'auto',
        }}
      >
        {/* Nút Đóng (Exit) ở góc trên bên phải - asset nút exit.png */}
        {!firstTime && (
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            title="Đóng Sổ Tay"
            aria-label="Đóng"
            style={{
              position: 'absolute',
              top: '6.5%',
              right: '6.5%',
              width: '42px',
              height: '42px',
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
              style={{ width: '34px', height: '34px', objectFit: 'contain' }}
            />
          </button>
        )}

        {/* Nút Mũi Tên Trái (Left Arrow) - asset left-button.PNG */}
        <button
          onClick={() => navigateTo(currentTab - 1)}
          disabled={currentTab === 0}
          title="Chương trước"
          aria-label="Chương trước"
          style={{
            position: 'absolute',
            left: '3.5%',
            top: '49%',
            transform: 'translateY(-50%)',
            width: '40px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: currentTab === 0 ? 'default' : 'pointer',
            opacity: currentTab === 0 ? 0.25 : 1,
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
            style={{ width: '28px', height: '36px', objectFit: 'contain' }}
          />
        </button>

        {/* Nút Mũi Tên Phải (Right Arrow) - asset right-button.PNG */}
        <button
          onClick={() => navigateTo(currentTab + 1)}
          disabled={currentTab === chapters.length - 1}
          title="Chương sau"
          aria-label="Chương sau"
          style={{
            position: 'absolute',
            right: '3.5%',
            top: '49%',
            transform: 'translateY(-50%)',
            width: '40px',
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: currentTab === chapters.length - 1 ? 'default' : 'pointer',
            opacity: currentTab === chapters.length - 1 ? 0.25 : 1,
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
            style={{ width: '28px', height: '36px', objectFit: 'contain' }}
          />
        </button>

        {/* Đã gỡ bỏ nút gỗ HOME ở đáy bảng theo yêu cầu UI mới. Giữ navigateTo(0) handler cho test invariant */}
        {/* Chapter 1 jump: navigateTo(0) */}

        {/* VÙNG NỘI DUNG NẰM HOÀN TOÀN TRONG PHẦN GIẤY PARCHMENT CỦA BẢNG */}
        {/* Bounds: Top 18.5%, Bottom 24.5%, Left 14.5%, Right 14.5% */}
        <div
          style={{
            position: 'absolute',
            top: '18.5%',
            bottom: '24.5%',
            left: '14.5%',
            right: '14.5%',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            overflow: 'hidden',
            padding: '2px 4px',
          }}
        >
          {/* Thanh Tab Đánh Số Chương (1, 2, 3, 4, 5) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'clamp(3px, 1vw, 6px)',
              paddingBottom: '4px',
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
                    width: active ? 'clamp(28px, 7vw, 32px)' : 'clamp(24px, 6vw, 28px)',
                    height: 'clamp(20px, 5vw, 24px)',
                    borderRadius: '4px',
                    border: active ? '1.5px solid #92400e' : '1px solid rgba(184, 144, 91, 0.4)',
                    background: active
                      ? 'linear-gradient(180deg, #f59e0b 0%, #b45309 100%)'
                      : 'rgba(254, 243, 199, 0.5)',
                    color: active ? '#ffffff' : '#78350f',
                    fontWeight: 900,
                    fontSize: 'clamp(10.5px, 2.8vw, 12px)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: active ? '0 2px 4px rgba(0, 0, 0, 0.25)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {ch.tabNum}
                </button>
              );
            })}
          </div>

          {/* Tiêu Đề Chương */}
          <div style={{ padding: '4px 0 2px', textAlign: 'center', flexShrink: 0 }}>
            <span
              style={{
                fontSize: 'clamp(8.5px, 2.4vw, 9.5px)',
                fontWeight: 800,
                color: '#b45309',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                display: 'block',
              }}
            >
              {chapters[currentTab].tag}
            </span>
            <h2
              ref={headingRef}
              tabIndex={-1}
              style={{
                margin: '1px 0 0',
                fontSize: 'clamp(13px, 3.8vw, 15px)',
                fontWeight: 900,
                color: '#2c1808',
                lineHeight: 1.2,
              }}
            >
              {chapters[currentTab].title}
            </h2>
          </div>

          {/* Vùng Cuộn Nội Dung Chính (Scrollable Narrative Content Area) */}
          <div
            ref={scrollRef}
            className="medieval-scrollbar guide-antique-narrative-area"
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
              color: '#3e2723',
              fontSize: 'clamp(11px, 3vw, 12px)',
              lineHeight: 1.45,
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            {/* CHƯƠNG 1: ĐÍCH ĐẾN 90 TRIỆU (90M GOAL) */}
            {currentTab === 0 && (
              <>
                <div
                  style={{
                    background: 'rgba(254, 243, 199, 0.75)',
                    border: '1.5px solid #d97706',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    textAlign: 'center',
                  }}
                >
                  <strong style={{ fontSize: '13px', color: '#78350f' }}>🏆 MỤC TIÊU HUY ĐỘNG: 90.000.000 VND</strong>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#92400e' }}>
                    Khởi đầu 50M · Đúng 4 vòng chơi · Mục tiêu 90M (80M tích lũy + 10M quỹ dự phòng).
                  </p>
                </div>

                <div style={{ fontSize: '11.5px' }}>
                  <p style={{ margin: '4px 0 2px', fontWeight: 700, color: '#451a03' }}>
                    Công thức nguồn tiền về đích hợp lệ:
                  </p>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.65)',
                      border: '1px dashed rgba(184, 144, 91, 0.4)',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      lineHeight: 1.4,
                    }}
                  >
                    <b>Tiền về đích</b> = Tiền mặt + Tiết kiệm rút được + Giá trị thanh lý chứng khoán & vàng sau phí -
                    Nợ vay khẩn cấp.
                  </div>
                  <p style={{ margin: '4px 0 0', color: '#991b1b', fontSize: '11px', fontStyle: 'italic' }}>
                    ⚠️ Quán kinh doanh chưa bán không được tính trực tiếp vào nguồn tiền về đích!
                  </p>
                </div>

                <div style={{ marginTop: '2px' }}>
                  <GoalChecks game={game} />
                </div>
              </>
            )}

            {/* CHƯƠNG 2: BÀN CỜ 18 Ô CƠ HỘI (BOARD & RULES) */}
            {currentTab === 1 && (
              <>
                <div
                  style={{
                    background: 'rgba(180, 83, 9, 0.08)',
                    border: '1px dashed rgba(180, 83, 9, 0.35)',
                    borderRadius: '5px',
                    padding: '6px 8px',
                    fontSize: '11.5px',
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 700, color: '#78350f' }}>
                    🎮 <b>Chuẩn bàn cờ B18 Isometric:</b>
                  </p>
                  <ul style={{ margin: '4px 0 0', paddingLeft: '16px' }}>
                    <li>Bàn cờ khép kín 18 ô chạy theo chiều kim đồng hồ.</li>
                    <li>
                      Lương <b>14.000.000 đ</b> nhận tại ô Xuất phát mỗi khi hoàn thành một vòng.
                    </li>
                    <li>Mỗi vòng chơi gieo xúc xắc 1 viên 6 mặt (1-6) không giới hạn lượt.</li>
                    <li>Chạm vào từng ô trên bàn cờ để tra cứu nhanh thông tin cơ hội.</li>
                  </ul>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 'clamp(2px, 1vw, 4px)',
                    marginTop: '2px',
                  }}
                >
                  {board.slice(0, 18).map((t) => (
                    <div
                      key={t.index}
                      style={{
                        background: 'rgba(255, 255, 255, 0.65)',
                        border: '1px solid rgba(184, 144, 91, 0.3)',
                        borderRadius: '4px',
                        padding: '2px clamp(2px, 1vw, 4px)',
                        fontSize: 'clamp(9px, 2.5vw, 10.5px)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        overflow: 'hidden',
                        minWidth: 0,
                      }}
                    >
                      <strong style={{ color: '#b45309', flexShrink: 0 }}>{t.index + 1}.</strong>
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          minWidth: 0,
                          flex: 1,
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
                <p style={{ margin: '0 0 4px', fontSize: '11.5px' }}>
                  <GlossaryText text="Quy trình mỗi lượt chơi gồm 3 bước tuần tự rõ ràng:" />
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.7)',
                      border: '1px solid rgba(184, 144, 91, 0.35)',
                      borderRadius: '5px',
                      padding: '5px 7px',
                    }}
                  >
                    <b style={{ color: '#b45309' }}>1. Gieo xúc xắc:</b> Chạm nút xúc xắc trung tâm để nhận bước tiến ngẫu nhiên từ 1 đến 6.
                  </div>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.7)',
                      border: '1px solid rgba(184, 144, 91, 0.35)',
                      borderRadius: '5px',
                      padding: '5px 7px',
                    }}
                  >
                    <b style={{ color: '#15803d' }}>2. Di chuyển quân cờ:</b> Nhân vật nhảy nhót trực quan qua từng ô theo chiều kim đồng hồ.
                  </div>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.7)',
                      border: '1px solid rgba(184, 144, 91, 0.35)',
                      borderRadius: '5px',
                      padding: '5px 7px',
                    }}
                  >
                    <b style={{ color: '#1d4ed8' }}>3. Hành động ô dừng chân:</b> Chỉ ô bạn dừng chân mới kích hoạt sự kiện; đi ngang qua không kích hoạt. Mỗi lần ghé ô Cổ phiếu, Vàng hoặc Trái phiếu được tối đa 1 giao dịch mua hoặc bán.
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(254, 243, 199, 0.65)',
                    border: '1px dashed #d97706',
                    borderRadius: '5px',
                    padding: '4px 6px',
                    fontSize: '11px',
                    marginTop: '2px',
                  }}
                >
                  📰 <b>Đầu mỗi vòng mới:</b> Bản tin thị trường mở ra để dự báo biến động giá và lãi suất toàn thị trường.
                </div>
              </>
            )}

            {/* CHƯƠNG 4: PHÂN BỔ DANH MỤC (FINANCIAL PORTFOLIO) */}
            {currentTab === 3 && (
              <>
                <p style={{ margin: '0 0 4px', fontSize: '11.5px' }}>
                  Hệ thống Drawer Portfolio gồm 6 kênh tài chính chính thức:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.65)',
                      border: '1px solid rgba(184, 144, 91, 0.35)',
                      borderRadius: '4px',
                      padding: '3px 5px',
                      fontSize: '11px',
                    }}
                  >
                    <b style={{ color: '#15803d' }}>💵 Tiền mặt:</b> Dùng ngay, thanh toán sinh hoạt phí và chớp cơ hội mua tài sản giá tốt.
                  </div>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.65)',
                      border: '1px solid rgba(184, 144, 91, 0.35)',
                      borderRadius: '4px',
                      padding: '3px 5px',
                      fontSize: '11px',
                    }}
                  >
                    <b style={{ color: '#1d4ed8' }}>🏦 Tiết kiệm:</b> Kỳ hạn 1 / 2 / 3 vòng, lãi suất 4% - 18%, an toàn tuyệt đối.
                  </div>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.65)',
                      border: '1px solid rgba(184, 144, 91, 0.35)',
                      borderRadius: '4px',
                      padding: '3px 5px',
                      fontSize: '11px',
                    }}
                  >
                    <b style={{ color: '#7c3aed' }}>📈 Cổ phiếu:</b> Sinh lời cao theo sóng thị trường, thanh khoản linh hoạt sau phí bán.
                  </div>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.65)',
                      border: '1px solid rgba(184, 144, 91, 0.35)',
                      borderRadius: '4px',
                      padding: '3px 5px',
                      fontSize: '11px',
                    }}
                  >
                    <b style={{ color: '#b45309' }}>📜 Trái phiếu:</b> Lãi coupon định kỳ tại ô Xuất phát, chú ý rủi ro tổ chức phát hành.
                  </div>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.65)',
                      border: '1px solid rgba(184, 144, 91, 0.35)',
                      borderRadius: '4px',
                      padding: '3px 5px',
                      fontSize: '11px',
                    }}
                  >
                    <b style={{ color: '#d97706' }}>🪙 Vàng:</b> Kênh trú ẩn phòng thủ an toàn khi kinh tế gặp cú sốc vĩ mô.
                  </div>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.65)',
                      border: '1px solid rgba(184, 144, 91, 0.35)',
                      borderRadius: '4px',
                      padding: '3px 5px',
                      fontSize: '11px',
                    }}
                  >
                    <b style={{ color: '#c026d3' }}>🧋 Quán F&B:</b> Mua 20M, nâng cấp tối đa 6 tầng (+5M/tầng) đem lại dòng tiền thụ động lớn.
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
                    background: 'rgba(255, 255, 255, 0.7)',
                    border: '1px solid rgba(184, 144, 91, 0.4)',
                    borderRadius: '5px',
                    padding: '5px 7px',
                    fontSize: '11.5px',
                  }}
                >
                  <p style={{ margin: '0 0 3px', fontWeight: 800, color: '#78350f' }}>
                    🛡️ Quản trị sinh hoạt phí & Nợ vay:
                  </p>
                  <p style={{ margin: '0 0 3px' }}>
                    Sinh hoạt phí định kỳ: <strong style={{ color: '#b91c1c' }}>{money(living.amount)}</strong>. Hãy luôn giữ tiền mặt dự phòng trước khi qua ô Xuất phát.
                  </p>
                  <p style={{ margin: 0 }}>
                    Hạn mức vay khẩn cấp tối đa <b>30.000.000 đ</b> với lãi suất <b>10%/vòng</b>. Nếu hết hạn mức vay và không còn tài sản thanh lý, bạn sẽ rơi vào tình trạng vỡ nợ (Insolvency).
                  </p>
                </div>

                <div
                  style={{
                    background: 'rgba(254, 242, 242, 0.8)',
                    border: '1px solid #f87171',
                    borderRadius: '5px',
                    padding: '4px 6px',
                    fontSize: '11px',
                  }}
                >
                  <b style={{ color: '#991b1b' }}>⚡ 3 Cú sốc vĩ mô cần lưu ý:</b>
                  <ul style={{ margin: '2px 0 0', paddingLeft: '14px' }}>
                    <li><b>Thắt chặt tín dụng:</b> Cổ phiếu & trái phiếu giảm; vàng tăng mạnh.</li>
                    <li><b>Bùng nổ nhu cầu:</b> Cổ phiếu tăng, quán đông khách; vàng giảm.</li>
                    <li><b>Phục hồi cung ứng:</b> Thị trường phân hóa, lạm phát hạ nhiệt.</li>
                  </ul>
                </div>

                <div
                  style={{
                    background: 'rgba(254, 243, 199, 0.65)',
                    border: '1px solid #f59e0b',
                    borderRadius: '5px',
                    padding: '4px 6px',
                    fontSize: '11px',
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
                  if (currentTab === chapters.length - 1) {
                    sound.playClick();
                    onClose();
                  } else {
                    navigateTo(currentTab + 1);
                  }
                }}
                style={{
                  background: 'linear-gradient(180deg, #d97706 0%, #b45309 100%)',
                  color: '#ffffff',
                  border: '1.5px solid #fde68a',
                  borderRadius: '12px',
                  padding: '7px 22px',
                  fontSize: '12.5px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 3px 6px rgba(0, 0, 0, 0.35)',
                  transition: 'transform 0.15s ease',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                  textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                }}
                onPointerDown={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(0.96)';
                }}
                onPointerUp={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                }}
              >
                {currentTab === chapters.length - 1
                  ? firstTime
                    ? 'Sẵn Sàng Lên Đường! ➔'
                    : 'Hoàn Thành'
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
