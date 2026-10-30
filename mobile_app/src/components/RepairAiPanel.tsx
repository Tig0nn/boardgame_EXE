import { useId, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode, KeyboardEvent } from 'react'
import type { createRepairAiBinding } from '../game/repair-ai.ts'
import { repairAiFeature } from '../game/repair-ai-feature.ts'
import { GamifiedModal } from './GamifiedModal'
import './repair-ai.css'

type Binding = ReturnType<typeof createRepairAiBinding>
const samples = ['So sánh trả ngay và sửa tạm', 'Sửa tạm miễn phí đúng không', 'Thanh khoản là gì?']
const limitationLabels = {
  'simulated-game-only': 'Chỉ giải thích tình huống trong trò chơi.',
  'client-state-unverified': 'Trạng thái trên thiết bị chưa được máy chủ xác thực.',
  'future-outcomes-unknown': 'Chưa biết các kết quả trong tương lai.',
  'funding-costs-not-included': 'Chi phí huy động vốn chưa được tính trong giải thích này.',
}
export function RepairAiPanel({ binding, title, badgeText, cash, description, decisions, onHelp }: {
  binding: Binding; title: string; badgeText: string; cash: ReactNode; description: ReactNode; decisions: ReactNode; onHelp?: () => void
}) {
  const view = useSyncExternalStore(binding.subscribe, binding.getSnapshot, binding.getSnapshot)
  const [wantsAi, setWantsAi] = useState(false)
  const decisionTab = useRef<HTMLButtonElement>(null), aiTab = useRef<HTMLButtonElement>(null), id = useId()
  // A snapshot/session reset closes the binding even when the AI tab is not visible.
  const activeAi = wantsAi && view.open
  const select = (ai: boolean, focus = false) => {
    if (ai) binding.open()
    setWantsAi(ai)
    if (focus) (ai ? aiTab : decisionTab).current?.focus({ preventScroll: true })
  }
  const tabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    select(event.key === 'End' || (event.key !== 'Home' && !activeAi), true)
  }
  const state = view.state
  const response = (state.status === 'answered' || state.status === 'fallback') && state.delivery.isCurrent()
    ? state.delivery.response : null
  const error = state.status === 'error' && state.isCurrent() ? state.error : null
  return <GamifiedModal title={title} badgeText={badgeText} onHelp={onHelp} className="repair-event-modal"
    fixedContent={<div className="repair-fixed">
      <div role="tablist" aria-label="Sửa xe: quyết định hoặc hỏi AI" className="repair-tabs">
        <button type="button" ref={decisionTab} role="tab" id={`${id}-decision-tab`} aria-controls={`${id}-decision`}
          aria-selected={!activeAi} tabIndex={activeAi ? -1 : 0} onKeyDown={tabKey} onClick={() => select(false)}>Quyết định</button>
        <button type="button" ref={aiTab} role="tab" id={`${id}-ai-tab`} aria-controls={`${id}-ai`}
          aria-selected={activeAi} tabIndex={activeAi ? 0 : -1} onKeyDown={tabKey} onClick={() => select(true)}>✨ Hỏi AI</button>
      </div>
      {cash}
    </div>}
    footerContent={activeAi ? <div className="repair-return"><button type="button" onClick={() => select(false, true)}>← Quay lại Quyết định</button></div> : undefined}>
    <div role="tabpanel" id={`${id}-decision`} aria-labelledby={`${id}-decision-tab`} hidden={activeAi} tabIndex={0} className="repair-decision-content">
      {description}{decisions}
    </div>
    <div role="tabpanel" id={`${id}-ai`} aria-labelledby={`${id}-ai-tab`} hidden={!activeAi} tabIndex={0}
      className="repair-ai" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); select(false, true) } }}>
      <p className="repair-ai-hint">Hỏi về chi phí, tiền mặt hoặc rủi ro sửa xe. AI giải thích, bạn tự quyết định.</p>
      <div className="repair-ai-samples" aria-label="Câu hỏi mẫu">
        {samples.map(sample => <button type="button" key={sample} onClick={() => binding.edit(sample)}>{sample}</button>)}
      </div>
      <form onSubmit={event => { event.preventDefault(); void binding.ask() }}>
        <label htmlFor={`${id}-question`}>Bạn muốn hiểu điều gì?</label>
        <input id={`${id}-question`} type="text" value={view.question} maxLength={400} autoComplete="off" onChange={event => binding.edit(event.target.value)} />
        <button type="submit" disabled={!view.question.trim() || state.status === 'loading'}>Gửi câu hỏi</button>
      </form>
      <div className="repair-ai-result" aria-live="polite" aria-atomic="true" aria-busy={state.status === 'loading'}>
        {state.status === 'loading' && <p role="status">Đang đối chiếu câu hỏi với tình huống hiện tại…</p>}
        {response?.result.status === 'answered' && <>
          <section className="repair-ai-conclusion"><h3>Giải thích</h3><p>{response.result.explanation}</p></section>
          <h3>Dữ kiện theo luật trò chơi</h3>
          {response.result.statements.map((item, index) => <section className={`repair-fact-card repair-fact-${item.optionId ?? 'overview'}`} key={index}>
            <h4>{item.label}</h4><p>{item.statement.text}</p>
          </section>)}
          <section className="repair-ai-reflection"><h3>Để bạn suy nghĩ</h3><p>{response.result.reflectionQuestion.text}</p></section>
        </>}
        {response?.result.status === 'fallback' && <><h3>Chưa thể trả lời câu hỏi này</h3><p>{response.result.explanation}</p></>}
        {response && <aside className="repair-ai-limitations" aria-label="Giới hạn giải thích"><ul>{response.limitations.map(limit => <li key={limit}>{limitationLabels[limit]}</li>)}</ul></aside>}
        {error && <p role="alert">{error.error.message} Bạn vẫn có thể quay lại và tự chọn cách sửa xe.</p>}
      </div>
      <button className="repair-disable" type="button" onClick={() => { binding.close(); repairAiFeature.setEnabled(false) }}>Tắt AI ở phiên này</button>
    </div>
  </GamifiedModal>
}