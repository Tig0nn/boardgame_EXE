import { useState } from 'react'
import { eventsForGame } from '../../../src/data/events'
import { advance, decide, fundPayment, roll } from '../../../src/game/engine'
import { createMultiCourseGame } from '../../../src/game/new-game'
import { GameExperience } from '../App'
import { createMobileSession } from '../game/session'
import { createRepairDemo } from './repair-fixture'
import './what-if-demo.css'

const scenarios = {
  board: 'Bàn chơi B18',
  gold: 'Mua vàng',
  routine: 'Mua vàng · Có sẵn 20 triệu',
  concentration: 'Mua vàng · Có khoản phải trả',
  bank: 'Gửi tiết kiệm',
  liquidity: 'Thiếu tiền sửa xe',
  debt: 'Vay trả phí sửa xe',
  progress: 'Trả nợ tại START',
  finished: 'Kết quả cuối ván',
} as const
type Scenario = keyof typeof scenarios

function nextEncounter(game: ReturnType<typeof createMultiCourseGame>, defer = false) {
  const event = eventsForGame(game).find(item => item.id === game.eventId)
  return event && decide(game, (event.options.find(option => defer && option.obligation)
    ?? event.options.find(option => option.id === 'skip') ?? event.options[0]).id)
}

function createFixture(scenario: Scenario) {
  if (scenario === 'board') return advance(createMultiCourseGame('mascot-integration-board', 0, 1))
  if (scenario === 'routine' || scenario === 'concentration') {
    const routine = scenario === 'routine'
    const lastTurn = routine ? 5 : 7
    let game = advance(createMultiCourseGame(routine ? 'mascot-quality-0' : 'mascot-quality-4', routine ? 30_000_000 : 0, 1))
    for (let turn = 0; turn <= lastTurn && game.phase === 'rolling'; turn++) {
      const rolled = roll(game)
      if (rolled.phase !== 'event') break
      if (turn === lastTurn && rolled.eventId === 'gold'
        && rolled.portfolio.cash === (routine ? 20_000_000 : 50_000_000)
        && rolled.obligations === (routine ? 0 : 3_500_000)) return rolled
      game = nextEncounter(rolled, !routine) ?? rolled
    }
    throw Error('Không tìm thấy mốc mua vàng cho Mascot.')
  }
  if (scenario === 'finished') {
    for (let seed = 0; seed < 12; seed++) {
      let game = createMultiCourseGame('mascot-learning-final-' + seed, 0, 1)
      for (let step = 0; step < 140; step++) {
        if (game.phase === 'finished') {
          if (game.termination === 'completed') return game
          break
        }
        if (game.phase === 'funding') break
        if (game.phase === 'rolling') game = roll(game)
        else if (game.phase === 'event') {
          const next = nextEncounter(game)
          if (!next) break
          game = next
        } else game = advance(game)
      }
    }
    throw Error('Không tìm thấy ván hoàn thành cho Mascot.')
  }
  if (scenario === 'liquidity') return createRepairDemo(49_500_000)
  if (scenario === 'debt') return decide(createRepairDemo(49_500_000), 'full')
  if (scenario === 'progress') {
    const funded = decide(createRepairDemo(49_500_000), 'full')
    let game = fundPayment(funded, 'debt', funded.pendingPayment!.remaining)
    for (let turn = 0; turn < 18 && game.phase === 'rolling'; turn++) {
      const rolled = roll(game)
      if (rolled.phase === 'summary' && rolled.portfolio.debt < game.portfolio.debt) return game
      if (rolled.phase !== 'event') break
      game = nextEncounter(rolled) ?? rolled
    }
  } else {
    for (let seed = 0; seed < 40; seed++) {
      let game = advance(createMultiCourseGame('mascot-demo-' + seed, 0, 1))
      for (let turn = 0; turn < 12 && game.phase === 'rolling'; turn++) {
        const rolled = roll(game)
        if (rolled.phase !== 'event') break
        if (rolled.eventId === scenario && rolled.portfolio.cash >= 20_000_000) return rolled
        game = nextEncounter(rolled) ?? rolled
      }
    }
  }
  throw Error('Không tìm thấy mốc chơi thử Mascot.')
}

export default function MascotDemo() {
  const selection = new URLSearchParams(location.search).get('mascotDemo')
  const scenario = Object.keys(scenarios).find(key => key === selection) as Scenario | undefined
  const [session, setSession] = useState(() => createMobileSession(createFixture(scenario ?? 'gold')))
  const restart = () => setSession(createMobileSession(createFixture(scenario ?? 'gold')))
  return <>
    <GameExperience session={session} onRestart={restart} onHome={restart} persist={false} />
    <div className="whatif-dev-toolbar" aria-label="Chơi thử Cáo EXE">
      <label>Chơi thử{' '}
        <select value={scenario ?? 'gold'} onChange={event => {
          location.search = new URLSearchParams({ mascotDemo: event.currentTarget.value }).toString()
        }}>
          {Object.entries(scenarios).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <button type="button" onClick={restart}>Thử lại</button>
    </div>
  </>
}
