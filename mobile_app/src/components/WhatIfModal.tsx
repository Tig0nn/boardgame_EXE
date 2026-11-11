import { Modal } from '../../../src/components/Modal'
import { money } from '../../../src/game/format'
import type { RepairOutcome, RepairWhatIf } from '../../../src/game/what-if'
import { analyzeRepairWhatIf } from '../../../src/game/what-if-analysis'
import { compactRepairCopy } from './what-if-copy'
import './what-if.css'

function OutcomeCard({ outcome, actual }: { outcome: RepairOutcome; actual: boolean }) {
  const paid = outcome.status === 'paid'
  return <section className={`whatif-card ${actual ? 'whatif-actual' : 'whatif-alternative'}`} aria-label={actual ? 'Actual · Bạn đã chọn' : 'What-if · Nếu chọn khác'}>
    <h3><span className="whatif-label">{actual ? 'BẠN ĐÃ CHỌN' : 'NẾU CHỌN KHÁC'} —</span>
      <span className="whatif-choice">{outcome.choice === 'full' ? 'SỬA NGAY' : 'SỬA TẠM'}</span></h3>
    <span className="whatif-cash-label">Tiền mặt còn lại</span>
    <strong className="whatif-cash">{money(outcome.cashAfter)}</strong>
    <dl>
      <div><dt>Trả ngay</dt><dd>{money(outcome.paidNow)}</dd></div>
      {!paid && <div><dt>Còn thiếu ngay</dt><dd>{money(outcome.fundingRemaining)}</dd></div>}
      <div><dt>Nghĩa vụ mới ở Xuất phát</dt><dd>{money(outcome.obligationAdded)}</dd></div>
      <div className="whatif-total"><dt>Tổng chi phí cam kết{!paid ? '*' : ''}</dt><dd>{money(outcome.totalCommitted)}</dd></div>
    </dl>
    {!paid && <p className="whatif-warning" role="note">
      {outcome.status === 'insolvent' ? 'Không còn nguồn thanh toán hợp lệ.' : 'Chưa hoàn tất thanh toán. Cần chọn nguồn tiền để trả phần còn thiếu.'}
      {' '}Yêu cầu trả ngay: {money(outcome.immediateDue)}.
      {outcome.obligationOnCompletion > 0 && <> Nghĩa vụ {money(outcome.obligationOnCompletion)} chỉ phát sinh sau khi trả đủ.</>}
      {' '}*Chi phí theo lựa chọn, chưa gồm phí hoặc lãi huy động vốn.
    </p>}
  </section>
}

export function WhatIfModal({ comparison, onClose }: { comparison: RepairWhatIf; onClose: () => void }) {
  const analysis = analyzeRepairWhatIf(comparison)
  const copy = compactRepairCopy(comparison, analysis)
  return <Modal title="Nếu tôi chọn cách khác?" onClose={onClose} className="whatif-modal">
    <header className="whatif-heading"><span className="whatif-premium">✨ PREMIUM · WHAT-IF</span>
      <h2>Nếu tôi chọn cách khác?</h2>
      <p>Cùng một sự kiện. Hai cách dùng tiền.</p>
    </header>
    {analysis.status !== 'invalid' && <>
      <div className="whatif-before"><span>Tiền mặt trước quyết định</span><strong>{money(comparison.cashBefore)}</strong></div>
      <div className="whatif-cards"><OutcomeCard outcome={comparison.actual} actual /><OutcomeCard outcome={comparison.alternative} actual={false} /></div>
    </>}
    <section className="whatif-quick" aria-label="Kết luận nhanh">
      <h3>Kết luận nhanh</h3>
      {copy.quick.map((text, i) => <p key={text}>{i === 0 ? <strong>{text}</strong> : text}</p>)}
    </section>
    <section className="whatif-lesson" aria-label="Bài học tài chính">
      <h3>Điểm cần nhớ</h3>
      <ul>{copy.insights.map(insight => <li key={insight.id} data-insight={insight.id}>{insight.text}</li>)}</ul>
    </section>
    <p className="whatif-scope">Chỉ mô phỏng tác động tại thời điểm quyết định. Chưa mô phỏng các lượt sau, thu nhập hay thanh toán ở Xuất phát. Ván đang chơi được giữ nguyên.</p>
    <button className="whatif-back" onClick={onClose}><span aria-hidden="true">‹ </span>Tiếp tục ván chơi</button>
  </Modal>
}
