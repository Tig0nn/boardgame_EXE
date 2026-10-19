import { useState } from 'react'
import { ECONOMY, MACRO_EVENTS, SECTORS } from '../data/config'
import { money, percent } from '../game/format'
import { saleQuote } from '../game/selectors'
import type { GameState, MarketInstrument, TradableAsset } from '../game/types'
import { hasBondCredit } from '../game/bond-credit'
import { BondHoldings } from './BondHoldings'
import { bondIssuer } from '../data/bond-issuers'
import { FinancialTerm } from './FinancialTerm'

export function PriceChart({ instrument, label }: { instrument: MarketInstrument; label: string }) {
  const history = instrument.priceHistory
  const prices = history.map(point => point.priceAfter)
  const low = Math.min(...prices); const high = Math.max(...prices)
  const x = (index: number) => 12 + index / Math.max(1, prices.length - 1) * 276
  const y = (price: number) => 108 - (price - low) / Math.max(1, high - low) * 88
  return <figure className="price-chart"><figcaption>{label} · Lịch sử đã xảy ra (giả lập)</figcaption>
    <svg viewBox="0 0 300 124" role="img" aria-label={`${label}: ${money(prices[0])} đến ${money(instrument.currentPrice)}; ${history.filter(point => point.kind === 'shock').length} cú sốc`}>
      <polyline points={prices.map((price, index) => `${x(index)},${y(price)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" />
      {history.map((point, index) => point.kind === 'shock' && <circle key={index} cx={x(index)} cy={y(point.priceAfter)} r="4" className="shock-marker"><title>{MACRO_EVENTS.find(event => event.id === point.eventId)?.label} · Lượt {point.timestamp} · {money(point.priceAfter)}</title></circle>)}
    </svg>
    <small>{money(low)} – {money(high)} · Hiện tại {money(instrument.currentPrice)} · So với điểm đầu biểu đồ {prices[0] > 0 ? percent(instrument.currentPrice / prices[0] - 1) : 'Chưa đủ dữ liệu'}</small>
    {history.filter(point => point.kind === 'shock').map((point, index) => <small key={index}>● {MACRO_EVENTS.find(event => event.id === point.eventId)?.label} · Vòng {point.lap}, lượt {point.timestamp}: {percent(point.returnRate)}</small>)}
  </figure>
}

export function MarketDetails({ game, asset, symbolId }: { game: GameState; asset: TradableAsset; symbolId?: string }) {
  const [selected, setSelected] = useState(game.market.stocks[0].id)
  if (asset === 'stocks') {
    const stock = game.market.stocks.find(stock => stock.id === (symbolId ?? selected))!
    const holding = game.stockHoldings[stock.id]
    return <div className="market-details">{!symbolId && <><label htmlFor="view-symbol">Mã cổ phiếu</label><select id="view-symbol" className="text-input" value={selected} onChange={event => setSelected(event.target.value)}>{game.market.stocks.map(stock => <option key={stock.id} value={stock.id}>{stock.id} · {stock.name}</option>)}</select></>}
      <p><b>{stock.name}</b> · {SECTORS[stock.sector]} · Biến động riêng ±{stock.volatility * 100}%/vòng (tham số thử nghiệm)</p>
      <p>Giá mua {money(stock.currentPrice)}/đơn vị · Phí bán {ECONOMY.tradeFees.stocks * 100}% · Đang giữ {(holding?.units ?? 0).toFixed(4)} đơn vị</p>
      <PriceChart instrument={stock} label={stock.id} />
    </div>
  }
  if (asset === 'gold') return <div className="market-details"><p>Người chơi mua: <b>{money(game.market.gold.currentPrice)}</b>/đơn vị</p><p>Người chơi bán: <b>{money(Math.round(game.market.gold.currentPrice * (1 - ECONOMY.goldSpread) * (1 - ECONOMY.tradeFees.gold)))}</b>/đơn vị · <FinancialTerm term="spread" /> {ECONOMY.goldSpread * 100}% + phí {ECONOMY.tradeFees.gold * 100}%</p><p>Giá vốn bình quân của bạn: {game.goldUnits > 0 ? money(Math.round(game.goldCostBasis / game.goldUnits)) : 'Chưa mua'} · Không có lãi định kỳ.</p><PriceChart instrument={game.market.gold} label="Vàng" /></div>
  if (hasBondCredit(game)) return <div className="market-details"><BondHoldings game={game} />
    {game.bondCredit!.issuers.map(issuer => <section key={issuer.id}><h3>{bondIssuer(issuer.id).name} · Hạng {issuer.rating}</h3>
      {issuer.priceHistory.length > 0 ? <PriceChart instrument={issuer} label={bondIssuer(issuer.id).name} /> : <p>Chưa đủ dữ liệu giá. Giá hiện tại {money(issuer.currentPrice)}.</p>}</section>)}</div>
  const active = game.bondLots.filter(lot => lot.status === 'active')
  return <div className="market-details"><p><b>{ECONOMY.bond.issuer}</b></p><p>Giá mua {money(game.market.bond.currentPrice)} · <FinancialTerm term="faceValue" /> {money(ECONOMY.bond.facePrice)} · <FinancialTerm term="coupon" /> {ECONOMY.bond.coupon * 100}% mệnh giá/vòng · Kỳ hạn {ECONOMY.bond.term} START.</p><p>{ECONOMY.bond.creditRisk}</p><p>Bán trước hạn danh mục: {money(saleQuote(game, 'bonds').net)} sau phí {ECONOMY.tradeFees.bonds * 100}%; giá có thể thấp hơn vốn.</p>
    <p>Khoản mua mới: lãi trái phiếu định kỳ tại START vòng {game.lap}{ECONOMY.bond.term > 1 ? ` đến ${game.lap + ECONOMY.bond.term - 1}` : ''}; hoàn gốc tại START vòng {game.lap + ECONOMY.bond.term - 1}.{game.lap + ECONOMY.bond.term - 1 > game.totalLaps ? ' Chưa hoàn gốc trong màn, có thể bán theo giá hiện hành.' : ''}</p>
    {active.map(lot => <p key={lot.id}>{lot.id}: lãi trái phiếu định kỳ {money(Math.round(lot.principal * ECONOMY.bond.coupon))}/START đến vòng {lot.maturityLap}; hoàn gốc {money(Math.round(lot.principal))} vòng {lot.maturityLap}.</p>)}
  </div>
}
