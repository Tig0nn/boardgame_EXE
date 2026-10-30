import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App, { GameExperience } from '../../mobile_app/src/App'
import { createMobileSession } from '../../mobile_app/src/game/session'
import { repairAiFeature } from '../../mobile_app/src/game/repair-ai-feature'
import { createMultiCourseGame } from '../../src/game/new-game'
import { advance, roll, decide, fundPayment } from '../../src/game/engine'
import { eventsForGame } from '../../src/data/events'
import type { GameState } from '../../src/game/types'
import '../../mobile_app/src/index.css'

function repair(): GameState {
  for (let i = 0; i < 1000; i++) {
    let game = createMultiCourseGame(`companion-fixture-${i}`, 0)
    for (let j = 0; j < 250 && game.phase !== 'finished'; j++) {
      if (game.phase === 'event' && game.eventId === 'repair') return new URLSearchParams(location.search).has('poor') ? { ...game, portfolio: { ...game.portfolio, cash: 0 } } : game
      if (game.phase === 'rolling') game = roll(game)
      else if (game.phase === 'event') {
        const options = eventsForGame(game).find(e => e.id === game.eventId)!.options
        game = decide(game, options.find(o => ['skip','acknowledge','full'].includes(o.id))?.id ?? options[0].id)
      } else if (game.phase === 'funding') game = fundPayment(game, 'debt', game.pendingPayment!.remaining)
      else game = advance(game)
    }
  }
  throw Error('No naturally revealed repair')
}
export function Harness() {
  const [session, setSession] = useState(() => createMobileSession(repair()))
  const restart = () => setSession(createMobileSession(repair()))
  return <>
    <GameExperience session={session} onRestart={restart} onHelp={() => {}} />
    <div style={{ position:'fixed',zIndex:2000,bottom:0,display:'flex',gap:8 }}>
      <button onClick={restart}>Test: restart/import session</button>
      <button onClick={() => repairAiFeature.setEnabled(false)}>Test: disable</button>
    </div>
  </>
}
createRoot(document.getElementById('root')!).render(<StrictMode>{new URLSearchParams(location.search).has('app') ? <App /> : <Harness />}</StrictMode>)