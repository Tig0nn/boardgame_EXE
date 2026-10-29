import { localizeNarrative } from '../../src/components/glossary'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import tilesData from './data/tiles.json'
import { boardFor } from '../../src/data/board'
import { goalProgress } from '../../src/game/selectors'
import { money } from '../../src/game/format'
import { Modal } from '../../src/components/Modal'
import { MobileContainer } from './components/MobileContainer'
import { TopHud } from './components/TopHud'
import { BoardView } from './components/BoardView'
import { Dice3D } from './components/Dice3D'
import { BottomControls } from './components/BottomControls'
import { FloatingMoney } from './components/FloatingMoney'
import type { MoneyParticle } from './components/FloatingMoney'
import { GameSetup } from './components/GameSetup'
import { GamePhase } from './components/GamePhase'
import { createMvpMobileGame, createMobileSession, movementPath } from './game/session'
import type { MobileCommand } from './game/session'
import { sound } from './utils/audio'
import { hasSeenTutorial, rememberTutorial, isTutorialDisabled } from './game/onboarding'
import { Tutorial } from './components/Tutorial'
import './engine-ui.css'
import './core-mvp.css'
import './medieval-theme.css'
import { UnifiedGameGuide } from './components/UnifiedGameGuide'
import tilesB18Data from './data/tiles-b18.json'
import { loadGameLocally, saveGameLocally, GAME_SAVE_KEY } from '../../src/game/saved-game'
import { preloadGameAssets } from './utils/preloader'
import { EntranceScreen } from './components/EntranceScreen'
import { UnifiedManagementSheet } from './components/UnifiedManagementSheet'
import { SettingsModal } from './components/SettingsModal'
import { MapScreen } from './components/MapScreen'
import type { MapNodeConfig } from './game/map-progress'

// Coordinates are artwork metadata; category/order/labels come from the official C20 or B18 board.
const coordinatesFor = (board: ReturnType<typeof boardFor>) => {
  const source = board.length === 18 ? tilesB18Data : tilesData
  return board.map((tile, i) => ({ ...source[i], ...tile }))
}
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
type Session = ReturnType<typeof createMobileSession>

