import { eventsForGame } from '../../src/data/events.ts'
import { ECONOMY } from '../../src/data/config.ts'
import { advance, canChoose, decide, roll, transact } from '../../src/game/engine.ts'
import { createMultiCourseGame } from '../../src/game/new-game.ts'
import { creditBondLots } from '../../src/game/bond-credit.ts'
import { businessUpgradeUnlocked } from '../../src/game/business.ts'
import { serializeLog } from '../../src/game/log.ts'
import type { RebalanceAction } from '../../src/game/types.ts'

export type MultiAssetFixture = 'stocks' | 'bonds' | 'business' | 'advanced'

/** Fixed independent seeds and native-only policy. No seed search, imported state, or edited engine fields. */
export function multiAssetFixture(kind: MultiAssetFixture, policy: 'trade' | 'hold' | 'skip' = 'trade'): string {
  let state = createMultiCourseGame(`EG3-AI-04-${kind.toUpperCase()}`, 0, 1)
  let bought = false, sold = false, upgraded = false, courses = 0
  for (let steps = 0; state.phase !== 'finished'; steps++) {
    if (steps >= 300 || state.phase === 'funding') throw new Error(`fixture-${kind}-unsupported`)
    if (state.phase === 'rolling') { state = roll(state); continue }
    if (state.phase !== 'event') { state = advance(state); continue }
    let action: RebalanceAction | undefined
    if (policy !== 'skip' && state.eventId === kind && !bought && kind !== 'advanced') {
      if (kind === 'stocks') action = { kind: 'buy', asset: 'stocks', amount: 5_000_000, symbolId: state.market.stocks[0].id }
      if (kind === 'bonds') action = { kind: 'buy', asset: 'bonds', amount: 5_000_000, issuerId: 'an-tam' }
      if (kind === 'business') action = { kind: 'buy', asset: 'business', amount: ECONOMY.business.cost }
      bought = true
    } else if (policy === 'trade' && state.eventId === kind && !sold) {
      if (kind === 'stocks' && state.portfolio.stocks > 0) action = { kind: 'sell', asset: 'stocks', amount: state.portfolio.stocks }
      if (kind === 'bonds') {
        const available = creditBondLots(state).find(item => item.quote.executable)
        if (available) action = { kind: 'sell', asset: 'bonds', amount: available.quote.available, lotId: available.lot.id }
      }
      if (kind === 'business' && businessUpgradeUnlocked(state)) {
        action = !upgraded ? { kind: 'upgrade', amount: ECONOMY.business.upgradeCost, customerPreferenceId: 'budget' }
          : { kind: 'sell', asset: 'business', amount: state.portfolio.business }
        upgraded = true
      }
      if (action?.kind === 'sell') sold = true
    }
    if (action) { state = transact(state, action); continue }
    if (kind === 'advanced' && state.eventId === 'course' && courses++ === 1 && canChoose(state, 'course-advanced')) {
      state = decide(state, 'course-advanced')
      continue
    }
    const option = canChoose(state, 'skip') ? 'skip' : eventsForGame(state).find(event => event.id === state.eventId)?.options.find(candidate => canChoose(state, candidate.id))?.id
    if (!option) throw new Error(`fixture-${kind}-decision`)
    state = decide(state, option)
  }
  if (state.termination !== 'completed') throw new Error(`fixture-${kind}-not-completed`)
  return serializeLog(state)
}
