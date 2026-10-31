import { Modal } from '../../../src/components/Modal'
import { money } from '../../../src/game/format'
import type { RepairOutcome, RepairWhatIf } from '../../../src/game/what-if'
import './what-if.css'

function OutcomeCard({ outcome, actual }: { outcome: RepairOutcome; actual: boolean }) {
  const paid = outcome.status === 'paid'
  return <section className={`whatif-card ${actual ? 'whatif-actual' : 'whatif-alternative'}`} aria-label={actual ? 'Actual · Bạn đã chọn' : 'What-if · Nếu chọn khác'}>
    <span className="whatif-label">{actual ? 'ACTUAL · BẠN ĐÃ CHỌN' : 'WHAT-IF · NẾU CHỌN KHÁC'}</span>
    <h3>{outcome.choice === 'full' ? 'Sửa ngay' : 'Sửa tạm'}</h3>
    <span className="whatif-cash-label">Tiền mặt sau quyết định</span>
    <strong className="whatif-cash">{money(outcome.cashAfter)}</strong>
    <dl>
      <div><dt>Đã thanh toán ngay</dt><dd>{money(outcome.paidNow)}</dd></div>
      {!paid && <div><dt>Còn thiếu ngay</dt><dd>{money(outcome.fundingRemaining)}</dd></div>}
      <div><dt>Nghĩa vụ mới tại Xuất phát</dt><dd>{money(outcome.obligationAdded)}</dd></div>
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
  return <Modal title="Nếu tôi chọn cách khác?" onClose={onClose} className="whatif-modal">
    <header className="whatif-heading"><span className="whatif-premium">✨ PREMIUM · WHAT-IF</span>
      <h2>Nếu tôi chọn cách khác?</h2>
      <p>Cùng một sự kiện. Hai cách dùng tiền.</p>
    </header>
    <div className="whatif-before"><span>Tiền mặt trước quyết định</span><strong>{money(comparison.cashBefore)}</strong></div>
    <div className="whatif-cards"><OutcomeCard outcome={comparison.actual} actual /><OutcomeCard outcome={comparison.alternative} actual={false} /></div>
    <section className="whatif-lesson" aria-label="Bài học tài chính"><h3>💡 Giữ tiền hôm nay có giá của nó</h3>
      <p>Sửa tạm giữ lại <strong>{money(comparison.temporaryCashKept)}</strong> tiền mặt ngay lúc này, nhưng tổng chi phí theo lựa chọn cao hơn <strong>{money(comparison.temporaryExtraCost)}</strong>.</p>
      <p>Trả ít hôm nay không có nghĩa là trả ít hơn. Hãy dành sẵn tiền cho nghĩa vụ ở lần qua Xuất phát tiếp theo.</p>
    </section>
    <p className="whatif-scope">Chỉ mô phỏng tác động tại thời điểm quyết định. Chưa mô phỏng các lượt sau, thu nhập hay thanh toán ở Xuất phát. Ván đang chơi được giữ nguyên.</p>
    <button className="whatif-back" onClick={onClose}>← Quay về ván đang chơi</button>
  </Modal>
}
