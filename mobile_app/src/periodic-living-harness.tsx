// Explicit development fixtures. No forced state is exposed in production.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { GameExperience } from './App'
import { Tutorial } from './components/Tutorial'
import { createMobileGame, createMobileSession } from './game/session'
import { beginSettlement } from '../../src/game/settlement'
import { decide, transact } from '../../src/game/engine'
import './index.css'

if (!import.meta.env.DEV) throw new Error('DEV fixtures disabled in production')
const key = new URLSearchParams(location.search).get('case') ?? 'summary'
let game = createMobileGame('periodic-dev-fixture', 20e6, 3)
if (key === 'funding' || key === 'insolvent') {
  // Unreachable with legal >=14M salary: tests defensive funding reentry only.
  game.recurringIncome = 0; game.portfolio.cash = 2e6
  if (key === 'insolvent') { game.deposits = []; game.portfolio.savings = 0; game.borrowingLimit = 0 }
} else if (key === 'deferred') {
  game = decide({ ...game, phase: 'event', eventId: 'medical', position: 7, turn: 1 }, 'defer')
} else if (key === 'bond-delay') {
  game = transact({ ...game, phase: 'event', eventId: 'bonds', position: 6, turn: 1 }, { kind: 'buy', asset: 'bonds', issuerId: 'an-tam', amount: 5e6 })
  game.bondCredit!.issuers[0].status = 'delayed'
} else if (key !== 'summary' && key !== 'board' && key !== 'legacy') throw new Error('Unknown fixture')
if (key === 'legacy') game = createMobileGame('periodic-legacy-fixture', 0, 1, 'v2.5-credit-risk', 'v2.4-on-landing')
if (key !== 'board' && key !== 'legacy') game = beginSettlement(game)
else game = { ...game, phase: 'rolling' }
const session = createMobileSession(game)
export function Harness() {
  const [help, setHelp] = useState(false)
  return <><GameExperience session={session} onRestart={() => location.reload()} onHelp={() => setHelp(true)} helpOpen={help} />
    {help && <Tutorial game={session.getSnapshot()} firstTime={false} onClose={() => setHelp(false)} />}
    <small style={{ position: 'fixed', bottom: 0, left: 0, zIndex: 200, background: '#10202e', color: '#fff', fontSize: 10 }}>DEV fixture · {key}{key === 'funding' || key === 'insolvent' ? ' · salary=0 (unreachable in legal gameplay)' : ''}</small>
  </>
}
createRoot(document.getElementById('root')!).render(<Harness />)
