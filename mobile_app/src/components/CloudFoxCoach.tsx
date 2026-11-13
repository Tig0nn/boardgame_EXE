import { ASSETS } from '../../../src/data/config'
import { money, signedMoney } from '../../../src/game/format'
import type { createGameApi, ServerState } from '../game/server-session'
import { MascotLearningPanel } from './MascotLearningPanel'

export type CloudFoxSource = {
  api: Pick<ReturnType<typeof createGameApi>, 'coachLearn'>
  evidence: ServerState['fox']
  sessionId: string
  stateVersion: number
}

const fundingLabels = { savings: 'Tiết kiệm', gold: 'Vàng', stocks: 'Cổ phiếu', bonds: 'Trái phiếu', debt: 'Vay nợ' }

function CoachEvidence({ value }: { value: ServerState['fox'] }) {
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

export function CloudFoxCoach({ api, sessionId, stateVersion, evidence }: CloudFoxSource) {
  return <div className="mascot-learning">
    <CoachEvidence value={evidence} />
    <MascotLearningPanel context={evidence.learningContext}
      onlineAsk={(question, signal) => api.coachLearn(sessionId, stateVersion, question, signal, true)} />
  </div>
}
