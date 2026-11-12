import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { boundedJson } from '../../../src/ai/what-if/contracts.ts'
import { MASCOT_SESSION_HEADER } from '../../../src/ai/mascot/contracts.ts'
import { composeLearningAnswer, fallbackLearning, INSUFFICIENT, learningCards, LEARNING_DEADLINE, LEARNING_ENDPOINT, offlineLearning, QUESTION_LIMIT,
  readLearningQuestion, readLearningReply, resolveLearningReply } from '../../../src/ai/mascot/learning.ts'
import type { LearningCard, LearningContext, LearningReply } from '../../../src/ai/mascot/learning.ts'

const learningEnabled = import.meta.env.VITE_MASCOT_LEARNING_ENABLED === '1'
const sourceLabels = { offline: 'Dữ kiện EXE', mock: 'Gemini giả lập', gemini: 'Gemini · Dữ kiện EXE', fallback: 'Chưa đủ dữ kiện' }
export function MascotLearningPanel({ context, getSession }: {
  context: LearningContext | null; getSession: () => string
}) {
  const [question, setQuestion] = useState('')
  const [error, setError] = useState('')
  const [answer, setAnswer] = useState<{ source: LearningReply['source']; cards: LearningCard[] }>()
  const [loading, setLoading] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    request.current?.abort()
    setAnswer(undefined)
    setLoading(false)
    setError('')
    const text = readLearningQuestion(question)
    if (!text) { setError('Nhập câu hỏi từ 3 đến ' + QUESTION_LIMIT + ' ký tự.'); return }
    const cards = learningCards(context)
    const offline = offlineLearning(text, cards)
    if (offline?.length) { setAnswer({ source: 'offline', cards: composeLearningAnswer(offline) }); return }
    if (!learningEnabled || !context) {
      const known = composeLearningAnswer(fallbackLearning(text, cards))
      setAnswer({ source: known.length ? 'offline' : 'fallback', cards: known })
      return
    }
    const controller = new AbortController()
    request.current = controller
    const timeout = AbortSignal.timeout(LEARNING_DEADLINE + 1500)
    const signal = AbortSignal.any([controller.signal, timeout])
    setLoading(true)
    try {
      const response = await fetch(LEARNING_ENDPOINT, {
        method: 'POST', redirect: 'error', cache: 'no-store', signal,
        headers: { 'Content-Type': 'application/json', 'x-mascot-learning': '1', [MASCOT_SESSION_HEADER]: getSession() },
        body: JSON.stringify({ question: text, context }),
      })
      if (response.status === 429 || response.status === 504) {
        if (!controller.signal.aborted) setError(response.status === 429
          ? 'Cáo đang giới hạn lượt hỏi. Bạn có thể thử gửi lại sau ít phút.'
          : 'Cáo mất quá lâu để trả lời. Bạn có thể thử gửi lại.')
        throw new Error('Learning request unavailable')
      }
      if (!response.ok) throw new Error('Learning request unavailable')
      const reply = readLearningReply(await boundedJson(response, signal, 2048), cards)
      signal.throwIfAborted()
      if (!reply) throw new Error('Learning response rejected')
      setAnswer(resolveLearningReply(text, cards, reply, context))
    } catch {
      if (controller.signal.aborted) return
      const related = composeLearningAnswer(fallbackLearning(text, cards, context))
      setAnswer({ source: related.length ? 'offline' : 'fallback', cards: related })
      if (timeout.aborted) setError('Cáo mất quá lâu để trả lời. Bạn có thể thử gửi lại.')
      else setError(current => current || 'Chưa lấy được câu trả lời. Bạn có thể thử gửi lại.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }
  return <div className="mascot-learning">
    <form onSubmit={submit} noValidate>
      <div className="mascot-question-row">
        <input aria-label="Câu hỏi về ván hoặc luật EXE"
          placeholder="Hỏi về luật EXE, ván chơi hoặc kết quả cuối ván"
          value={question} maxLength={QUESTION_LIMIT} autoComplete="off"
          onChange={event => {
            request.current?.abort()
            setLoading(false)
            setAnswer(undefined)
            setError('')
            setQuestion(event.currentTarget.value)
          }} />
        <button type="submit" disabled={loading}>Gửi</button>
      </div>
    </form>
    <div aria-live="polite" aria-busy={loading}>
      {loading && <p>Đang tìm dữ kiện…</p>}
      {error && <p role="alert">{error}</p>}
      {answer && <div className="mascot-learning-answer">
        <p className="mascot-explanation-source">{sourceLabels[answer.source]}</p>
        {answer.cards.length ? answer.cards.map(item => <p key={item.id}>{item.text} <small>({item.source})</small></p>) : <p>{INSUFFICIENT}</p>}
      </div>}
    </div>
  </div>
}
