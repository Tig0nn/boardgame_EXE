// Research only. Never imported by either player application.
import { EVENTS } from '../../src/data/events.ts'
import { ECONOMY, RULES } from '../../src/data/config.ts'
import { createPlayerGame } from '../../src/game/new-game.ts'
import { advance, decide, fundPayment, roll, transact } from '../../src/game/engine.ts'
import { borrowingAvailable, fundingSources } from '../../src/game/transactions.ts'
import { liquidatableFunds, saleQuote, victory } from '../../src/game/selectors.ts'
import type { GameState, RebalanceAction, Term } from '../../src/game/types.ts'

export const strategies = ['reserve-saver', 'mixed-investor', 'aggressive-saver'] as const
export type Strategy = typeof strategies[number]
export type LotPolicy = 'A' | 'B'

export function researchAction(s: GameState, strategy: Strategy, policy: LotPolicy): RebalanceAction | null {
  const remaining = s.totalLaps - s.lap + 1
  const reserve = strategy === 'aggressive-saver' ? 2e6 : 10e6
  const excess = Math.max(0, s.portfolio.cash - reserve)
  if (s.eventId === 'bank') {
    if (policy === 'B' && s.deposits.some(lot => lot.status === 'active')) return null
    const amount = Math.floor(excess * (strategy === 'reserve-saver' ? .85 : strategy === 'mixed-investor' ? .5 : 1))
    if (amount < 1e6) return null
    return { kind: 'deposit', amount, term: Math.min(strategy === 'mixed-investor' ? 2 : 3, remaining) as Term }
  }
  if (strategy !== 'mixed-investor') return null
  if (s.eventId === 'business') {
    if (s.business.capital && s.lap >= 3) return { kind: 'sell', asset: 'business', amount: s.portfolio.business }
    if (!s.business.capital && s.lap === 1 && excess >= ECONOMY.business.cost) return { kind: 'buy', asset: 'business', amount: ECONOMY.business.cost }
    if (s.business.capital && s.lap <= 2 && s.businessPurchaseTurn !== s.turn && excess >= ECONOMY.business.upgradeCost &&
      !s.log.some(e => e.turn === s.turn && e.decisionId === 'upgrade-business') &&
      Object.values(s.business.upgrades).reduce((sum, n) => sum + n, 0) < ECONOMY.business.maxUpgrades)
      return { kind: 'upgrade', asset: 'business', amount: ECONOMY.business.upgradeCost, customerPreferenceId: s.customerPreferenceId }
  }
  if (['stocks', 'bonds', 'gold'].includes(s.eventId ?? '') &&
    !s.log.some(e => e.turn === s.turn && e.kind === 'rebalancing')) {
    const asset = s.eventId as 'stocks' | 'bonds' | 'gold'
    if (asset === 'bonds' && remaining < ECONOMY.bond.term || asset === 'stocks' && s.scenarioId === 'uncertain') return null
    const amount = Math.floor(excess * .4)
    if (amount >= 1e6) return { kind: 'buy', asset, amount, symbolId: s.market.stocks[s.turn % 6].id, ...(asset === 'stocks' ? { completeEncounter: true } : {}) }
  }
  return null
}

export function researchStep(s: GameState, strategy: Strategy, policy: LotPolicy): GameState {
  if (s.phase === 'rolling') return roll(s)
  if (s.phase === 'funding') {
    const source = fundingSources(s)[0]
    if (!source) throw new Error('Engine failed to terminate insolvency')
    if (source === 'savings') {
      const lot = s.deposits.find(lot => lot.status === 'active')!
      return fundPayment(s, source, lot.principal, lot.id)
    }
    if (source === 'debt') return fundPayment(s, source, Math.min(s.pendingPayment!.remaining, borrowingAvailable(s)))
    let low = 1; let high = s.portfolio[source]
    if (saleQuote(s, source, high).net >= s.pendingPayment!.remaining) {
      while (low < high) { const mid = Math.floor((low + high) / 2); if (saleQuote(s, source, mid).net >= s.pendingPayment!.remaining) high = mid; else low = mid + 1 }
    }
    return fundPayment(s, source, high)
  }
  if (s.phase === 'event') {
    const action = researchAction(s, strategy, policy)
    if (action) return transact(s, action)
    const event = EVENTS.find(event => event.id === s.eventId)!
    const option = s.eventId === 'course' && !s.coursePurchased && s.lap <= 3 && s.portfolio.cash >= RULES.courseCost
      ? 'upgrade' : event.options.find(option => option.id === 'skip')?.id ?? event.options[0].id
    return decide(s, option)
  }
  // Hold financial instruments at START; the final selector includes net sale proceeds.
  return advance(s)
}

export function playSavingsPolicy(seed: string, strategy: Strategy, policy: LotPolicy, initialSavings: number, compact = true) {
  let s = createPlayerGame(seed, initialSavings, 3)
  let earlyWithdrawals = 0; let interestForfeited = 0; let cashSamples = 0; let cashTotal = 0
  let bankEncounters = 0; let bankDeposits = 0; let choices = 0; let depositOpportunities = 0
  let path = ''; let steps = 0
  while (s.phase !== 'finished' && steps++ < 500) {
    if (s.phase === 'rolling') { cashSamples++; cashTotal += s.portfolio.cash }
    if (s.phase === 'event' && s.eventId === 'bank' &&
      (policy === 'A' || !s.deposits.some(l => l.status === 'active')) && s.portfolio.cash > 0) depositOpportunities++
    if (s.phase === 'event' || s.phase === 'funding' || s.phase === 'rebalancing') choices++
    const next = researchStep(s, strategy, policy)
    for (const entry of next.log.slice(s.log.length)) {
      if (entry.kind === 'roll') path += String(entry.after.dice)
      if (entry.kind === 'funding' && entry.decisionId === 'fund-savings') earlyWithdrawals++
      interestForfeited += entry.lostSavingsInterest
      if (entry.kind === 'encounter' && entry.eventId === 'bank') bankEncounters++
      if (entry.kind === 'rebalancing' && entry.decisionId === 'deposit-bank') bankDeposits++
    }
    // Only same-turn log entries influence encounter permissions. Metrics already consumed older entries.
    // Keeping full history is available for verification; this restriction is simulation-only.
    s = compact ? { ...next, log: next.log.filter(e => e.turn === next.turn) } : next
  }
  if (s.phase !== 'finished') throw new Error('Simulation exceeded step limit')
  return { state: s, metrics: { won: Number(victory(s).won), insolvent: Number(s.termination === 'insolvent'),
    lawfulProceeds: liquidatableFunds(s), earlyWithdrawals, interestForfeited,
    averageUninvestedCash: cashTotal / cashSamples, bankEncounters, bankDeposits, choices, depositOpportunities }, path }
}
