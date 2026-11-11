import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { createBinding } from '../game/bank-historical-review'
import { createExplanationBinding } from '../game/bank-explanation-binding'
import { offlineMock } from '../../../src/what-if-explanation/mock'
import './bank-explanation.css'

/** Only mounted inside the DEV historical review; no provider/network configuration. */
export function BankExplanation({ history }: { history: ReturnType<typeof createBinding> }) {
  const [controller] = useState(() => createExplanationBinding(offlineMock))
  const lesson = useRef<HTMLDetailsElement>(null)
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  useEffect(() => {
    controller.activate(history)
    controller.showDefault()
    return () => controller.dispose()
  }, [controller, history])
  // Never retain a DTO/model payload in React state: the active lease is checked at consumption.
  const view = controller.read()
  const revealLesson = () => { if (lesson.current) lesson.current.open = true }
  return <aside className="bank-explanation" aria-label="Giải thích offline">
    <details ref={lesson} className="bank-explanation-lesson">
      <summary><h3>Bài học từ lựa chọn</h3></summary>
      {view && <div className="bank-explanation-result" aria-label="Nội dung giải thích offline">
        <p role="status" className="bank-explanation-source">{view.status === 'pending'
          ? 'Đang thử mẫu offline… Bạn có thể đóng ngay.'
          : view.source === 'mock' ? 'Mẫu offline · chỉ thay cách diễn đạt'
            : view.status === 'fallback' ? 'Giải thích của trò chơi · fallback offline' : 'Giải thích của trò chơi'}</p>
        {view.sections.map(section => <div key={section.slot} className="bank-explanation-part"><h4>{section.title}</h4><p>{section.text}</p></div>)}
      </div>}
    </details>
    <details className="bank-explanation-qa">
      <summary>Công cụ QA/DEV</summary>
      <p className="bank-explanation-notice">Mock offline · chỉ thử cách diễn đạt, chưa gọi Gemini. Số liệu vẫn lấy từ engine.</p>
      <div className="bank-explanation-actions">
        <button type="button" onClick={() => { controller.showDefault(); revealLesson() }}>Về giải thích mặc định</button>
        <button type="button" onClick={() => { revealLesson(); void controller.requestMock(true) }} disabled={view?.status === 'pending'}>Xem thử giải thích · mock offline</button>
      </div>
    </details>
  </aside>
}
