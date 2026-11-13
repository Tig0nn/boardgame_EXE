import { boardFor } from '../../../../src/data/board.ts'
import { creditBondLots } from '../../../../src/game/bond-credit.ts'
import { transact } from '../../../../src/game/engine.ts'
import { investmentPurchaseUsed, investmentTradeUsed, tileTradingEnabled } from '../../../../src/game/encounters.ts'
import { saleQuote, stockQuote } from '../../../../src/game/selectors.ts'
import type { GameState } from '../../../../src/game/types.ts'
import type { TradePayload } from '../validation.ts'

export function b18TradingAsset(game: GameState) {
  if (game.phase !== 'event' || !tileTradingEnabled(game) || investmentTradeUsed(game)) return null
  const tile = boardFor(game)[game.position].type
  return game.eventId === tile && (tile === 'gold' || tile === 'stocks' || tile === 'bonds') ? tile : null
}

function tradeTerms(game: GameState, action: TradePayload) {
  const { asset, kind } = action
  if (asset !== b18TradingAsset(game)) return null
  const buying = kind === 'buy'
  if (buying && investmentPurchaseUsed(game)) return null

  if (asset === 'gold') {
    return {
      unitPrice: game.market.gold.currentPrice,
      maxAmount: buying ? game.portfolio.cash : game.portfolio.gold,
      units: (state: GameState) => state.goldUnits,
    }
  }
  if (asset === 'stocks') {
    const symbolId = action.symbolId ?? (buying ? game.market.stocks[0].id : undefined)
    if (symbolId === undefined) {
      // Canonical aggregate sales reduce every holding proportionally.
      return { unitPrice: null, maxAmount: game.portfolio.stocks, units: null }
    }
    if (!game.market.stocks.some(stock => stock.id === symbolId)) return null
    const { stock, units } = stockQuote(game, symbolId)
    return {
      unitPrice: stock.currentPrice,
      maxAmount: buying ? game.portfolio.cash : Math.min(game.portfolio.stocks, Math.round(stock.currentPrice * units)),
      units: (state: GameState) => state.stockHoldings[symbolId]?.units ?? 0,
    }
  }
  if (action.kind === 'buy') {
    const issuer = game.bondCredit?.issuers.find(item => item.id === action.issuerId)
    if (!issuer || issuer.status !== 'performing' || issuer.currentPrice <= 0) return null
    return {
      unitPrice: issuer.currentPrice,
      maxAmount: game.portfolio.cash,
      units: (state: GameState) => state.bondLots[game.bondLots.length]?.units ?? 0,
    }
  }
  const item = creditBondLots(game).find(({ lot }) => lot.id === action.lotId)
  if (!item?.quote.executable || !item.lot.credit) return null
  const issuer = game.bondCredit?.issuers.find(issuer => issuer.id === item.lot.credit?.issuerId)
  if (!issuer) throw new Error('Tradable bond lot has no issuer')
  return {
    unitPrice: issuer.currentPrice,
    maxAmount: Math.min(game.portfolio.bonds, item.quote.gross),
    units: (state: GameState) => state.bondLots.find(lot => lot.id === action.lotId)!.units,
  }
}

function executableTerms(game: GameState, action: TradePayload) {
  const terms = tradeTerms(game, action)
  if (!terms || !Number.isSafeInteger(action.amount) || action.amount <= 0 || action.amount > terms.maxAmount) return null
  return terms
}

export function transitionB18Trade(game: GameState, action: TradePayload) {
  return executableTerms(game, action) ? transact(game, action) : null
}

export function quoteB18Trade(game: GameState, action: TradePayload) {
  const terms = executableTerms(game, action)
  if (!terms) return null

  // A quote runs the same pure transition on the restored snapshot without writing it.
  const next = transact(game, action)
  const cashDelta = next.portfolio.cash - game.portfolio.cash
  const buying = action.kind === 'buy'
  const sale = buying ? null : saleQuote(game, action.asset, action.amount, 'lotId' in action ? action.lotId : undefined)
  return {
    unitPrice: terms.unitPrice,
    maxAmount: terms.maxAmount,
    quantity: terms.units ? Math.abs(terms.units(next) - terms.units(game)) : null,
    gross: action.amount,
    fee: sale?.fee ?? 0,
    spread: sale?.spread ?? 0,
    cashPaid: buying ? -cashDelta : 0,
    cashReceived: buying ? 0 : cashDelta,
    cashAfter: next.portfolio.cash,
  }
}
