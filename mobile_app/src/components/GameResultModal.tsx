import { useEffect, useRef } from 'react'
import { FinancialTerm } from '../../../src/components/FinancialTerm'
import { AICoachPanel } from '../../../src/ai/AICoachPanel'
import { goalProgress, totalWorth, victory } from '../../../src/game/selectors'
import { money } from '../../../src/game/format'
import type { GameState } from '../../../src/game/types'
import { FinancialReview } from '../../../src/components/FinancialReview'
import { hasBondCredit } from '../../../src/game/bond-credit'
import { sound } from '../utils/audio'

interface GameResultModalProps {
  game: GameState
  onRestart: () => void
  onHome?: () => void
  onClose?: () => void
  onExport: () => void
  onHelp?: () => void
}

export function GameResultModal({
  game,
  onRestart,
  onHome,
  onClose,
  onExport,
  onHelp,
}: GameResultModalProps) {
  const won = victory(game).won
  const { funds, target, percent: progress } = goalProgress(game)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Dynamic Victory / Defeat Particle Animation Canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth || 320
    const height = canvas.clientHeight || 105
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    type Particle = {
      x: number
      y: number
      vx: number
      vy: number
      size: number
      color: string
      alpha: number
      rotation?: number
      vRot?: number
    }

    const particles: Particle[] = []

    if (won) {
      // Confetti & Sparkling Stars for Victory
      const victoryColors = ['#fbbf24', '#f59e0b', '#10b981', '#34d399', '#ec4899', '#60a5fa', '#a855f7']
      for (let i = 0; i < 35; i++) {
        particles.push({
          x: width * 0.5 + (Math.random() - 0.5) * 70,
          y: 50 + (Math.random() - 0.5) * 25,
          vx: (Math.random() - 0.5) * 2.8,
          vy: Math.random() * -2.8 - 0.5,
          size: Math.random() * 3.5 + 2,
          color: victoryColors[Math.floor(Math.random() * victoryColors.length)],
          alpha: Math.random() * 0.7 + 0.3,
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.08,
        })
      }
    } else {
      // Gentle Falling Rain for Defeat
      const rainColors = ['#93c5fd', '#60a5fa', '#38bdf8', '#bae6fd']
      for (let i = 0; i < 24; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: -0.5 - Math.random() * 0.4,
          vy: 2.0 + Math.random() * 1.8,
          size: Math.random() * 7 + 5,
          color: rainColors[Math.floor(Math.random() * rainColors.length)],
          alpha: Math.random() * 0.4 + 0.25,
        })
      }
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height)

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        ctx.save()
        ctx.globalAlpha = p.alpha

        if (won) {
          p.x += p.vx
          p.y += p.vy
          p.vy += 0.05 // Gravity
          if (p.rotation !== undefined && p.vRot !== undefined) {
            p.rotation += p.vRot
          }

          // Reset confetti when falling below banner
          if (p.y > height + 8 || p.x < -8 || p.x > width + 8) {
            p.x = width * 0.5 + (Math.random() - 0.5) * 80
            p.y = 40 + (Math.random() - 0.5) * 15
            p.vx = (Math.random() - 0.5) * 2.6
            p.vy = Math.random() * -2.6 - 0.4
          }

          ctx.translate(p.x, p.y)
          if (p.rotation !== undefined) ctx.rotate(p.rotation)
          ctx.fillStyle = p.color
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.8)
        } else {
          // Rain droplets
          p.x += p.vx
          p.y += p.vy

          if (p.y > height) {
            p.y = -8
            p.x = Math.random() * (width + 30)
          }

          ctx.strokeStyle = p.color
          ctx.lineWidth = 1.1
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x + p.vx * 1.8, p.y + p.size)
          ctx.stroke()
        }

        ctx.restore()
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [won])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(12, 10, 8, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '10px',
        boxSizing: 'border-box',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          sound.playClick()
          onClose()
        }
      }}
    >
      {/* Strict Slim Mobile Container (w-[88%] max-w-[340px] h-[80vh] max-h-[660px]) */}
      <div
        className={`w-[88%] max-w-[340px] h-[80vh] max-h-[660px] mx-auto relative overflow-hidden flex flex-col rounded-[32px] bg-white shadow-2xl border-2 ${
          won ? 'border-amber-300/60' : 'border-indigo-200/60'
        } text-slate-800 game-result-container`}
        style={{
          width: '88%',
          maxWidth: '340px',
          height: '80vh',
          maxHeight: '660px',
          writingMode: 'horizontal-tb',
          textOrientation: 'mixed',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          borderRadius: '30px',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
          fontFamily: "'Fredoka', 'Baloo 2', system-ui, -apple-system, sans-serif",
          boxSizing: 'border-box',
        }}
      >
        {/* BANNER HEADER CÓ CANVAS PARTICLES - TINH GỌN (HEIGHT: 105px) */}
        <div
          style={{
            position: 'relative',
            height: '105px',
            flexShrink: 0,
            background: won
              ? 'linear-gradient(180deg, #fef3c7 0%, #fde68a 55%, #fcd34d 100%)'
              : 'linear-gradient(180deg, #e0e7ff 0%, #c7d2fe 55%, #a5b4fc 100%)',
            borderBottom: won ? '1.5px solid #f59e0b' : '1.5px solid #818cf8',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 12px 6px',
            overflow: 'hidden',
          }}
        >
          {/* Canvas Hạt Pháo Hoa / Mưa Rơi */}
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />

          {/* Nút thoát góc trên bên phải nếu có */}
          {onClose && (
            <button
              onClick={() => {
                sound.playClick()
                onClose()
              }}
              title="Đóng Bảng"
              aria-label="Đóng"
              style={{
                position: 'absolute',
                top: '8px',
                right: '10px',
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.08)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 900,
                zIndex: 10,
                transition: 'transform 0.15s ease',
              }}
              onPointerDown={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(0.9)'
              }}
              onPointerUp={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)'
              }}
            >
              ✕
            </button>
          )}

          {/* Vòng & Vòng Chơi Kicker */}
          <span
            style={{
              fontSize: '10px',
              fontWeight: 800,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: won ? '#b45309' : '#4338ca',
              zIndex: 2,
              marginBottom: '1px',
            }}
          >
            VÒNG {game.lap}/{game.totalLaps} · {won ? 'HOÀN THÀNH' : 'KẾT THÚC'}
          </span>

          {/* Huy hiệu Medal Mascot */}
          <div
            style={{
              fontSize: '28px',
              lineHeight: 1,
              zIndex: 2,
              filter: won
                ? 'drop-shadow(0 3px 8px rgba(245, 158, 11, 0.45))'
                : 'drop-shadow(0 3px 8px rgba(99, 102, 241, 0.35))',
              margin: '1px 0 3px',
            }}
          >
            {won ? '🏆' : game.termination === 'insolvent' ? '🥀' : '🌱'}
          </div>

          {/* Tiêu đề Banner dạng Huy hiệu */}
          <div
            style={{
              background: won
                ? 'linear-gradient(90deg, #d97706, #b45309)'
                : 'linear-gradient(90deg, #4f46e5, #4338ca)',
              color: '#ffffff',
              padding: '2.5px 11px',
              borderRadius: '16px',
              fontSize: '12px',
              fontWeight: 900,
              letterSpacing: '0.02em',
              boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
              zIndex: 2,
              whiteSpace: 'nowrap',
            }}
          >
            {won
              ? 'CHIẾN THẮNG RỰC RỠ!'
              : game.termination === 'insolvent'
              ? 'HẸN MỘT HÀNH TRÌNH MỚI!'
              : 'TIẾC QUÁ, THỬ LẠI NHÉ!'}
          </div>
        </div>

        {/* THÂN BẢNG CUỘN (SCROLLABLE BODY - TINH GỌN PX-3.5) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 13px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxSizing: 'border-box',
          }}
        >
          {/* Thông điệp phụ */}
          <p
            style={{
              margin: '0 0 2px',
              fontSize: '11.5px',
              textAlign: 'center',
              color: '#475569',
              fontWeight: 600,
              lineHeight: 1.35,
            }}
          >
            {won
              ? 'Bạn đã hoàn thành đủ các vòng và huy động thành công mục tiêu 90M!'
              : game.termination === 'insolvent'
              ? `Hành trình dừng vì còn thiếu ${money(
                  game.pendingPayment?.remaining ?? 0
                )}; không còn nguồn thanh toán khả dụng.`
              : `Còn thiếu ${money(Math.max(0, target - funds))} để chạm mốc mục tiêu 90M.`}
          </p>

          {/* CARD CHỈ SỐ: NGUỒN TIỀN VỀ ĐÍCH */}
          <div
            style={{
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '16px',
              padding: '8px 11px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b' }}>
                <FinancialTerm term="proceeds">Nguồn tiền về đích</FinancialTerm>
              </span>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Sau phí & nợ</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <strong
                style={{
                  fontSize: '18px',
                  fontWeight: 900,
                  color: won ? '#047857' : '#1e293b',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {money(funds)}
              </strong>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>
                / {money(target)}
              </span>
            </div>

            {/* Thanh tiến trình bo tròn */}
            <div
              style={{
                width: '100%',
                height: '7px',
                background: '#e2e8f0',
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(0, progress))}%`,
                  height: '100%',
                  background: won
                    ? 'linear-gradient(90deg, #10b981, #059669)'
                    : 'linear-gradient(90deg, #f59e0b, #ea580c)',
                  borderRadius: '8px',
                  transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10.5px',
                fontWeight: 700,
                color: '#64748b',
              }}
            >
              <span>{Math.round(progress)}% mục tiêu</span>
              <span>{won ? '✅ Đạt chỉ tiêu' : '⚠️ Chưa hoàn tất'}</span>
            </div>
          </div>

          {/* ĐÁNH GIÁ TÀI CHÍNH (FINANCIAL REVIEW) */}
          <div style={{ fontSize: '11.5px' }}>
            <FinancialReview game={game} />
          </div>

          {/* ACCORDION: NHẬN XÉT TỪ AI COACH */}
          <details className="result-accordion" style={{ margin: 0, padding: '7px 10px' }}>
            <summary>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                <span>🤖</span>
                <span>AI Coach · Tùy chọn</span>
              </span>
              <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>▼</span>
            </summary>
            <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #e2e8f0' }}>
              <AICoachPanel game={game} />
            </div>
          </details>

          {/* ACCORDION: CHI TIẾT KẾT QUẢ & LƯU NHẬT KÝ */}
          <details className="result-accordion" style={{ margin: 0, padding: '7px 10px' }}>
            <summary>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                <span>📜</span>
                <span>Chi tiết số liệu & Lưu nhật ký</span>
              </span>
              <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>▼</span>
            </summary>
            <div
              style={{
                marginTop: '6px',
                paddingTop: '6px',
                borderTop: '1px dashed #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                fontSize: '11px',
                lineHeight: 1.4,
                color: '#475569',
              }}
            >
              <p style={{ margin: 0 }}>
                Nguồn tiền về đích bao gồm tiền mặt, gốc tiết kiệm rút được và tiền bán tài sản tài
                chính theo thị giá sau phí, trừ toàn bộ nợ và khoản phải trả.
              </p>
              <p style={{ margin: 0 }}>
                <strong>
                  <FinancialTerm term="netWorth" />:
                </strong>{' '}
                {money(totalWorth(game))} · <strong>Tiền mặt:</strong> {money(game.portfolio.cash)}
              </p>
              <p style={{ margin: 0 }}>
                Vốn kinh doanh chưa bán và lãi tiết kiệm chưa trả không tính vào nguồn tiền về đích.
              </p>
              {hasBondCredit(game) && (
                <p style={{ margin: 0 }}>
                  <FinancialTerm term="coupon" /> và gốc đang chờ trả không được cộng thêm. Trái
                  phiếu chỉ tính tiền có thể bán nhận sau phí; khoản nợ vỡ nợ không có giá bán.
                </p>
              )}

              <button
                onClick={() => {
                  sound.playClick()
                  onExport()
                }}
                style={{
                  marginTop: '3px',
                  padding: '6px 10px',
                  borderRadius: '9px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#1e293b',
                  fontWeight: 700,
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <span>💾</span>
                <span>Lưu nhật ký hành trình (JSON)</span>
              </button>
            </div>
          </details>

          {/* Nút trợ giúp / sổ tay nếu có */}
          {onHelp && (
            <div style={{ textAlign: 'center', marginTop: '1px' }}>
              <button
                onClick={() => {
                  sound.playClick()
                  onHelp()
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  textDecoration: 'underline',
                }}
              >
                📖 Xem lại Sổ Tay Luật Chơi
              </button>
            </div>
          )}
        </div>

        {/* CHÂN TRANG HÀNH ĐỘNG CỐ ĐỊNH (FIXED ACTION FOOTER - COMPACT) */}
        <div
          style={{
            padding: '8px 12px 10px 12px',
            background: 'rgba(255, 255, 255, 0.98)',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          {/* Nút chính: Thử lại ván mới */}
          <button
            className="btn-glossy-orange"
            style={{ padding: '8px 12px', fontSize: '14px' }}
            onClick={() => {
              sound.playClick()
              onRestart()
            }}
          >
            <span>{won ? 'Chơi Ván Mới 🏆' : 'Thử Lại Ván Mới 🔄'}</span>
          </button>

          {/* Hàng 2: Về màn hình chờ & Xem lại bàn cờ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', width: '100%' }}>
            {onHome && (
              <button
                className="btn-pill-subtle"
                style={{ padding: '7px 8px', fontSize: '12px' }}
                onClick={() => {
                  sound.playClick()
                  onHome()
                }}
              >
                <span>🏠 Màn Hình Chờ</span>
              </button>
            )}

            {onClose && (
              <button
                className="btn-outline-subtle"
                style={{ padding: '7px 8px', fontSize: '12px' }}
                onClick={() => {
                  sound.playClick()
                  onClose()
                }}
              >
                <span>🔍 Xem Bàn Cờ</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
