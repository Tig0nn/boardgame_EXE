import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal } from '../../../src/components/Modal'
import { loadGameLocally } from '../../../src/game/saved-game'
import type { GameState } from '../../../src/game/types'
import { apiMessage, createGameApi, createServerSession, recoverable } from '../game/server-session'
import type { SessionHeader, Setup } from '../game/server-session'
import { EntranceScreen } from './EntranceScreen'
import { GameSetup } from './GameSetup'
import { MobileContainer } from './MobileContainer'
import { ServerGame } from './ServerGame'
import { UnifiedGameGuide } from './UnifiedGameGuide'
import { UnifiedManagementSheet } from './UnifiedManagementSheet'

export function OnlineApp({ accessToken, onSignOut, onPractice }: {
  accessToken: () => Promise<string | null>; onSignOut?: () => void; onPractice?: () => void
}) {
  const api = useMemo(() => createGameApi(accessToken), [accessToken])
  const [screen, setScreen] = useState<'entrance' | 'sessions' | 'setup' | 'game'>('entrance')
  const [sessions, setSessions] = useState<SessionHeader[]>([])
  const [controller, setController] = useState<ReturnType<typeof createServerSession> | null>(null)
  const [help, setHelp] = useState(false)
  const [legacy, setLegacy] = useState<GameState | null>(null)
  const [saved] = useState(loadGameLocally)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [createPending, setCreatePending] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const locked = useRef(false)
  const pending = useRef<{ key: string; setup: Setup } | null>(null)

  const run = async (work: () => Promise<void>) => {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    try { await work() }
    catch (problem) { setError(apiMessage(problem)) }
    finally { locked.current = false; setBusy(false) }
  }

  const list = (more = false) => {
    setScreen('sessions')
    void run(async () => {
      const data = await api.list(more ? sessions.length : 0)
      setHasMore(data.sessions.length === 20)
      setSessions(previous => more ? [...new Map([...previous, ...data.sessions].map(item => [item.id, item])).values()] : data.sessions)
    })
  }

  const open = async (id: string) => {
    setController(createServerSession(api, await api.read(id)))
    setScreen('game')
  }

  const create = (setup?: Setup) => {
    if (locked.current) return
    const request = pending.current ?? (setup && { key: crypto.randomUUID(), setup })
    if (!request) return
    pending.current = request
    void run(async () => {
      try {
        const { session } = await api.create(request.setup, request.key)
        await open(session.id)
        pending.current = null
        setCreatePending(false)
      } catch (problem) {
        if (!recoverable(problem)) pending.current = null
        setCreatePending(!!pending.current)
        throw problem
      }
    })
  }

  useEffect(() => {
    const reconnect = () => {
      if (controller) void controller.reload()
    }
    window.addEventListener('online', reconnect)
    return () => window.removeEventListener('online', reconnect)
  }, [controller])

  const newGame = () => { setError(''); setScreen('setup') }

  return <>
    {screen === 'entrance' && <MobileContainer><EntranceScreen onPlay={() => list()} onHelp={() => setHelp(true)} /></MobileContainer>}
    {screen === 'sessions' && <Modal title="Ván chơi của bạn" onClose={busy ? undefined : () => setScreen('entrance')}>
      <h2>Ván chơi của bạn</h2>
      <button type="button" className="button primary" disabled={busy} onClick={newGame}>Tạo ván mới</button>
      {busy && <p role="status">Đang tải ván…</p>}
      {error && <p role="alert">{error}</p>}
      {!busy && !error && !sessions.length && <p>Bạn chưa có ván trực tuyến.</p>}
      <ul>{sessions.map(item => <li key={item.id}>
        <button type="button" className="button secondary" disabled={busy || item.status === 'abandoned'} onClick={() => { void run(() => open(item.id)) }}>
          {item.status === 'completed' ? 'Xem kết quả' : item.status === 'abandoned' ? 'Đã bỏ ván' : 'Tiếp tục ván'} · {new Date(item.updatedAt).toLocaleString('vi-VN')}
        </button>
      </li>)}</ul>
      {hasMore && <button type="button" className="button secondary" disabled={busy} onClick={() => list(true)}>Xem thêm ván</button>}
      <button type="button" className="button secondary" disabled={busy} onClick={() => list()}>Tải lại danh sách</button>
      {onPractice && <button type="button" className="button secondary" disabled={busy} onClick={onPractice}>Chơi local bằng mã hành trình</button>}
      {onSignOut && <button type="button" className="button secondary" disabled={busy} onClick={onSignOut}>Đăng xuất</button>}
    </Modal>}
    {screen === 'setup' && <GameSetup online busy={busy || createPending} saved={saved}
      saveNotice={error} onHelp={() => setHelp(true)} onRestore={setLegacy}
      onClose={busy || createPending ? undefined : () => list()}
      onStart={(_seed, initialSavings, savingsTerm) => create({ initialSavings, savingsTerm })} />}
    {screen === 'setup' && createPending && <Modal title="Chưa xác nhận tạo ván">
      <p role="alert">{error}</p>
      <button type="button" className="button primary" disabled={busy} onClick={() => create()}>Thử lại tạo ván</button>
      <button type="button" className="button secondary" disabled={busy} onClick={() => { pending.current = null; setCreatePending(false); list() }}>Kiểm tra danh sách ván</button>
    </Modal>}
    {screen === 'game' && controller && <ServerGame key={controller.getSnapshot().detail.session.id} controller={controller} api={api}
      onHome={() => list()} onNew={newGame} />}
    {help && <UnifiedGameGuide onClose={() => setHelp(false)} />}
    {legacy && <UnifiedManagementSheet game={legacy} initialTab="log" onClose={() => setLegacy(null)}
      readOnlyNotice="Chỉ xem nhật ký từ thiết bị. Dữ liệu trong tệp chưa được máy chủ xác minh." />}
  </>
}
