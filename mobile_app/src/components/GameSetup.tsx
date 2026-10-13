import { useState } from 'react'
import { Modal } from '../../../src/components/Modal'
import { MoneyInput } from '../../../src/components/MoneyInput'
import { money } from '../../../src/game/format'
import { RULES } from '../../../src/data/config'
import { savingsProfileForMode } from '../../../src/game/savings'
import type { Term } from '../../../src/game/types'

export function GameSetup({ onStart }: { onStart: (seed: string, savings: number, term: Term) => void }) {
  const [savings, setSavings] = useState(20_000_000)
  const [term, setTerm] = useState<Term>(1)
  const [seed, setSeed] = useState('')
  const valid = Number.isSafeInteger(savings) && savings >= 0 && savings <= RULES.startingCapital
  const rates = savingsProfileForMode('experimental-b').rates
  return <Modal title="Bắt đầu hành trình">
    <span className="section-kicker">EXPERIMENTAL B · C20 · 4 VÒNG</span>
    <h2>Xoay Vòng Tiến Lui</h2>
    <p>Vốn {money(RULES.startingCapital)} · Mục tiêu huy động 90 triệu.</p>
    <label htmlFor="initial-savings">Tiết kiệm ban đầu</label>
    <MoneyInput id="initial-savings" amount={savings} onChange={setSavings} invalid={!valid} />
    <label htmlFor="initial-term">Kỳ hạn theo START</label>
    <select id="initial-term" value={term} onChange={e => setTerm(Number(e.target.value) as Term)}>
      {([1, 2, 3] as Term[]).map(value => <option key={value} value={value}>{value} START · {rates[value] * 100}%/START</option>)}
    </select>
    <p>Tiền mặt khởi đầu: {valid ? money(RULES.startingCapital - savings) : 'Số tiền không hợp lệ'}</p>
    <details><summary>Tùy chọn kiểm thử</summary><label htmlFor="mobile-seed">Seed cố định</label>
      <input id="mobile-seed" value={seed} placeholder="Để trống: ván ngẫu nhiên mới" maxLength={128} onChange={e => setSeed(e.target.value)} />
    </details>
    <button className="button primary full-button" disabled={!valid} onClick={() => onStart(seed, savings, term)}>Bắt đầu hành trình</button>
    <details><summary>Luật chơi</summary>
      <p>Chỉ ô dừng kích hoạt sự kiện. Sinh hoạt 7 triệu chỉ khi dừng đúng ô; START nhận lương 14 triệu.</p>
      <p>Mỗi lần gặp Ngân hàng mở một khoản mới; các khoản độc lập, tự đáo hạn, không tự tái tục. Chỉ rút toàn khoản trước hạn khi thiếu tiền bắt buộc và mất lãi chưa trả.</p>
      <p>Mua tài sản đúng ô; START bán cổ phiếu, trái phiếu, vàng. Kinh doanh chỉ bán tại ô Kinh doanh; không bán khẩn cấp.</p>
      <p>Thiếu tiền bắt buộc: kết hợp tiết kiệm, bán tài sản tài chính và vay trong hạn mức 30 triệu, lãi 10%.</p>
      <p>Trải nghiệm thị trường tài chính được mô phỏng trong trò chơi.</p>
    </details>
  </Modal>
}
