import { useId, useRef, useSyncExternalStore } from 'react'
import type { createRepairAiBinding } from '../game/repair-ai.ts'
import { repairAiFeature } from '../game/repair-ai-feature.ts'
import './repair-ai.css'

type Binding = ReturnType<typeof createRepairAiBinding>
const samples = ['So sánh trả ngay và sửa tạm', 'Sửa tạm miễn phí đúng không', 'Thanh khoản là gì?']
export function RepairAiPanel({ binding }: { binding: Binding }) {
  const view = useSyncExternalStore(binding.subscribe, binding.getSnapshot, binding.getSnapshot)
  const enabled = useSyncExternalStore(repairAiFeature.subscribe, repairAiFeature.isEnabled, () => false)
  const trigger = useRef<HTMLButtonElement>(null), id = useId()
  const close = () => { binding.close(); trigger.current?.focus({ preventScroll: true }) }
  if (!enabled) return null
  const state = view.state
  // Final render guard reads the live session; queued React updates cannot revive old tickets.
  const response = (state.status === 'answered' || state.status === 'fallback') && state.delivery.isCurrent()
    ? state.delivery.response : null
  const error = state.status === 'error' && state.isCurrent() ? state.error : null
  return <section className="repair-ai" aria-label="AI Companion sửa xe" onKeyDown={event => {
    if (event.key === 'Escape' && view.open) { event.stopPropagation(); close() }
  }}>
    <button ref={trigger} type="button" className="repair-ai-trigger" aria-expanded={view.open}
      aria-controls={id} onClick={() => view.open ? close() : binding.open()}>
      ✨ Hỏi AI trước khi quyết định
    </button>
    {view.open && <div id={id} className="repair-ai-panel">
      <h3>Hiểu rõ rồi tự quyết định</h3>
      <p className="repair-ai-hint">Hỏi về chi phí, tiền mặt hoặc rủi ro sửa xe trong trò chơi. AI chỉ giải thích, không chọn thay bạn.</p>
      <div className="repair-ai-samples" aria-label="Câu hỏi mẫu">
        {samples.map(sample => <button type="button" key={sample} onClick={() => binding.edit(sample)}>{sample}</button>)}
      </div>
      <form onSubmit={event => { event.preventDefault(); void binding.ask() }}>
        <label htmlFor={`${id}-question`}>Bạn muốn hiểu điều gì?</label>
        <input autoFocus id={`${id}-question`} type="text" value={view.question} maxLength={400}
          autoComplete="off" onChange={event => binding.edit(event.target.value)} />
        <button type="submit" disabled={!view.question.trim() || state.status === 'loading'}>Gửi câu hỏi</button>
      </form>
      <div className="repair-ai-result" aria-live="polite" aria-atomic="true" aria-busy={state.status === 'loading'}>
        {state.status === 'loading' && <p role="status">Đang đối chiếu câu hỏi với tình huống hiện tại…</p>}
        {response?.result.status === 'answered' && <>
          <p>{response.result.explanation}</p>
          {response.result.statements.map((item, index) => <p key={index}><strong>{item.label}: </strong>{item.statement.text}</p>)}
          <p className="repair-ai-reflection">{response.result.reflectionQuestion.text}</p>
          {response.limitations.includes('funding-costs-not-included') && <p>Chi phí huy động vốn chưa được tính trong giải thích này.</p>}
        </>}
        {response?.result.status === 'fallback' && <><strong>Chưa thể trả lời câu hỏi này</strong><p>{response.result.explanation}</p></>}
        {error && <p role="alert">{error.error.message} Bạn vẫn có thể quay lại và tự chọn cách sửa xe.</p>}
      </div>
      <div className="repair-ai-actions">
        <button type="button" onClick={close}>← Quay lại quyết định</button>
        <button type="button" onClick={() => { binding.close(); repairAiFeature.setEnabled(false) }}>Tắt AI ở phiên này</button>
      </div>
    </div>}
  </section>
}