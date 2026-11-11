import { boardFor } from '../../../../src/data/board.ts'
import { ECONOMY } from '../../../../src/data/config.ts'
import { CUSTOMER_PREFERENCES } from '../../../../src/data/customer-preferences.ts'
import { BOND_ISSUERS } from '../../../../src/data/bond-issuers.ts'
import { creditBondLots } from '../../../../src/game/bond-credit.ts'
import { canChoose, decide, transact } from '../../../../src/game/engine.ts'
import type { GameState, LogEntry, RebalanceAction } from '../../../../src/game/types.ts'
import { requireEndgame } from '../endgame-whatif-contract.ts'
import type { WorkBudget } from '../endgame-whatif-contract.ts'
import { sameExternal } from '../endgame-whatif-fairness.ts'
import { applyRecorded } from '../endgame-whatif-replay.ts'
import { equalData } from '../endgame-whatif-identity.ts'
import type { WhatIfDecision } from './orchestrator.ts'

export type ReplayKind = Exclude<WhatIfDecision['kind'], 'gold'>
export type LegalAlternative = { id: WhatIfDecision['alternativeId']; label: string; principal?: number } & (
  { kind: 'event'; optionId: string } | { kind: 'transaction'; action: RebalanceAction } | { kind: 'retain' }
)
/** Adapters probe native legality at the verified prefix, before any alternative outcome is known. */
export interface DecisionAdapter {
  kind: ReplayKind
  matches(entry: LogEntry): boolean
  alternatives(before: GameState, entry: LogEntry): LegalAlternative[]
}

const bank: DecisionAdapter = {
  kind: 'bank',
  matches: entry => entry.kind === 'decision' && entry.eventId === 'bank' && entry.decisionId === 'skip'
    || entry.kind === 'rebalancing' && entry.action?.kind === 'deposit',
  alternatives: (_before, entry) => [
    ...(entry.kind === 'rebalancing' ? [omitTrade(entry)] : []),
    { id: 'deposit-one-start', label: 'Gửi ngân sách giả định trong một kỳ START',
      kind: 'transaction', action: { kind: 'deposit', amount: 5_000_000, term: 1 }, principal: 5_000_000 },
  ],
}
const course: DecisionAdapter = {
  kind: 'course',
  matches: entry => entry.kind === 'decision' && entry.eventId === 'course' && ['skip', 'course-basic'].includes(entry.decisionId ?? ''),
  alternatives: (_before, entry) => entry.decisionId === 'skip'
    ? [{ id: 'course-basic', label: 'Học khóa cơ bản', kind: 'event', optionId: 'course-basic' }]
    : [{ id: 'skip', label: 'Bỏ qua lần học khóa cơ bản', kind: 'event', optionId: 'skip' }],
}
const advanced: DecisionAdapter = {
  kind: 'advanced',
  matches: entry => entry.kind === 'decision' && entry.eventId === 'course'
    && ['skip', 'course-basic', 'course-advanced'].includes(entry.decisionId ?? ''),
  alternatives: (_before, entry) => entry.decisionId === 'course-advanced'
    ? [{ id: 'skip', label: 'Bỏ qua lần học nâng cao', kind: 'event', optionId: 'skip' },
      { id: 'course-basic', label: 'Thử khóa cơ bản', kind: 'event', optionId: 'course-basic' }]
    : [{ id: 'course-advanced', label: 'Học khóa nâng cao', kind: 'event', optionId: 'course-advanced' }],
}

