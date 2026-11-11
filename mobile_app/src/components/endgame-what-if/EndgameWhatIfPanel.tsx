import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { EndgameView } from '../../game/endgame-whatif-ui-controller.ts'

type PanelProps = {
  view: EndgameView
  trigger: RefObject<HTMLButtonElement | null>
  onClose: () => void
  onCreate: (sequence: number, alternative: 'skip' | null) => Promise<void>
  onFollowUp: () => Promise<void>
  onRecheck: () => void
}

const messages = {
  verifying: 'Đang kiểm chứng lịch sử ván đã chơi…',
  verified: 'Đang tìm các quyết định có thể thử…',
  creating: 'Đang mô phỏng phần còn lại của ván…',
  resuming: 'Đang tiếp tục mô phỏng…',
  'final-read': 'Đang kiểm tra kết quả cuối ván…',
  blocked: 'Chưa kiểm chứng được lịch sử hoặc kết quả của ván này.',
  limited: 'Chưa có lựa chọn mua vàng có thể so sánh trong trường hợp này.',
  unavailable: 'Hiện chưa thể chạy phân tích. Bạn vẫn có thể xem kết quả ván đã chơi.',
  revoked: 'Lượt phân tích đã hết hiệu lực. Bạn có thể đóng và mở một lượt mới.',
  timeout: 'Lượt phân tích đã hết thời gian chờ. Hãy mở một lượt mới nếu muốn thử lại.',
  cancelled: 'Lượt phân tích đã dừng.',
  catalog: 'Đã kiểm chứng ván đã chơi. Hãy chọn một quyết định.',
  followup: 'Cần thêm một lựa chọn để tiếp tục.',
  final: 'Đã xác minh kết quả so sánh.',
  closed: '',
  ineligible: '',
}

export function EndgameWhatIfPanel({ view, trigger, onClose, onCreate, onFollowUp, onRecheck }: PanelProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const title = useId()
  const historyGroup = useId()
  const alternativeGroup = useId()
  const [selection, select] = useState<number | null>(null)
  const [alternative, selectAlternative] = useState<'skip' | null>(null)

  useLayoutEffect(() => {
    const element = dialog.current
    if (!element) return
    const previous = trigger.current
    element.showModal()
    heading.current?.focus({ preventScroll: true })
    return () => {
      element.close()
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [trigger])
  useLayoutEffect(() => {
    if (view.kind === 'catalog' || view.kind === 'followup' || view.kind === 'final') {
      stepHeading.current?.focus()
    }
  }, [view.kind])
  useLayoutEffect(() => {
    if (view.kind !== 'final') return
    window.addEventListener('focus', onRecheck)
    return () => window.removeEventListener('focus', onRecheck)
  }, [onRecheck, view.kind])

  const pending = ['verifying', 'verified', 'creating', 'resuming', 'final-read'].includes(view.kind)
  return createPortal(
    <dialog className="endgame-what-if" ref={dialog} aria-labelledby={title}
      onPointerDown={event => {
        // A native backdrop hit is retargeted to the dialog. Keep focus inside it.
        if (event.target === event.currentTarget) event.preventDefault()
      }}
      onCancel={event => { event.preventDefault(); onClose() }}>
      <header className="endgame-what-if__header">
        <h2 id={title} ref={heading} tabIndex={-1}>Thử một lựa chọn khác</h2>
        <button type="button" onClick={onClose} aria-label="Đóng phân tích">Đóng</button>
      </header>
      <p className="endgame-what-if__status" role="status" aria-live="polite">{messages[view.kind]}</p>
      <div className="endgame-what-if__content" aria-busy={pending}>
        {view.kind === 'catalog' && <>
          <h3 ref={stepHeading} tabIndex={-1}>Chọn quyết định trong ván đã chơi</h3>
          <fieldset>
            <legend>Quyết định mua vàng</legend>
            {view.decisions.map(decision => <label key={decision.sequence}>
              <input type="radio" name={historyGroup} checked={selection === decision.sequence}
                onChange={() => { select(decision.sequence); selectAlternative(null) }} />
              <span>Mua vàng {decision.amount} · Vòng {decision.lap}, lượt {decision.turn}</span>
            </label>)}
          </fieldset>
          {selection !== null && <fieldset>
            <legend>Phương án thử</legend>
            <label><input type="radio" name={alternativeGroup} checked={alternative === 'skip'}
              onChange={() => selectAlternative('skip')} />
              <span>Bỏ qua lần mua vàng này</span></label>
          </fieldset>}
          <button type="button" className="endgame-what-if__primary" disabled={selection === null || !alternative}
            onClick={() => { if (selection !== null) void onCreate(selection, alternative) }}>
            Chạy mô phỏng
          </button>
        </>}
        {view.kind === 'followup' && <>
          <h3 ref={stepHeading} tabIndex={-1}>Lần bán vàng sau đó</h3>
          <p>Trong ván đã chơi, bạn bán vàng ở vòng {view.lap}, lượt {view.turn}.</p>
          <p>{view.hasNoGold
            ? 'Trong phương án thử, bạn không có vàng để bán ở lượt này.'
            : 'Số vàng trong phương án thử không cho phép thực hiện giao dịch bán đã ghi nhận.'}</p>
          <button type="button" className="endgame-what-if__primary" onClick={() => { void onFollowUp() }}>
            Bỏ qua lần bán này
          </button>
        </>}
        {view.kind === 'final' && <>
          <h3 ref={stepHeading} tabIndex={-1}>So sánh cuối ván</h3>
          <p>Vòng {view.lap}, lượt {view.turn} · Mục tiêu {view.goalTarget}</p>
          {view.combined && <p>Chênh lệch gồm việc bỏ qua lần mua vàng và lựa chọn bỏ qua lần bán sau đó.</p>}
          {view.rows.map(row => <section className="endgame-what-if__metric" key={row.key}>
            <h4>{row.label}</h4>
            <dl>
              <div><dt>Ván đã chơi</dt><dd>{row.actual}</dd></div>
              <div><dt>Phương án thử</dt><dd>{row.alternative}</dd></div>
              <div className="endgame-what-if__delta"><dt>Chênh lệch</dt><dd>{row.direction} · {row.delta}</dd></div>
            </dl>
          </section>)}
          <p>Tiền có thể thu về là ước tính ròng theo luật chơi, sau các khoản phí và nghĩa vụ mà engine tính. Phương án thử được kiểm chứng bằng cách phát lại cùng diễn biến đã xảy ra. Kết quả này không cho biết lựa chọn nào sẽ tốt hơn ở ván khác.</p>
        </>}
      </div>
      <footer className="endgame-what-if__footer">
        <button type="button" onClick={onClose}>{pending || view.kind === 'followup' ? 'Dừng phân tích' : 'Về kết quả ván'}</button>
      </footer>
    </dialog>,
    document.body,
  )
}
