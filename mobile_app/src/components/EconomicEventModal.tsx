import { Modal } from '../../../src/components/Modal'
import { Icon } from '../../../src/components/Icon'
import { money, percent, signedMoney } from '../../../src/game/format'
import type { GameState } from '../../../src/game/types'
import { buildEconomicEventImpact } from '../game/economic-event'
import type { EventPriceImpact } from '../game/economic-event'
import '../economic-event.css'

function Movement({ rate }: { rate: number | null }) {
  const direction = rate === null ? 'unavailable' : rate > 0 ? 'up' : rate < 0 ? 'down' : 'flat'
  const label = rate === null ? 'Chưa đủ dữ liệu' : rate > 0 ? 'Giá tăng' : rate < 0 ? 'Giá giảm' : 'Giá không đổi'
  return <strong className={`event-movement ${direction}`} aria-label={rate === null ? label : `${label} ${percent(Math.abs(rate)).replace('+', '')}`}>
    {rate === null ? label : `${rate > 0 ? '↑ ' : rate < 0 ? '↓ ' : '↔ '}${percent(rate)}`}
  </strong>
}
const statusText = { performing: 'Đang trả đúng hạn', delayed: 'Đang chậm trả', defaulted: 'Đang thu hồi vốn', resolved: 'Đã xử lý thu hồi' }
function CreditNote({ item }: { item: EventPriceImpact }) {
  if (!item.credit) return null
  const credit = item.credit
  return <small className="event-credit">Áp lực trả nợ {credit.stressBefore}/2 → {credit.stressAfter}/2
    {credit.statusAfter !== 'performing' && <span>{statusText[credit.statusAfter]}{credit.statusBefore === credit.statusAfter ? ' · Đã có trước biến cố' : ''}</span>}
  </small>
}

export function EconomicEventModal({ game, onChoose, onHelp }: { game: GameState; onChoose: (id: string) => void; onHelp?: () => void }) {
  const impact = buildEconomicEventImpact(game)
  if (!impact) return null
  return <Modal title={impact.headline} onHelp={onHelp} className="economic-event">
    <div className="economic-event-scroll">
      <span className="section-kicker">VÒNG {impact.lap} · Ô {impact.tile} · BIẾN CỐ KINH TẾ</span>
      <h2><Icon name="bolt" size={24} /> {impact.headline}!</h2>
      <p className="event-context">{impact.context}</p>
      <section className="event-market" aria-label="Thị trường vừa phản ứng">
        <h3>Thị trường vừa phản ứng</h3>
        {impact.groups.map(group => <article key={group.asset} className="event-asset" aria-label={group.label}>
          <div className="event-asset-heading"><span><Icon name={group.icon} size={18} />{group.label}</span>
            {group.asset !== 'bonds' || !impact.credit ? <Movement rate={group.returnRate} /> : null}</div>
          {group.asset === 'stocks' && <small>Bình quân đều các mã</small>}
          {group.asset === 'bonds' && impact.credit && <div className="event-issuers">{group.items.map(item => <div key={item.id}>
            <div><span>{item.id === 'an-tam' ? 'An Tâm' : 'Bứt Phá'}</span><Movement rate={item.returnRate} /></div>
            <CreditNote item={item} />
          </div>)}</div>}
        </article>)}
        <p className="event-caption">Đổi giá do biến cố vừa xảy ra; không phải tiền lãi/lỗ đã nhận, không gồm lãi trái phiếu định kỳ hay phí.</p>
      </section>
      <aside className="event-lesson" aria-label="Góc nhìn tài chính"><h3>Góc nhìn tài chính</h3><p>{impact.lesson}</p></aside>
      <details className="event-breakdown"><summary>Xem chi tiết thị trường</summary>
        <p className="event-caption">So sánh giá ngay trước → ngay sau cùng biến cố. Bình quân ngành dùng trọng số bằng nhau giữa các mã, không theo danh mục của bạn.</p>
        <h3>Cổ phiếu theo ngành</h3>
        {impact.sectors.map(sector => <div className="event-sector" key={sector.id}><span>{sector.label}</span><Movement rate={sector.returnRate} /></div>)}
        {impact.groups.map(group => <section key={group.asset} aria-label={`Chi tiết ${group.label.toLowerCase()}`}>
          <h3>{group.label}</h3>
          {group.items.map(item => <div className="event-instrument" key={item.id}>
            <div><strong>{item.label}</strong><Movement rate={item.returnRate} /></div>
            <small>{item.priceBefore === null || item.priceAfter === null ? 'Chưa đủ dữ liệu' : `${money(item.priceBefore)} → ${money(item.priceAfter)}/đơn vị`}</small>
            {item.credit && <><CreditNote item={item} /><small>Hạng {item.credit.ratingBefore} → {item.credit.ratingAfter} · {statusText[item.credit.statusAfter]}</small></>}
          </div>)}
        </section>)}
        <p className="event-caption">Tín dụng xấu đi có thể ảnh hưởng khả năng trả nợ sau này; biến động giá không tự xác nhận chậm trả hay mất vốn. Bối cảnh và giá là nội dung trong trò chơi.</p>
      </details>
      {impact.portfolio.length > 0 && <details className="event-portfolio"><summary>Tài sản của bạn bị ảnh hưởng thế nào?</summary>
        <p className="event-caption">Thay đổi định giá chưa thực hiện, theo tài sản nắm ngay trước biến cố. Không phải tiền mặt nhận/chi hoặc nguồn tiền về đích sau phí và nợ.</p>
        {impact.portfolio.map(item => <div className="event-instrument" key={item.asset}>
          <div><strong>{item.label}</strong><strong className={`event-movement ${item.delta > 0 ? 'up' : item.delta < 0 ? 'down' : 'flat'}`}>{signedMoney(item.delta)}</strong></div>
          <small>{money(item.before)} → {money(item.after)}</small>
          {item.asset === 'business' && <small>Chỉ là giá trị vốn thu hồi; không tính thu nhập vận hành quán.</small>}
        </div>)}
      </details>}
    </div>
    <footer className="economic-event-actions"><button className="button primary full-button" onClick={() => onChoose('acknowledge')}>Đã hiểu · Tiếp tục</button></footer>
  </Modal>
}
