import { ASSETS, ECONOMY, MACRO_EVENTS, SCENARIOS } from '../../../src/data/config.ts'
import type { GameState, MarketInstrument, PricePoint, Snapshot, TradableAsset } from '../../../src/game/types.ts'

const assets: TradableAsset[] = ['stocks', 'bonds', 'gold']
const education: Record<TradableAsset, { characteristic: string; lesson: string }> = {
  stocks: { characteristic: 'Mỗi mã có thể đi khác hướng', lesson: 'Tín hiệu tích cực không loại bỏ rủi ro giảm giá. Đừng dùng tiền sắp cần chi.' },
  bonds: { characteristic: `Coupon ${ECONOMY.bond.coupon * 100}% · Giá bán có thể giảm`, lesson: 'Coupon và biến động giá là hai phần khác nhau. Bán trước hạn có thể thu về ít hơn vốn.' },
  gold: { characteristic: 'Không có lãi định kỳ · Có chênh lệch giá bán', lesson: 'Giá tăng chưa chắc đủ bù chênh lệch và phí bán. Hãy xem số tiền thực nhận.' },
}

// Read-only presentation selectors. Never persist forecasts, advance the engine, or draw RNG.
function roundSource(game: GameState, lap: number) {
  if (!Number.isInteger(lap) || lap < 1 || lap > game.lap) return null
  const start = game.log.flatMap(entry => [entry.before, entry.after])
    .find(value => value.lap === lap && value.scenarioId !== '') ?? (lap === game.lap ? game : null)
  if (!start) return null
  const scenario = SCENARIOS.find(value => value.id === start.scenarioId)
  if (!scenario) return null
  // A truncated log starting after a price change cannot establish the opening boundary.
  if (assets.some(asset => instruments(start, asset).some(instrument => instrument.priceHistory.some(point => point.kind !== 'history' && point.lap === lap)))) return null
  const normal = game.log.find(entry => entry.kind === 'market' && entry.after.lap === lap
    && entry.after.market.normalLaps.includes(lap) && !entry.before.market.normalLaps.includes(lap))
  return { start, scenario, endTurn: normal?.after.turn ?? game.turn }
}

export function marketBulletin(game: GameState, lap = game.lap) {
  const source = roundSource(game, lap)
  return {
    available: !!source, lap, forecastId: source?.scenario.id ?? null,
    headline: source?.scenario.label ?? 'Chưa đủ dữ liệu',
    context: source?.scenario.description ?? 'Chưa tìm thấy bản tin đầu vòng này.',
    assets: assets.map(asset => ({ asset, ...ASSETS[asset], ...education[asset],
      forecast: source?.scenario.tendencies[asset] ?? 'Chưa đủ dữ liệu' })),
  }
}

function observations(instrument: MarketInstrument | undefined, lap: number, startTurn: number, endTurn: number, openingPrice?: number): PricePoint[] | null {
  if (!instrument) return null
  const points = instrument.priceHistory.filter(point => point.kind !== 'history' && point.lap === lap
    && point.timestamp >= startTurn && point.timestamp <= endTurn)
  if (!points.length || (openingPrice !== undefined && points[0].priceBefore !== openingPrice) || points.some((point, index) => !Number.isFinite(point.priceBefore) || !Number.isFinite(point.priceAfter)
    || point.priceBefore <= 0 || point.priceAfter <= 0
    || (index > 0 && (point.timestamp < points[index - 1].timestamp || point.priceBefore !== points[index - 1].priceAfter)))) return null
  return points
}

function observedReturn(points: PricePoint[] | null, requireNormal: boolean) {
  if (!points || (requireNormal && !points.some(point => point.kind === 'normal'))) return null
  return points.at(-1)!.priceAfter / points[0].priceBefore - 1
}

function instruments(snapshot: Snapshot, asset: TradableAsset) {
  return asset === 'stocks' ? snapshot.market.stocks : [asset === 'bonds' ? snapshot.market.bond : snapshot.market.gold]
}

export function roundMarketReview(game: GameState, lap = game.lap) {
  const bulletin = marketBulletin(game, lap)
  const source = roundSource(game, lap)
  const endTurn = source ? Math.min(source.endTurn, game.turn) : game.turn
  const result = bulletin.assets.map(item => {
    const values = instruments(game, item.asset).map(instrument => {
      const opening = source ? instruments(source.start, item.asset).find(value => !('id' in instrument) || ('id' in value && value.id === instrument.id)) : undefined
      const points = source && opening ? observations(instrument, lap, source.start.turn, endTurn, opening.currentPrice) : null
      return { label: 'id' in instrument ? String(instrument.id) : item.label, returnRate: observedReturn(points, true) }
    })
    const complete = values.length > 0 && values.every(value => value.returnRate !== null)
    return { ...item, returnRate: complete ? values.reduce((sum, value) => sum + value.returnRate!, 0) / values.length : null,
      instruments: values }
  })
  // Attribute only shocks already present in this round's price history AND public market log.
  // These are annotations to the endpoint return, never extra percentage points to add to it.
  const shockPoints = source ? assets.flatMap(asset => instruments(game, asset).flatMap(instrument =>
    (observations(instrument, lap, source.start.turn, endTurn) ?? []).filter(point => point.kind === 'shock'))) : []
  const unique = new Map<string, { eventId: string; label: string; turn: number }>()
  for (const point of shockPoints) {
    const event = MACRO_EVENTS.find(event => event.id === point.eventId)
    const logged = game.log.some(entry => entry.kind === 'market' && entry.eventId === point.eventId
      && entry.after.lap === lap && entry.after.turn === point.timestamp)
    if (event && logged) unique.set(`${point.timestamp}:${event.id}`, { eventId: event.id, label: event.label, turn: point.timestamp })
  }
  return { lap, forecastId: bulletin.forecastId, headline: bulletin.headline,
    startTurn: source?.start.turn ?? null, endTurn, settled: !!source && game.market.normalLaps.includes(lap),
    assets: result, shocks: [...unique.values()] }
}

export function investmentSignal(game: GameState, asset: TradableAsset, symbolId?: string) {
  const source = roundSource(game, game.lap)
  const instrument = asset === 'stocks' ? game.market.stocks.find(stock => stock.id === (symbolId ?? game.market.stocks[0]?.id))
    : asset === 'bonds' ? game.market.bond : game.market.gold
  const initial = source ? instruments(source.start, asset).find(value => asset !== 'stocks' || ('id' in value && value.id === (symbolId ?? game.market.stocks[0]?.id))) : undefined
  const points = source && initial ? observations(instrument, game.lap, source.start.turn, game.turn, initial.currentPrice) : null
  return { ...marketBulletin(game).assets.find(item => item.asset === asset)!,
    label: asset === 'stocks' && instrument && 'id' in instrument ? String(instrument.id) : ASSETS[asset].label,
    price: points?.at(-1)?.priceAfter ?? initial?.currentPrice ?? null,
    returnRate: observedReturn(points, false), remainingStarts: Math.max(0, game.totalLaps - game.lap + 1),
    saleFee: ECONOMY.tradeFees[asset], spread: asset === 'gold' ? ECONOMY.goldSpread : 0 }
}
