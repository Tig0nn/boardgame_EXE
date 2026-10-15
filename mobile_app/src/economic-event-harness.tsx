// Explicit development-only fixtures, separate from the four-lap production game.
import { createRoot } from 'react-dom/client'
import { GameExperience } from './App'
import { createMobileGame, createMobileSession } from './game/session'
import { transact } from '../../src/game/engine'
import { applyMacroShock } from '../../src/game/market'
import { MACRO_EVENTS } from '../../src/data/config'
import type { GameState, LogEntry } from '../../src/game/types'
import archivedUrl from '../../docs/playtests/economic-event-ux-v1/browser-full-game.json.gz?url'
import './index.css'

if (!import.meta.env.DEV) throw new Error('Economic event fixtures are disabled in production')
const params = new URLSearchParams(location.search), id = params.get('event') ?? 'credit-tightening'
if (!MACRO_EVENTS.some(event => event.id === id)) throw new Error('Unknown economic event fixture')
async function fixture(): Promise<GameState> {
  if (params.has('archived')) {
    const response = await fetch(archivedUrl)
    if (!response.ok) throw new Error('Archived game unavailable')
    const bytes = new Uint8Array(await response.arrayBuffer())
    const text = bytes[0] === 31 && bytes[1] === 139
      ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
      : new TextDecoder().decode(bytes)
    const saved = JSON.parse(text) as { state: GameState; entries: LogEntry[] }
    const index = saved.entries.findIndex(entry => entry.kind === 'market' && entry.eventId === id)
    if (index < 0) throw new Error('Archived event unavailable')
    const end = saved.entries[index].after
    return { ...saved.state, ...end, eventId: id, pendingLanding: false, pendingPayment: null, settlement: null,
      log: saved.entries.slice(0, index + 1), summaries: saved.state.summaries.filter(summary => summary.lap < end.lap) }
  }
  let game = createMobileGame('economic-event-fixture', 0, 1, params.has('legacy') ? 'v2.4-single-issuer' : 'v2.5-credit-risk')
  if (params.has('holdings')) for (const [asset, position, amount] of [['stocks', 2, 3e6], ['bonds', 6, 5e6], ['gold', 9, 2e6], ['business', 8, 20e6]] as const)
    game = transact({ ...game, phase: 'event', eventId: asset, position, turn: game.turn + 1 }, { kind: 'buy', asset, issuerId: 'an-tam', amount })
  game = { ...game, phase: 'event', eventId: id, position: 5, turn: game.turn + 1 }
  return params.has('missing') ? game : applyMacroShock(game, id)
}
fixture().then(game => {
  const session = createMobileSession(game)
  createRoot(document.getElementById('root')!).render(<GameExperience session={session} onRestart={() => location.reload()} />)
}).catch(error => { document.getElementById('root')!.textContent = String(error); console.error(error) })
