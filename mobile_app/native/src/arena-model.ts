import { boardFor } from '../../../src/data/board.ts'
import { ECONOMY } from '../../../src/data/config.ts'
import { eventsForGame } from '../../../src/data/events.ts'
import { canChoose } from '../../../src/game/engine.ts'
import { businessMatchingKey, businessUpgradeUnlocked } from '../../../src/game/business.ts'
import { currentCustomerPreference } from '../../../src/game/customer-preferences.ts'
import { creditBondLots } from '../../../src/game/bond-credit.ts'
import { encounterActionUsed, investmentPurchaseUsed } from '../../../src/game/encounters.ts'
import { money, percent } from '../../../src/game/format.ts'
import { goalForGame } from '../../../src/game/rules-profile.ts'
import { savingsProfileForGame } from '../../../src/game/savings.ts'
import { businessOverview, liquidatableFunds, purchasePreview, saleQuote, totalWorth, victory } from '../../../src/game/selectors.ts'
import { borrowingAvailable, fundingSources } from '../../../src/game/transactions.ts'
import type { GameState, RebalanceAction, Term, FundingSource, Portfolio, LapSummary } from '../../../src/game/types.ts'
import { paymentOptionCopy } from '../../../src/components/financial-decision-copy.ts'
import { investmentLotLabel, tileDisplayLabel } from '../../../src/components/player-language.ts'
import { getLapQuarterInsight } from '../../src/game/market-news.ts'
import type { OfficialResult, ServerState } from '../../src/game/cloud-contract.ts'
import type { MobileCommand } from '../../src/game/session.ts'
import { projectLearningContext } from '../../src/game/mascot-learning-context.ts'
import { boardPeek } from '../../src/game/board-peek.ts'

export type FixedChoice = { label: string; note?: string; command: MobileCommand; skip?: boolean }
export type TradeChoice = { label: string; note?: string; min: number; max: number; command: MobileCommand }
type Journal = Pick<ServerState['journal'][number], 'sequence' | 'lap' | 'kind' | 'title' | 'decision' | 'consequence'>
export type Arena = {
  phase: GameState['phase']; lap: number; totalLaps: number; position: number; dice: number
  portfolio: Portfolio; proceeds: number; target: number; totalWorth: number; obligations: number
  eventId: string | null; board: ReturnType<typeof boardFor>; reachable: number[]; journal: Journal[]
  title: string; note?: string; fixed: FixedChoice[]; trades: TradeChoice[]; summary?: LapSummary
  result: OfficialResult; finishedLaps: number; local?: GameState
  learning: ReturnType<typeof projectLearningContext>
  coachCards: { id: string; title: string; text: string }[]
  businessDetails?: Pick<ServerState['business'], 'owned' | 'purchaseCost' | 'initialSaleValue' | 'currentSaleValue' | 'currentStartIncome' | 'currentCustomerPreference'> & {
    baseIncome: number; matchingBonus: number; cashAfterPurchase?: number | null
  }
}
const fundingNames: Record<FundingSource, string> = {
  savings: 'Rút tiết kiệm', bonds: 'Bán trái phiếu', stocks: 'Bán cổ phiếu', gold: 'Bán vàng', debt: 'Vay nợ',
}
const terms = [1, 2, 3] as const
const sellNames = { bonds: 'Bán trái phiếu', stocks: 'Bán cổ phiếu', gold: 'Bán vàng' }
const assetName = { bonds: 'Trái phiếu', stocks: 'Cổ phiếu', gold: 'Vàng' }
const exact = (label: string, action: RebalanceAction, note?: string): FixedChoice => ({ label, note, command: { type: 'trade', action } })
const varying = (label: string, max: number, action: RebalanceAction, note?: string): TradeChoice => ({
  label, note, min: 1, max, command: { type: 'trade', action },
})
export function setAmount(item: TradeChoice, amount: number): MobileCommand {
  if (item.command.type === 'trade') return { type: 'trade', action: { ...item.command.action, amount } }
  if (item.command.type === 'fund') return { ...item.command, amount }
  throw new Error('Expected a financial amount')
}
const enabled = (items: TradeChoice[]) => items.filter(item => item.max >= item.min)

