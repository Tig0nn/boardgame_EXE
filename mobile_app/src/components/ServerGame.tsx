import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ASSETS } from '../../../src/data/config'
import { boardFor } from '../../../src/data/board'
import { goalForGame } from '../../../src/game/rules-profile'
import { money } from '../../../src/game/format'
import { Modal } from '../../../src/components/Modal'
import { readLearningContext } from '../../../src/ai/mascot/learning'
import { localizeNarrative } from '../../../src/components/glossary'
import tiles from '../data/tiles-b18.json'
import { createMascotCoach } from '../game/mascot-coach'
import { projectLearningEntries } from '../game/mascot-learning-context'
import type { MobileCommand } from '../game/session'
import type { createGameApi, createServerSession, SessionDetail } from '../game/server-session'
import { sound } from '../utils/audio'
import { BoardView } from './BoardView'
import { BottomControls } from './BottomControls'
import { Dice3D } from './Dice3D'
import { MascotCoach } from './MascotCoach'
import { MobileContainer } from './MobileContainer'
import { ServerGamePhase } from './ServerGamePhase'
import { TopHud } from './TopHud'
import { UnifiedGameGuide } from './UnifiedGameGuide'

function coachFacts(detail: SessionDetail, previous?: ReturnType<typeof coachFactsFromState>) {
  const facts = coachFactsFromState(detail)
  if (!previous || previous.id !== facts.id) return facts
  let prefix = 0
  while (prefix < previous.log.length && prefix < facts.log.length
    && JSON.stringify(previous.log[prefix]) === JSON.stringify(facts.log[prefix])) prefix++
  if (prefix) facts.log = [...previous.log.slice(0, prefix), ...facts.log.slice(prefix)]
  return facts
}

function coachFactsFromState({ session, state }: SessionDetail) {
  const target = goalForGame(state).target
  return { id: session.id, portfolio: state.portfolio, phase: state.phase, obligations: state.obligations,
    pendingPayment: state.pendingPayment, log: state.journal, goal: { target, remaining: Math.max(0, target - state.bank.liquidatableFunds) } }
}

function Wallet({ detail, onClose }: { detail: SessionDetail; onClose: () => void }) {
  const { state } = detail
  const [journal, setJournal] = useState(false)
  return <Modal title="Ví và nhật ký" onClose={onClose}>
    <button type="button" className="button secondary" onClick={() => setJournal(!journal)}>{journal ? 'Danh mục' : 'Nhật ký'}</button>
    {journal ? <ol>{state.journal.toReversed().map(item => <li key={item.sequence}>
      <details><summary>{localizeNarrative(item.title)}</summary><p>{localizeNarrative(item.decision)}</p><p>{localizeNarrative(item.consequence)}</p></details>
    </li>)}</ol> : <>
      <dl>{Object.entries(state.portfolio).map(([id, value]) => <div key={id}>
        <dt>{id === 'cash' ? 'Tiền mặt' : id === 'savings' ? 'Tiết kiệm' : id === 'debt' ? 'Dư nợ' : ASSETS[id as keyof typeof ASSETS].label}</dt><dd>{money(value)}</dd>
      </div>)}</dl>
      {state.bank.deposits.map(lot => <p key={lot.id}>{lot.id} · {money(lot.principal)} · Đáo hạn vòng {lot.maturityLap}</p>)}
      {Object.entries(state.holdings.stocks).filter(([, item]) => item.units > 0).map(([id, item]) => <p key={id}>{id} · {item.units.toLocaleString('vi-VN')} đơn vị</p>)}
      {state.holdings.bonds.filter(lot => lot.status === 'active').map(lot => <p key={lot.id}>{lot.id} · {money(lot.principal)}</p>)}
      {state.holdings.gold.units > 0 && <p>Vàng · {state.holdings.gold.units.toLocaleString('vi-VN')} đơn vị</p>}
      {state.business.owned && <p>Vốn kinh doanh {money(state.business.capital)} · Giá trị bán {money(state.business.currentSaleValue)}</p>}
    </>}
  </Modal>
}

