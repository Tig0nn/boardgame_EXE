import { localizeNarrative } from '../../src/components/glossary'
import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode, RefObject } from 'react'
import type { GameState } from '../../src/game/types'
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
import { MascotCoach } from './components/MascotCoach'
import { createMascotCoach } from './game/mascot-coach'
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
import { WhatIfModal } from './components/WhatIfModal'
import type { RepairWhatIf } from '../../src/game/what-if'
import { createAppAnalysisBinding } from './game/endgame-analysis-app-binding'
import type { EndgameAppBinding, EndgameAppQaDriver, EndgameSessionOrigin } from './game/endgame-analysis-app-binding'

// Owner review only. Production builds cannot enable this via a URL.
const whatIfEnabled = import.meta.env.DEV && typeof window !== 'undefined'
  && (new URLSearchParams(window.location.search).get('whatIf') === '1'
    || new URLSearchParams(window.location.search).get('whatIfDemo') === 'repair')

// Explicit opt-in, compiled out of production; no changes to shared phase components.
const HistoricalHost = import.meta.env.DEV && typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('historicalWhatIf') === '1'
  ? lazy(() => import('./components/BankHistoricalReview')) : null
function HistoricalSlot({ session, game, children }: { session: Session; game: GameState; children: ReactNode }) {
  return HistoricalHost ? <Suspense fallback={children}><HistoricalHost session={session} game={game}>{children}</HistoricalHost></Suspense> : <>{children}</>
}
// Independent Gold DEV opt-in; App mount requires Owner approval.
const GoldHistoricalHost = import.meta.env.DEV && typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('goldHistoricalWhatIf') === '1'
  ? lazy(() => import('./components/GoldHistoricalReview')) : null