function eventChoices(game: Pick<GameState, 'gameplayProfile' | 'eventId'>, options: ServerState['options']): FixedChoice[] {
  const event = eventsForGame(game).find(event => event.id === game.eventId)
  return options.map(option => {
    const copy = event && paymentOptionCopy({ ...event, options }, option)
    return { label: copy?.label ?? option.label, note: [copy?.detail ?? option.detail, copy?.comparison].filter(Boolean).join(' '),
      command: { type: 'choose', id: option.id }, skip: option.id === 'skip' }
  })
}

type Quotes = {
  stocks: { id: string; currentPrice: number }[]
  bonds: { id: 'an-tam' | 'but-pha'; currentPrice: number; rating: string }[]
  gold: { currentPrice: number }
}
function buys(asset: 'gold' | 'stocks' | 'bonds', quotes: Quotes, cash: number): TradeChoice[] {
  switch (asset) {
    case 'gold': return [varying('Mua vàng', cash, { kind: 'buy', asset, amount: 0, completeEncounter: true }, 'Giá ' + money(quotes.gold.currentPrice))]
    case 'stocks': return quotes.stocks.map(item => varying('Mua cổ phiếu · ' + item.id, cash,
      { kind: 'buy', asset, amount: 0, symbolId: item.id, completeEncounter: true }, 'Giá ' + money(item.currentPrice)))
    case 'bonds': return quotes.bonds.map(item => varying('Mua trái phiếu · ' + (item.id === 'an-tam' ? 'An Tâm' : 'Bứt Phá'), cash,
      { kind: 'buy', asset, amount: 0, issuerId: item.id, completeEncounter: true }, item.rating + ' · Giá ' + money(item.currentPrice)))
  }
}
const deposits = (cash: number, rates: Record<Term, number>) => terms.map(term => varying(
  'Gửi tiết kiệm · ' + term + ' kỳ', cash, { kind: 'deposit', amount: 0, term },
  percent(rates[term]) + ' mỗi kỳ · Nhận gốc và lãi khi đáo hạn',
))
const repay = (max: number) => varying('Trả nợ', max, { kind: 'repay', amount: 0 })
const funding = ({ source, lotId, minAmount: min, maxAmount: max }: ServerState['fundingOptions'][number]): TradeChoice => ({
  label: fundingNames[source] + (lotId && (source === 'savings' || source === 'bonds') ? ' · ' + investmentLotLabel(source, lotId) : ''),
  min, max, command: { type: 'fund', source, lotId, amount: min },
})
const businessAction = (action: RebalanceAction, note?: string) => exact(
  (action.kind === 'buy' ? 'Mở quán' : action.kind === 'sell' ? 'Bán toàn cơ sở' : 'Nâng cấp cơ sở') + ' · ' + money(action.amount), action, note,
)
const advance = (label: string): FixedChoice => ({ label, command: { type: 'advance' } })
function heading(source: Pick<GameState, 'phase' | 'lap' | 'totalLaps' | 'eventId' | 'pendingPayment'>, event?: { title: string; description: string } | null) {
  switch (source.phase) {
    case 'forecast': {
      const info = getLapQuarterInsight(source.lap)
      return { title: info.periodName, fixed: [advance('Bắt đầu vòng ' + source.lap)] }
    }
    case 'funding': return { title: 'Huy động vốn', note: 'Còn phải thanh toán ' + money(source.pendingPayment?.remaining ?? 0), fixed: [] }
    case 'summary': return { title: 'Khép lại vòng ' + source.lap, fixed: [advance(source.lap === source.totalLaps ? 'Đến quyết toán cuối ván' : 'Ghé ví tại ô Xuất phát')] }
    case 'rebalancing': return { title: 'Ghé ví tại ô Xuất phát', fixed: [advance(source.lap === source.totalLaps ? 'Xem kết quả hành trình' : 'Bắt đầu vòng mới')] }
    case 'event': return { title: event?.title ?? 'Quyết định tài chính', note: event?.description, fixed: [] }
    default: return { title: '', fixed: [] }
  }
}
function base(source: Pick<GameState, 'boardLayout' | 'boardRevision' | 'gameplayProfile' | 'phase' | 'lap' | 'totalLaps' | 'position' | 'dice' | 'portfolio' | 'eventId' | 'obligations' | 'pendingLanding' | 'pendingPayment'>) {
  return { phase: source.phase, lap: source.lap, totalLaps: source.totalLaps, position: source.position,
    dice: source.dice, portfolio: source.portfolio, eventId: source.eventId, obligations: source.obligations,
    board: boardFor(source), reachable: boardPeek(source).destinations.map(item => item.tile.index) }
}
function sale({ asset, lotId, symbolId, maxAmount }: ServerState['start']['sales'][number]) {
  const label = lotId ? investmentLotLabel('bonds', lotId) : symbolId ?? assetName[asset]
  return varying(sellNames[asset] + ' · ' + label, maxAmount, { kind: 'sell', asset, amount: 0, lotId, symbolId })
}

