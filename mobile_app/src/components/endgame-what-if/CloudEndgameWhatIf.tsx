import { useEffect, useRef, useState } from 'react'
import type { WhatIfCatalog, WhatIfEvaluation } from '../../../../apps/api/src/services/what-if'
import type { WhatIfRequest } from '../../../../apps/api/src/validation'
import { money, signedMoney } from '../../../../src/game/format'
import { Modal } from '../../../../src/components/Modal'
import { ApiError, apiMessage } from '../../game/server-session'
import type { createGameApi } from '../../game/server-session'
import './cloud-endgame-what-if.css'

type Api = Pick<ReturnType<typeof createGameApi>, 'whatIf' | 'whatIfCatalog'>
type Decision = WhatIfCatalog['decisions'][number]
type Alternative = WhatIfRequest['alternative']
const labels = { victory: 'Đạt mục tiêu', defeat: 'Chưa đạt mục tiêu', insolvent: 'Mất khả năng thanh toán' }

function explainError(error: unknown) {
  if (error instanceof ApiError && error.code === 'WHAT_IF_BUDGET_EXCEEDED') return 'Phân tích quá thời gian. Bạn có thể thử lại.'
  if (error instanceof ApiError && error.status === 409) return 'Ván đã thay đổi. Hãy tải lại danh sách quyết định.'
  return apiMessage(error)
}

function Alternatives({ decision, disabled, evaluate }: {
  decision: Decision; disabled: boolean; evaluate: (alternative: Alternative) => void
}) {
  const { original, fundingOptions } = decision
  const originalFunding = original.actionId === 'fund' && 'source' in original.payload ? original.payload : null
  const trade = original.actionId === 'trade' && 'kind' in original.payload ? original.payload : null
  const [amount, setAmount] = useState(trade ? String(trade.amount) : '')
  const [term, setTerm] = useState<1 | 2 | 3>(trade?.kind === 'deposit' ? trade.term ?? 1 : 1)
  const value = Number(amount)
  const tradeEdited = trade && (trade.kind !== 'deposit' || value !== trade.amount || term !== (trade.term ?? 1))
    && (trade.kind === 'deposit' || value !== trade.amount)

  return <fieldset disabled={disabled}>
    <legend>Thử phương án khác</legend>
    {decision.eventChoices.map(option => <button key={option.optionId} type="button" className="button secondary"
      onClick={() => evaluate({ mode: 'replace', action: { actionId: 'choose', payload: { optionId: option.optionId } } })}>
      {option.label} · {option.detail}
    </button>)}
    {decision.tradeAlternatives.map(({ label, payload }) => <button key={label} type="button" className="button secondary"
      onClick={() => evaluate({ mode: 'replace', action: { actionId: 'trade', payload } })}>
      {label} · {money(payload.amount)}
    </button>)}
    {decision.canOmit && <button type="button" className="button secondary" onClick={() => evaluate({ mode: 'omit' })}>Bỏ giao dịch này</button>}
    {trade && (trade.kind === 'deposit' || trade.kind === 'repay' || ('asset' in trade && trade.asset !== 'business')) && <>
      <label>Số tiền (₫)<input className="text-input" type="number" min="1" step="1" value={amount} onChange={event => setAmount(event.target.value)} /></label>
      {trade.kind === 'deposit' && <label>Kỳ hạn (vòng)<select className="text-input" value={term}
        onChange={event => setTerm(Number(event.target.value) as typeof term)}>
        {[1, 2, 3].map(item => <option key={item} value={item}>{item}</option>)}
      </select></label>}
      <button type="button" className="button secondary" disabled={!tradeEdited || !Number.isSafeInteger(value) || value <= 0}
        onClick={() => evaluate({ mode: 'replace', action: { actionId: 'trade',
          payload: trade.kind === 'deposit' ? { ...trade, amount: value, term } : { ...trade, amount: value } } })}>
        Thử giao dịch mới
      </button>
    </>}
    {originalFunding && fundingOptions.map((option, index) => {
      const amount = option.maxAmount
      if (amount < option.minAmount || (originalFunding.source === option.source && originalFunding.amount === amount &&
          ('lotId' in originalFunding ? originalFunding.lotId : undefined) === option.lotId)) return null
      const names = { savings: 'Tiết kiệm', stocks: 'Cổ phiếu', bonds: 'Trái phiếu', gold: 'Vàng', debt: 'Vay nợ' }
      const { source, lotId } = option
      const payload = source === 'bonds' && lotId ? { source, lotId, amount } as const
        : source === 'savings' ? { source, lotId, amount } as const
          : source !== 'bonds' ? { source, amount } : null
      return payload && <button key={index} type="button" className="button secondary"
        onClick={() => evaluate({ mode: 'replace', action: { actionId: 'fund', payload } })}>
        {names[source]} {lotId} · {money(amount)}
      </button>
    })}
  </fieldset>
}

