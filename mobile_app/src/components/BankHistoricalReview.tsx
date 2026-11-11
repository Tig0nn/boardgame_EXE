import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Modal } from '../../../src/components/Modal'
import { money } from '../../../src/game/format'
import { createBinding, findBankDecision } from '../game/bank-historical-review'
import { createWorkerExecutor } from '../game/bank-historical-worker'
import type { Session, ReviewDTO } from '../game/bank-historical-contract'
import type { GameState } from '../../../src/game/types'
import './bank-historical-review.css'
import { BankExplanation } from './BankExplanation'

function Result({ result, pending }: { result: ReviewDTO | null; pending: boolean }) {
  if (!result && pending) return <p role="status">Đang kiểm chứng lịch sử ván chơi… Bạn có thể đóng bất cứ lúc nào.</p>
  if (!result || result.status !== 'supported') return <p role="status">Chưa đủ dữ liệu lịch sử hợp lệ ở cùng mốc để so sánh. Chưa hiển thị kết quả tiền.</p>
  return <>
    <p>Nhìn lại sau quyết toán START vòng {result.checkpointLap}. Hai phương án từ cùng một thời điểm.</p>
    <section aria-label="Bạn đã chọn" className="bank-history-actual"><h3>Bạn đã chọn</h3>
      <p>Bỏ qua gửi tiết kiệm tại Ngân hàng.</p><span>Tiền mặt tại mốc đã qua</span><strong>{money(result.actualCash)}</strong></section>
    <section aria-label="Nếu chọn khác" className="bank-history-alternative"><h3>Nếu chọn khác</h3>
      <p>Giả sử gửi {money(result.principal)}, kỳ hạn 1.</p><span>Tiền mặt tại cùng mốc</span><strong>{money(result.alternativeCash)}</strong></section>
    <section className="bank-history-difference" aria-label="Kết quả đã kiểm chứng"><h3>Chênh lệch ròng đã kiểm chứng</h3>
      <strong>{money(result.difference)}</strong><p>Tiền gốc và lãi đã đáo hạn bằng engine tại START đã ghi trong lịch sử.</p>
      <p>Phí gửi/đáo hạn: {money(result.fees)}. Nợ và nghĩa vụ còn lại tại mốc: {money(result.debt + result.obligations)}.</p></section>
    <h3>Đánh đổi thanh khoản</h3><p>Nhánh gửi còn {money(result.alternativeLiquidBuffer)} dùng ngay sau lựa chọn, so với {money(result.actualLiquidBuffer)} nếu bỏ qua gửi. Khoản gửi bị khóa tới START kế tiếp, không được rút tự nguyện.</p>
    <p>{money(result.principal)} là ngân sách giả định của phân tích; record bỏ qua không chứng minh bạn đã chủ động giữ đúng khoản này.</p>
    <p>Kết quả ở mốc đã qua không chứng minh lựa chọn ban đầu sai và không bảo đảm lợi nhuận tương lai. Kỳ hạn tới START là luật trò chơi, không phải lãi suất ngoài đời.</p>
  </>
}

/** Owns only the DEV summary entry and transient review; children remain the existing phase UI. */
export default function BankHistoricalReview({ session, game, children }: { session: Session; game: GameState; children: ReactNode }) {
  const enabled = import.meta.env.DEV && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('historicalWhatIf') === '1'
  const [controller] = useState(() => createBinding(undefined, createWorkerExecutor()))
  const root = useRef<HTMLDivElement>(null)
  const requestGeneration = useRef(0)
  const [entry] = useState(() => {
    if (typeof document === 'undefined') return null
    const node = document.createElement('div'); node.className = 'bank-historical-entry'; return node
  })
  const [opened, setOpened] = useState<{ owner: typeof controller; session: Session; snapshot: GameState; pending: boolean } | null>(null)
  const sequence = enabled ? findBankDecision(game) : null
  const open = !!opened && opened.owner === controller && opened.session === session && opened.snapshot === session.getSnapshot()
  useEffect(() => {
    if (!enabled) return
    controller.activate(session, 'gameplay-mount')
    const generation = requestGeneration
    return () => { generation.current++; controller.dispose() }
  }, [controller, session, enabled])
  useEffect(() => {
    if (!enabled || !entry || sequence === null) return
    // Scoped slot into the existing START body; no changes to the shared summary or a board CTA.
    const target = root.current?.querySelector('.gamified-modal-card .anime-slim-scroll')
    if (!target) return
    target.append(entry)
    return () => entry.remove()
  }, [enabled, entry, sequence, game])
  const close = () => { requestGeneration.current++; controller.dispose(); controller.activate(session, 'review-close'); setOpened(null) }
  const launch = () => {
    if (sequence === null || session.getSnapshot() !== game) return
    const generation = ++requestGeneration.current
    setOpened({ owner: controller, session, snapshot: game, pending: true })
    // Paint loading before bounded work. No DTO is stored in React state.
    void new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0))).then(() => {
      if (generation === requestGeneration.current && session.getSnapshot() === game) return controller.request(sequence)
    }).then(() => { if (generation === requestGeneration.current) setOpened(current => current && current.session === session && current.snapshot === game ? { ...current, pending: false } : current) })
  }
  const result = open ? controller.read() : null
  return <>
    <div ref={root}>{children}</div>
    {enabled && entry && sequence !== null && createPortal(<button type="button" className="bank-history-launch" onClick={launch}>Xem lại lựa chọn Ngân hàng · DEV</button>, entry)}
    {enabled && open && <Modal title="Nhìn lại lựa chọn Ngân hàng" className="bank-historical-modal" onClose={close}>
      <span className="bank-history-kicker">DEV · WHAT-IF LỊCH SỬ · CHỈ XEM</span><h2>Nhìn lại lựa chọn Ngân hàng</h2>
      <Result result={result} pending={!!opened?.pending}/>
      {result?.status === 'supported' && <BankExplanation history={controller}/>}<button className="bank-history-return" onClick={close}>Quay lại tổng kết START</button>
    </Modal>}
  </>
}
