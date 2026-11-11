import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { money, signedMoney } from '../../../src/game/format.ts'
import { EndgameWhatIfPanel } from '../components/endgame-what-if/EndgameWhatIfPanel.tsx'
import '../components/endgame-what-if/endgame-what-if.css'
import { createAppAnalysisBinding } from '../game/endgame-analysis-app-binding.ts'
import { parseHistory } from '../game/endgame-whatif-identity.ts'
import { createEndgameUiController } from '../game/endgame-whatif-ui-controller.ts'
import { askBank, explainBank } from '../game/what-if-ai/bank.ts'
import { askDecision, createDecisionClient } from '../game/what-if-ai/decision-client.ts'
import type { DecisionResult } from '../game/what-if-ai/decision.worker.ts'
import type { ReplayComparison, ReplayFollowUp } from '../game/what-if-ai/decision-replay.ts'
import { askGold, explainGold } from '../game/what-if-ai/gold.ts'
import { mockGemini } from '../game/what-if-ai/mock-gemini.ts'
import { explainWhatIf, QUESTION_LIMIT } from '../game/what-if-ai/orchestrator.ts'
import goldFixture from '../../../docs/playtests/core-mvp-b18-multi-course/browser-390-trades.json.gz?url'
import bankFixture from '../../../docs/playtests/core-mvp-b18-multi-course/frozen-screen-cash-roi.json.gz?url'
import courseFixture from '../../../docs/playtests/core-mvp-b18-multi-course/frozen-holdout-diversified-roi.json.gz?url'
import './what-if-ai.css'

const fixtures = {
  gold: { url: goldFixture, question: 'Nếu tôi bỏ mua vàng thì sao?' },
  bank: { url: bankFixture, question: 'Nếu tôi gửi tiết kiệm ở ngân hàng thì sao?' },
  course: { url: courseFixture, question: 'Nếu tôi học khóa cơ bản tại quyết định 49 thì sao?' },
}
const metrics = [['cash', 'Tiền mặt'], ['totalWorth', 'Tổng tài sản ròng'], ['liquidatableFunds', 'Tiền có thể thu về']] as const
type Fixture = keyof typeof fixtures

async function readFixture(scenario: Fixture, signal: AbortSignal) {
  const response = await fetch(fixtures[scenario].url, { signal })
  if (!response.ok || !response.body) throw new Error('fixture-unavailable')
  // Vite serves precompressed archives with Content-Encoding, which fetch decodes automatically.
  const text = response.headers.get('content-encoding') === 'gzip' ? await response.text()
    : await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).text()
  signal.throwIfAborted()
  return text
}

