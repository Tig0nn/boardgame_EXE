import { creditBondLots } from '../../../../src/game/bond-credit.ts'
import { fundingSources } from '../../../../src/game/engine.ts'
import { borrowingAvailable } from '../../../../src/game/transactions.ts'
import type { FundingSource, GameState } from '../../../../src/game/types.ts'

type FundingOption = {
  source: FundingSource
  lotId?: string
  minAmount: number
  maxAmount: number
}

export function b18FundingOptions(game: GameState): FundingOption[] {
  if (game.phase !== 'funding' || !game.pendingPayment) return []

  const { remaining } = game.pendingPayment
  return fundingSources(game).flatMap((source): FundingOption[] => {
    switch (source) {
      case 'savings':
        return game.deposits.filter(lot => lot.status === 'active').map(lot => ({
          source, lotId: lot.id, minAmount: lot.principal, maxAmount: lot.principal,
        }))
      case 'bonds':
        return creditBondLots(game).filter(({ quote }) => quote.executable).map(({ lot, quote }) => ({
          source, lotId: lot.id, minAmount: 1, maxAmount: quote.gross,
        }))
      case 'debt':
        return [{ source, minAmount: 1, maxAmount: Math.min(remaining, borrowingAvailable(game)) }]
      default:
        return [{ source, minAmount: 1, maxAmount: game.portfolio[source] }]
    }
  })
}

export function canFundB18(game: GameState, source: FundingSource, amount: number, lotId?: string) {
  // When no savings lot is specified, the engine selects the first active lot.
  const option = b18FundingOptions(game).find(item =>
    item.source === source && (item.lotId === lotId || (source === 'savings' && lotId === undefined)))
  return !!option && amount >= option.minAmount && amount <= option.maxAmount
}
