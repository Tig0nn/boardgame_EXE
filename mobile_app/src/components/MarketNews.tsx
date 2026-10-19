import { MACRO_EVENTS } from '../../../src/data/config'
import { money, percent } from '../../../src/game/format'
import type { GameState, TradableAsset } from '../../../src/game/types'
import { Icon } from '../../../src/components/Icon'
import { creditRoundReview, investmentSignal, marketBulletin, roundMarketReview } from '../game/market-news'
import { hasBondCredit } from '../../../src/game/bond-credit'
import '../market-news.css'
import { CustomerPreferenceCard } from '../../../src/components/CustomerPreferenceCard'
import { GlossaryText } from '../../../src/components/FinancialTerm'

const policyContext: Record<string, string> = {
  'credit-tightening': 'Cổ phiếu và giá trái phiếu giảm; vàng tăng.',
  'demand-boom': 'Cổ phiếu và giá trái phiếu tăng; vàng giảm.',
  'supply-recovery': 'Tác động khác nhau giữa các ngành; giá trái phiếu và vàng giảm.',
}

export function EconomicBulletin({ game }: { game: GameState }) {
  const news = marketBulletin(game)
  return <section className="market-news" aria-label="Bản tin Kinh tế & Thị trường">
    <span className="section-kicker">BẢN TIN KINH TẾ & THỊ TRƯỜNG · VÒNG {game.lap}</span>
    <h2>{news.headline}</h2><p className="news-context">{news.context}</p>
    <div className="news-assets">{news.assets.map(item => <article key={item.asset}>
      <Icon name={item.icon} size={22} /><div><h3>{item.label}</h3><strong><GlossaryText text={item.forecast} /></strong><small><GlossaryText text={item.characteristic} /></small></div>
    </article>)}</div>
    <CustomerPreferenceCard game={game} />
    <p className="news-reminder">Chừa tiền cho sinh hoạt và khoản đến hạn. Cân nhắc phí bán, khả năng xoay tiền và {game.totalLaps - game.lap + 1} lần qua START còn lại.</p>
    <details><summary>Chi tiết · Đọc tín hiệu thế nào?</summary>
      {news.assets.map(item => <p key={item.asset}><b>{item.label}:</b> {item.lesson}</p>)}
      <p>Dự báo không bảo đảm giá tăng. Giá đổi tại START và khi gặp sự kiện kinh tế. Những tình huống dưới đây có thể xuất hiện trong trò chơi, chưa phải sự kiện sắp xảy ra:</p>
      <ul>{MACRO_EVENTS.map(event => <li key={event.id}><b>{event.label}:</b> {hasBondCredit(game) ? event.id === 'credit-tightening' ? 'Áp lực tín dụng tăng; giá và khả năng trả nợ khác nhau giữa tổ chức phát hành.' : 'Áp lực tín dụng giảm; không đảm bảo tổ chức phát hành trả đúng hạn.' : policyContext[event.id]}</li>)}</ul>
      <p>Giá và tin tức là nội dung trong trò chơi, không phải bản tin hay giá giao dịch thực tế. Tiết kiệm giữ lãi suất cố định theo kỳ hạn; quán dùng sở thích khách trong màn Kinh doanh.</p>
    </details>
  </section>
}