export function WhatIfAiPage() {
  const [{ binding, controller, watchListeners }] = useState(() => {
    const binding = createAppAnalysisBinding({ transport: 'S' })
    return { binding, controller: createEndgameUiController(binding), watchListeners: new Set<() => void>() }
  })
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const [scenario, setScenario] = useState<Fixture>('gold')
  const [question, setQuestion] = useState(fixtures.gold.question)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [comparison, setComparison] = useState<ReplayComparison | null>(null)
  const [courseFollowUp, setCourseFollowUp] = useState<ReplayFollowUp | null>(null)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [showFinal, setShowFinal] = useState(false)
  const active = useRef<AbortController | null>(null)
  const decisionClient = useRef<ReturnType<typeof createDecisionClient> | null>(null)
  const submitButton = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    const unmount = controller.mount(listener => {
      watchListeners.add(listener)
      return () => { watchListeners.delete(listener) }
    })
    return () => {
      active.current?.abort()
      binding.revoke('home')
      unmount()
    }
  }, [binding, controller, watchListeners])

  function clearRun() {
    active.current?.abort()
    active.current = null
    decisionClient.current?.dispose()
    decisionClient.current = null
    binding.revoke('home')
    controller.close()
    setBusy(false)
    setComparison(null)
    setCourseFollowUp(null)
    setExplanation(null)
    setShowFinal(false)
    setStatus('')
  }

  async function acceptCourse(result: DecisionResult | null, job: AbortController) {
    if (active.current !== job) return
    setCourseFollowUp(null)
    if (result?.status === 'needs-followup') {
      setCourseFollowUp(result.followUp)
      setStatus('Một lựa chọn học sau đó không còn hợp lệ. Cần bạn xác nhận để tiếp tục.')
      return
    }
    decisionClient.current?.dispose()
    decisionClient.current = null
    if (result?.status !== 'supported-final') {
      setStatus('Chưa thể xác minh phương án học này. Hãy thử câu hỏi mẫu.')
      return
    }
    const comparison = result.comparison
    setComparison(comparison)
    const delta = comparison.delta.cash
    const text = await explainWhatIf(mockGemini, { kind: 'course', direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'unchanged',
      confirmedFollowUp: false }, job.signal)
    if (active.current !== job) return
    setExplanation(text)
    setStatus('Đã xác minh so sánh cuối ván.')
  }

  async function confirmCourse() {
    const job = active.current, client = decisionClient.current, pending = courseFollowUp
    if (!job || !client || !pending || busy) return
    setBusy(true)
    try {
      const result = await client.request({ kind: 'followup', choice: { id: pending.id, optionId: 'skip' } })
      await acceptCourse(result, job)
    } catch {
      if (active.current === job) {
        clearRun()
        setStatus('Chưa thể tiếp tục phân tích.')
      }
    } finally { if (active.current === job) setBusy(false) }
  }

  async function finishGold(job: AbortController) {
    controller.readFinal()
    const current = controller.getSnapshot()
    if (current.kind === 'followup') {
      setStatus('Cần bạn xác nhận lần bán vàng trước khi so sánh.')
      return
    }
    if (current.kind !== 'final') {
      setStatus('Worker chưa xác minh được kết quả so sánh.')
      return
    }
    const text = await explainGold(mockGemini, current, job.signal)
    if (active.current !== job || controller.getSnapshot() !== current) return
    setExplanation(text)
    setStatus('Đã xác minh so sánh cuối ván.')
  }

  async function runQuestion() {
    clearRun()
    const job = new AbortController()
    active.current = job
    setBusy(true)
    setStatus('Đang xác minh lịch sử và tìm lựa chọn có thể thử…')
    try {
      const text = await readFixture(scenario, job.signal)
      if (scenario === 'course') {
        const client = createDecisionClient(job.signal)
        decisionClient.current = client
        const result = await askDecision(client, text, 'course', mockGemini, question, job.signal)
        await acceptCourse(result, job)
        return
      }
      if (scenario === 'bank') {
        const result = await askBank(text, mockGemini, question, job.signal)
        if (active.current !== job) return
        if (result.kind !== 'final') {
          setStatus(result.kind === 'blocked' ? `Chưa thể so sánh (${result.reason}).` : 'Chưa thể so sánh.')
          return
        }
        setComparison(result.comparison)
        const summary = await explainBank(mockGemini, result.comparison, job.signal)
        if (active.current !== job) return
        setExplanation(summary)
        setStatus('Đã xác minh so sánh cuối ván.')
        return
      }

      const { state } = parseHistory(text)
      binding.replaceSession({ getSnapshot: () => state, subscribe: () => () => {} }, 'restored-state')
      watchListeners.forEach(listener => listener())
      await controller.open()
      if (active.current !== job) return
      if (controller.getSnapshot().kind !== 'catalog') {
        setStatus('Worker chưa tìm được quyết định mua vàng đủ điều kiện.')
        return
      }
      const result = await askGold(controller, mockGemini, question, job.signal)
      if (active.current !== job) return
      if (result === 'unsupported') {
        clearRun()
        setStatus('Câu hỏi chưa khớp một lựa chọn trong lịch sử. Hãy thử câu hỏi mẫu.')
      } else await finishGold(job)
    } catch {
      if (active.current === job) {
        clearRun()
        setStatus('Chưa thể hoàn thành phân tích. Hãy thử lại.')
      }
    } finally {
      if (active.current === job) setBusy(false)
    }
  }

  async function confirmSale() {
    const job = active.current
    if (!job || view.kind !== 'followup') return
    setBusy(true)
    setStatus('Đang phát lại phần còn lại của ván…')
    try {
      await controller.followUp()
      if (active.current === job) await finishGold(job)
    } catch {
      if (active.current === job) setStatus('Chưa thể xác minh nhánh thay thế.')
    } finally {
      if (active.current === job) setBusy(false)
    }
  }

  const goldFinal = view.kind === 'final'
  const followUp = view.kind === 'followup' || view.kind === 'resuming'
  return <main className="what-if-ai-dev">
    <h1>Thử What-if bằng câu hỏi</h1>
    <p>DEV · Mock Gemini chọn từ lịch sử mẫu. Engine B18 xác minh và tính kết quả.</p>
    <form onSubmit={event => { event.preventDefault(); if (!busy && !followUp && !courseFollowUp) void runQuestion() }}>
      <label htmlFor="ai-fixture">Ván mẫu</label>
      <select id="ai-fixture" value={scenario} onChange={event => {
        clearRun()
        const next = event.target.value === 'course' ? 'course' : event.target.value === 'bank' ? 'bank' : 'gold'
        setScenario(next)
        setQuestion(fixtures[next].question)
      }}>
        <option value="gold">Gold C1 · Bỏ mua vàng</option>
        <option value="bank">Bank · Gửi tiết kiệm ở ô cuối vòng</option>
        <option value="course">Course · Thử học khóa cơ bản</option>
      </select>
      {scenario === 'bank' && <p>Phương án dùng ngân sách giả định của ván mẫu trong một kỳ START.</p>}
      <label htmlFor="ai-question">Câu hỏi What-if</label>
      <input id="ai-question" value={question} onChange={event => {
        if (active.current) clearRun()
        setQuestion(event.target.value)
      }} maxLength={QUESTION_LIMIT} required />
      <div className="what-if-ai-actions">
        <button type="submit" ref={submitButton} disabled={busy || followUp || !!courseFollowUp || !question.trim()}>Chạy phân tích</button>
        {(busy || courseFollowUp) && <button type="button" onClick={clearRun}>Dừng phân tích</button>}
      </div>
    </form>
    <p role="status">{status}</p>
    {courseFollowUp && <section aria-labelledby="course-followup">
      <h2 id="course-followup">Lần học sau cần xác nhận</h2>
      <p>Phương án thử chưa có kết quả cuối ván.</p>
      <button type="button" disabled={busy} onClick={() => { void confirmCourse() }}>Bỏ qua lần học sau</button>
    </section>}
    {(comparison || goldFinal) && explanation && <section aria-labelledby="mock-explanation">
      <h2 id="mock-explanation">Giải thích từ mock Gemini</h2>
      <p>{explanation}</p>
    </section>}
    {goldFinal && <button type="button" onClick={() => {
      controller.readFinal()
      if (controller.getSnapshot().kind === 'final') setShowFinal(true)
    }}>Xem so sánh cuối ván</button>}
    {comparison && <section aria-labelledby="decision-comparison">
      <h2 id="decision-comparison">So sánh cuối ván</h2>
      <p>Vòng {comparison.lap}, lượt {comparison.turn}{comparison.principal !== undefined && <> · Tiền gửi giả định {money(comparison.principal)}</>}</p>
      {metrics.map(([key, label]) => <section key={key} className="endgame-what-if__metric">
        <h3>{label}</h3>
        <dl>
          <div><dt>Ván đã chơi</dt><dd>{money(comparison.actual[key])}</dd></div>
          <div><dt>Phương án thử</dt><dd>{money(comparison.alternative[key])}</dd></div>
          <div><dt>Chênh lệch</dt><dd>{signedMoney(comparison.delta[key])}</dd></div>
        </dl>
      </section>)}
    </section>}
    {(followUp || showFinal && goldFinal) && <EndgameWhatIfPanel view={view}
      trigger={submitButton} onClose={clearRun}
      onCreate={controller.create} onFollowUp={confirmSale} onRecheck={controller.readFinal} />}
  </main>
}
