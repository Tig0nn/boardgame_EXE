import { palette, styles } from './src/theme'
import { useEffect, useRef, useState } from 'react'
import { BackHandler, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
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
import { apiMessage } from '../src/game/server-session'
import { useAccount } from './src/account'
import { art } from './src/assets'
import { GuideContent, LocalGame } from './src/game'
import { CloudSaveFlow } from './src/cloud-saves'
import { Action, ArtButton, Copy, Panel } from './src/ui'
import { fromLocal } from './src/arena-model'

type Route = 'entrance' | 'map' | 'local' | 'online'

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

function Journey() {
  const [route, setRoute] = useState<Route>('entrance')
  const [guide, setGuide] = useState(false)
  const [local, setLocal] = useState<GameState>()
  const [saved, setSaved] = useState(false)
  const [failure, setFailure] = useState('')
  const [muted, setMuted] = useState(false)
  const actionAudio = useAudioPlayer(art.confirm)
  const lock = useRef(false)
  const account = useAccount()
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
    lock.current = true; setFailure('')
    try { await work() } catch (problem) { setFailure(error ?? apiMessage(problem)) }
    finally { lock.current = false }
  }
  const playSound = () => {
    if (!muted) void actionAudio.seekTo(0).then(() => actionAudio.play()).catch(() => {})
  }
  const toggleSound = () => { if (!muted) actionAudio.pause(); setMuted(!muted) }
  const leaveGame = () => setRoute('map')
  useEffect(() => {
    if (route !== 'map') return
    let live = true
    void AsyncStorage.getItem(GAME_SAVE_KEY).then(value => { if (live) setSaved(!!value) }).catch(() => { if (live) setSaved(false) })
    return () => { live = false }
  }, [route])
  useEffect(() => {
    if (route === 'local' || route === 'online') return
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (guide) { setGuide(false); return true }
      if (lock.current) return true
      if (route !== 'entrance') { setRoute(route === 'map' ? 'entrance' : 'map'); return true }
      return false
    })
    return () => back.remove()
  }, [guide, route])

  return <SafeAreaView style={{ flex: 1, backgroundColor: palette.dark }}>
    <StatusBar style="light"/>
    {route === 'entrance' && <Landing open={() => setRoute('map')} guide={() => setGuide(true)}/>}
    {route === 'map' && <ChapterMap open={practice} online={() => setRoute('online')} account={!!account.session} guide={() => setGuide(true)}
      back={() => setRoute('entrance')} saved={saved} continueGame={resume}/>}
    {route === 'online' && <CloudSaveFlow account={account} back={leaveGame} sound={toggleSound} playSound={playSound}/>}
    {route === 'local' && local && <LocalGame key={local.seed} initial={local} ownerExit={leaveGame} sound={toggleSound} playSound={playSound} restart={practice}/>}
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
