import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import tilesData from './data/tiles.json'
import { C20_BOARD } from '../../src/data/board'
import { RULES } from '../../src/data/config'
import { totalWorth, liquidatableFunds } from '../../src/game/selectors'
import { money } from '../../src/game/format'
import { LogDialog } from '../../src/components/EventLog'
import { Modal } from '../../src/components/Modal'
import { MobileContainer } from './components/MobileContainer'
import { TopHud } from './components/TopHud'
import { BoardView } from './components/BoardView'
import { Dice3D } from './components/Dice3D'
import { BottomControls } from './components/BottomControls'
import { PortfolioDrawer } from './components/PortfolioDrawer'
import { FloatingMoney } from './components/FloatingMoney'
import type { MoneyParticle } from './components/FloatingMoney'
import { GameSetup } from './components/GameSetup'
import { GamePhase } from './components/GamePhase'
import { RulebookModal } from './components/RulebookModal'
import { createMobileGame, createMobileSession, movementPath } from './game/session'
import type { MobileCommand } from './game/session'
import { sound } from './utils/audio'
import './engine-ui.css'

// Coordinates are artwork metadata; category/order/labels come from the official C20 board.
const coordinates = C20_BOARD.map((tile, i) => ({ ...tilesData[i], ...tile }))
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
type Session = ReturnType<typeof createMobileSession>

export function GameExperience({ session, onRestart }: { session: Session; onRestart: () => void }) {
  // React subscribes to immutable engine snapshots: https://react.dev/reference/react/useSyncExternalStore
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const [animation, setAnimation] = useState<'dice' | 'pause' | 'moving' | null>(null)
  const [animatedTile, setAnimatedTile] = useState(0)
  const [overlay, setOverlay] = useState<'portfolio' | 'log' | 'rulebook' | null>(null)
  const [muted, setMuted] = useState(false)
  const [notice, setNotice] = useState('')
  const [particles, setParticles] = useState<MoneyParticle[]>([])
  const busy = useRef(false)
  const generation = useRef(0)
  const particleId = useRef(0)
  const nextActionAt = useRef(0)
  useEffect(() => () => { generation.current++ }, [])
  useEffect(() => {
    const unlock = () => { sound.unlockAudio(); if (!sound.isMuted) sound.startBgm() }
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  const send = (command: MobileCommand): boolean => {
    if (busy.current || Date.now() < nextActionAt.current) return false
    try {
      if (!session.dispatch(command, game)) return false
      // Reject the second click of a double tap even if a same-phase sheet has already rerendered.
      nextActionAt.current = Date.now() + 300
      setNotice('')
      sound.playClick()
      const delta = session.getSnapshot().portfolio.cash - game.portfolio.cash
      if (delta) {
        const id = String(++particleId.current)
        setParticles([{ id, text: `${delta > 0 ? '+' : ''}${money(delta)}`, type: delta > 0 ? 'gain' : 'loss', x: 470, y: 1100 }])
        if (delta > 0) sound.playCoin(); else sound.playPay()
      }
      return true
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không thể thực hiện hành động.'); return false }
  }

  const rollDice = async () => {
    if (busy.current || overlay || game.phase !== 'rolling') return
    busy.current = true
    const token = ++generation.current
    setAnimatedTile(game.position)
    setAnimation('dice')
    session.dispatch({ type: 'roll' }, game)
    const rolled = session.getSnapshot()
    sound.unlockAudio(); sound.playDiceRoll(); sound.triggerHaptic('medium')
    await delay(800)
    if (token !== generation.current) return
    setAnimation('pause')
    await delay(400)
    if (token !== generation.current) return
    setAnimation('moving')
    for (const position of movementPath(game, rolled)) {
      sound.playHop(); sound.triggerHaptic('light')
      setAnimatedTile(position)
      await delay(280)
      if (token !== generation.current) return
    }
    busy.current = false
    setAnimation(null)
    sound.playEventShow()
  }
  const disabled = !!animation || !!overlay || game.phase !== 'rolling'
  return <>
    <MobileContainer overlay={<>
      <TopHud cash={game.portfolio.cash} debt={game.portfolio.debt} netWorth={totalWorth(game)}
        lawfulProceeds={liquidatableFunds(game)} targetGoal={RULES.goal + RULES.cashGoal} isMuted={muted}
        onToggleMute={() => { const next = !muted; sound.isMuted = next; setMuted(next); if (next) sound.stopBgm(); else { sound.unlockAudio(); sound.startBgm() } }}
        onOpenRulebook={() => { if (!busy.current) setOverlay('rulebook') }} />
      <BottomControls onRollClick={rollDice} disabled={disabled} lastDiceValue={game.dice || undefined}
        onPortfolioClick={() => { if (!busy.current) setOverlay('portfolio') }}
        onLogClick={() => { if (!busy.current) setOverlay('log') }} />
    </>}>
      <BoardView currentTileIndex={animation ? animatedTile : game.position} tileCoordinates={coordinates}
        lap={game.lap} totalLaps={game.totalLaps} isPawnMoving={animation === 'moving'} isDancing={!animation && game.phase === 'summary'}>
        <Dice3D value={game.dice || 1} isRolling={animation === 'dice'} isPawnMoving={animation === 'moving'}
          onRollClick={rollDice} disabled={disabled} isUpOnLawn={!!animation || (game.dice > 0 && game.phase !== 'rolling')} />
        <FloatingMoney particles={particles} />
      </BoardView>
    </MobileContainer>
    {!animation && !overlay && <GamePhase game={game} send={send} onRestart={onRestart} />}
    {overlay === 'portfolio' && <PortfolioDrawer game={game} onClose={() => setOverlay(null)} />}
    {overlay === 'log' && <LogDialog game={game} onClose={() => setOverlay(null)} />}
    {overlay === 'rulebook' && <RulebookModal onClose={() => setOverlay(null)} />}
    {notice && <Modal title="Không thể thực hiện" onClose={() => setNotice('')}><p role="alert">{notice}</p></Modal>}
  </>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [showRulebook, setShowRulebook] = useState(false)

  if (session) return <GameExperience session={session} onRestart={() => setSession(null)} />
  return <>
    <MobileContainer>
      <BoardView currentTileIndex={0} tileCoordinates={coordinates} lap={1} totalLaps={4} />
    </MobileContainer>
    <GameSetup
      onStart={(seed, savings, term) => setSession(createMobileSession(createMobileGame(seed, savings, term)))}
      onOpenRulebook={() => setShowRulebook(true)}
    />
    {showRulebook && <RulebookModal onClose={() => setShowRulebook(false)} />}
  </>
}