export function ServerGame({ controller, api, onHome, onNew }: {
  controller: ReturnType<typeof createServerSession>; api: ReturnType<typeof createGameApi>; onHome: () => void; onNew: () => void
}) {
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const { detail } = view
  const { state, session, result } = detail
  const [overlay, setOverlay] = useState<'wallet' | 'help' | 'menu' | null>(null)
  const [muted, setMuted] = useState(() => sound.isMuted)
  const [animation, setAnimation] = useState<{ tile: number; rolling: boolean } | null>(null)
  const animating = useRef(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const coach = useMemo(() => createMascotCoach(), [])
  useEffect(() => {
    let last = controller.getSnapshot().detail
    let previous = coachFacts(last)
    return controller.subscribe(() => {
      const current = controller.getSnapshot().detail
      if (last === current) return
      const next = coachFacts(current, previous)
      coach.observe(previous, next)
      previous = next
      last = current
    })
    // The controller remains stable for the lifetime of a mounted session.
  }, [controller, coach])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const locked = view.busy || view.retryable || view.needsReload || !!animation
  const surface = overlay || animation ? null : state.phase === 'rolling' ? 'board' : state.phase === 'summary' || state.phase === 'finished' ? 'summary' : null
  useEffect(() => { coach.present(surface, performance.now()) }, [coach, surface, state])
  const context = useMemo(() => readLearningContext({
    cash: state.portfolio.cash, obligations: state.obligations, lap: state.lap, scenario: state.scenarioId,
    entries: projectLearningEntries(state.journal), gold: null,
    result: result ? { funds: Number(result.lawfulProceedsVnd), target: goalForGame(state).target,
      won: result.outcome === 'victory', insolvent: result.outcome === 'insolvent', worth: state.bank.totalWorth, requiredRounds: state.totalLaps } : null,
  }), [state, result])
  const companion = surface && <MascotCoach coach={coach} surface={surface} online={{ context, revision: String(session.stateVersion) }} />
  const board = boardFor(state)
  const send = (command: MobileCommand) => {
    if (locked || animating.current || overlay || !state.availableActions.includes(command.type)) return
    void controller.send(command, session.stateVersion)
  }
  const roll = async () => {
    if (locked || animating.current || overlay || !state.availableActions.includes('roll')) return
    animating.current = true
    setAnimation({ tile: state.position, rolling: true })
    sound.playDiceRoll()
    const accepted = await controller.send({ type: 'roll' }, session.stateVersion)
    if (!accepted) { animating.current = false; setAnimation(null); return }
    const rolled = controller.getSnapshot().detail.state
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animating.current = false
      setAnimation(null)
      return
    }
    const schedule = (callback: () => void, wait: number) => {
      timers.current.push(setTimeout(callback, wait))
    }
    for (let step = 1; step <= rolled.dice; step++) {
      schedule(() => setAnimation({ tile: (state.position + step) % board.length, rolling: false }), 280 * step)
    }
    schedule(() => { timers.current = []; animating.current = false; setAnimation(null) }, 280 * (rolled.dice + 1))
  }
  const home = () => { if (!locked && !animating.current) onHome() }

  return <>
    <MobileContainer overlay={<>
      <TopHud cash={state.portfolio.cash} debt={state.portfolio.debt} lawfulProceeds={state.bank.liquidatableFunds}
        targetGoal={goalForGame(state).target} lap={state.lap} totalLaps={state.totalLaps} isMuted={muted}
        onHome={home} onOpenSettings={() => { if (!locked) setOverlay('menu') }}
        onToggleMute={() => { sound.isMuted = !muted; setMuted(!muted); if (!muted) sound.stopBgm() }} />
      {surface === 'board' && companion}
      <BottomControls onRollClick={roll} disabled={locked || state.phase !== 'rolling' || !!overlay}
        lastDiceValue={state.dice || undefined} onBagClick={() => setOverlay('wallet')} onGuideClick={() => setOverlay('help')} />
    </>}>
      <BoardView tileCoordinates={board.map((tile, index) => ({ ...tiles[index], ...tile }))}
        currentTileIndex={animation?.tile ?? state.position} lap={state.lap} totalLaps={state.totalLaps}
        isPawnMoving={!!animation && !animation.rolling}>
        <Dice3D value={state.dice || 1} isRolling={!!animation?.rolling} isPawnMoving={!!animation && !animation.rolling}
          disabled={locked || state.phase !== 'rolling' || !!overlay} onRollClick={roll} />
      </BoardView>
    </MobileContainer>
    {!animation && !overlay && <ServerGamePhase detail={detail} api={api} send={send} locked={locked}
      onHome={home} onNew={onNew} refresh={() => { void controller.reload('Ván đã thay đổi. Đã tải lại trạng thái từ máy chủ.') }}
      coach={surface === 'summary' ? companion : undefined} />}
    {overlay === 'wallet' && <Wallet detail={detail} onClose={() => setOverlay(null)} />}
    {overlay === 'help' && <UnifiedGameGuide onClose={() => setOverlay(null)} />}
    {overlay === 'menu' && <Modal title="Ván chơi trực tuyến" onClose={() => setOverlay(null)}>
      <button type="button" className="button secondary" onClick={home}>Về danh sách ván</button>
      <button type="button" className="button secondary" onClick={onNew}>Tạo ván mới</button>
    </Modal>}
    {view.message && <Modal title="Kết nối ván chơi"
      onClose={view.retryable || view.needsReload ? undefined : controller.clearMessage}>
      <p role="alert">{view.message}</p>
      {!view.busy && view.message.includes('đăng nhập') && <button type="button" className="button secondary" onClick={onHome}>Về danh sách ván</button>}
      {view.retryable && <button type="button" className="button primary" disabled={view.busy} onClick={() => { void controller.retry() }}>Thử lại thao tác</button>}
      {view.needsReload && <button type="button" className="button primary" disabled={view.busy} onClick={() => { void controller.reload() }}>Tải lại ván</button>}
    </Modal>}
  </>
}
