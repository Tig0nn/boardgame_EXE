import { useEffect, useRef, useState } from 'react'
import type { WhatIfAssistantReply } from '../../../../apps/api/src/services/what-if-cloud-assistant'
import type { WhatIfAssistantRequest, WhatIfRequest } from '../../../../apps/api/src/validation'
import type { createGameApi } from '../../game/server-session'
import { apiMessage } from '../../game/server-session'

type Props = {
  api: Pick<ReturnType<typeof createGameApi>, 'whatIfAssistant'>
  sessionId: string
  stateVersion: number
  busy: boolean
  onConfirm: (request: WhatIfRequest) => void
}

const assistanceMessages = {
  'not-requested': '', used: 'Gemini đã hỗ trợ đọc câu hỏi hoặc đối chiếu dữ kiện.', 'not-applicable': '',
  disabled: 'Gemini What-if đang tắt. Bạn vẫn có thể chọn phương án thủ công.',
  timeout: 'Gemini phản hồi quá thời gian.',
  unavailable: 'Gemini hiện chưa khả dụng.',
  'rate-limited': 'Đã đạt giới hạn lượt dùng Gemini. Hãy thử lại sau.',
  'output-rejected': 'Chưa thể xác minh phản hồi từ Gemini.',
}
const statuses: Record<string, string> = {
  'ambiguous': 'Có nhiều cách hiểu. Hãy nêu rõ số bước hoặc chọn thủ công.',
  'unsupported': 'Chưa có phương án phù hợp trong lịch sử ván.',
  'multiple-changes': 'Hãy thử thay đổi một quyết định mỗi lần.',
  'needs-details': 'Hãy bổ sung số tiền, kỳ hạn hoặc mã tài sản phù hợp với quyết định.',
}
const intentKinds = { gold: 'vàng', bank: 'ngân hàng', stocks: 'cổ phiếu', bonds: 'trái phiếu',
  business: 'kinh doanh', course: 'khóa học', advanced: 'khóa học' }
const intentActions = { skip: 'Bỏ qua', buy: 'Mua', sell: 'Bán', deposit: 'Gửi tiết kiệm',
  basic: 'Học khóa cơ bản', advanced: 'Học khóa nâng cao', upgrade: 'Nâng cấp' }

export function CloudWhatIfAssistant({ api, sessionId, stateVersion, busy, onConfirm }: Props) {
  const [question, setQuestion] = useState('')
  const [allowGemini, setAllowGemini] = useState(false)
  const [reply, setReply] = useState<WhatIfAssistantReply>()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  async function ask(operation: 'interpret' | 'propose') {
    if (busy || request.current || question.trim().length < 3) return
    const controller = new AbortController()
    request.current = controller
    setReply(undefined)
    setError('')
    setPending(true)
    try {
      const response = await api.whatIfAssistant(sessionId, { stateVersion, operation, question, allowGemini }, controller.signal)
      if (!controller.signal.aborted) setReply(response)
    } catch (error) {
      if (!controller.signal.aborted) setError(apiMessage(error))
    } finally {
      if (request.current === controller) {
        request.current = null
        setPending(false)
      }
    }
  }

  return <details>
    <summary>Hỏi về một phương án</summary>
    <form onSubmit={event => { event.preventDefault(); void ask('propose') }}>
      <label>Câu hỏi What-if
        <input className="text-input" value={question} maxLength={240} disabled={pending || busy}
          onChange={event => { setQuestion(event.target.value); setReply(undefined); setError(''); setAllowGemini(false) }}
          placeholder="Ví dụ: Bỏ mua vàng tại quyết định 7" />
      </label>
      <label><input type="checkbox" checked={allowGemini} disabled={pending || busy}
        onChange={event => { setAllowGemini(event.target.checked); setReply(undefined) }} />
        Cho phép gửi câu hỏi này tới Gemini. Hãy bỏ thông tin cá nhân trước khi gửi.
      </label>
      <button className="button secondary" type="button" disabled={pending || busy || question.trim().length < 3}
        onClick={() => { void ask('interpret') }}>Kiểm tra cách hiểu</button>
      <button className="button secondary" type="submit" disabled={pending || busy || question.trim().length < 3}>Tìm phương án</button>
    </form>
    {pending && <p role="status">Đang đọc câu hỏi…</p>}
    {error && <p role="alert">{error}</p>}
    {reply && 'interpretation' in reply && <div aria-live="polite">
      {assistanceMessages[reply.assistance] && <p>{assistanceMessages[reply.assistance]}</p>}
      {reply.interpretation.status === 'intent' && <p>
        {intentActions[reply.interpretation.intent.action]} · {intentKinds[reply.interpretation.intent.kind]}
      </p>}
      {statuses[reply.status] && <p>{statuses[reply.status]}</p>}
      {'proposal' in reply && <>
        <p>Bước {reply.proposal.sequence} · Ván thật: {reply.preview.original}</p>
        <p>Giả lập: {reply.preview.replacement}</p>
        <button className="button primary" type="button" disabled={pending || busy}
          onClick={() => onConfirm(reply.proposal)}>Xác nhận và mô phỏng</button>
      </>}
    </div>}
  </details>
}

export function CloudWhatIfExplanation({ api, sessionId, input }: {
  api: Props['api']; sessionId: string; input: WhatIfRequest
}) {
  const [reply, setReply] = useState<WhatIfAssistantReply>()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  async function explain() {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setError('')
    const body: WhatIfAssistantRequest = { ...input, operation: 'explain', allowGemini: true }
    try {
      const response = await api.whatIfAssistant(sessionId, body, controller.signal)
      if (!controller.signal.aborted) setReply(response)
    } catch (error) {
      if (!controller.signal.aborted) setError(apiMessage(error))
    } finally {
      if (request.current === controller) {
        request.current = null
        setPending(false)
      }
    }
  }
  return <div>
    <button className="button secondary" type="button" disabled={pending} onClick={() => { void explain() }}>
      {pending ? 'Đang kiểm chứng…' : 'Nhờ Gemini hỗ trợ giải thích'}
    </button>
    {error && <p role="alert">{error}</p>}
    {reply && 'claim' in reply && <div aria-live="polite">
      {assistanceMessages[reply.assistance] && <p>{assistanceMessages[reply.assistance]}</p>}
      {reply.claim && <p>{reply.claim.text}</p>}
    </div>}
  </div>
}
