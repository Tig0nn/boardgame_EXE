import { useState } from 'react'
import { RULES } from '../data/config'
import { savingsProfileForMode } from '../game/savings'
import type { GameModeId, Term } from '../game/types'
import { gameMode } from '../data/modes'
import { money } from '../game/format'
import { City } from './City'
import { Icon } from './Icon'
import { GoalChecks } from './GoalChecks'

export function Setup({ onStart }: { onStart: (seed: string, savings: number, term: Term, mode: GameModeId) => void }) {
  const mode: GameModeId = 'experimental-b'
  const selected = gameMode(mode)
  const rates = savingsProfileForMode(mode).rates
  const [savings, setSavings] = useState(20_000_000)
  const [seed, setSeed] = useState('SAIGON-2026')
  const [term, setTerm] = useState<Term>(1)
  return <main className="setup-page">
    <section className="setup-story">
      <span className="eyebrow"><span className="status-dot" /> CHƠI ĐỂ HIỂU TÀI CHÍNH</span>
      <h1>Phố nhỏ.<br /><em>Ước mơ lớn.</em></h1>
      <p className="setup-description">50 triệu khởi đầu. 4 vòng khám phá.<br />Huy động đủ 90 triệu để chạm đích cùng bạn.</p>
      <div className="setup-illustration"><City /><span className="illustration-caption">Một hành trình nhỏ. Những lựa chọn lớn.</span></div>
      <div className="game-facts"><span><strong>01</strong> người chơi</span><span><strong>{String(selected.totalLaps).padStart(2,'0')}</strong> vòng chơi</span><span><strong>20</strong> ô bàn cờ</span></div>
    </section>
    <section className="setup-card">
      <div className="section-kicker"><Icon name="flag" size={18} /> VẠCH XUẤT PHÁT</div>
      <h2>Sẵn sàng dạo phố?</h2><p>Một người chơi · 4 vòng · Bàn C20</p>
      <div className="initial-capital"><span>Vốn ban đầu</span><strong>{money(RULES.startingCapital)}</strong></div>
      <div className="setup-defaults"><span><Icon name="wallet" size={18} /> Tiền mặt <b>{money(RULES.startingCapital - savings)}</b></span><span><Icon name="bank" size={18} /> Tiết kiệm <b>{money(savings)}</b></span></div>
      <button className="button primary start-button" onClick={() => onStart(seed, savings, term, mode)}>Bắt đầu hành trình <Icon name="arrow" /></button>
      <details className="setup-customize"><summary>Tùy chỉnh hành trang <span>Tiết kiệm & mã ván chơi</span></summary>
      <div className="allocation-heading"><label htmlFor="allocation">Phân bổ vào tiết kiệm</label><strong>{money(savings)}</strong></div>
      <input id="allocation" type="range" min="0" max={RULES.startingCapital} step="1000000" value={savings} onChange={e => setSavings(Number(e.target.value))} />
      <div className="range-labels"><span>0 ₫</span><span>50 triệu ₫</span></div>
      <div className="allocation-cards">
        <div><Icon name="wallet" /><span>Tiền mặt</span><strong>{money(RULES.startingCapital - savings)}</strong><small>Sẵn sàng cho mọi cơ hội</small></div>
        <div><Icon name="bank" /><span>Tiết kiệm có kỳ hạn</span><strong>{money(savings)}</strong><small>Lãi game {Math.round(rates[term] * 100)}%/vòng, trả cuối kỳ</small></div>
      </div>
      <label className="seed-label" htmlFor="initial-term">Kỳ hạn khoản gửi đầu ván</label><select id="initial-term" className="text-input" value={term} onChange={event => setTerm(Number(event.target.value) as Term)}>{([1, 2, 3] as Term[]).map(value => <option key={value} value={value}>{value} lần qua START · {Math.round(rates[value] * 100)}% lãi game/vòng</option>)}</select>
      <p className="inline-note"><Icon name="info" size={16} /> Đáo hạn tại START vòng {term}, gốc + {money(Math.round(savings * rates[term] * term))} lãi về tiền mặt. Rút toàn khoản trước hạn mất toàn bộ lãi chưa trả.</p>
      <label className="seed-label" htmlFor="seed">Mã hạt giống <span>Cùng mã, cùng chuỗi ngẫu nhiên</span></label>
      <input id="seed" className="text-input" value={seed} maxLength={64} onChange={e => setSeed(e.target.value)} placeholder="VD: SAIGON-2026" />
      </details>
      <GoalChecks />
      <p className="setup-footnote">Sau {selected.totalLaps} vòng, cần đạt cả hai điều kiện để chiến thắng.</p>
    </section>
    <div className="how-it-works"><span className="eyebrow">NHỊP CHƠI</span><div><span>Đọc dự báo</span><Icon name="arrow" size={15} /><span>Gieo xúc xắc</span><Icon name="arrow" size={15} /><span>Ra quyết định</span><Icon name="arrow" size={15} /><span>Quyết toán vòng</span></div></div>
  </main>
}

