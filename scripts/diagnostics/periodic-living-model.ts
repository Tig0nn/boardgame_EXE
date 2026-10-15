import { advance, canChoose, createGame, decide, fundPayment, roll, transact } from '../../src/game/engine.ts'
import { creditBondLots, creditIssuer } from '../../src/game/bond-credit.ts'
import { borrowingAvailable, fundingSources } from '../../src/game/transactions.ts'
import { liquidatableFunds, victory } from '../../src/game/selectors.ts'
import { ECONOMY } from '../../src/data/config.ts'
import { EVENTS } from '../../src/data/events.ts'
import type { GameState, LivingExpenseRulesVersion, Term } from '../../src/game/types.ts'

export const LIVING_STRATEGIES = ['bank-first', 'stocks', 'gold', 'bonds', 'diversified', 'liquidity'] as const
export type LivingStrategy = typeof LIVING_STRATEGIES[number]

// Fixed heuristics, visible information only. No seed/outcome lookup. Every buy
// uses the current event; sales only occur at START or mandatory funding.
export function livingStrategyStep(s: GameState, strategy: LivingStrategy): GameState {
  if (s.phase === 'rolling') return roll(s)
  if (s.phase === 'funding') {
    const source = fundingSources(s)[0]
    if (!source) throw new Error('Unresolved funding')
    const deposit = s.deposits.find(lot => lot.status === 'active')
    const bond = source === 'bonds' ? creditBondLots(s).find(item => item.quote.executable) : undefined
    const amount = source === 'savings' ? deposit!.principal : source === 'debt' ? Math.min(s.pendingPayment!.remaining, borrowingAvailable(s))
      : source === 'bonds' ? bond!.quote.gross : s.portfolio[source]
    return fundPayment(s, source, amount, source === 'savings' ? deposit!.id : bond?.lot.id)
  }
  if (s.phase === 'rebalancing' && strategy === 'liquidity') {
    for (const asset of ['stocks', 'gold', 'bonds'] as const) {
      const bond = asset === 'bonds' ? creditBondLots(s).find(item => item.quote.executable) : undefined
      const amount = asset === 'bonds' ? bond?.quote.gross ?? 0 : s.portfolio[asset]
      if (amount > 0) return transact(s, { kind: 'sell', asset, amount, lotId: bond?.lot.id })
    }
  }
  if (s.phase !== 'event') return advance(s)
  const reserve = strategy === 'liquidity' ? 20e6 : 10e6
  const budget = Math.max(0, s.portfolio.cash - reserve), id = s.eventId
  if (id === 'bank' && budget >= 1e6 && (strategy === 'bank-first' || strategy === 'diversified')) {
    return transact(s, { kind: 'deposit', amount: Math.floor(budget * (strategy === 'bank-first' ? .85 : .25)),
      term: strategy === 'bank-first' ? Math.min(3, 5 - s.lap) as Term : 1 })
  }
  if ((id === 'stocks' || id === 'gold' || id === 'bonds') && budget >= 1e6
    && (strategy === id || strategy === 'diversified' || strategy === 'liquidity')) {
    if (id !== 'bonds' || creditIssuer(s, 'an-tam').status === 'performing') return transact(s, {
      kind: 'buy', asset: id, amount: Math.floor(Math.min(budget, strategy === 'diversified' || strategy === 'liquidity' ? 5e6 : 15e6)),
      issuerId: id === 'bonds' ? 'an-tam' : undefined, symbolId: s.market.stocks[s.turn % s.market.stocks.length].id })
  }
  if (id === 'business' && strategy === 'diversified') {
    if (s.business.capital > 0 && s.lap >= 3) return transact(s, { kind: 'sell', asset: 'business', amount: s.portfolio.business })
    if (!s.business.capital && s.lap <= 2 && budget >= ECONOMY.business.cost) return transact(s, { kind: 'buy', asset: 'business', amount: ECONOMY.business.cost })
    if (s.business.capital > 0 && s.lap <= 2 && budget >= ECONOMY.business.upgradeCost && s.businessPurchaseTurn !== s.turn
      && !s.log.some(e => e.turn === s.turn && e.decisionId === 'upgrade-business')
      && Object.values(s.business.upgrades).reduce((n, x) => n + x, 0) < ECONOMY.business.maxUpgrades) {
      return transact(s, { kind: 'upgrade', asset: 'business', amount: ECONOMY.business.upgradeCost, customerPreferenceId: s.customerPreferenceId })
    }
  }
  const event = EVENTS.find(e => e.id === id)!
  const choice = id === 'course' && s.lap <= 2 && canChoose(s, 'upgrade') ? 'upgrade'
    : event.options.find(option => option.id === 'skip')?.id ?? event.options.find(option => canChoose(s, option.id))!.id
  return decide(s, choice)
}
export function playLivingGame(seed: string, strategy: LivingStrategy, policy: LivingExpenseRulesVersion): GameState {
  let s = createGame(seed, 20e6, 3, 'experimental-b', undefined, 'v2.4-customer-preferences', 'v2.4-atomic-investments', 'vn-v1', 'v2.5-credit-risk', policy)
  for (let step = 0; s.phase !== 'finished' && step < 500; step++) s = livingStrategyStep(s, strategy)
  if (s.phase !== 'finished') throw new Error(`Deadlock ${seed}/${strategy}`)
  if (s.log.some(e => e.after.portfolio.cash < 0)) throw new Error('Negative cash')
  return s
}
export function livingGameMetrics(s: GameState, strategy: LivingStrategy) {
  const funding = s.log.filter(e => e.kind === 'funding')
  const encounters = s.log.filter(e => e.kind === 'encounter')
  const rolls = s.log.filter(e => e.kind === 'roll')
  const personal = ['medical', 'repair', 'family']
  const livingPaid = s.log.filter(e => e.title === 'Chi phí sinh hoạt').reduce((n, e) => n + e.expensePaid, 0)
  const lateBuys = s.log.filter(e => e.kind === 'rebalancing' && e.lap >= 3 && /^buy-(stocks|bonds|gold)/.test(e.decisionId ?? ''))
  return { seed: s.seed, strategy, won: victory(s).won, funds: liquidatableFunds(s), insolvent: s.termination === 'insolvent',
    cash: s.portfolio.cash, meanTurnCash: rolls.reduce((n, e) => n + e.before.portfolio.cash, 0) / rolls.length,
    livingPaid, livingFunding: funding.filter(e => e.title === 'Chi phí sinh hoạt').length,
    emergencyPaid: s.log.filter(e => personal.includes(e.eventId ?? '') && (e.kind === 'decision' || e.kind === 'funding')).reduce((n, e) => n + e.expensePaid, 0),
    borrowing: funding.filter(e => e.decisionId === 'fund-debt').length,
    savingsWithdrawals: funding.filter(e => e.decisionId === 'fund-savings').length,
    opportunities: Object.fromEntries(['bank', 'stocks', 'bonds', 'gold', 'business', 'course', 'personal'].map(id => [id, encounters.filter(e => id === 'personal' ? personal.includes(e.eventId ?? '') : e.eventId === id).length])),
    lateOpportunities: Object.fromEntries(['stocks', 'bonds', 'gold'].map(id => [id, encounters.filter(e => e.lap >= 3 && e.eventId === id).length])),
    latePurchaseCost: lateBuys.reduce((n, e) => n - e.cashDelta, 0),
    terminalFinancialExposure: s.portfolio.stocks + s.portfolio.gold + s.portfolio.bonds,
    unmaturedBondFace: s.bondLots.filter(lot => lot.status === 'active' && lot.maturityLap > s.totalLaps).reduce((n, lot) => n + lot.principal, 0),
    completedStarts: s.summaries.length,
    dicePath: rolls.map(e => e.after.dice).join(','),
    encounterPath: encounters.map(e => `${e.turn}:${e.tileId}:${e.eventId}`).join(',') }
}
