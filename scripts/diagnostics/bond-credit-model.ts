import { advance, canChoose, createGame, decide, fundPayment, roll, transact } from '../../src/game/engine.ts'
import { EVENTS } from '../../src/data/events.ts'
import { ECONOMY } from '../../src/data/config.ts'
import { creditBondLots, creditIssuer } from '../../src/game/bond-credit.ts'
import { fundingSources, borrowingAvailable } from '../../src/game/transactions.ts'
import type { BondIssuerId, GameState, Term } from '../../src/game/types.ts'

export const BOND_STRATEGIES = ['bank-first', 'issuer-a', 'issuer-b', 'mixed-bonds', 'liquidity', 'balanced'] as const
export type BondStrategy = typeof BOND_STRATEGIES[number]

// Observable inputs only. No lookup of seed outcomes or future credit events.
export function bondStrategyStep(s: GameState, strategy: BondStrategy): GameState {
  if (s.phase === 'rolling') return roll(s)
  if (s.phase === 'funding') {
    const source = fundingSources(s)[0]
    if (!source) throw new Error('Unresolved funding state')
    const deposit = s.deposits.find(lot => lot.status === 'active')
    const bond = source === 'bonds' ? creditBondLots(s).find(item => item.quote.executable) : undefined
    const amount = source === 'savings' ? deposit!.principal : source === 'debt' ? Math.min(s.pendingPayment!.remaining, borrowingAvailable(s))
      : source === 'bonds' ? bond!.quote.gross : s.portfolio[source]
    return fundPayment(s, source, amount, source === 'savings' ? deposit!.id : bond?.lot.id)
  }
  if (s.phase === 'rebalancing' && strategy === 'liquidity') {
    const bond = creditBondLots(s).find(item => item.quote.executable)
    if (bond) return transact(s, { kind: 'sell', asset: 'bonds', lotId: bond.lot.id, amount: bond.quote.gross })
  }
  if (s.phase !== 'event') return advance(s)
  const reserve = strategy === 'liquidity' ? 20_000_000 : 10_000_000
  const budget = Math.max(0, s.portfolio.cash - reserve), id = s.eventId
  if (id === 'bank' && budget >= 1_000_000 && ['bank-first', 'balanced'].includes(strategy)) {
    return transact(s, { kind: 'deposit', amount: Math.floor(budget * (strategy === 'bank-first' ? .85 : .25)),
      term: strategy === 'bank-first' ? Math.min(3, 5 - s.lap) as Term : 1 })
  }
  if (id === 'bonds' && strategy !== 'bank-first' && budget >= 1_000_000) {
    const desired: BondIssuerId = strategy === 'issuer-b' ? 'but-pha' : strategy === 'mixed-bonds' || strategy === 'balanced'
      ? s.bondLots.filter(lot => lot.credit?.issuerId === 'an-tam').length > s.bondLots.filter(lot => lot.credit?.issuerId === 'but-pha').length ? 'but-pha' : 'an-tam'
      : 'an-tam'
    if (creditIssuer(s, desired).status === 'performing') return transact(s, { kind: 'buy', asset: 'bonds', issuerId: desired,
      amount: Math.floor(Math.min(strategy === 'balanced' ? 5_000_000 : 15_000_000, budget)) })
  }
  if (strategy === 'balanced') {
    if ((id === 'stocks' || id === 'gold') && budget >= 1_000_000) return transact(s, { kind: 'buy', asset: id,
      amount: Math.floor(Math.min(id === 'stocks' ? 5_000_000 : 3_000_000, budget)), symbolId: s.market.stocks[s.turn % s.market.stocks.length].id })
    if (id === 'business') {
      if (s.business.capital > 0 && s.lap >= 3) return transact(s, { kind: 'sell', asset: 'business', amount: s.portfolio.business })
      if (!s.business.capital && s.lap <= 2 && budget >= ECONOMY.business.cost) return transact(s, { kind: 'buy', asset: 'business', amount: ECONOMY.business.cost })
      if (s.business.capital > 0 && s.lap <= 2 && budget >= ECONOMY.business.upgradeCost && s.businessPurchaseTurn !== s.turn
        && !s.log.some(e => e.turn === s.turn && e.decisionId === 'upgrade-business')
        && Object.values(s.business.upgrades).reduce((n, x) => n + x, 0) < ECONOMY.business.maxUpgrades) {
        return transact(s, { kind: 'upgrade', asset: 'business', amount: ECONOMY.business.upgradeCost, customerPreferenceId: s.customerPreferenceId })
      }
    }
  }
  const event = EVENTS.find(event => event.id === id)!
  const choice = id === 'course' && s.lap <= 2 && canChoose(s, 'upgrade') ? 'upgrade'
    : event.options.find(option => option.id === 'skip')?.id ?? event.options.find(option => canChoose(s, option.id))!.id
  return decide(s, choice)
}
export function playBondGame(seed: string, strategy: BondStrategy): GameState {
  let s = createGame(seed, strategy === 'bank-first' ? 30_000_000 : strategy === 'balanced' ? 15_000_000 : 0,
    2, 'experimental-b', undefined, 'v2.4-customer-preferences', 'v2.4-atomic-investments', 'vn-v1', 'v2.5-credit-risk')
  for (let step = 0; s.phase !== 'finished' && step < 400; step++) s = bondStrategyStep(s, strategy)
  if (s.phase !== 'finished') throw new Error(`Deadlock: ${seed}/${strategy}`)
  return s
}
