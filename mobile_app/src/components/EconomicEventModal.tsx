import { Modal } from '../../../src/components/Modal'
import { Icon } from '../../../src/components/Icon'
import { money, percent, signedMoney } from '../../../src/game/format'
import type { GameState } from '../../../src/game/types'
import { buildEconomicEventImpact } from '../game/economic-event'
import type { EventPriceImpact } from '../game/economic-event'
import { issuerPressureChange, issuerPressureDetails } from './market-language'
import '../economic-event.css'

function Movement({ rate }: { rate: number | null }) {
  const direction = rate === null ? 'unavailable' : rate > 0 ? 'up' : rate < 0 ? 'down' : 'flat'
  const label = rate === null ? 'Chưa đủ dữ liệu' : rate > 0 ? 'Giá tăng' : rate < 0 ? 'Giá giảm' : 'Giá không đổi'
  return <strong className={`event-movement ${direction}`} aria-label={rate === null ? label : `${label} ${percent(Math.abs(rate)).replace('+', '')}`}>
    {rate === null ? label : `${rate > 0 ? '↑ ' : rate < 0 ? '↓ ' : '↔ '}${percent(rate)}`}
  </strong>
}
const statusText = { performing: 'Đang trả đúng hạn', delayed: 'Đang chậm trả', defaulted: 'Đang thu hồi vốn', resolved: 'Đã xử lý thu hồi' }
function CreditNote({ item, expanded = false }: { item: EventPriceImpact; expanded?: boolean }) {
  if (!item.credit) return null
  const credit = item.credit
  return <small className="event-credit">{expanded ? issuerPressureDetails(credit.stressBefore, credit.stressAfter) : issuerPressureChange(credit.stressBefore, credit.stressAfter)}
    {credit.statusAfter !== 'performing' && <span>{statusText[credit.statusAfter]}{credit.statusBefore === credit.statusAfter ? ' · Đã có trước biến cố' : ''}</span>}
  </small>
}

export function EconomicEventModal({ game, onChoose, onHelp }: { game: GameState; onChoose: (id: string) => void; onHelp?: () => void }) {
  const impact = buildEconomicEventImpact(game)
  if (!impact) return null
  const hasAssets = Object.values(game.stockHoldings).some(item => item.units > 0)
    || game.bondLots.some(item => item.status === 'active' && item.units > 0) || game.goldUnits > 0 || game.business.capital > 0
  return <Modal title={impact.headline} onHelp={onHelp} className="economic-event">
    <div className="economic-event-scroll">
      <span className="section-kicker">VÒNG {impact.lap} · Ô {impact.tile} · BIẾN CỐ KINH TẾ</span>
      <h2><Icon name="bolt" size={24} /> {impact.headline}!</h2>
      <p className="event-context">{impact.context}</p>
      <section className="event-market" aria-label="Giá thay đổi sau sự kiện">
        <h3>Giá thay đổi sau sự kiện</h3>
        {impact.groups.map(group => <article key={group.asset} className="event-asset" aria-label={group.label}>
          <div className="event-asset-heading"><span><Icon name={group.icon} size={18} />{group.label}</span>
            {group.asset !== 'bonds' || !impact.credit ? <Movement rate={group.returnRate} /> : null}</div>
          {group.asset === 'stocks' && <small>Mức thay đổi trung bình của tất cả cổ phiếu, mỗi mã tính như nhau. Từng mã có thể tăng hoặc giảm khác nhau; đây không phải lãi của bạn.</small>}
          {group.asset === 'bonds' && impact.credit && <div className="event-issuers">{group.items.map(item => <div key={item.id}>
            <div><span>{item.id === 'an-tam' ? 'An Tâm' : 'Bứt Phá'}</span><Movement rate={item.returnRate} /></div>
            <CreditNote item={item} />
          </div>)}</div>}
          {group.asset === 'bonds' && impact.credit && <small>Áp lực tài chính là của bên phát hành trái phiếu, không phải nợ của bạn.</small>}
        </article>)}
        <p className="event-caption">Giá đổi chưa phải tiền lãi/lỗ đã nhận; chưa tính tiền lãi trái phiếu định kỳ hay phí bán.</p>
      </section>
      <p className="event-caption event-personal-impact">{!hasAssets
        ? 'Bạn chưa giữ cổ phiếu, trái phiếu, vàng hay quán. Mức đổi giá trên không phải lãi/lỗ của bạn.'
        : impact.portfolio.length > 0
          ? `Giá trị tài sản bạn đang giữ thay đổi: ${impact.portfolio.map(item => `${item.label} ${signedMoney(item.delta)}`).join('; ')}. Chưa phải tiền bán đã nhận.`
          : 'Chưa đủ dữ liệu để tính thay đổi giá trị tài sản bạn đang giữ.'}</p>
      <aside className="event-lesson" aria-label="Góc nhìn tài chính"><h3>Góc nhìn tài chính</h3><p>{impact.lesson}</p></aside>
      <details className="event-breakdown"><summary>Xem chi tiết thị trường</summary>
        <p className="event-caption">So sánh ngay trước → ngay sau sự kiện. Mức trung bình là trung bình cộng tỷ lệ đổi giá của từng mã: mỗi mã có trọng số bằng nhau, không theo số tiền bạn đầu tư và không phải chỉ số thị trường thực.</p>
        <h3>Cổ phiếu theo ngành</h3>
        {impact.sectors.map(sector => <div className="event-sector" key={sector.id}><span>{sector.label}</span><Movement rate={sector.returnRate} /></div>)}
        {impact.groups.map(group => <section key={group.asset} aria-label={`Chi tiết ${group.label.toLowerCase()}`}>
          <h3>{group.label}</h3>
          {group.items.map(item => <div className="event-instrument" key={item.id}>
            <div><strong>{item.label}</strong><Movement rate={item.returnRate} /></div>
            <small>{item.priceBefore === null || item.priceAfter === null ? 'Chưa đủ dữ liệu' : `${money(item.priceBefore)} → ${money(item.priceAfter)}/đơn vị`}</small>
            {item.credit && <><CreditNote item={item} expanded /><small>Hạng {item.credit.ratingBefore} → {item.credit.ratingAfter} · {statusText[item.credit.statusAfter]}</small></>}
          </div>)}
        </section>)}
        <p className="event-caption">Áp lực tài chính tăng có thể làm bên phát hành khó trả nợ hơn sau này. Giá giảm không đồng nghĩa đã chậm trả hoặc mất vốn. Bối cảnh và giá là nội dung trong trò chơi.</p>
      </details>
      {impact.portfolio.length > 0 && <details className="event-portfolio"><summary>Tài sản của bạn bị ảnh hưởng thế nào?</summary>
        <p className="event-caption">Giá trị trước và sau sự kiện của cùng lượng tài sản đang giữ. Chưa bán nên chưa nhận khoản tiền này; chưa trừ phí bán và nợ. Không phải lãi/lỗ so với số tiền đã bỏ ra mua.</p>
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