// Proposal only: this boundary owns Gold failure, never the gameplay subtree.
class GoldHistoricalBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? null : this.props.children }
}
function GoldGameplayScope({ root, children }: { root: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  return GoldHistoricalHost ? <div ref={root} data-gold-review-host="">{children}</div> : <>{children}</>
}
function GoldHistoricalSlot({ session, game, root }: { session: Session; game: GameState; root: RefObject<HTMLDivElement | null> }) {
  return GoldHistoricalHost && game.phase === 'rebalancing' ? <GoldHistoricalBoundary><Suspense fallback={null}><GoldHistoricalHost session={session} game={game} root={root}/></Suspense></GoldHistoricalBoundary> : null
}
// Coordinates are artwork metadata; category/order/labels come from the official C20 or B18 board.
const coordinatesFor = (board: ReturnType<typeof boardFor>) => {
  const source = board.length === 18 ? tilesB18Data : tilesData
  return board.map((tile, i) => ({ ...source[i], ...tile }))
}
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
type Session = ReturnType<typeof createMobileSession>

function bindMascotCoach(session: Session) {
  const coach = createMascotCoach()
  return {
    coach,
    connect() {
      let previous = session.getSnapshot()
      return session.subscribe(() => {
        const before = previous
        previous = session.getSnapshot()
        coach.observe(before, previous)
      })
    },
  }
}

type RenderEndgameResultAction = (watch: Session['subscribe']) => ReactNode

export function GameExperience({ session, onRestart, onHome, onHelp, helpOpen = false, persist = true, renderEndgameResultAction }: {
  session: Session;
  onRestart: () => void;
  onHome?: () => void;
  onHelp?: () => void;
  helpOpen?: boolean;
  persist?: boolean;
  renderEndgameResultAction?: RenderEndgameResultAction;
}) {
  // React subscribes to immutable engine snapshots: https://react.dev/reference/react/useSyncExternalStore
  const game = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const mascot = useMemo(() => bindMascotCoach(session), [session])
  useEffect(() => mascot.connect(), [mascot])
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
  const [whatIfFor, setWhatIfFor] = useState<RepairWhatIf | null>(null)
  const [reviewDismissedFor, setReviewDismissedFor] = useState<RepairWhatIf | null>(null)
  const comparison = session.getRepairWhatIf()
  const whatIfOpen = !!comparison && whatIfFor === comparison
  const reviewOpen = whatIfEnabled && !!comparison && reviewDismissedFor !== comparison && game.phase === 'rolling'
  const busy = useRef(false)
  const generation = useRef(0)
  const particleId = useRef(0)
  const goldPhaseRoot = useRef<HTMLDivElement>(null)
  const nextActionAt = useRef(0)

  useEffect(() => () => { generation.current++ }, [])
  useEffect(() => {
    if (!persist) return
    const timer = window.setTimeout(() => {
      if (!saveGameLocally(game)) {
        setNotice('Không lưu tự động được trên trình duyệt này. Hãy xuất nhật ký trong Ví để giữ ván. Khi đóng hoặc tải lại trang, các lượt chưa lưu có thể mất.')
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [game, persist])

  useEffect(() => {
    const unlock = () => { sound.unlockAudio(); if (!sound.isMuted) sound.startBgm() }
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  const send = (command: MobileCommand): boolean => {
    if (helpOpen || whatIfOpen || reviewOpen || busy.current || Date.now() < nextActionAt.current) return false
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
    if (helpOpen || whatIfOpen || reviewOpen || busy.current || Date.now() < nextActionAt.current || overlay || game.phase !== 'rolling') return
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

  const disabled = helpOpen || whatIfOpen || reviewOpen || !!animation || !!overlay || game.phase !== 'rolling'
  const mascotSurface = settingsOpen ? null : !disabled ? 'board'
    : (game.phase === 'summary' || game.phase === 'finished') && (game.phase !== 'finished' || !dismissResult) && !animation && !overlay && !helpOpen && !whatIfOpen && !reviewOpen ? 'summary' : null
  useEffect(() => { mascot.coach.present(mascotSurface, performance.now()) }, [mascot, mascotSurface, game])
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
            {mascotSurface === 'board' && <MascotCoach coach={mascot.coach} surface="board" game={game} />}
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

      {!animation && !overlay && !whatIfOpen && !reviewOpen && (!dismissResult || game.phase !== 'finished') && (
        <HistoricalSlot session={session} game={game}><GoldGameplayScope root={goldPhaseRoot}><GamePhase
          session={session}
          game={game}
          send={send}
          onRestart={onRestart}
          onHome={onHome}
          onHelp={onHelp}
          onDismissResult={() => setDismissResult(true)}
          summaryCoach={mascotSurface === 'summary' ? <MascotCoach coach={mascot.coach} surface="summary" game={game} /> : undefined}
          endgameResultAction={game.phase === 'finished' && !helpOpen && !settingsOpen
            ? renderEndgameResultAction?.(session.subscribe) : undefined}
        /><GoldHistoricalSlot session={session} game={game} root={goldPhaseRoot}/></GoldGameplayScope></HistoricalSlot>
      )}

      {reviewOpen && comparison && !animation && !overlay && !helpOpen && !settingsOpen &&
        <div aria-hidden={whatIfOpen || undefined}>
        <Modal title="Quyết định sửa xe vừa chọn" className="whatif-modal whatif-result" onClose={() => setReviewDismissedFor(comparison)}>
          <h2>Đã {comparison.actual.choice === 'full' ? 'sửa ngay' : 'sửa tạm'}</h2>
          <p>Đã trả {money(comparison.actual.paidNow)}. Tiền mặt còn {money(comparison.actual.cashAfter)}.</p>
          <p>{comparison.actual.obligationAdded > 0
            ? `Nghĩa vụ mới ở Xuất phát: ${money(comparison.actual.obligationAdded)}.`
            : 'Không phát sinh nghĩa vụ sửa xe mới.'}</p>
          <button className="whatif-review-link" onClick={() => {
            if (session.getRepairWhatIf() === comparison) setWhatIfFor(comparison)
          }}>Xem phương án khác</button>
          <button className="whatif-back" onClick={() => setReviewDismissedFor(comparison)}>Tiếp tục ván chơi</button>
        </Modal></div>}

      {whatIfEnabled && comparison && game.phase === 'rolling' && !animation && !overlay && !helpOpen && !settingsOpen && whatIfOpen &&
        <WhatIfModal comparison={comparison} onClose={() => setWhatIfFor(null)} />}

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

type EndgameResultDriver = EndgameAppQaDriver & {
  renderEndgameResultAction?: RenderEndgameResultAction
}

type RestoreQaDriver = EndgameResultDriver & { setupRequests?: EventTarget }

export default function App(props: { endgameQa?: RestoreQaDriver; endgameBeta?: EndgameResultDriver; onLeaveLocal?: () => void } = {}) {
  const endgameQa = import.meta.env.DEV ? props.endgameQa : undefined
  const resultDriver = import.meta.env.DEV ? endgameQa : import.meta.env.PROD && import.meta.env.VITE_ENDGAME_WHAT_IF_BETA === '1' ? props.endgameBeta : undefined
  const [screen, setScreen] = useState<'entrance' | 'map' | 'game' | 'setup'>(props.onLeaveLocal ? 'setup' : 'entrance')
  const [session, setSession] = useState<Session | null>(null)
  const [saved, setSaved] = useState(() => loadGameLocally())
  const [saveNotice, setSaveNotice] = useState('')
  const [muted, setMuted] = useState(() => sound.isMuted)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mapOverlay, setMapOverlay] = useState<'portfolio' | 'rules' | null>(null)

  useEffect(() => { preloadGameAssets() }, [])

  const endgameBinding = useRef<EndgameAppBinding | null>(null)
  const endgameSession = useRef<{ session: Session; origin: EndgameSessionOrigin } | null>(null)
  useEffect(() => {
    if (!import.meta.env.DEV && !(import.meta.env.PROD && import.meta.env.VITE_ENDGAME_WHAT_IF_BETA === '1')) return
    if (!resultDriver) return
    const binding = createAppAnalysisBinding({ transport: resultDriver.transport })
    endgameBinding.current = binding
    const current = endgameSession.current
    if (current) binding.replaceSession(current.session, current.origin)
    let disconnect: (() => void) | undefined
    try {
      disconnect = resultDriver.connect(binding)
    } catch {
      binding.dispose()
      endgameBinding.current = null
    }
    return () => {
      if (endgameBinding.current === binding) endgameBinding.current = null
      binding.dispose()
      try {
        disconnect?.()
      } catch { /* QA teardown must not interrupt gameplay. */ }
    }
  }, [resultDriver])

  useEffect(() => {
    if (!import.meta.env.DEV || !endgameQa?.setupRequests) return
    const target = endgameQa.setupRequests
    const openSetup = () => setScreen('setup')
    target.addEventListener('open-setup', openSetup)
    return () => target.removeEventListener('open-setup', openSetup)
  }, [endgameQa])

  const installSession = (next: Session, origin: EndgameSessionOrigin) => {
    endgameBinding.current?.replaceSession(next, origin)
    endgameSession.current = { session: next, origin }
    setSession(next)
  }

  // Chương 1 (Node 1) là chương duy nhất mở khóa, gồm 4 vòng chơi (Laps 1-4).
  // Các vòng chơi thuộc tiến trình nội bộ của Chương 1, không nhảy node hay mở khóa Chương 2-5.

  const returnToMap = () => {
    endgameBinding.current?.revoke('home')
    endgameSession.current = null
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
    installSession(createMobileSession(fresh, { whatIf: whatIfEnabled }), 'fresh')
    setScreen('game')
  }

  const handlePlayNode = (node: MapNodeConfig) => {
    sound.playClick()
    void node.id
    if (saved && saved.phase !== 'finished') {
      installSession(createMobileSession(saved, { whatIf: whatIfEnabled }), 'saved')
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
            onClose={props.onLeaveLocal}
            onHelp={openHelp}
            saved={saved}
            saveNotice={saveNotice}
            onRestore={s => { installSession(createMobileSession(s, { whatIf: whatIfEnabled }), 'restored-state'); setScreen('game') }}
            onStart={(seed, savings, term) => { installSession(createMobileSession(createMvpMobileGame(seed, savings, term), { whatIf: whatIfEnabled }), 'fresh'); setScreen('game') }}
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
            renderEndgameResultAction={resultDriver?.renderEndgameResultAction}
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