export function GameExperience({ session, onRestart, onHome, onHelp, helpOpen = false }: {
  session: Session;
  onRestart: () => void;
  onHome?: () => void;
  onHelp?: () => void;
  helpOpen?: boolean;
}) {
  // React subscribes to immutable engine snapshots: https://react.dev/reference/react/useSyncExternalStore
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const coordinates = coordinatesFor(boardFor(game))
  const [animation, setAnimation] = useState<'dice' | 'pause' | 'moving' | null>(null)
  const [animatedTile, setAnimatedTile] = useState(0)
  const [overlay, setOverlay] = useState<'portfolio' | 'log' | null>(null)
  const [dismissResult, setDismissResult] = useState(false)
  const [muted, setMuted] = useState(false)
  const [notice, setNotice] = useState('')
  const [particles, setParticles] = useState<MoneyParticle[]>([])
  const [diceSealValue, setDiceSealValue] = useState<number | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const busy = useRef(false)
  const generation = useRef(0)
  const particleId = useRef(0)
  const nextActionAt = useRef(0)

  useEffect(() => () => { generation.current++ }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!saveGameLocally(game)) {
        setNotice('Không lưu tự động được trên trình duyệt này. Hãy xuất nhật ký trong Ví để giữ ván. Khi đóng hoặc tải lại trang, các lượt chưa lưu có thể mất.')
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [game])

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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể thực hiện hành động.')
      return false
    }
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

    // Medieval Dice Seal Result Flourish
    setAnimation('pause')
    setDiceSealValue(rolled.dice)
    sound.playCoin()
    await delay(650)
    if (token !== generation.current) return
    setDiceSealValue(null)

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
  const goal = goalProgress(game)
  const pieces = (
    <>
      <Dice3D
        value={game.dice || 1}
        isRolling={animation === 'dice'}
        isPawnMoving={animation === 'moving'}
        onRollClick={rollDice}
        disabled={disabled}
        isUpOnLawn={!!animation || (game.dice > 0 && game.phase !== 'rolling')}
      />
      <FloatingMoney particles={particles} />
      {diceSealValue !== null && (
        <div className="medieval-dice-seal-container">
          <div className="medieval-dice-seal">
            <span className="seal-subtext">KẾT QUẢ</span>
            <span className="seal-number">{diceSealValue}</span>
            <span className="seal-unit">BƯỚC TIẾN</span>
          </div>
        </div>
      )}
    </>
  )

  const toggleMute = () => {
    const next = !muted
    sound.isMuted = next
    setMuted(next)
    if (next) sound.stopBgm()
    else { sound.unlockAudio(); sound.startBgm() }
  }

  return (
    <>
      <MobileContainer
        overlay={
          <>
            <TopHud
              cash={game.portfolio.cash}
              debt={game.portfolio.debt}
              lawfulProceeds={goal.funds}
              targetGoal={goal.target}
              isMuted={muted}
              lap={game.lap}
              totalLaps={game.totalLaps}
              onHelp={onHelp}
              helpDisabled={!!animation}
              onHome={onHome || onRestart}
              onToggleMute={toggleMute}
              onOpenSettings={() => setSettingsOpen(true)}
            />
            <BottomControls
              onRollClick={rollDice}
              disabled={disabled}
              lastDiceValue={game.dice || undefined}
              onBagClick={() => { if (!busy.current) setOverlay('portfolio') }}
              onGuideClick={() => { if (!busy.current) onHelp?.() }}
            />
          </>
        }
      >
        <BoardView
          game={game}
          currentTileIndex={animation ? animatedTile : game.position}
          tileCoordinates={coordinates}
          lap={game.lap}
          totalLaps={game.totalLaps}
          isPawnMoving={animation === 'moving'}
          isDancing={!animation && game.phase === 'summary'}
        >
          {pieces}
        </BoardView>
      </MobileContainer>

      {!animation && !overlay && (!dismissResult || game.phase !== 'finished') && (
        <GamePhase
          game={game}
          send={send}
          onRestart={onRestart}
          onHome={onHome}
          onHelp={onHelp}
          onDismissResult={() => setDismissResult(true)}
        />
      )}

      {dismissResult && game.phase === 'finished' && !overlay && (
        <div
          style={{
            position: 'fixed',
            bottom: '84px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
          }}
        >
          <button
            onClick={() => setDismissResult(false)}
            className="medieval-ribbon-btn"
            style={{
              padding: '10px 22px',
              fontSize: '13.5px',
              fontWeight: 900,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '8px',
              whiteSpace: 'nowrap',
              border: '2px solid #b45309',
            }}
          >
            <span>🏆</span>
            <strong>Xem Kết Quả Ván Chơi</strong>
          </button>
        </div>
      )}

      {overlay && (
        <UnifiedManagementSheet
          game={game}
          initialTab={overlay}
          onClose={() => setOverlay(null)}
          onHelp={onHelp}
        />
      )}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isMuted={muted}
        onToggleMute={toggleMute}
        onRestart={onRestart}
        onHelp={onHelp}
      />

      {notice && (
        <Modal title="Không thể thực hiện" onClose={() => setNotice('')}>
          <p role="alert">{localizeNarrative(notice)}</p>
        </Modal>
      )}
    </>
  )
}

