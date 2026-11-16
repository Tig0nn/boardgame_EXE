import { palette, styles } from './src/theme'
import { useEffect, useRef, useState } from 'react'
import { BackHandler, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { useFonts, Fredoka_500Medium, Fredoka_700Bold } from '@expo-google-fonts/fredoka'
import { useAudioPlayer } from 'expo-audio'
import { randomUUID } from 'expo-crypto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { GAME_SAVE_KEY, restoreSavedGame } from '../../src/game/saved-game'
import { createMultiCourseGame } from '../../src/game/new-game'
import type { GameState } from '../../src/game/types'
import { MAP_1_NODES } from '../src/game/map-progress'
import { apiMessage, recoverable, type SessionDetail, type SessionHeader } from '../src/game/server-session'
import { useAccount } from './src/account'
import { art } from './src/assets'
import { CloudGame, GuideContent, LocalGame } from './src/game'
import { Action, ArtButton, Copy, Panel } from './src/ui'
import { fromLocal } from './src/arena-model'

type Route = 'entrance' | 'map' | 'auth' | 'saves' | 'local' | 'cloud'

function Landing({ open, guide }: { open: () => void; guide: () => void }) {
  return <View style={{ flex: 1, backgroundColor: palette.dark }}>
    <Image source={art.splash} style={StyleSheet.absoluteFill} contentFit="cover"/>
    <View style={{ position: 'absolute', bottom: 54, alignSelf: 'center', alignItems: 'center', gap: 12 }}>
      <ArtButton label="Bắt đầu phiêu lưu" icon={art.play} onPress={open} size={112}/>
      <Action label="Sổ tay" onPress={guide}/>
    </View>
  </View>
}

function ChapterMap({ open, online, account, guide, back, continueGame, saved }: {
  open: () => void; online: () => void; account: boolean; guide: () => void; back: () => void
  continueGame: () => void; saved: boolean
}) {
  const { width } = useWindowDimensions()
  const scroll = useRef<ScrollView>(null)
  const [notice, setNotice] = useState('')
  const height = width * 2400 / 1080
  return <View style={{ flex: 1, backgroundColor: '#1e7190' }}>
    <ScrollView ref={scroll} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
      <View style={{ width, height }}>
        <Image source={art.map} style={StyleSheet.absoluteFill} contentFit="fill"/>
        {MAP_1_NODES.map(node => <Pressable key={node.id} accessibilityRole="button"
          accessibilityLabel={node.title + (node.stageNumber === 1 ? '' : ', đang cập nhật')}
          onPress={() => node.stageNumber === 1 ? open() : setNotice(node.title + ' đang cập nhật.')}
          style={{ position: 'absolute', left: `${node.x}%`, top: `${node.y}%`, width: 52, height: 57,
            transform: [{ translateX: -26 }, { translateY: -29 }], alignItems: 'center', justifyContent: 'center' }}>
          <Image source={art.pin} style={StyleSheet.absoluteFill} contentFit="contain" />
          <Copy variant="heading" style={{ color: '#fff3bf', marginTop: -12, textShadowColor: '#39210b', textShadowRadius: 4 }}>{node.stageNumber}</Copy>
        </Pressable>)}
      </View>
    </ScrollView>
    <View style={{ position: 'absolute', left: 13, right: 13, top: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
      <ArtButton label="Trang chủ" icon={art.home} onPress={back}/>
      <Copy variant="heading" style={{ color: '#fff3bf', backgroundColor: '#15382de8', borderRadius: 14, padding: 11 }}>HÀNH TRÌNH B18</Copy>
      <ArtButton label="Sổ tay" icon={art.guide} onPress={guide}/>
    </View>
    <View style={{ position: 'absolute', bottom: 8, left: 13, right: 13, gap: 6 }}>
      {!!notice && <View style={styles.card}><Copy>{notice}</Copy></View>}
      {saved && <Action label="Tiếp tục ván trên thiết bị" onPress={continueGame}/>}
      <Action label={account ? 'Cloud Save · Ván của tôi' : 'Đăng nhập để lưu ván'} onPress={online} tone="primary"/>
    </View>
  </View>
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

function Journey() {
  const [requestedRoute, setRoute] = useState<Route>('entrance')
  const [guide, setGuide] = useState(false)
  const [local, setLocal] = useState<GameState>()
  const [saved, setSaved] = useState(false)
  const [cloudSave, setCloud] = useState<{ owner: string; detail: SessionDetail }>()
  const [cloudList, setList] = useState<{ owner: string; sessions: SessionHeader[] }>()
  const [hasMore, setHasMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const [muted, setMuted] = useState(false)
  const actionAudio = useAudioPlayer(art.confirm)
  const lock = useRef(false)
  const creation = useRef<{ owner: string; key: string; id?: string } | null>(null)
  const account = useAccount()
  const api = account.api
  const owner = account.session?.user.id
  const cloud = cloudSave?.owner === owner ? cloudSave?.detail : undefined
  const list = cloudList?.owner === owner ? cloudList?.sessions : undefined
  const route = requestedRoute === 'cloud' && (!cloud || !api) || requestedRoute === 'saves' && !api
    ? 'auth' : requestedRoute
  const practice = () => {
    if (lock.current) return
    setLocal(createMultiCourseGame(randomUUID(), 0, 1))
    setRoute('local')
  }
  function resume() {
    void run(async () => {
      const data = await AsyncStorage.getItem(GAME_SAVE_KEY)
      if (!data) throw Error('Missing local game')
      const value = restoreSavedGame(data)
      if (value.boardLayout !== 'B18' || value.totalLaps !== 4) throw Error('Unsupported board')
      setLocal(value); setRoute('local')
    }, 'Không mở được ván lưu trên thiết bị.')
  }
  async function run(work: () => Promise<unknown>, error?: string) {
    if (lock.current) return
    lock.current = true; setBusy(true); setFailure('')
    try { await work() } catch (problem) { setFailure(error ?? apiMessage(problem)) }
    finally { lock.current = false; setBusy(false) }
  }
  const playSound = () => {
    if (!muted) void actionAudio.seekTo(0).then(() => actionAudio.play()).catch(() => {})
  }
  const toggleSound = () => { if (!muted) actionAudio.pause(); setMuted(!muted) }
  const leaveGame = () => setRoute(route === 'cloud' ? 'saves' : 'map')
  const openCloud = (id: string) => {
    if (!api || !owner) return
    void run(async () => { setCloud({ owner, detail: await api.read(id) }); setRoute('cloud') })
  }
  const loadCloud = (more = false) => {
    if (!api || !owner) return
    void run(async () => {
      const rows = await api.list(more ? list?.length ?? 0 : 0)
      setList(prev => ({ owner, sessions: more && prev?.owner === owner
        ? [...new Map([...prev.sessions, ...rows.sessions].map(item => [item.id, item])).values()] : rows.sessions }))
      setHasMore(rows.sessions.length === 20)
    })
  }
  const newCloud = () => {
    if (!api || !owner || lock.current) return
    const attempt = creation.current?.owner === owner ? creation.current : { owner, key: randomUUID() }
    creation.current = attempt
    void run(async () => {
      try {
        attempt.id ??= (await api.create(attempt.key)).session.id
        const newSave = await api.read(attempt.id)
        creation.current = null
        setCloud({ owner, detail: newSave }); setRoute('cloud')
      } catch (error) {
        if (!attempt.id && !recoverable(error)) creation.current = null
        throw error
      }
    })
  }
  const routeToCloud = () => {
    setFailure('')
    if (api) { setRoute('saves'); loadCloud() } else setRoute('auth')
  }
  useEffect(() => {
    if (route !== 'map') return
    let live = true
    void AsyncStorage.getItem(GAME_SAVE_KEY).then(value => { if (live) setSaved(!!value) }).catch(() => { if (live) setSaved(false) })
    return () => { live = false }
  }, [route])
  useEffect(() => {
    if (route === 'local' || route === 'cloud') return
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (guide) { setGuide(false); return true }
      if (busy) return true
      if (route !== 'entrance') { setRoute(route === 'map' ? 'entrance' : 'map'); return true }
      return false
    })
    return () => back.remove()
  }, [busy, guide, route])

  return <SafeAreaView style={{ flex: 1, backgroundColor: palette.dark }}>
    <StatusBar style="light"/>
    {route === 'entrance' && <Landing open={() => setRoute('map')} guide={() => setGuide(true)}/>}
    {route === 'map' && <ChapterMap open={practice} online={routeToCloud} account={!!account.session} guide={() => setGuide(true)}
      back={() => setRoute('entrance')} saved={saved} continueGame={resume}/>}
    {(route === 'auth' || route === 'saves') && <Image source={art.map} style={StyleSheet.absoluteFill} contentFit="cover"/>}
    {route === 'auth' && <Panel title="Tài khoản EXE" header={<Action label="Đóng" disabled={busy} onPress={() => setRoute('map')}/>}>
      {api ? <Action label="Mở Cloud Save" onPress={routeToCloud} tone="primary"/> : <AccountForm busy={busy || !account.ready} message={account.message}
        configured={account.configured} onSubmit={(email, password, register) => { void run(() => account.authenticate(email, password, register)) }}/>}
    </Panel>}
    {route === 'saves' && <Panel title="Ván chơi của bạn" header={<Action label="Bản đồ" disabled={busy} onPress={() => setRoute('map')}/>}>
      <Action label="Tạo ván mới" onPress={newCloud} disabled={busy} tone="primary"/>
      {busy && <Copy accessibilityLiveRegion="polite">Đang tải ván…</Copy>}
      {(failure || account.message) && <Copy accessibilityRole="alert">{failure || account.message}</Copy>}
      {list?.length === 0 && <Copy>Bạn chưa có ván trực tuyến.</Copy>}
      {list?.map(item => <Action key={item.id} label={(item.status === 'completed' ? 'Xem kết quả' : item.status === 'abandoned' ? 'Đã bỏ ván' : 'Tiếp tục ván')
        + ' · ' + new Date(item.updatedAt).toLocaleString('vi-VN')} disabled={busy || item.status === 'abandoned'} onPress={() => openCloud(item.id)}/>)}
      {hasMore && <Action label="Xem thêm ván" disabled={busy} onPress={() => loadCloud(true)}/>}
      <Action label="Tải lại danh sách" onPress={() => loadCloud()} disabled={busy}/>
      <Action label="Đăng xuất" disabled={busy} onPress={() => { void run(async () => {
        if (!await account.signOut()) return
        creation.current = null; setCloud(undefined); setList(undefined); setRoute('auth')
      }) }}/>
    </Panel>}
    {route === 'local' && local && <LocalGame key={local.seed} initial={local} ownerExit={leaveGame} sound={toggleSound} playSound={playSound} restart={practice}/>}
    {route === 'cloud' && cloud && api && <CloudGame key={cloud.session.id} initial={cloud} api={api} ownerExit={leaveGame} sound={toggleSound} playSound={playSound} restart={newCloud}/>}
    {route === 'map' && !!failure && <Panel title="Ván lưu trên thiết bị" header={<Action label="Đóng" onPress={() => setFailure('')}/>}><Copy>{failure}</Copy></Panel>}
    {guide && <Panel title="Sổ tay chiến lược" header={<Action label="Đóng" onPress={() => setGuide(false)}/>}>
      <GuideContent arena={fromLocal(createMultiCourseGame('rulebook', 0, 1))}/>
    </Panel>}
  </SafeAreaView>
}

export default function App() {
  const [ready] = useFonts({ Fredoka500: Fredoka_500Medium, Fredoka700: Fredoka_700Bold })
  return <SafeAreaProvider>{ready ? <Journey/> : <View style={{ flex: 1, backgroundColor: palette.dark }}/>}</SafeAreaProvider>
}
