import { localizeNarrative } from '../../src/components/glossary'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import tilesData from './data/tiles.json'
import { boardFor } from '../../src/data/board'
import { hasPeriodicLiving } from '../../src/game/living-expenses'
import { goalProgress } from '../../src/game/selectors'
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
import { createMvpMobileGame, createMobileSession, movementPath } from './game/session'
import type { MobileCommand } from './game/session'
import { sound } from './utils/audio'
import { Tutorial } from './components/Tutorial'
import { hasSeenTutorial, rememberTutorial } from './game/onboarding'
import './engine-ui.css'
import './core-mvp.css'
import { CoreMvpBoard } from './components/CoreMvpBoard'
import { isCoreMvp } from '../../src/game/rules-profile'
import { RulebookModal } from './components/RulebookModal'
import { loadGameLocally, saveGameLocally } from '../../src/game/saved-game'

// Coordinates are artwork metadata; category/order/labels come from the official C20 board.
const coordinatesFor = (board: ReturnType<typeof boardFor>) => board.map((tile, i) => ({ ...tilesData[i], ...tile }))
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
type Session = ReturnType<typeof createMobileSession>

export function GameExperience({ session, onRestart, onHelp, helpOpen = false }: { session: Session; onRestart: () => void; onHelp?: () => void; helpOpen?: boolean }) {
  // React subscribes to immutable engine snapshots: https://react.dev/reference/react/useSyncExternalStore
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const coordinates = coordinatesFor(boardFor(game))
  const [animation, setAnimation] = useState<'dice' | 'pause' | 'moving' | null>(null)
  const [animatedTile, setAnimatedTile] = useState(0)
  const [overlay, setOverlay] = useState<'portfolio' | 'log' | null>(null)
  const [muted, setMuted] = useState(false)
  const [notice, setNotice] = useState('')
  const [particles, setParticles] = useState<MoneyParticle[]>([])
  const busy = useRef(false)
  const generation = useRef(0)
  const particleId = useRef(0)
  const nextActionAt = useRef(0)
  useEffect(() => () => { generation.current++ }, [])
  useEffect(()=>{
    const timer=window.setTimeout(()=>{
      if(!saveGameLocally(game))setNotice('Không lưu tự động được trên trình duyệt này. Hãy xuất nhật ký trong Ví để giữ ván. Khi đóng hoặc tải lại trang, các lượt chưa lưu có thể mất.')
    },0)
    return ()=>window.clearTimeout(timer)
  },[game])
  useEffect(() => {
    const unlock = () => { sound.unlockAudio(); if (!sound.isMuted) sound.startBgm() }
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  const send = (command: MobileCommand): boolean => {
    if (helpOpen || busy.current || Date.now() < nextActionAt.current) return false
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
    if (helpOpen || busy.current || Date.now() < nextActionAt.current || overlay || game.phase !== 'rolling') return
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
  const disabled = helpOpen || !!animation || !!overlay || game.phase !== 'rolling'
  const goal=goalProgress(game)
  const pieces=<><Dice3D value={game.dice||1} isRolling={animation==='dice'} isPawnMoving={animation==='moving'} onRollClick={rollDice} disabled={disabled} isUpOnLawn={!!animation||(game.dice>0&&game.phase!=='rolling')}/><FloatingMoney particles={particles}/></>
  return <>
    <MobileContainer overlay={<>
      <TopHud cash={game.portfolio.cash} debt={game.portfolio.debt}
        lawfulProceeds={goal.funds} targetGoal={goal.target} isMuted={muted} lap={game.lap} totalLaps={game.totalLaps}
        onHelp={onHelp} helpDisabled={!!animation}
        onToggleMute={() => { const next = !muted; sound.isMuted = next; setMuted(next); if (next) sound.stopBgm(); else { sound.unlockAudio(); sound.startBgm() } }} />
      <BottomControls onRollClick={rollDice} disabled={disabled} lastDiceValue={game.dice || undefined}
        onPortfolioClick={() => { if (!busy.current) setOverlay('portfolio') }}
        onLogClick={() => { if (!busy.current) setOverlay('log') }} />
    </>}>
      {isCoreMvp(game)?<CoreMvpBoard game={game} position={animation?animatedTile:game.position} lap={game.lap} totalLaps={game.totalLaps} moving={animation==='moving'} dancing={!animation&&game.phase==='summary'}>{pieces}</CoreMvpBoard>:<BoardView currentTileIndex={animation ? animatedTile : game.position} tileCoordinates={coordinates}
        replacementTiles={hasPeriodicLiving(game) ? [3, 14] : []}
        lap={game.lap} totalLaps={game.totalLaps} isPawnMoving={animation === 'moving'} isDancing={!animation && game.phase === 'summary'}>
        <Dice3D value={game.dice || 1} isRolling={animation === 'dice'} isPawnMoving={animation === 'moving'}
          onRollClick={rollDice} disabled={disabled} isUpOnLawn={!!animation || (game.dice > 0 && game.phase !== 'rolling')} />
        <FloatingMoney particles={particles} />
      </BoardView>}
    </MobileContainer>
    {!animation && !overlay && <GamePhase game={game} send={send} onRestart={onRestart} onHelp={onHelp} />}
    {overlay === 'portfolio' && <PortfolioDrawer game={game} onClose={() => setOverlay(null)} onHelp={onHelp} />}
    {overlay === 'log' && <LogDialog game={game} onClose={() => setOverlay(null)} />}
    {notice && <Modal title="Không thể thực hiện" onClose={() => setNotice('')}><p role="alert">{localizeNarrative(notice)}</p></Modal>}
  </>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [saved,setSaved]=useState(()=>loadGameLocally())
  const [saveNotice,setSaveNotice]=useState('')
  const returnToSetup=()=>{
    const latest=session!.getSnapshot()
    // Flush the current snapshot before unmount cancels a pending autosave timer.
    const persisted=saveGameLocally(latest)
    setSaved(latest)
    setSaveNotice(persisted?'':'Ván mới nhất chỉ còn trong phiên này vì trình duyệt không lưu được. Hãy mở lại và xuất nhật ký trước khi đóng trang.')
    setSession(null)
  }
  const [tutorial, setTutorial] = useState<'first' | 'help' | null>(() => hasSeenTutorial() ? null : 'first')
  const openHelp = () => setTutorial('help')
  const closeTutorial = () => { if (tutorial === 'first') rememberTutorial(); setTutorial(null) }
  return <>
    {session ? <GameExperience session={session} onRestart={returnToSetup} onHelp={openHelp} helpOpen={!!tutorial} /> : <>
      <MobileContainer><CoreMvpBoard/></MobileContainer>
      {tutorial !== 'first' && <GameSetup onHelp={openHelp} saved={saved} saveNotice={saveNotice} onRestore={s=>setSession(createMobileSession(s))} onStart={(seed, savings, term) => setSession(createMobileSession(createMvpMobileGame(seed, savings, term)))} />}
    </>}
    {tutorial==='first'&&<Tutorial firstTime onClose={closeTutorial} game={session?.getSnapshot()}/>}
    {tutorial==='help'&&<RulebookModal onClose={closeTutorial} game={session?.getSnapshot()}/>}
  </>
}
