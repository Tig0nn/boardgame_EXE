import { useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { EndgameAppBinding } from '../../game/endgame-analysis-app-binding.ts'
import { createInGameAiController } from '../../game/what-if-ai/in-game-controller.ts'
import { createHttpWhatIfProvider } from '../../game/what-if-ai/http-provider.ts'
import type { WhatIfDecision } from '../../game/what-if-ai/orchestrator.ts'
import { alternativeLabel, parameterQuestion, QUESTION_LIMIT } from '../../game/what-if-ai/orchestrator.ts'
import './endgame-what-if.css'
import './in-game-ai.css'
import { FlexibleChoices } from './FlexibleChoices.tsx'
import { decisionQuestion } from '../../game/what-if-ai/natural-language.ts'

type Registration = { subscribe(listener: () => void): () => void; getSnapshot(): EndgameAppBinding | null }
type Props = { registration: Registration; watch(listener: () => void): () => void }
const kindNames = { gold: 'Vàng', bank: 'Ngân hàng', course: 'Khóa học', advanced: 'Khóa nâng cao',
  stocks: 'Cổ phiếu', bonds: 'Trái phiếu', business: 'Kinh doanh' }
const questions: Record<WhatIfDecision['kind'], string> = { gold: 'Nếu tôi bỏ mua vàng thì sao?', bank: 'Nếu tôi gửi tiết kiệm ở ngân hàng thì sao?',
  course: 'Nếu tôi học khóa cơ bản thì sao?', advanced: 'Nếu tôi học khóa nâng cao thì sao?',
  stocks: 'Nếu tôi mua cổ phiếu thì sao?', bonds: 'Nếu tôi mua trái phiếu An Tâm thì sao?', business: 'Nếu tôi mua cơ sở thì sao?' }
function choiceLabel(choice: WhatIfDecision) {
  return `${alternativeLabel(choice)} · Quyết định ${choice.decisionId.split(':')[1]} · Vòng ${choice.lap}, lượt ${choice.turn}`
}

export function InGameAiEntry({ registration, watch }: Props) {
  const binding = useSyncExternalStore(registration.subscribe, registration.getSnapshot)
  return binding ? <BoundAiEntry binding={binding} watch={watch} /> : null
}
function BoundAiEntry({ binding, watch }: { binding: EndgameAppBinding; watch: Props['watch'] }) {
  const controller = useMemo(() => createInGameAiController(binding, () => createHttpWhatIfProvider()), [binding])
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const trigger = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    const unsubscribe = watch(controller.watch)
    return () => { unsubscribe(); controller.close() }
  }, [controller, watch])
  if (!binding.inspect().terminal) return null
  return <>
    <button type="button" className="endgame-what-if-entry" ref={trigger} aria-haspopup="dialog"
      aria-expanded={view.stage !== 'closed'} onClick={() => { void controller.open() }}>Hỏi AI về lựa chọn khác</button>
    {view.stage !== 'closed' && <AiDialog controller={controller} trigger={trigger} />}
  </>
}

