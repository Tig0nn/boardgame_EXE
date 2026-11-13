import { useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { FoxLearningReply } from '../../../apps/api/src/services/fox-coach'
import { apiMessage } from '../game/server-session'
import { composeLearningAnswer, fallbackLearning, INSUFFICIENT, learningCards, offlineLearning, QUESTION_LIMIT,
  readLearningQuestion } from '../../../src/ai/mascot/learning.ts'
import type { LearningCard, LearningContext } from '../../../src/ai/mascot/learning.ts'

const assistanceMessages = {
  'not-requested': '',
  disabled: 'Gemini chưa được bật cho Cáo.',
  'not-needed': '',
  used: '',
  'no-match': 'Gemini chưa tìm được nội dung EXE phù hợp.',
  unavailable: 'Gemini hiện chưa khả dụng.',
  timeout: 'Gemini phản hồi quá thời gian.',
  'rate-limited': 'Cáo đã đạt giới hạn lượt dùng Gemini. Hãy thử lại sau.',
}

export function MascotLearningPanel({ context, onlineAsk }: {
  context: LearningContext | null
  onlineAsk?: (question: string, signal: AbortSignal) => Promise<FoxLearningReply>
}) {
  const [question, setQuestion] = useState('')
  const [error, setError] = useState('')
  const [answer, setAnswer] = useState<{ cards: LearningCard[]; assisted?: boolean; note?: string }>()
  const [loading, setLoading] = useState(false)
  const [share, setShare] = useState(false)
  const request = useRef<AbortController | null>(null)
  useLayoutEffect(() => () => request.current?.abort(), [])

  const readQuestion = () => {
    const text = readLearningQuestion(question)
    if (!text) setError('Nhập câu hỏi từ 3 đến ' + QUESTION_LIMIT + ' ký tự.')
    return text
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setShare(false)
    const text = readQuestion()
    if (!text) return
    const cards = learningCards(context)
    setAnswer({ cards: composeLearningAnswer(offlineLearning(text, cards) ?? fallbackLearning(text, cards, context)) })
  }

  const askGemini = async () => {
    if (!onlineAsk || !share || request.current) return
    const text = readQuestion()
    if (!text) return
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setError('')
    setShare(false)
    try {
      const reply = await onlineAsk(text, controller.signal)
      if (controller.signal.aborted) return
      setAnswer({ cards: reply.cards, assisted: reply.assistance === 'used', note: assistanceMessages[reply.assistance] })
    } catch (problem) {
      if (!controller.signal.aborted) setError(apiMessage(problem))
    } finally {
      if (request.current === controller) {
        request.current = null
        setLoading(false)
      }
    }
  }

  return <div className="mascot-learning">
    <form onSubmit={submit} noValidate aria-label="Hỏi Cáo">
      <div className="mascot-question-row">
        <input aria-label="Câu hỏi về ván hoặc luật EXE"
          placeholder="Hỏi về luật EXE, ván chơi hoặc kết quả cuối ván"
          value={question} maxLength={QUESTION_LIMIT} autoComplete="off"
          onChange={event => {
            request.current?.abort()
            request.current = null
            setLoading(false)
            setAnswer(undefined)
            setError('')
            setShare(false)
            setQuestion(event.currentTarget.value)
          }} />
        <button type="submit" disabled={loading}>Hỏi Cáo</button>
      </div>
    </form>
    <div aria-live="polite" aria-busy={loading}>
      {loading && <p>Đang tìm dữ kiện…</p>}
      {error && <p role="alert">{error}</p>}
      {answer && <div className="mascot-learning-answer">
        <p className="mascot-explanation-source">{answer.assisted ? 'Gemini hỗ trợ chọn nội dung EXE' : answer.cards.length ? 'Dữ kiện EXE' : 'Chưa đủ dữ kiện'}</p>
        {answer.cards.length ? answer.cards.map(item => <p key={item.id}>{item.text} <small>({item.source})</small></p>) : <p>{INSUFFICIENT}</p>}
        {answer.note && <p>{answer.note}</p>}
      </div>}
    </div>
    {onlineAsk && answer?.cards.length === 0 && !loading && <>
      <label>
        <input type="checkbox" checked={share} onChange={event => setShare(event.currentTarget.checked)} />
        Cho phép gửi câu hỏi này tới Gemini. Vui lòng bỏ thông tin cá nhân khỏi câu hỏi.
      </label>
      <button type="button" disabled={!share} onClick={() => { void askGemini() }}>Nhờ Gemini tìm nội dung</button>
    </>}
  </div>
}
