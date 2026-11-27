import { palette } from './src/theme'
import { useEffect, useRef, useState } from 'react'
import { AppState, BackHandler, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { useFonts, Fredoka_500Medium, Fredoka_700Bold } from '@expo-google-fonts/fredoka'
import { useAudioPlayer } from 'expo-audio'
import { randomUUID } from 'expo-crypto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { GAME_SAVE_KEY, restoreSavedGame } from '../../src/game/saved-game'
import { createMultiCourseGame } from '../../src/game/new-game'
import type { GameState } from '../../src/game/types'
import { apiMessage } from '../src/game/server-session'
import { useAccount } from './src/account'
import { art } from './src/assets'
import { GuideContent, LocalGame } from './src/game'
import { CloudSaveFlow } from './src/cloud-saves'
import { Action, Copy, Panel } from './src/ui'
import { fromLocal } from './src/arena-model'
import { ChapterMap, Landing } from './src/journey-screens'
import { AnalyticsSettings } from './src/analytics-settings'
import { gameplayAnalytics, analyticsForeground, trackGameStarted } from './src/analytics/runtime'
import { localGameSignal } from './src/analytics/game-signal'

type Route = 'entrance' | 'map' | 'local' | 'online'

function Journey() {
  const [route, setRoute] = useState<Route>('entrance')
  const [guide, setGuide] = useState(false)
  const [settings, setSettings] = useState(false)
  const [local, setLocal] = useState<GameState>()
  const [saved, setSaved] = useState(false)
  const [failure, setFailure] = useState('')
  const [muted, setMuted] = useState(false)
  const actionAudio = useAudioPlayer(art.confirm)
  const lock = useRef(false)
  const pendingStart = useRef<{ key: string; replay: boolean } | undefined>(undefined)
  const account = useAccount()
  const practice = (replay = false) => {
    if (lock.current) return
    const game = createMultiCourseGame(randomUUID(), 0, 1)
    pendingStart.current = { key: game.seed, replay }
    setLocal(game)
    setRoute('local')
  }
  function resume() {
    void run(async () => {
      const data = await AsyncStorage.getItem(GAME_SAVE_KEY)
      if (!data) throw Error('Missing local game')
      const value = restoreSavedGame(data)
      if (value.boardLayout !== 'B18' || value.totalLaps !== 4) throw Error('Unsupported board')
      pendingStart.current = undefined
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
    if (route !== 'local' || !local || pendingStart.current?.key !== local.seed) return
    const replay = pendingStart.current.replay
    pendingStart.current = undefined
    trackGameStarted(() => localGameSignal(local), replay)
  }, [route, local])
  useEffect(() => {
    if (AppState.currentState === 'active') analyticsForeground()
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') analyticsForeground()
      else gameplayAnalytics.background()
    })
    const retry = setInterval(() => { void gameplayAnalytics.flush() }, 30_000)
    return () => { subscription.remove(); clearInterval(retry) }
  }, [])
  useEffect(() => {
    if (route !== 'map') return
    let live = true
    void AsyncStorage.getItem(GAME_SAVE_KEY).then(value => { if (live) setSaved(!!value) }).catch(() => { if (live) setSaved(false) })
    return () => { live = false }
  }, [route])
  useEffect(() => {
    if (route === 'local' || route === 'online') return
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (settings) { setSettings(false); return true }
      if (guide) { setGuide(false); return true }
      if (lock.current) return true
      if (route !== 'entrance') { setRoute(route === 'map' ? 'entrance' : 'map'); return true }
      return false
    })
    return () => back.remove()
  }, [guide, route, settings])

  return <SafeAreaView style={{ flex: 1, backgroundColor: palette.dark }}>
    <StatusBar style="light"/>
    {route === 'entrance' && <Landing open={() => setRoute('map')} settings={() => setSettings(true)} sound={toggleSound} muted={muted}/>}
    {route === 'map' && <ChapterMap open={() => practice(false)} online={() => setRoute('online')} account={!!account.session} guide={() => setGuide(true)}
      back={() => setRoute('entrance')} saved={saved} continueGame={resume} settings={() => setSettings(true)} sound={toggleSound} muted={muted}/>}
    {route === 'online' && <CloudSaveFlow account={account} back={leaveGame} sound={toggleSound} playSound={playSound}/>}
    {route === 'local' && local && <LocalGame key={local.seed} initial={local} ownerExit={leaveGame} sound={toggleSound} playSound={playSound} restart={() => practice(true)}/>}
    {route === 'map' && !!failure && <Panel title="Ván lưu trên thiết bị" header={<Action label="Đóng" onPress={() => setFailure('')}/>}><Copy>{failure}</Copy></Panel>}
    {guide && <Panel title="Sổ tay chiến lược" header={<Action label="Đóng" onPress={() => setGuide(false)}/>}>
      <GuideContent arena={fromLocal(createMultiCourseGame('rulebook', 0, 1))}/>
    </Panel>}
    {settings && <Panel title="Cài đặt" icon={art.settings} header={<Action label="Đóng" onPress={() => setSettings(false)}/>}>
      <Action label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'} onPress={toggleSound}/>
      <Action label="Sổ tay" onPress={() => { setSettings(false); setGuide(true) }}/>
      <Copy>Chuyển động trang trí tôn trọng cài đặt Giảm chuyển động của thiết bị.</Copy>
      <AnalyticsSettings/>
    </Panel>}
  </SafeAreaView>
}

export default function App() {
  const [ready] = useFonts({ Fredoka500: Fredoka_500Medium, Fredoka700: Fredoka_700Bold })
  return <SafeAreaProvider>{ready ? <Journey/> : <View style={{ flex: 1, backgroundColor: palette.dark }}/>}</SafeAreaProvider>
}