function AiDialog({ controller, trigger }: { controller: ReturnType<typeof createInGameAiController>;
  trigger: React.RefObject<HTMLButtonElement | null> }) {
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const [question, setQuestion] = useState('Nếu tôi bỏ mua vàng thì sao?')
  const focusQuestion = useRef(false), questionInput = useRef<HTMLTextAreaElement>(null)
  const manualCategory = useRef<HTMLSelectElement>(null)
  const dialog = useRef<HTMLDialogElement>(null), heading = useRef<HTMLHeadingElement>(null), stepHeading = useRef<HTMLHeadingElement>(null)
  const title = useId(), input = useId(), category = useId()
  const pending = ['preparing', 'proposing', 'running'].includes(view.stage)
  const missingParameter = view.missing?.[0]
  const needsHistory = !!view.natural && !!view.history?.length && !view.selectedSequence
  useLayoutEffect(() => {
    const element = dialog.current, previous = trigger.current
    element?.showModal()
    heading.current?.focus()
    return () => { element?.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [trigger])
  useLayoutEffect(() => {
    const check = () => { controller.getSnapshot() }
    window.addEventListener('focus', check)
    return () => window.removeEventListener('focus', check)
  }, [controller])
  useLayoutEffect(() => {
    if (['proposal', 'followup', 'final', 'blocked'].includes(view.stage)) stepHeading.current?.focus()
    else if (view.stage === 'question' && focusQuestion.current) {
      focusQuestion.current = false
      questionInput.current?.focus()
    } else if (view.stage === 'question') {
      const target = missingParameter ? `[data-parameter="${missingParameter}"]` : needsHistory ? '[data-history-selector]' : null
      if (target) dialog.current?.querySelector<HTMLElement>(target)?.focus()
    }
  }, [view.stage, missingParameter, needsHistory])
  function updateQuestion(value: string) {
    setQuestion(value)
    controller.editQuestion()
  }
  function anotherQuestion() {
    focusQuestion.current = true
    setQuestion('')
    void controller.restart()
  }
  const missingNames: Record<string, string> = { amount: 'số tiền VND', symbolId: 'mã cổ phiếu', issuerId: 'tổ chức phát hành',
    lotId: 'lot trái phiếu', term: 'kỳ hạn', preferenceId: 'chuyên môn nâng cấp' }
  const suggestions = view.catalog.slice(0, 3).map(decisionQuestion)
  if (!suggestions.length && view.history?.length) {
    const { sequence, action } = view.history[0]
    const question = action === 'course-basic' ? 'Nếu tôi bỏ học khóa cơ bản'
      : action === 'course-advanced' ? 'Nếu tôi bỏ học khóa nâng cao' : questions[view.kind].replace(' thì sao?', '')
    suggestions.push(`${question} tại quyết định ${sequence} thì sao?`)
  }
  return createPortal(<dialog className="endgame-what-if" ref={dialog} aria-labelledby={title}
    onCancel={event => { event.preventDefault(); controller.close() }}>
    <header className="endgame-what-if__header">
      <h2 id={title} ref={heading} tabIndex={-1}>Hỏi AI về lựa chọn khác</h2>
      <button type="button" onClick={() => controller.close()}>Đóng</button>
    </header>
    <div className="endgame-what-if__content" aria-busy={pending}>
      <p>Thử phương án trên lịch sử ván đã chơi. Bạn xác nhận từng thay đổi trước khi mô phỏng.</p>
      <p className="in-game-ai-mode">DEV · AI mock qua HTTP. Gemini live chưa được chạy.</p>
      <p role="status">{view.notice ?? (view.stage === 'preparing' ? 'Đang xác minh lịch sử và tìm lựa chọn…'
        : view.stage === 'proposing' ? 'Đang chờ đề xuất AI…' : view.stage === 'running' ? 'Đang xác minh phương án thử…' : '')}</p>
      {['preparing', 'question', 'proposing'].includes(view.stage) && <form onSubmit={event => {
        event.preventDefault()
        if (!pending) void controller.ask(question)
      }}>
        <label htmlFor={input}>Câu hỏi What-if</label>
        <textarea id={input} ref={questionInput} value={question} maxLength={QUESTION_LIMIT} disabled={view.stage === 'preparing'} rows={3}
          onChange={event => updateQuestion(event.target.value)} required />
        <button type="submit" disabled={pending || view.stage !== 'question' || !question.trim()}>Phân tích câu hỏi (mock)</button>
        {view.stage === 'question' && view.providerFailed && <button type="button" onClick={() => {
          const selector = view.selectedSequence && view.catalog.length ? '[data-verified-alternative]' : view.history?.length ? '[data-history-selector]' : null
          const target = selector ? dialog.current?.querySelector<HTMLSelectElement>(selector) : manualCategory.current
          target?.focus()
        }}>Chọn phương án thủ công</button>}
        {view.stage === 'proposing' && <button type="button" onClick={() => {
          focusQuestion.current = true
          controller.cancelProvider()
        }}>Hủy yêu cầu AI</button>}
        {!!suggestions.length && <section aria-label="Gợi ý câu hỏi"><p>Gợi ý từ lịch sử và phương án hiện có:</p>
          {suggestions.map(suggestion => <button key={suggestion} type="button" disabled={pending} onClick={() => updateQuestion(suggestion)}>{suggestion}</button>)}
        </section>}
        {!!view.missing?.length && <p role="note">Cần bổ sung: {view.missing.map(key => missingNames[key]).join(', ')}.</p>}
        <h3>Chọn hoặc bổ sung phương án</h3>
        <label htmlFor={category}>Nhóm quyết định</label>
        <select id={category} ref={manualCategory} value={view.kind} disabled={pending} onChange={event => {
          const kind = event.target.value as WhatIfDecision['kind']
          setQuestion(questions[kind])
          void controller.selectKind(kind)
        }}>{Object.entries(kindNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        {(view.natural || view.filteredHistory) && <button type="button" disabled={pending} onClick={() => { void controller.selectKind(view.kind) }}>Xem toàn bộ quyết định trong nhóm</button>}
        <FlexibleChoices view={view} controller={controller} pending={pending} />
        {!pending && !view.history?.length && <p>Chưa có quyết định trong nhóm này.</p>}
        {view.catalog.length === 1 && view.catalog[0].parameters && <button type="button" disabled={pending}
          onClick={() => setQuestion(parameterQuestion(view.catalog[0]))}>Điền câu hỏi theo tham số đã xác minh</button>}
        <button type="button" onClick={() => { void controller.propose(question) }} disabled={pending || view.stage !== 'question' || !question.trim() || !view.selectedSequence || !view.catalog.length}>Đề xuất phương án</button>
      </form>}
      {view.stage === 'proposal' && view.proposal && <section aria-label="Đề xuất cần xác nhận">
        <h3 ref={stepHeading} tabIndex={-1}>Đề xuất cần bạn xác nhận</h3>
        <p>Phương án hợp lệ ở lượt này. Xác nhận để kiểm tra các lượt còn lại.</p>
        <p><strong>Quyết định gốc.</strong> {view.history?.find(row => row.sequence === view.selectedSequence)?.description}</p>
        <p><strong>Phương án thử.</strong> {choiceLabel(view.proposal)}</p>
        <button type="button" onClick={() => { void controller.confirm() }}>Xác nhận và mô phỏng</button>
        <button type="button" onClick={() => { focusQuestion.current = true; controller.editQuestion() }}>Sửa câu hỏi</button>
      </section>}
      {view.stage === 'followup' && <section>
        <h3 ref={stepHeading} tabIndex={-1}>Cần thêm lựa chọn</h3>
        <p>Một hành động sau đó không còn hợp lệ trong phương án thử. Hãy xác nhận để tiếp tục.</p>
        <p>{view.followUpDetail}</p>
        <button type="button" onClick={() => { void controller.followUp() }}>{view.followUp}</button>
      </section>}
      {view.stage === 'final' && <section>
        <h3 ref={stepHeading} tabIndex={-1}>So sánh cuối ván</h3>
        <p><strong>Quyết định gốc:</strong> {view.original}</p>
        <p><strong>Phương án thay thế:</strong> {view.alternative}</p>
        {view.rows?.map(row => <section className="endgame-what-if__metric" key={row.label}>
          <h4>{row.label}</h4><dl>
            <div><dt>Ván đã chơi</dt><dd>{row.actual}</dd></div>
            <div><dt>Phương án thử</dt><dd>{row.alternative}</dd></div>
            <div><dt>Chênh lệch</dt><dd>{row.delta}</dd></div>
          </dl>
        </section>)}
        <p>{view.explanation}</p>
        {!!view.salaryChanges?.length && <section aria-label="Dữ kiện lương từ engine">
          <h4>Khoản tăng lương theo vòng</h4>
          <ul>{view.salaryChanges.map(change => <li key={change}>{change}</li>)}</ul>
        </section>}
        <details className="in-game-ai-limits">
          <summary>Cách đọc kết quả</summary>
          <p>Hai nhánh được replay đến hết vòng 4. Tài sản ròng gồm cả tài sản còn nắm giữ và các khoản phải trả. Tiền có thể thu về dựa trên định giá bán và các khoản phải trả tại thời điểm đó. Tiền mặt là số dư đang có.</p>
          <p>Kết quả áp dụng cho ván này, phương án đã chọn và các follow-up đã xác nhận.</p>
        </details>
        <button type="button" onClick={anotherQuestion}>Hỏi câu khác trên ván gốc</button>
        <button type="button" onClick={() => { void controller.restart() }}>Đổi phương án trên ván gốc</button>
      </section>}
      {!!view.confirmedFollowUps?.length && <section aria-label="Follow-up đã xác nhận"><h3>Bạn đã xác nhận</h3>
        <ul>{view.confirmedFollowUps.map((text, index) => <li key={index}>{text}</li>)}</ul>
      </section>}
      {view.stage === 'blocked' && <h3 ref={stepHeading} tabIndex={-1}>Chưa thể mô phỏng</h3>}
      {['blocked', 'followup'].includes(view.stage) && <button type="button" onClick={() => { void controller.restart() }}>Đổi phương án trên ván gốc</button>}
    </div>
    <footer className="endgame-what-if__footer"><button type="button" onClick={() => controller.close()}>Dừng và về kết quả ván</button></footer>
  </dialog>, document.body)
}