function omitTrade(entry: LogEntry): LegalAlternative {
  return entry.after.phase === entry.before.phase
    ? { id: 'skip', label: 'Bỏ qua giao dịch này', kind: 'retain' }
    : { id: 'skip', label: 'Bỏ qua giao dịch này', kind: 'event', optionId: 'skip' }
}
function assetAdapter(kind: 'stocks' | 'bonds' | 'business'): DecisionAdapter {
  return {
    kind,
    matches: entry => entry.kind === 'decision' && entry.eventId === kind && entry.decisionId === 'skip'
      || entry.kind === 'rebalancing' && (entry.action?.asset === kind || kind === 'business' && entry.action?.kind === 'upgrade')
        && ['buy', 'sell', 'upgrade'].includes(entry.action?.kind ?? ''),
    alternatives(before, entry) {
      const omitted = entry.kind === 'rebalancing' ? [omitTrade(entry)] : []
      if (kind === 'stocks') return [...omitted,
        { id: 'buy-stocks', label: 'Mua mã đầu tiên trong danh sách đang mở với ngân sách giả định', kind: 'transaction',
          action: { kind: 'buy', asset: 'stocks', amount: 5_000_000, symbolId: before.market.stocks[0].id } },
        { id: 'sell-stocks', label: 'Bán toàn bộ cổ phiếu đang giữ', kind: 'transaction',
          action: { kind: 'sell', asset: 'stocks', amount: before.portfolio.stocks } },
      ]
      if (kind === 'bonds') return [...omitted,
        ...BOND_ISSUERS.map(issuer => ({ id: `buy-bonds:${issuer.id}` as const, label: `Mua trái phiếu ${issuer.name}`,
          kind: 'transaction' as const, action: { kind: 'buy' as const, asset: 'bonds' as const, amount: 5_000_000, issuerId: issuer.id } })),
        ...creditBondLots(before).filter(item => item.quote.executable).map(({ lot, quote }) => ({
          id: `sell-bonds:${lot.id}` as const, label: `Bán toàn bộ khoản ${lot.id}`, kind: 'transaction' as const,
          action: { kind: 'sell' as const, asset: 'bonds' as const, amount: quote.available, lotId: lot.id },
        })),
      ]
      return [...omitted,
        { id: 'buy-business', label: 'Mua cơ sở theo giá vốn trong luật chơi', kind: 'transaction',
          action: { kind: 'buy', asset: 'business', amount: ECONOMY.business.cost } },
        { id: 'sell-business', label: 'Bán toàn bộ cơ sở', kind: 'transaction',
          action: { kind: 'sell', asset: 'business', amount: before.portfolio.business } },
        ...CUSTOMER_PREFERENCES.map(preference => ({ id: `upgrade-business:${preference.id}` as const,
          label: `Nâng cấp theo ${preference.label}`, kind: 'transaction' as const,
          action: { kind: 'upgrade' as const, amount: ECONOMY.business.upgradeCost, customerPreferenceId: preference.id },
        })),
      ]
    },
  }
}
const adapters: Record<ReplayKind, DecisionAdapter> = { bank, course, advanced,
  stocks: assetAdapter('stocks'), bonds: assetAdapter('bonds'), business: assetAdapter('business') }

export function adapterFor(kind: ReplayKind): DecisionAdapter {
  requireEndgame(Object.hasOwn(adapters, kind), 'adapter-unsupported')
  return adapters[kind]
}

export function decisionChoice(adapter: DecisionAdapter, entry: LogEntry, alternative: LegalAlternative): WhatIfDecision {
  return { kind: adapter.kind, decisionId: `${adapter.kind}:${entry.sequence}`, alternativeId: alternative.id, lap: entry.lap, turn: entry.turn }
}

export function forkDecision(adapter: DecisionAdapter, before: GameState, entry: LogEntry,
  alternative: LegalAlternative, work: WorkBudget,
) {
  work.check()
  const context = adapter.kind === 'advanced' ? 'course' : adapter.kind
  const checkpoint = before.phase === 'rebalancing' && entry.kind === 'rebalancing'
    && (entry.action?.kind === 'sell' || adapter.kind === 'bank' && entry.action?.kind === 'deposit')
  requireEndgame(adapter.matches(entry) && (checkpoint || before.phase === 'event' && before.eventId === context
    && boardFor(before)[before.position].type === context) && entry.tileId === before.position
    && entry.sequence === before.log.length + 1 && entry.turn === before.turn && entry.lap === before.lap
    && !before.pendingPayment && !before.settlement && !before.termination, 'adapter-fork-context')
  const actual = applyRecorded(structuredClone(before), entry, work)
  work.step()
  let simulated: GameState
  if (alternative.kind === 'event') {
    requireEndgame(canChoose(before, alternative.optionId), 'adapter-alternative-illegal')
    simulated = decide(structuredClone(before), alternative.optionId)
  } else if (alternative.kind === 'retain') simulated = structuredClone(before)
  else simulated = transact(structuredClone(before), alternative.action)
  if (actual.phase === 'rolling' && simulated.phase === 'event' && simulated.eventId === before.eventId && canChoose(simulated, 'skip')) {
    requireEndgame(entry.kind === 'decision' && entry.decisionId === 'skip', 'adapter-completion-unsupported')
    // An inserted business trade retains the selected historical skip to finish this same encounter.
    simulated = applyRecorded(simulated, entry, work)
  }
  requireEndgame(sameExternal(actual, simulated) && !simulated.pendingPayment, 'adapter-fork-diverged')
  requireEndgame(!equalData(actual, simulated), 'adapter-alternative-unchanged')
  return { actual, alternative: simulated }
}
