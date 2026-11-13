import type { GameState, LogEntry, RebalanceAction } from '../../../../src/game/types.ts'
import { creditBondLots } from '../../../../src/game/bond-credit.ts'
import { requireEndgame } from '../endgame-whatif-contract.ts'
import { adapterFor } from './decision-adapters.ts'
import type { DecisionAdapter, LegalAlternative, ReplayKind } from './decision-adapters.ts'
import { parameterAlternativeId } from './orchestrator.ts'
import type { DecisionParameters, WhatIfDecision } from './orchestrator.ts'
import type { HistoricalDecision, HistoryLocator } from './natural-language.ts'
import { money } from '../../../../src/game/format.ts'

export type CatalogQuery = { mode: 'history'; offset: number; limit?: number; locator?: HistoryLocator }
  | { mode: 'alternatives'; sequence: number; offset: number; limit?: number; parameters?: DecisionParameters }
export type { HistoricalDecision } from './natural-language.ts'
export type DecisionControls = { cash: number; stockSellMax: number; symbols: string[]; issuers: string[];
  lots: { id: string; available: number }[]; terms: (1 | 2 | 3)[] }
export type CatalogPage = { history: HistoricalDecision[]; decisions: WhatIfDecision[]; controls?: DecisionControls;
  offset: number; total: number; nextOffset: number | null }

export function flexibleAdapterFor(kind: ReplayKind): DecisionAdapter {
  const adapter = adapterFor(kind)
  if (kind !== 'course') return adapter
  return { ...adapter, matches: adapterFor('advanced').matches,
    alternatives: () => [
      { id: 'skip', label: 'Bỏ qua lần học', kind: 'event', optionId: 'skip' },
      { id: 'course-basic', label: 'Học khóa cơ bản', kind: 'event', optionId: 'course-basic' },
      { id: 'course-advanced', label: 'Học khóa nâng cao', kind: 'event', optionId: 'course-advanced' },
    ] }
}

export function parameterAlternative(kind: ReplayKind, parameters: DecisionParameters): LegalAlternative {
  const id = parameterAlternativeId(kind, parameters)
  requireEndgame(id, 'adapter-parameters-invalid')
  let action: RebalanceAction
  if (kind === 'bank') action = { kind: 'deposit', amount: parameters.amount, term: parameters.term }
  else if (kind === 'stocks') action = { kind: parameters.operation as 'buy' | 'sell', asset: 'stocks', amount: parameters.amount, symbolId: parameters.symbolId }
  else action = { kind: parameters.operation as 'buy' | 'sell', asset: 'bonds', amount: parameters.amount,
    ...(parameters.operation === 'buy' ? { issuerId: parameters.issuerId as 'an-tam' | 'but-pha' } : { lotId: parameters.lotId }) }
  return { id, label: 'Phương án do người chơi chọn', kind: 'transaction', action,
    ...(kind === 'bank' ? { principal: parameters.amount } : {}) }
}

export function prefixControls(before: GameState): DecisionControls {
  return { cash: before.portfolio.cash, stockSellMax: before.portfolio.stocks,
    symbols: before.market.stocks.map(stock => stock.id),
    issuers: (before.bondCredit?.issuers ?? []).filter(issuer => issuer.status === 'performing' && issuer.currentPrice > 0).map(issuer => issuer.id),
    lots: creditBondLots(before).filter(item => item.quote.executable).map(({ lot, quote }) => ({ id: lot.id, available: quote.available })),
    terms: [1, 2, 3] }
}

export function historyDecision(entry: LogEntry): HistoricalDecision {
  const action = entry.action
  const target = action?.symbolId ?? action?.issuerId ?? action?.lotId ?? ''
  const amount = action ? ` · ${money(action.amount)}${action.term ? ` · ${action.term} START` : ''}` : ''
  return { sequence: entry.sequence, lap: entry.lap, turn: entry.turn, action: entry.decisionId ?? entry.kind,
    ...Object.fromEntries(['symbolId', 'issuerId', 'lotId'].filter(key => action?.[key as keyof RebalanceAction] !== undefined)
      .map(key => [key, action![key as keyof RebalanceAction]])),
    description: `${entry.decision ?? entry.decisionId ?? entry.kind}${target ? ` · ${target}` : ''}${amount}`.slice(0, 240) }
}
