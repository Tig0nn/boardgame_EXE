// Development-only fixture page; excluded from both production entry points.
import { createRoot } from 'react-dom/client'
import { GameExperience } from './App'
import { createMobileGame, createMobileSession } from './game/session'
import { decide, transact } from '../../src/game/engine'
import { currentCustomerPreference } from '../../src/game/customer-preferences'
import './index.css'
import type { GameState } from '../../src/game/types'

if (!import.meta.env.DEV) throw new Error('Development fixtures are disabled in production')
const fixture = new URLSearchParams(location.search).get('fixture')
let game = createMobileGame('mobile-fixture', 3e6, 3)
if (fixture === 'funding') {
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
    game = transact({ ...game, phase: 'event', eventId: asset, position, turn: game.turn + 1 }, { kind: 'buy', asset, amount: 6e6 })
  game = { ...game, phase: 'rebalancing', lap: 4, eventId: null }
}
const session = createMobileSession(game)
Object.assign(window, { mobileHarness: { getState: session.getSnapshot, preference: currentCustomerPreference(game) } })
createRoot(document.getElementById('root')!).render(<GameExperience session={session} onRestart={() => location.reload()} />)
declare global { interface Window { mobileHarness: { getState: () => GameState; preference: ReturnType<typeof currentCustomerPreference> } } }