export function fromServer(state: ServerState, result: OfficialResult): Arena {
  const header = heading(state, state.event)
  const fixed = [...header.fixed]
  const choices: TradeChoice[] = []
  if (state.phase === 'event') {
    fixed.push(...eventChoices(state, state.options))
    if (state.tradingAsset) choices.push(...buys(state.tradingAsset, state.market, state.portfolio.cash))
    if (state.bank.canDeposit) choices.push(...deposits(state.portfolio.cash, state.bank.savingsRates))
    fixed.push(...state.business.actions.map(action => businessAction(action,
      action.kind === 'upgrade' ? state.business.specializations.find(s => s.id === action.customerPreferenceId)?.label
        : 'Dòng tiền tại START ' + money(state.business.currentStartIncome))))
  }
  if (state.phase === 'funding') choices.push(...state.fundingOptions.map(funding))
  if (state.phase === 'rebalancing') choices.push(...state.start.sales.map(sale))
  if (state.bank.canRepay) choices.push(repay(Math.min(state.portfolio.cash, state.portfolio.debt)))
  return { ...base(state), ...header, fixed, trades: enabled(choices), journal: state.journal,
    businessDetails: { ...state.business, baseIncome: ECONOMY.business.baseIncome, matchingBonus: ECONOMY.business.matchingBonus },
    proceeds: state.bank.liquidatableFunds, totalWorth: state.bank.totalWorth, target: goalForGame(state).target,
    summary: state.start.summary ?? state.summaries.at(-1), result, finishedLaps: state.summaries.length,
    learning: state.fox?.learningContext ?? null, coachCards: state.fox?.cards ?? [] }
}

