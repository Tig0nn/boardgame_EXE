import { useState } from 'react'
import { Modal } from '../../../src/components/Modal'
import { MoneyInput } from '../../../src/components/MoneyInput'
import { money } from '../../../src/game/format'
import { RULES } from '../../../src/data/config'
import { savingsProfileForMode } from '../../../src/game/savings'
import type { Term } from '../../../src/game/types'

export function GameSetup({ onStart, onHelp }: { onStart: (seed: string, savings: number, term: Term) => void; onHelp: () => void }) {
  const [savings, setSavings] = useState(20_000_000)
  const [term, setTerm] = useState<Term>(1)
  const [seed, setSeed] = useState('')
  const valid = Number.isSafeInteger(savings) && savings >= 0 && savings <= RULES.startingCapital
  const rates = savingsProfileForMode('experimental-b').rates
  return <Modal title="Bắt đầu hành trình" onHelp={onHelp} className="game-setup">
    <span className="section-kicker">MỘT NGƯỜI CHƠI · 4 VÒNG</span>
    <h2>Sẵn sàng dạo phố?</h2>
    <p>Khởi đầu {money(RULES.startingCapital)}. Chinh phục 90 triệu!</p>
    <label htmlFor="initial-savings">Tiết kiệm ban đầu</label>
    <MoneyInput id="initial-savings" amount={savings} onChange={setSavings} invalid={!valid} />
    <label htmlFor="initial-term">Kỳ hạn tiết kiệm</label>
    <select id="initial-term" value={term} onChange={e => setTerm(Number(e.target.value) as Term)}>
      {([1, 2, 3] as Term[]).map(value => <option key={value} value={value}>{value} lần qua START · Lãi {rates[value] * 100}%/kỳ</option>)}
    </select>
    <p>Tiền mặt khởi đầu: {valid ? money(RULES.startingCapital - savings) : 'Số tiền không hợp lệ'}</p>
    <button className="button primary full-button" disabled={!valid} onClick={() => onStart(seed, savings, term)}>Bắt đầu hành trình</button>
    <details><summary>Chơi lại cùng hành trình</summary><label htmlFor="mobile-seed">Mã hành trình</label>
      <input id="mobile-seed" value={seed} placeholder="Để trống để khám phá ván mới" maxLength={128} onChange={e => setSeed(e.target.value)} />
      <p>Cùng mã và lựa chọn ban đầu sẽ có cùng hành trình.</p>
    </details>
  </Modal>
}