export default function App() {
  const [screen, setScreen] = useState<'entrance' | 'map' | 'game' | 'setup'>('entrance')
  const [session, setSession] = useState<Session | null>(null)
  const [saved, setSaved] = useState(() => loadGameLocally())
  const [saveNotice, setSaveNotice] = useState('')
  const [muted, setMuted] = useState(() => sound.isMuted)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mapOverlay, setMapOverlay] = useState<'portfolio' | 'rules' | null>(null)

  useEffect(() => { preloadGameAssets() }, [])

  // Chương 1 (Node 1) là chương duy nhất mở khóa, gồm 4 vòng chơi (Laps 1-4).
  // Các vòng chơi thuộc tiến trình nội bộ của Chương 1, không nhảy node hay mở khóa Chương 2-5.

  const returnToMap = () => {
    if (session) {
      const latest = session.getSnapshot()
      if (latest.phase === 'finished') {
        window.localStorage.removeItem(GAME_SAVE_KEY)
        setSaved(null)
      } else {
        const persisted = saveGameLocally(latest)
        setSaved(latest)
        setSaveNotice(persisted ? '' : 'Ván mới nhất chỉ còn trong phiên này vì trình duyệt không lưu được.')
      }
    }
    setScreen('map')
  }

  const handleStartFreshGame = () => {
    const fresh = createMvpMobileGame(String(Date.now()), 0, 1)
    saveGameLocally(fresh)
    setSaved(fresh)
    setSession(createMobileSession(fresh))
    setScreen('game')
  }

  const handlePlayNode = (node: MapNodeConfig) => {
    sound.playClick()
    void node.id
    if (saved && saved.phase !== 'finished') {
      setSession(createMobileSession(saved))
      setScreen('game')
    } else {
      handleStartFreshGame()
    }
    // Chạm Node 1: nếu là tân binh, mở trực tiếp modal "Chào Tân Binh" trên bàn cờ
    if (!isTutorialDisabled() && !hasSeenTutorial()) {
      setTutorial('first')
    }
  }

  const handleToggleSound = () => {
    const next = !sound.isMuted
    sound.isMuted = next
    setMuted(next)
    if (next) sound.stopBgm()
    else { sound.unlockAudio(); sound.startBgm() }
  }

  const [tutorial, setTutorial] = useState<'first' | 'help' | null>(() => hasSeenTutorial() ? null : 'first')
  const openHelp = () => setTutorial('help')

  // Bấm PLAY trên EntranceScreen: vào thẳng màn hình Bản Đồ 4 Vòng
  const handlePlayFromEntrance = () => {
    sound.playClick()
    setScreen('map')
  }

  const closeTutorial = () => {
    if (tutorial === 'first') {
      rememberTutorial()
    }
    setTutorial(null)
    if (screen === 'entrance') {
      setScreen('map')
    }
  }

  return (
    <>
      {screen === 'entrance' ? (
        <MobileContainer>
          <EntranceScreen
            onPlay={handlePlayFromEntrance}
            isMuted={muted}
            onToggleMute={handleToggleSound}
            onRestart={handleStartFreshGame}
            onHelp={openHelp}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          {tutorial !== 'first' && (
            <div style={{ display: 'none' }} aria-hidden="true" id="initial-savings" />
          )}
        </MobileContainer>
      ) : screen === 'map' ? (
        <MobileContainer>
          <MapScreen
            onBack={() => setScreen('entrance')}
            onPlayNode={handlePlayNode}
            onOpenSettings={() => setSettingsOpen(true)}
            isMuted={muted}
            onToggleMute={handleToggleSound}
            game={session ? session.getSnapshot() : (saved || undefined)}
            onOpenInventory={() => setMapOverlay('portfolio')}
            onOpenRules={() => setMapOverlay('rules')}
          />
        </MobileContainer>
      ) : screen === 'setup' ? (
        <MobileContainer>
          <GameSetup
            onHelp={openHelp}
            saved={saved}
            saveNotice={saveNotice}
            onRestore={s => { setSession(createMobileSession(s)); setScreen('game') }}
            onStart={(seed, savings, term) => { setSession(createMobileSession(createMvpMobileGame(seed, savings, term))); setScreen('game') }}
          />
        </MobileContainer>
      ) : (
        session && (
          <GameExperience
            session={session}
            onRestart={handleStartFreshGame}
            onHome={returnToMap}
            onHelp={openHelp}
            helpOpen={!!tutorial}
          />
        )
      )}

      {/* Root Layer Modals cho Map Screen (chuẩn hóa kích thước tương đương Playboard, tránh scale-down) */}
      {screen === 'map' && mapOverlay === 'portfolio' && (
        <UnifiedManagementSheet
          game={session ? session.getSnapshot() : (saved || createMvpMobileGame('map-preview', 0, 1))}
          initialTab="portfolio"
          onClose={() => setMapOverlay(null)}
          onHelp={() => setMapOverlay('rules')}
        />
      )}
      {screen === 'map' && mapOverlay === 'rules' && (
        <UnifiedGameGuide
          firstTime={false}
          onClose={() => setMapOverlay(null)}
          game={session?.getSnapshot() || saved || undefined}
        />
      )}

      {tutorial === 'first' ? (
        <Tutorial firstTime onClose={closeTutorial} />
      ) : tutorial === 'help' ? (
        <UnifiedGameGuide firstTime={false} onClose={closeTutorial} game={session?.getSnapshot()} />
      ) : null}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        isMuted={muted}
        onToggleMute={handleToggleSound}
        onRestart={handleStartFreshGame}
        onHelp={openHelp}
      />
    </>
  )
}
