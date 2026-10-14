import { useState } from 'react'
import { Modal } from '../../../src/components/Modal'
import { MoneyInput } from '../../../src/components/MoneyInput'
import { money } from '../../../src/game/format'
import { RULES } from '../../../src/data/config'
import { savingsProfileForMode } from '../../../src/game/savings'
import type { Term } from '../../../src/game/types'
import { SavingsTerms } from '../../../src/components/SavingsTerms'

export function GameSetup({ onStart, onHelp }: { onStart: (seed: string, savings: number, term: Term) => void; onHelp: () => void }) {
  const [savings, setSavings] = useState(20_000_000)
  const [term, setTerm] = useState<Term>(1)
  const [seed, setSeed] = useState('')
  const valid = Number.isSafeInteger(savings) && savings >= 0 && savings <= RULES.startingCapital
  const rates = savingsProfileForMode('experimental-b').rates
  return <Modal title="Bắt đầu hành trình" onHelp={onHelp} className="game-setup">
    <span className="section-kicker">HÀNH TRÌNH TÀI CHÍNH · 4 VÒNG</span>
    <h2>Sẵn sàng dạo phố?</h2>
    <div className="setup-goal-card"><div><small>Vốn khởi đầu</small><strong>{money(RULES.startingCapital)}</strong></div><span aria-hidden="true">→</span><div><small>Mục tiêu về đích</small><strong>{money(RULES.goal + RULES.cashGoal)}</strong></div></div>
    <label htmlFor="initial-savings">Tiết kiệm ban đầu</label>
    <MoneyInput id="initial-savings" amount={savings} onChange={setSavings} invalid={!valid} />
    <div className="amount-presets" aria-label="Gửi tiết kiệm nhanh">{[10_000_000, 20_000_000, 30_000_000].map(value => <button type="button" key={value} aria-pressed={savings === value} onClick={() => setSavings(value)}>{value / 1_000_000} triệu</button>)}</div>
    <SavingsTerms name="initial-term" term={term} rates={rates} onChange={setTerm} />
    <div className="sheet-actions setup-start"><div className="setup-cash"><span>Tiền mặt khởi đầu</span><strong>{valid ? money(RULES.startingCapital - savings) : 'Số tiền không hợp lệ'}</strong></div>
      <button className="button primary full-button" disabled={!valid} onClick={() => onStart(seed, savings, term)}>Bắt đầu hành trình <span aria-hidden="true">→</span></button></div>
    <details><summary>Chơi lại cùng hành trình</summary><label htmlFor="mobile-seed">Mã hành trình</label>
      <input id="mobile-seed" value={seed} placeholder="Để trống để khám phá ván mới" maxLength={128} onChange={e => setSeed(e.target.value)} />
      <p>Cùng mã và lựa chọn ban đầu sẽ có cùng hành trình.</p>
    </details>
  </Modal>
}