export function ForecastReality({ game, lap }: { game: GameState; lap: number }) {
  const review = roundMarketReview(game, lap)
  return <section className="forecast-reality" aria-label="Dự báo và thực tế">
    <h3>Dự báo và thực tế</h3>
    <p className="news-caption">{review.headline} · {review.settled ? 'Giá đầu vòng → sau START' : 'Chưa đủ dữ liệu cuối vòng'}</p>
    <div className="reality-assets">{review.assets.map(item => <article key={item.asset}>
      <div className="reality-heading"><span><Icon name={item.icon} size={18} /> {item.label}</span>
        <strong className={item.returnRate === null ? '' : item.returnRate >= 0 ? 'positive' : 'negative'}>{item.returnRate === null ? 'Chưa đủ dữ liệu' : percent(item.returnRate)}</strong></div>
      <small>Dự báo: {item.forecast}</small>
    </article>)}</div>
    <p className="news-caption">Biến động giá, không phải lãi của bạn; chưa trừ phí và không gồm lãi trái phiếu định kỳ.</p>
    {hasBondCredit(game) && <details className="credit-reality"><summary>Tín dụng & tiền thực nhận</summary>{creditRoundReview(game, lap).map(issuer => <article key={issuer.id}>
      <strong>{issuer.name}</strong>{!issuer.available ? <p>Chưa đủ dữ liệu</p> : <><small>{issuer.forecast}</small>
        <p>Hạng {issuer.ratingBefore} → {issuer.ratingAfter} · {issuer.status === 'performing' ? 'Trả đúng hạn' : issuer.status === 'delayed' ? 'Chậm trả' : issuer.status === 'defaulted' ? 'Đang thu hồi vốn' : 'Đã xử lý thu hồi'}</p>
        <dl><dt>Biến động giá</dt><dd>{issuer.returnRate === null ? 'Chưa đủ dữ liệu' : issuer.returnRate === -1 ? 'Tạm ngừng giao dịch' : percent(issuer.returnRate)}</dd>
          <dt>Lãi trái phiếu định kỳ đến hạn / nhận</dt><dd>{money(issuer.couponDue)} / {money(issuer.couponPaid)}</dd>
          <dt>Gốc đến hạn / nhận, thu hồi</dt><dd>{money(issuer.principalDue)} / {money(issuer.principalPaid)}</dd>
          <dt>Chưa nhận lãi trái phiếu định kỳ / gốc</dt><dd>{money(issuer.outstandingCoupon)} / {money(issuer.outstandingPrincipal)}</dd>
          <dt>Mất gốc / lãi trái phiếu định kỳ</dt><dd>{money(issuer.principalLost)} / {money(issuer.couponLost)}</dd></dl></>}
    </article>)}</details>}
    <p className="news-caption">{review.shocks.length > 0 ? `${review.shocks.length} sự kiện kinh tế đã tác động; xem bên dưới.` : 'Chưa ghi nhận cú sốc kinh tế trong dữ liệu vòng này.'}</p>
    <details><summary>Điều bạn học được</summary>
      {review.shocks.length > 0 ? <><p>Sự kiện đã tác động trong vòng; mức biến động trên đã gồm tác động này:</p>
        <ul>{review.shocks.map(shock => <li key={`${shock.turn}-${shock.eventId}`}>{shock.label} · Lượt {shock.turn}</li>)}</ul></>
        : <p>Không ghi nhận cú sốc kinh tế trong dữ liệu vòng này. Chênh lệch dự báo có thể đến từ biến động giá thông thường.</p>}
      {review.assets.map(item => <p key={item.asset}><b>{item.label}:</b> {item.lesson}</p>)}
      <p>Cổ phiếu là bình quân biến động của tất cả mã với cùng trọng số, không theo số tiền bạn nắm giữ. Mỗi mã có thể khác nhau:</p>
      <ul>{review.assets[0].instruments.map(item => <li key={item.label}>{item.label}: {item.returnRate === null ? 'Chưa đủ dữ liệu' : percent(item.returnRate)}</li>)}</ul>
      <p>So sánh giá trước biến động đầu tiên của vòng với giá sau cập nhật START. Các đợt tăng/giảm nối tiếp đã được tính một lần, không cộng lại cú sốc. Lãi trái phiếu định kỳ, thời điểm mua/bán và phí khiến kết quả đầu tư của bạn khác biến động giá.</p>
      <p>Một quyết định hợp lý vẫn có thể lỗ. Hãy nhìn cả khoản dự phòng, chi phí và thời gian còn lại.</p>
    </details>
  </section>
}

export function CompactForecastReality({ game, lap }: { game: GameState; lap: number }) {
  const review = roundMarketReview(game, lap)
  return <section className="start-market" aria-label="Thị trường vòng này">
    <h3>Thị trường vòng này</h3>
    <ul>{review.assets.map(item => <li key={item.asset}><span>{item.label}</span>
      <strong className={item.returnRate === null || item.returnRate === 0 ? 'neutral' : item.returnRate > 0 ? 'positive' : 'negative'}>
        {item.returnRate === null ? 'Chưa đủ dữ liệu' : item.returnRate === -1 && item.asset === 'bonds' ? 'Ngừng giao dịch' : percent(item.returnRate)}
      </strong></li>)}</ul>
    <p className="start-caption">Biến động giá; không gồm lãi trái phiếu định kỳ hay phí.</p>
    <details><summary>Xem dự báo và thực tế</summary><ForecastReality game={game} lap={lap} /></details>
  </section>
}

export function MarketSignal({ game, asset, symbolId }: { game: GameState; asset: TradableAsset; symbolId?: string }) {
  const signal = investmentSignal(game, asset, symbolId)
  return <details className="market-signal"><summary>Xem tín hiệu thị trường</summary>
    <strong>{signal.label} · {signal.forecast}</strong>
    <p>Giá hiện tại: {signal.price === null ? 'Chưa đủ dữ liệu' : `${money(signal.price)}/đơn vị`}.
      {' '}Trong vòng: {signal.returnRate === null ? 'Chưa đủ dữ liệu; chưa có biến động giá.' : `${percent(signal.returnRate)} đã xảy ra.`}</p>
    <p>{signal.lesson}</p>
    <p>Phí bán {percent(signal.saleFee).replace('+', '')}{signal.spread > 0 ? ` + chênh lệch ${percent(signal.spread).replace('+', '')}` : ''} · Còn {signal.remainingStarts} lần qua START. Bán tại START hoặc để trả khoản thiếu bắt buộc.</p>
    <p>Giữ đủ tiền cho sinh hoạt và khoản đến hạn. Xem tiền mặt sau giao dịch trước khi chọn mua.</p>
  </details>
}
