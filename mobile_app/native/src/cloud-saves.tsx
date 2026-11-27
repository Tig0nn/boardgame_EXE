import { useRef, useState, useEffect } from 'react'
import { BackHandler, StyleSheet, TextInput } from 'react-native'
import { Image } from 'expo-image'
import { randomUUID } from 'expo-crypto'
import { apiMessage, recoverable, type SessionDetail, type SessionHeader } from '../../src/game/server-session'
import type { useAccount } from './account'
import { art } from './assets'
import { CloudGame } from './game'
import { Action, Copy, Panel } from './ui'
import { palette, styles } from './theme'
import { trackGameStarted } from './analytics/runtime'
import { cloudGameSignal } from './analytics/game-signal'

type Props = {
  account: ReturnType<typeof useAccount>
  back: () => void
  sound: () => void
  playSound: () => void
}

export function CloudSaveFlow(props: Props) {
  // A new owner gets a new workspace, including requests, drafts and game controllers.
  return <CloudWorkspace key={props.account.session?.user.id ?? 'signed-out'} {...props}/>
}

function CloudWorkspace({ account, back, sound, playSound }: Props) {
  const api = account.api
  const [route, setRoute] = useState<'auth' | 'saves' | 'cloud'>('auth')
  const [detail, setDetail] = useState<SessionDetail>()
  const [list, setList] = useState<SessionHeader[]>()
  const [hasMore, setHasMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const lock = useRef(false)
  const creation = useRef<{ key: string; id?: string } | null>(null)
  async function run(work: () => Promise<unknown>) {
    if (lock.current) return
    lock.current = true; setBusy(true); setFailure('')
    try { await work() } catch (error) { setFailure(apiMessage(error)) }
    finally { lock.current = false; setBusy(false) }
  }
  function loadCloud(more = false) {
    if (!api) return
    setRoute('saves')
    void run(async () => {
      const rows = await api.list(more ? list?.length ?? 0 : 0)
      setList(previous => more ? [...new Map([...(previous ?? []), ...rows.sessions].map(item => [item.id, item])).values()] : rows.sessions)
      setHasMore(rows.sessions.length === 20)
    })
  }
  function openCloud(id: string) {
    if (!api) return
    void run(async () => { setDetail(await api.read(id)); setRoute('cloud') })
  }
  function newCloud(replay = false) {
    if (!api || lock.current) return
    const attempt = creation.current ?? { key: randomUUID() }
    creation.current = attempt
    void run(async () => {
      try {
        attempt.id ??= (await api.create(attempt.key)).session.id
        const next = await api.read(attempt.id)
        creation.current = null
        trackGameStarted(() => cloudGameSignal(next), replay)
        setDetail(next); setRoute('cloud')
      } catch (error) {
        if (!attempt.id && !recoverable(error)) creation.current = null
        throw error
      }
    })
  }
  useEffect(() => {
    if (route === 'cloud') return
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!lock.current) back()
      return true
    })
    return () => listener.remove()
  }, [route, back])
  if (route === 'cloud' && detail && api) return <CloudGame key={detail.session.id} initial={detail} api={api}
    ownerExit={() => { if (!lock.current) loadCloud() }} restart={() => newCloud(true)} sound={sound} playSound={playSound}/>
  return <>
    <Image source={art.map} style={StyleSheet.absoluteFill} contentFit="cover"/>
    {route === 'auth' ? <Panel title="Tài khoản EXE" header={<Action label="Đóng" disabled={busy} onPress={back}/>}>
      {api ? <Action label="Mở Cloud Save" onPress={() => loadCloud()} tone="primary"/> :
        <AccountForm busy={busy || !account.ready} message={account.message} configured={account.configured}
          onSubmit={(email, password, register) => { void run(() => account.authenticate(email, password, register)) }}/>}
    </Panel> : <Panel title="Ván chơi của bạn" header={<Action label="Bản đồ" disabled={busy} onPress={back}/>}>
      <Action label="Tạo ván mới" onPress={() => newCloud(false)} disabled={busy} tone="primary"/>
      {busy && <Copy accessibilityLiveRegion="polite">Đang tải ván…</Copy>}
      {(failure || account.message) && <Copy accessibilityRole="alert">{failure || account.message}</Copy>}
      {list?.length === 0 && <Copy>Bạn chưa có ván trực tuyến.</Copy>}
      {list?.map(item => <Action key={item.id} label={(item.status === 'completed' ? 'Xem kết quả' : item.status === 'abandoned' ? 'Đã bỏ ván' : 'Tiếp tục ván')
        + ' · ' + new Date(item.updatedAt).toLocaleString('vi-VN')} disabled={busy || item.status === 'abandoned'} onPress={() => openCloud(item.id)}/>)}
      {hasMore && <Action label="Xem thêm ván" disabled={busy} onPress={() => loadCloud(true)}/>}
      <Action label="Tải lại danh sách" onPress={() => loadCloud()} disabled={busy}/>
      <Action label="Đăng xuất" disabled={busy} onPress={() => { void run(async () => { await account.signOut() }) }}/>
    </Panel>}
  </>
}

function AccountForm({ busy, message, configured, onSubmit }: {
  busy: boolean; message: string; configured: boolean; onSubmit: (email: string, password: string, register: boolean) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [register, setRegister] = useState(false)
  if (!configured) return <Copy>Cấu hình dịch vụ tài khoản chưa có trên bản cài này. Bạn có thể chơi và lưu trên thiết bị.</Copy>
  return <>
    <TextInput style={styles.input} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="Email"
      accessibilityLabel="Email" placeholderTextColor={palette.muted} value={email} onChangeText={setEmail} editable={!busy}/>
    <TextInput style={styles.input} secureTextEntry autoComplete={register ? 'new-password' : 'password'} placeholder="Mật khẩu"
      accessibilityLabel="Mật khẩu" placeholderTextColor={palette.muted} value={password} onChangeText={setPassword} editable={!busy}/>
    {message && <Copy accessibilityRole="alert">{message}</Copy>}
    <Action label={register ? 'Tạo tài khoản' : 'Đăng nhập'} disabled={busy || !email.trim() || !password}
      onPress={() => onSubmit(email.trim(), password, register)} tone="primary"/>
    <Action label={register ? 'Đã có tài khoản' : 'Tạo tài khoản mới'} disabled={busy} onPress={() => setRegister(!register)}/>
  </>
}
