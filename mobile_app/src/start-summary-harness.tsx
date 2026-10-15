// Development-only archived START checkpoints, never included in production.
import { createRoot } from 'react-dom/client'
import { GameExperience } from './App'
import { createMobileGame, createMobileSession } from './game/session'
import { beginSettlement } from '../../src/game/settlement'
import { transact } from '../../src/game/engine'
import type { GameState, LogEntry, LapSummary } from '../../src/game/types'
import normalUrl from '../../docs/playtests/bond-credit-v25/browser-normal-a.json.gz?url'
import delayedUrl from '../../docs/playtests/bond-credit-v25/browser-delayed.json.gz?url'
import defaultUrl from '../../docs/playtests/bond-credit-v25/browser-default-recovery.json.gz?url'
import defaultBUrl from '../../docs/playtests/bond-credit-v25/browser-default-b.json.gz?url'
import './index.css'

if (!import.meta.env.DEV) throw new Error('Development checkpoints are disabled in production')
const cases: Record<string, { url: string; lap: number }> = {
  normal: { url: normalUrl, lap: 1 }, delayed: { url: delayedUrl, lap: 2 }, cure: { url: delayedUrl, lap: 3 },
  default: { url: defaultUrl, lap: 2 }, recovery: { url: defaultUrl, lap: 3 }, defeat: { url: defaultBUrl, lap: 4 },
}
async function loadCheckpoint(): Promise<GameState> {
  const key = new URLSearchParams(location.search).get('case') ?? 'normal'
  if (key === 'empty') return beginSettlement(createMobileGame('start-empty', 0))
  if (key === 'both') {
    let game = createMobileGame('start-both', 0)
    for (const issuerId of ['an-tam', 'but-pha'] as const) game = transact({ ...game, phase: 'event', eventId: 'bonds', position: 6, turn: game.turn + 1 },
      { kind: 'buy', asset: 'bonds', issuerId, amount: 5e6 })
    return beginSettlement(game)
  }
  const fixture = cases[key]
  if (!fixture) throw new Error('Unknown START checkpoint')
  const response = await fetch(fixture.url)
  if (!response.ok) throw new Error('Archived checkpoint unavailable')
  const bytes = new Uint8Array(await response.arrayBuffer())
  // Vite can serve .json.gz already decoded. Accept that and raw gzip bytes.
  const text = bytes[0] === 31 && bytes[1] === 139
    ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(bytes)
  const data = JSON.parse(text) as {
    state: GameState; entries: LogEntry[]; summaries: LapSummary[]
  }
  const index = data.entries.findIndex(entry => entry.kind === 'settlement' && entry.decisionId === 'settle-lap' && entry.after.lap === fixture.lap)
  if (index < 0) throw new Error('Missing settlement checkpoint')
  const end = data.entries[index].after
  return { ...data.state, ...end, eventId: null, pendingPayment: null, settlement: null,
    pendingLanding: end.position !== 0, log: data.entries.slice(0, index + 1), summaries: data.summaries.filter(summary => summary.lap <= fixture.lap) }
}
loadCheckpoint().then(game => {
  const session = createMobileSession(game)
  Object.assign(window, { startHarness: { getState: session.getSnapshot } })
  createRoot(document.getElementById('root')!).render(<GameExperience session={session} onRestart={() => location.reload()} />)
}).catch(error => { document.getElementById('root')!.textContent = String(error); console.error(error) })
declare global { interface Window { startHarness: { getState: () => GameState } } }
