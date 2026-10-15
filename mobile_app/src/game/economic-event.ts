import { ASSETS, MACRO_EVENTS } from '../../../src/data/config.ts'
import { boardFor } from '../../../src/data/board.ts'
import { BOND_ISSUERS } from '../../../src/data/bond-issuers.ts'
import type { Asset, CreditStatus, GameState, Snapshot, TradableAsset } from '../../../src/game/types.ts'

const copy: Record<string, { context: string; lesson: string }> = {
  'credit-tightening': {
    context: 'Bên cho vay thận trọng hơn. Lo ngại về vốn và khả năng trả nợ khiến nhà đầu tư điều chỉnh giá.',
    lesson: 'Một biến cố có thể khiến tài sản này giảm nhưng tài sản khác tăng. Giữ khoản dự phòng và xem cả rủi ro trả nợ trước khi đầu tư.',
  },
  'demand-boom': {
    context: 'Người mua chi tiêu nhiều hơn, mở thêm cơ hội cho doanh nghiệp. Các nhóm tài sản phản ứng khác nhau trước tín hiệu này.',
    lesson: 'Nhu cầu khởi sắc không có nghĩa mọi tài sản đều tăng. Nhìn từng nhóm và số tiền sắp cần dùng, thay vì chạy theo một tín hiệu tốt.',
  },
  'supply-recovery': {
    context: 'Nguyên liệu và hàng hóa lưu thông thuận lợi hơn. Triển vọng các ngành thay đổi, nên giá có thể đi theo những hướng khác nhau.',
    lesson: 'Cùng một tin, mỗi ngành có thể phản ứng khác nhau. Giá đã tăng chưa bảo đảm bạn sẽ có lời sau phí hoặc khi cần bán.',
  },
}

export interface EventPriceImpact {
  id: string; label: string; sector?: string; priceBefore: number | null; priceAfter: number | null; returnRate: number | null
  credit: { stressBefore: number; stressAfter: number; ratingBefore: string; ratingAfter: string;
    statusBefore: CreditStatus; statusAfter: CreditStatus } | null
}
function observation(id: string, label: string, before?: number, after?: number): EventPriceImpact {
  const valid = Number.isFinite(before) && before! > 0 && Number.isFinite(after) && after! >= 0
  return { id, label, priceBefore: valid ? before! : null, priceAfter: valid ? after! : null,
    returnRate: valid ? after! / before! - 1 : null, credit: null }
}
const average = (items: EventPriceImpact[]) => items.length && items.every(item => item.returnRate !== null)
  ? items.reduce((total, item) => total + item.returnRate!, 0) / items.length : null

function portfolioImpact(before: Snapshot, after: Snapshot, groups: Array<{ asset: TradableAsset; items: EventPriceImpact[] }>) {
  const stable = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
  const relevant: Record<Asset, boolean> = {
    stocks: Object.values(before.stockHoldings).some(holding => holding.units > 0) && stable(before.stockHoldings, after.stockHoldings),
    bonds: before.bondLots.some(lot => lot.status === 'active' && lot.units > 0) && stable(before.bondLots, after.bondLots),
    gold: before.goldUnits > 0 && before.goldUnits === after.goldUnits,
    business: before.business.capital > 0 && before.business.capital === after.business.capital && stable(before.business.upgrades, after.business.upgrades),
  }
  // Macro shocks preserve quantities. Use the engine's rounded gross valuations
  // for those same pre-shock holdings, never net sale proceeds or coupon claims.
  return (['stocks', 'bonds', 'gold', 'business'] as Asset[]).flatMap(asset => {
    if (!relevant[asset] || (asset !== 'business' && !groups.find(group => group.asset === asset)?.items.every(item => item.returnRate !== null))) return []
    const first = before.portfolio[asset], last = after.portfolio[asset]
    if (![first, last].every(value => Number.isSafeInteger(value) && value >= 0)) return []
    return [{ asset, label: asset === 'business' ? 'Vốn quán có thể thu hồi' : ASSETS[asset].label,
      before: first, after: last, delta: last - first }]
  })
}

export function buildEconomicEventImpact(game: GameState) {
  const event = MACRO_EVENTS.find(item => item.id === game.eventId)
  if (!event || game.phase !== 'event' || boardFor(game)[game.position]?.type !== 'macro') return null
  const key = `${game.turn}:${event.id}`
  const entry = game.log.findLast(item => item.kind === 'market' && item.eventId === event.id && item.turn === game.turn && item.lap === game.lap
    && item.before?.turn === game.turn && item.after?.turn === game.turn
    && item.before.lap === game.lap && item.after.lap === game.lap
    && item.before.position === game.position && item.after.position === game.position
    && Array.isArray(item.before.market?.appliedShocks) && Array.isArray(item.after.market?.appliedShocks)
    && !item.before.market.appliedShocks.includes(key) && item.after.market.appliedShocks.includes(key))
  const before = entry?.before, after = entry?.after
  const stocks = (before?.market?.stocks ?? game.market.stocks).map(stock => ({
    ...observation(stock.id, stock.id, before?.market?.stocks?.find(item => item.id === stock.id)?.currentPrice,
      after?.market?.stocks?.find(item => item.id === stock.id)?.currentPrice), sector: stock.sector,
  }))
  const credit = game.bondRulesVersion === 'v2.5-credit-risk'
  const bonds = credit ? BOND_ISSUERS.map(issuer => {
    const first = before?.bondCredit?.issuers.find(item => item.id === issuer.id)
    const last = after?.bondCredit?.issuers.find(item => item.id === issuer.id)
    return { ...observation(issuer.id, issuer.name, first?.currentPrice, last?.currentPrice),
      credit: first && last ? { stressBefore: first.stress, stressAfter: last.stress, ratingBefore: first.rating, ratingAfter: last.rating,
        statusBefore: first.status, statusAfter: last.status } : null }
  }) : [observation('legacy-bond', 'Trái phiếu', before?.market?.bond?.currentPrice, after?.market?.bond?.currentPrice)]
  const gold = observation('gold', 'Vàng', before?.market?.gold?.currentPrice, after?.market?.gold?.currentPrice)
  const groups: Array<{ asset: TradableAsset; label: string; icon: string; items: EventPriceImpact[]; returnRate: number | null }> = [
    { asset: 'stocks', ...ASSETS.stocks, items: stocks, returnRate: average(stocks) },
    { asset: 'bonds', ...ASSETS.bonds, items: bonds, returnRate: credit ? null : bonds[0].returnRate },
    { asset: 'gold', ...ASSETS.gold, items: [gold], returnRate: gold.returnRate },
  ]
  const sectorNames: Record<string, string> = { technology: 'Công nghệ', banking: 'Ngân hàng', manufacturing: 'Sản xuất' }
  return { id: event.id, headline: event.label, ...copy[event.id], lap: game.lap, tile: game.position + 1, turn: game.turn,
    available: !!entry, credit, groups,
    sectors: [...new Set(stocks.map(item => item.sector))].map(id => ({ id, label: sectorNames[id] ?? id,
      returnRate: average(stocks.filter(item => item.sector === id)) })),
    portfolio: before && after ? portfolioImpact(before, after, groups) : [] }
}
