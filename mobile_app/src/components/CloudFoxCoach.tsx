import { useEffect, useState } from 'react'
import type { FoxCoachReply } from '../../../apps/api/src/services/fox-coach'
import { ASSETS } from '../../../src/data/config'
import { money, signedMoney } from '../../../src/game/format'
import { apiMessage } from '../game/server-session'
import type { createGameApi } from '../game/server-session'
import { MascotLearningPanel } from './MascotLearningPanel'

export type CloudFoxSource = {
  api: Pick<ReturnType<typeof createGameApi>, 'coach' | 'coachLearn'>
  sessionId: string
  stateVersion: number
}

const fundingLabels = { savings: 'Tiết kiệm', gold: 'Vàng', stocks: 'Cổ phiếu', bonds: 'Trái phiếu', debt: 'Vay nợ' }

function CoachEvidence({ value }: { value: FoxCoachReply }) {
  const { evidence } = value
  const { position } = evidence
  return <div className="mascot-learning-answer" aria-label="Cáo giải thích từ ván đã lưu">
    <p className="mascot-explanation-source">Dữ kiện từ ván đã lưu · Vòng {position.lap}</p>
    {value.cards.map(card => <section key={card.id}>
      <p><strong>{card.title}</strong></p>
      <p>{card.text}</p>
    </section>)}
    <details>
      <summary>Số liệu trong ván</summary>
      <ul>
        {Object.entries(ASSETS).map(([id, asset]) => <li key={id}>{asset.label} · {money(position.portfolio[id as keyof typeof ASSETS])}</li>)}
        <li>Nghĩa vụ đã ghi nhận · {money(position.obligationsVnd)}</li>
        <li>Hạn mức còn có thể vay · {money(position.borrowingAvailableVnd)}</li>
        {position.deposits.filter(item => item.status === 'active').map(item =>
          <li key={item.id}>Gốc tiết kiệm {money(item.principal)} · Đáo hạn vòng {item.maturityLap}</li>)}
      </ul>
      {position.fundingOptions.length > 0 && <>
        <p>Nguồn huy động đang mở</p>
        <ul>{position.fundingOptions.map(option =>
          <li key={option.source + (option.lotId ?? '')}>{fundingLabels[option.source]} · tối đa {money(option.maxAmount)}</li>)}</ul>
      </>}
      {evidence.start && <ul aria-label={'Dòng tiền START vòng ' + evidence.start.lap}>
        {evidence.start.lines.map((line, index) => <li key={index}>{line.label} · {signedMoney(line.amount)}</li>)}
      </ul>}
    </details>
  </div>
}

export function CloudFoxCoach({ api, sessionId, stateVersion }: CloudFoxSource) {
  const [result, setResult] = useState<FoxCoachReply>()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void api.coach(sessionId, stateVersion, controller.signal)
      .then(value => { if (!controller.signal.aborted) setResult(value) })
      .catch(problem => { if (!controller.signal.aborted) setError(apiMessage(problem)) })
    return () => controller.abort()
  }, [api, sessionId, stateVersion, attempt])

  return <div className="mascot-learning">
    {!result && !error && <p role="status">Đang đọc dữ kiện ván…</p>}
    {error && <><p role="alert">{error}</p><button type="button" onClick={() => {
      setError(''); setAttempt(value => value + 1)
    }}>Thử lại Cáo</button></>}
    {result && <CoachEvidence value={result} />}
    <MascotLearningPanel context={null} onlineAsk={(question, signal) => api.coachLearn(sessionId, stateVersion, question, signal)} />
  </div>
}
