// Development-only fixture page; excluded from both production entry points.
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { GameExperience } from './App'
import { Tutorial } from './components/Tutorial'
import { createMobileGame as createCandidateMobileGame, createMobileSession } from './game/session'
import { decide, transact } from '../../src/game/engine'
import { currentCustomerPreference } from '../../src/game/customer-preferences'
import './index.css'
import type { GameState } from '../../src/game/types'
import { settleCreditBonds } from '../../src/game/bond-credit'
import { syncValuations } from '../../src/game/market'

const createMobileGame = (...args: Parameters<typeof createCandidateMobileGame>) => createCandidateMobileGame(args[0], args[1], args[2], args[3], 'v2.4-on-landing')


if (!import.meta.env.DEV) throw new Error('Development fixtures are disabled in production')
const fixture = new URLSearchParams(location.search).get('fixture')
let game = createMobileGame('mobile-fixture', 3e6, 3)
if (fixture?.startsWith('preference-')) {
  game = createCandidateMobileGame('preferences', 0)
  if (fixture !== 'preference-forecast') game = { ...game, phase: 'event', position: 8, eventId: 'business', turn: 1 }
  if (fixture === 'preference-owned') {
    game = transact(game, { kind: 'buy', asset: 'business', amount: 20e6 })
    game = { ...game, phase: 'event', position: 13, eventId: 'business', turn: 2 }
  }
} else if (fixture === 'funding') {
  game = transact({ ...game, phase: 'event', position: 9, eventId: 'gold' }, { kind: 'buy', asset: 'gold', amount: 2e6 })
  game = decide({ ...game, phase: 'event', position: 3, eventId: 'living', portfolio: { ...game.portfolio, cash: 2e6 } }, 'pay')
} else if (fixture === 'business') {
  game = transact({ ...game, phase: 'event', position: 8, eventId: 'business', turn: 1 }, { kind: 'buy', asset: 'business', amount: 20e6 })
  game = { ...game, phase: 'event', position: 13, eventId: 'business', turn: 2 }
} else if (fixture === 'bank') {
  game = { ...game, phase: 'event', position: 1, eventId: 'bank', turn: 2 }
} else if (fixture === 'gold' || fixture === 'stocks' || fixture === 'bonds') {
  game = { ...game, phase: 'event', position: { gold: 9, stocks: 2, bonds: 6 }[fixture], eventId: fixture, turn: 2 }
} else if (fixture === 'rebalancing') {
  game = transact({ ...game, phase: 'event', position: 8, eventId: 'business' }, { kind: 'buy', asset: 'business', amount: 20e6 })
  for (const [asset, position] of [['stocks', 2], ['bonds', 6], ['gold', 9]] as const)
    game = transact({ ...game, phase: 'event', eventId: asset, position, turn: game.turn + 1 }, { kind: 'buy', asset, issuerId: asset === 'bonds' ? 'an-tam' : undefined, amount: 6e6 })
  game = { ...game, phase: 'rebalancing', lap: 4, eventId: null }
} else if (fixture === 'bond-credit-funding' || fixture === 'bond-credit-sale') {
  // Explicit deterministic UI fixtures; not recorded as complete browser games.
  game = transact({ ...game, phase: 'event', eventId: 'bonds', position: 6, turn: 1 }, { kind: 'buy', asset: 'bonds', issuerId: 'an-tam', amount: 2e6 })
  game = transact({ ...game, phase: 'event', eventId: 'bonds', position: 6, turn: 2 }, { kind: 'buy', asset: 'bonds', issuerId: 'but-pha', amount: 3e6 })
  game.bondCredit!.issuers[1].status = 'delayed'; game.bondCredit!.issuers[1].rating = 'CCC'; game.bondCredit!.issuers[1].currentPrice = 55_000
  if (fixture === 'bond-credit-funding') {
    game.bondCredit!.issuers[0].status = 'defaulted'; game.bondCredit!.issuers[0].rating = 'D'; game.bondCredit!.issuers[0].defaultLap = 1
  }
  settleCreditBonds(game); syncValuations(game)
  game = fixture === 'bond-credit-sale' ? { ...game, phase: 'rebalancing', eventId: null }
    : decide({ ...game, phase: 'event', position: 3, eventId: 'living', portfolio: { ...game.portfolio, cash: 2e6 } }, 'pay')
}
const session = createMobileSession(game)
Object.assign(window, { mobileHarness: { getState: session.getSnapshot, preference: currentCustomerPreference(game) } })
export function IntegrationHarness() {
  const [help, setHelp] = useState(false)
  return <><GameExperience session={session} onRestart={() => location.reload()} onHelp={() => setHelp(true)} helpOpen={help} />
    {help && <Tutorial game={session.getSnapshot()} firstTime={false} onClose={() => setHelp(false)} />}</>
}
createRoot(document.getElementById('root')!).render(<IntegrationHarness />)
declare global { interface Window { mobileHarness: { getState: () => GameState; preference: ReturnType<typeof currentCustomerPreference> } } }
