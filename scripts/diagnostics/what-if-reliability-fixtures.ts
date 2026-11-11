import { eventsForGame } from '../../src/data/events.ts'
import { ECONOMY } from '../../src/data/config.ts'
import { advance, canChoose, decide, roll, transact } from '../../src/game/engine.ts'
import { businessUpgradeUnlocked } from '../../src/game/business.ts'
import { creditBondLots } from '../../src/game/bond-credit.ts'
import { serializeLog } from '../../src/game/log.ts'
import { createMultiCourseGame } from '../../src/game/new-game.ts'
import type { GameState, RebalanceAction } from '../../src/game/types.ts'
import type { DecisionParameters, WhatIfDecision } from '../../mobile_app/src/game/what-if-ai/orchestrator.ts'

type ReliabilityCase = {
  kind: WhatIfDecision['kind']; seed: string; sales: number; goldSale?: 'tile'; sequence: number
  alternativeId?: WhatIfDecision['alternativeId']; parameters?: DecisionParameters; followUps: number[]
}

export const reliabilityCases: ReliabilityCase[] = [
  { kind: 'gold', seed: 'EG3-AI-08-GOLD-2', sales: 3, goldSale: 'tile', sequence: 7, followUps: [31] },
  { kind: 'bank', seed: 'EG3-AI-08-MIXED-3', sales: 3, sequence: 7, parameters: { operation: 'deposit', amount: 7_250_019, term: 3 }, followUps: [] },
  { kind: 'course', seed: 'EG3-AI-08-MIXED-5', sales: 3, sequence: 48, alternativeId: 'skip', followUps: [] },
  { kind: 'advanced', seed: 'EG3-AI-08-MIXED-9', sales: 8, sequence: 7, alternativeId: 'course-advanced', followUps: [] },
  { kind: 'stocks', seed: 'EG3-AI-08-MIXED-5', sales: 3, sequence: 7, alternativeId: 'skip', followUps: [20, 21, 22] },
  { kind: 'bonds', seed: 'EG3-AI-08-MIXED-3', sales: 3, sequence: 78, parameters: { operation: 'sell', amount: 17, lotId: 'bond-4' }, followUps: [] },
  { kind: 'business', seed: 'EG3-AI-08-MIXED-5', sales: 3, sequence: 76, alternativeId: 'upgrade-business:taste', followUps: [] },
]

/** Fixed native play policy. Fixture selection uses encounter coverage and source size, never deltas. */
export function reliabilityHistory(seed: string, checkpointStockSales: number, goldSale: 'checkpoint' | 'tile' = 'checkpoint') {
  let state = createMultiCourseGame(seed, 1_234_567, 3)
  let goldClosed = false, stockSales = false, courses = 0, banks = 0, stocks = 0, businesses = 0
  const trades: Record<string, number> = {}
  function trade(action: RebalanceAction) {
    state = transact(state, action)
    const key = `${action.kind}:${action.asset ?? (action.kind === 'upgrade' ? 'business' : 'bank')}`
    trades[key] = (trades[key] ?? 0) + 1
  }
  let beforeLastAdvance: GameState | undefined
  for (let step = 0; step < 300 && state.phase !== 'finished'; step++) {
    if (state.phase === 'funding') throw new Error(`${seed}: funding`)
    if (state.phase === 'rolling') { state = roll(state); continue }
    if (state.phase === 'rebalancing') {
      if (goldSale === 'checkpoint' && state.portfolio.gold > 0 && !goldClosed) {
        trade({ kind: 'sell', asset: 'gold', amount: state.portfolio.gold })
        goldClosed = true
      }
      if (state.stockHoldings.FPT?.units > 0 && !stockSales) {
        for (let i = 0; i < checkpointStockSales; i++) trade({ kind: 'sell', asset: 'stocks', symbolId: 'FPT', amount: 100_003 + i })
        stockSales = true
      }
      const openLots = creditBondLots(state).filter(item => item.quote.executable)
      if (openLots.length > 1 && !trades['sell:bonds']) {
        trade({ kind: 'sell', asset: 'bonds', lotId: openLots[1].lot.id, amount: 11_003 })
      }
      if (state.lap === 4) beforeLastAdvance = state
      state = advance(state)
      continue
    }
    if (state.phase !== 'event') { state = advance(state); continue }
    const kind = state.eventId
    const cash = state.portfolio.cash
    if (kind === 'gold' && (goldSale === 'checkpoint' || state.position === 5) && !trades['buy:gold'] && cash > 10_000_000) {
      trade({ kind: 'buy', asset: 'gold', amount: 2_371_109, completeEncounter: true }); continue
    }
    if (kind === 'gold' && goldSale === 'tile' && state.position === 5 && state.portfolio.gold > 0 && !goldClosed) {
      trade({ kind: 'sell', asset: 'gold', amount: state.portfolio.gold }); goldClosed = true; continue
    }
    if (kind === 'stocks' && stocks++ < 2 && cash > 10_000_000) {
      trade({ kind: 'buy', asset: 'stocks', amount: stocks === 1 ? 4_173_337 : 1_927_013, symbolId: stocks === 1 ? 'FPT' : 'VCB' }); continue
    }
    if (kind === 'bonds' && (trades['buy:bonds'] ?? 0) < 4 && cash > 10_000_000) {
      const issuers = state.bondCredit?.issuers.filter(issuer => issuer.status === 'performing' && issuer.currentPrice > 0) ?? []
      if (issuers.length) {
        const ordinal = trades['buy:bonds'] ?? 0
        trade({ kind: 'buy', asset: 'bonds', issuerId: issuers[ordinal % issuers.length].id, amount: 1_381_237 + ordinal }); continue
      }
    }
    if (kind === 'business') {
      businesses++
      if (businesses === 1 && cash > ECONOMY.business.cost + 10_000_000) {
        trade({ kind: 'buy', asset: 'business', amount: ECONOMY.business.cost }); continue
      }
      if (businesses === 2 && businessUpgradeUnlocked(state) && cash > ECONOMY.business.upgradeCost + 10_000_000) {
        trade({ kind: 'upgrade', customerPreferenceId: 'checkin', amount: ECONOMY.business.upgradeCost })
      }
    }
    if (kind === 'bank' && banks++ === 1 && cash > 10_000_000) {
      trade({ kind: 'deposit', amount: 1_911_019, term: 2 }); continue
    }
    if (kind === 'course' && courses++ === 1 && cash > 10_000_000 && canChoose(state, 'course-basic')) {
      state = decide(state, 'course-basic'); continue
    }
    const option = canChoose(state, 'skip') ? 'skip' : eventsForGame(state).find(event => event.id === kind)?.options.find(candidate => canChoose(state, candidate.id))?.id
    if (!option) throw new Error(`${seed}: no legal action at ${kind}`)
    state = decide(state, option)
  }
  if (state.termination !== 'completed' || !beforeLastAdvance) throw new Error(`${seed}: incomplete`)
  return { state, beforeLastAdvance, text: serializeLog(state), trades }
}