function Comparison({ result }: { result: WhatIfEvaluation }) {
  const { continuation } = result
  return <section aria-label="Kết quả giả lập" aria-live="polite">
    {result.status === 'limited'
      ? <p>{result.reason === 'EARLY_INSOLVENCY' ? 'Nhánh giả lập mất khả năng thanh toán trước khi hoàn tất ván.' :
        'Điều kiện thị trường hoặc đường đi đã khác; chưa có so sánh ở cùng điều kiện.'} Số vòng hoàn tất: {result.completedLaps.length}/4.</p>
      : <>
        <h3>So sánh sau vòng 4</h3>
        <p>Ván thật: {labels[result.actual.outcome]} · Giả lập: {labels[result.alternative.outcome]}</p>
        <div className="cloud-what-if-table"><table>
          <thead><tr><th scope="col">Chỉ số</th><th scope="col">Ván thật</th><th scope="col">Giả lập</th><th scope="col">Chênh lệch</th></tr></thead>
          <tbody>{([
            ['Nguồn huy động', Number(result.actual.lawfulProceedsVnd), Number(result.alternative.lawfulProceedsVnd), Number(result.delta.lawfulProceedsVnd)],
            ['Tiền mặt', result.actual.cash, result.alternative.cash, result.delta.cash],
            ['Tài sản ròng', result.actual.totalWorth, result.alternative.totalWorth, result.delta.totalWorth],
            ['Dư nợ', result.actual.debt, result.alternative.debt, result.delta.debt],
          ] as const).map(([label, actual, alternative, delta]) => <tr key={label}><th scope="row">{label}</th>
            <td>{money(actual)}</td><td>{money(alternative)}</td><td>{signedMoney(delta)}</td></tr>)}</tbody>
        </table></div>
        <h3>Vì sao kết quả khác?</h3>
        <p>Chênh lệch tiền mặt ngay sau quyết định: {signedMoney(result.explanation.decision.cashDeltaVnd)}.</p>
        <p>Ván thật: {result.explanation.decision.actual.map(item => item.consequence).join(' ')}</p>
        <p>Giả lập: {result.explanation.decision.alternative.map(item => item.consequence).join(' ') || 'Bỏ giao dịch đã chọn.'}</p>
        <ul>{result.explanation.startDifferences.flatMap(item => item.lines.map(line =>
          <li key={item.lap + ':' + line.label}>START vòng {item.lap} · {line.label}: {signedMoney(line.delta)}</li>))}</ul>
      </>}
    <p>Giữ lại {continuation.retained} bước sau điểm rẽ nhánh; {continuation.notRetained} bước không áp dụng lại.</p>
    {continuation.fallback.length > 0 && <details><summary>{continuation.fallback.length} quyết định bổ sung theo quy tắc giả lập</summary>
      <ul>{continuation.fallback.map((step, index) => <li key={index}>Vòng {step.context.lap}: {step.label}</li>)}</ul>
    </details>}
  </section>
}

function Analysis({ api, sessionId, close }: { api: Api; sessionId: string; close: () => void }) {
  const request = useRef<AbortController | null>(null)
  const [catalog, setCatalog] = useState<WhatIfCatalog | null>(null)
  const [selected, setSelected] = useState<number>()
  const [result, setResult] = useState<WhatIfEvaluation>()
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [generation, reload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void api.whatIfCatalog(sessionId, controller.signal).then(value => {
      if (!controller.signal.aborted) { setCatalog(value); setSelected(value.decisions[0]?.sequence) }
    }).catch(error => {
      if (!controller.signal.aborted) setError(explainError(error))
    }).finally(() => {
      if (!controller.signal.aborted) setBusy(false)
    })
    return () => { controller.abort(); request.current?.abort(); request.current = null }
  }, [api, sessionId, generation])

  const decision = catalog?.decisions.find(item => item.sequence === selected)
  const evaluate = (alternative: Alternative) => {
    if (!catalog || !decision || request.current) return
    const controller = new AbortController()
    request.current = controller
    setResult(undefined); setBusy(true); setError('')
    void api.whatIf(sessionId, { stateVersion: catalog.stateVersion, sequence: decision.sequence, alternative }, controller.signal)
      .then(value => { if (!controller.signal.aborted) setResult(value) })
      .catch(error => { if (!controller.signal.aborted) setError(explainError(error)) })
      .finally(() => {
        if (request.current === controller) { request.current = null; setBusy(false) }
      })
  }

  return <Modal title="Nếu chọn khác thì sao?" onClose={close} wide>
    <h2>Nếu chọn khác thì sao?</h2>
    <p>Giữ nguyên quyết định trước điểm rẽ nhánh và chạy đến hết vòng 4. Giả lập không thay đổi ván thật.</p>
    {busy && <p role="status">Đang phân tích…</p>}
    {error && <><p role="alert">{error}</p><button type="button" className="button secondary" onClick={() => {
      setBusy(true); setError(''); setCatalog(null); setResult(undefined); reload(value => value + 1)
    }}>Tải lại quyết định</button></>}
    {catalog && !catalog.decisions.length && <p>Ván này không có quyết định phù hợp để thử lại.</p>}
    {catalog && decision && <>
      <label>Quyết định đã thực hiện<select className="text-input" value={decision.sequence} disabled={busy}
        onChange={event => { setSelected(Number(event.target.value)); setResult(undefined); setError('') }}>
        {catalog.decisions.map(item => <option key={item.sequence} value={item.sequence}>
          Vòng {item.lap} · {item.title} · {item.label} (bước {item.sequence})
        </option>)}
      </select></label>
      <Alternatives key={decision.sequence} decision={decision} evaluate={evaluate} disabled={busy} />
    </>}
    {result && <Comparison result={result} />}
  </Modal>
}

export function CloudEndgameWhatIf({ api, sessionId }: { api: Api; sessionId: string }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className="button secondary" onClick={() => setOpen(true)}>Nếu chọn khác thì sao?</button>
    {open && <Analysis api={api} sessionId={sessionId} close={() => setOpen(false)} />}
  </>
}
