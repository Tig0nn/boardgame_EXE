import { useState } from 'react'
import { Modal } from '../../../src/components/Modal'
import { MoneyInput } from '../../../src/components/MoneyInput'
import { money } from '../../../src/game/format'
import { RULES } from '../../../src/data/config'
import { CORE_MVP_RULES } from '../../../src/game/rules-profile'
import { savingsProfileForMode } from '../../../src/game/savings'
import type { Term } from '../../../src/game/types'
import { SavingsTerms } from '../../../src/components/SavingsTerms'
import type { GameState } from '../../../src/game/types'
import { restoreSavedGame } from '../../../src/game/saved-game'

export function GameSetup({ onStart, onHelp, onRestore, saved, saveNotice }: { onStart: (seed: string, savings: number, term: Term) => void; onHelp: () => void;onRestore?:(game:GameState)=>void;saved?:GameState|null;saveNotice?:string }) {
  const [savings, setSavings] = useState(0)
  const [term, setTerm] = useState<Term>(3)
  const [seed, setSeed] = useState('')
  const [error,setError]=useState('')
  const valid = Number.isSafeInteger(savings) && savings >= 0 && savings <= RULES.startingCapital
  const rates = savingsProfileForMode('experimental-b').rates
  return <Modal title="Bắt đầu hành trình" onHelp={onHelp} className="game-setup">
    <span className="section-kicker">18 Ô · 4 VÒNG · MỘT MỤC TIÊU 90 TRIỆU</span>
    <h2>Sẵn sàng dạo phố?</h2>
    {saved&&onRestore&&<button className="button secondary full-button" onClick={()=>onRestore(saved)}>{saved.phase==='finished'?`Xem lại ván ${saved.boardLayout} đã kết thúc`:`Tiếp tục ván ${saved.boardLayout} · Vòng ${saved.lap}/${saved.totalLaps}`}</button>}
    {saveNotice&&<p role="status">{saveNotice}</p>}
    <div className="setup-goal-card"><div><small>Vốn khởi đầu</small><strong>{money(RULES.startingCapital)}</strong></div><span aria-hidden="true">→</span><div><small>Mục tiêu về đích</small><strong>{money(CORE_MVP_RULES.goal)}</strong></div></div>
    <p>Bạn tự phân bổ 50 triệu. Tiền mặt giúp trả chi phí và đón bất ngờ; không buộc giữ mức dự phòng cố định.</p>
    <label htmlFor="initial-savings">Bạn muốn gửi tiết kiệm bao nhiêu?</label>
    <MoneyInput id="initial-savings" amount={savings} onChange={setSavings} invalid={!valid} />
    <div className="amount-presets" aria-label="Gửi tiết kiệm nhanh">{[0,10_000_000,20_000_000,50_000_000].map(value => <button type="button" key={value} aria-pressed={savings === value} onClick={() => setSavings(value)}>{value / 1_000_000} triệu</button>)}</div>
    {savings===RULES.startingCapital&&<p className="inline-note" role="status">Bạn bắt đầu với 0đ tiền mặt: chưa thể học hoặc mua tài sản. Khi cần trả tiền, rút sớm tiết kiệm mất lãi chưa nhận; vẫn có thể chọn cách này.</p>}
    <SavingsTerms name="initial-term" term={term} rates={rates} onChange={setTerm} />
    <div className="sheet-actions setup-start"><div className="setup-cash"><span>Tiền mặt khởi đầu</span><strong>{valid ? money(RULES.startingCapital - savings) : 'Số tiền không hợp lệ'}</strong></div>
      <button className="button primary full-button" disabled={!valid} onClick={() => onStart(seed, savings, term)}>Bắt đầu hành trình <span aria-hidden="true">→</span></button></div>
    <details><summary>Chơi lại cùng hành trình</summary><label htmlFor="mobile-seed">Mã hành trình</label>
      <input id="mobile-seed" value={seed} placeholder="Để trống để khám phá ván mới" maxLength={128} onChange={e => setSeed(e.target.value)} />
      <p>Cùng mã và lựa chọn ban đầu sẽ có cùng hành trình.</p>
    </details>
    {onRestore&&<details><summary>Mở ván đã lưu</summary><label htmlFor="saved-game-file">Nhật ký JSON · Giữ nguyên phiên bản của ván</label><input id="saved-game-file" type="file" accept=".json,application/json" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>20_000_000)throw Error('File quá lớn.');onRestore(restoreSavedGame(await file.text()))}catch(err){setError(err instanceof Error?err.message:'Không mở được ván.')}}}/>{error&&<p role="alert">{error}</p>}</details>}
  </Modal>
}