export function fromLocal(game: GameState): Arena {
  const event = eventsForGame(game).find(item => item.id === game.eventId)
  const header = heading(game, event)
  const fixed = [...header.fixed]
  const choices: TradeChoice[] = []
  const cash = game.portfolio.cash
  if (game.phase === 'event') {
    fixed.push(...eventChoices(game, event?.options.filter(option => canChoose(game, option.id)) ?? []))
    if (game.eventId === 'bank' && !encounterActionUsed(game, 'deposit')) choices.push(...deposits(cash, savingsProfileForGame(game).rates))
    if ((game.eventId === 'gold' || game.eventId === 'stocks' || game.eventId === 'bonds') && !investmentPurchaseUsed(game)) {
      choices.push(...buys(game.eventId, { ...game.market, bonds: game.bondCredit?.issuers.filter(item => item.status === 'performing') ?? [] }, cash))
    }
    if (game.eventId === 'business') {
      const overview = businessOverview(game)
      if (!game.business.capital && cash >= ECONOMY.business.cost) {
        fixed.unshift(businessAction({ kind: 'buy', asset: 'business', amount: ECONOMY.business.cost }))
      } else if (game.business.capital && game.businessPurchaseTurn !== game.turn) {
        if (overview.sale > 0) fixed.unshift(businessAction({ kind: 'sell', asset: 'business', amount: overview.sale }))
        const preference = businessMatchingKey(game)
        if (businessUpgradeUnlocked(game) && cash >= ECONOMY.business.upgradeCost &&
            (preference === 'checkin' || preference === 'budget' || preference === 'taste')) {
          fixed.unshift(businessAction({ kind: 'upgrade', asset: 'business', amount: ECONOMY.business.upgradeCost, customerPreferenceId: preference }))
        }
      }
    }
  }
  if (game.phase === 'rebalancing') {
    choices.push(sale({ asset: 'gold', maxAmount: game.portfolio.gold }))
    for (const item of game.market.stocks) {
      choices.push(sale({ asset: 'stocks', symbolId: item.id,
        maxAmount: Math.round((game.stockHoldings[item.id]?.units ?? 0) * item.currentPrice) }))
    }
    for (const { lot, quote } of creditBondLots(game)) if (quote.executable) choices.push(sale({ asset: 'bonds', lotId: lot.id, maxAmount: quote.gross }))
  }
  if (game.phase === 'funding') {
    for (const source of fundingSources(game)) {
      if (source === 'savings') {
        for (const lot of game.deposits.filter(item => item.status === 'active')) choices.push(funding({ source, lotId: lot.id, minAmount: lot.principal, maxAmount: lot.principal }))
      } else if (source === 'bonds') {
        for (const { lot, quote } of creditBondLots(game)) if (quote.executable) choices.push(funding({ source, lotId: lot.id, minAmount: 1, maxAmount: quote.gross }))
      } else {
        const maxAmount = source === 'debt' ? Math.min(borrowingAvailable(game), game.pendingPayment?.remaining ?? 0) : game.portfolio[source]
        choices.push(funding({ source, minAmount: 1, maxAmount }))
      }
    }
  }
  if (game.phase === 'rebalancing' && game.portfolio.debt) choices.push(repay(Math.min(cash, game.portfolio.debt)))
  const proceeds = liquidatableFunds(game)
  const business = businessOverview(game)
  return { ...base(game), ...header, fixed, trades: enabled(choices), local: game, journal: game.log,
    businessDetails: game.customerPreferenceId ? { owned: game.business.capital > 0, purchaseCost: ECONOMY.business.cost,
      initialSaleValue: business.initialSale, currentSaleValue: business.sale, currentStartIncome: business.income,
      baseIncome: ECONOMY.business.baseIncome, matchingBonus: ECONOMY.business.matchingBonus,
      cashAfterPurchase: purchasePreview(game, ECONOMY.business.cost).cashAfter,
      currentCustomerPreference: currentCustomerPreference(game) } : undefined,
    proceeds, totalWorth: totalWorth(game), target: goalForGame(game).target,
    summary: game.summaries.at(-1), finishedLaps: game.summaries.length,
    result: game.phase === 'finished' ? { outcome: game.termination === 'insolvent' ? 'insolvent' : victory(game).won ? 'victory' : 'defeat',
      lawfulProceedsVnd: String(proceeds) } : null,
    learning: projectLearningContext(game), coachCards: [] }
}

export function assetLabel(asset: keyof Portfolio) {
  return { cash: 'Tiền mặt', savings: 'Tiết kiệm', stocks: 'Cổ phiếu', bonds: 'Trái phiếu',
    gold: 'Vàng', business: 'Kinh doanh', debt: 'Dư nợ' }[asset]
}
export function tileLabel(arena: Arena, position: number) { return tileDisplayLabel(arena.board[position]?.label ?? '') }
export function localQuote(game: GameState, action: RebalanceAction) {
  if (!('asset' in action && action.asset) || action.kind !== 'sell' || action.asset === 'business') return null
  return saleQuote(game, action.asset, action.amount, action.lotId)
}
