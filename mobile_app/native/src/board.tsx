import { palette } from './theme'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, AppState, Easing, Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useAssets } from 'expo-asset'
import { Canvas, useFrame, useLoader } from '@react-three/fiber/native'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { AnimationMixer, Box3, Vector3 } from 'three'
import { money } from '../../../src/game/format'
import coords from '../../src/data/tiles-b18.json'
import type { Arena } from './arena-model'
import { tileLabel } from './arena-model'
import { art } from './assets'
import { ArtButton, Copy, Eye } from './ui'
import { Dice3D } from './dice-3d'
import type { RollPresentation, RollStage } from './roll-presentation'

const coordinate = (index: number, scale: number) => {
  const point = coords[index] ?? coords[0]
  return { x: point.x * scale, y: point.y * scale }
}

const pawnCamera = { position: [2.5, 2.1, 5.5] as [number, number, number], fov: 35 }

function Model({ uri, running, moving }: { uri: string; running: boolean; moving: boolean }) {
  const { scene, animations } = useLoader(GLTFLoader, uri)
  const size = useMemo(() => {
    const box = new Box3().setFromObject(scene)
    return { scale: 2 / Math.max(.1, box.getSize(new Vector3()).y), offset: box.getCenter(new Vector3()).negate() }
  }, [scene])
  const mixer = useMemo(() => new AnimationMixer(scene), [scene])
  useEffect(() => {
    const clip = animations.find(item => item.name.includes(moving ? 'Run' : 'Idle')) ?? animations.find(item => item.name.includes('Idle'))
    const action = clip ? mixer.clipAction(clip) : null
    action?.reset().play()
    return () => { action?.stop() }
  }, [animations, mixer, moving])
  useEffect(() => () => { mixer.stopAllAction(); mixer.uncacheRoot(scene) }, [mixer, scene])
  useFrame((_state, delta) => { if (running) mixer.update(Math.min(delta, .1)) })
  return <group scale={size.scale}><primitive object={scene} position={size.offset} /></group>
}
const styles = StyleSheet.create({
  hud: { position: 'absolute', left: 12, right: 12, top: 12, gap: 6, alignSelf: 'center', maxWidth: 440 },
  tray: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: '#0f172aad', borderWidth: 1, borderColor: '#cba35d88', borderRadius: 99,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 5 },
  gold: { color: '#ffe19a', fontSize: 9, lineHeight: 11, textAlign: 'center' },
  white: { color: '#fff4db', fontSize: 11, lineHeight: 14, textAlign: 'center' },
  icon: { width: 22, height: 22 },
  dock: { position: 'absolute', bottom: 6, left: 12, right: 12, alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'center', maxWidth: 440 },
})

export function Board({ arena, peek, blocked, onRoll, onReturn, onHome, onWallet, onGuide, onSound, onSettings, onTile, presentation, onPresentationComplete }: {
  arena: Arena; peek: boolean; blocked: boolean; onRoll: () => void; onReturn: () => void; onHome: () => void
  onWallet: () => void; onGuide: () => void; onSound: () => void; onSettings?: () => void; onTile: (position: number) => void
  presentation?: RollPresentation | null; onPresentationComplete?: (id: number, stage: RollStage) => void
}) {
  const { width } = useWindowDimensions()
  const [pawnAsset] = useAssets([art.pawn])
  const pawnUri = pawnAsset?.[0]?.localUri ?? pawnAsset?.[0]?.uri
  const [box, setBox] = useState({ width, height: width * 1672 / 940 })
  const scale = Math.min(box.width / 940, box.height / 1672)
  const pawn = useMemo(() => new Animated.ValueXY(), [])
  const tumble = useMemo(() => new Animated.Value(1), [])
  const rollSequence = arena.journal.findLast(entry => entry.kind === 'roll')?.sequence
  const diceSettled = useRef(() => {})
  const presentationId = presentation?.id
  const presentationFrom = presentation?.from
  const presentationStage = presentation?.stage
  const [reduceMotion, setReduceMotion] = useState(true)
  const [foreground, setForeground] = useState(() => AppState.currentState === 'active')
  const moving = presentationStage === 'pawn' && foreground && !reduceMotion
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'))
    return () => subscription.remove()
  }, [])
  useEffect(() => {
    let active = true
    void AccessibilityInfo.isReduceMotionEnabled().then(enabled => { if (active) setReduceMotion(enabled) }).catch(() => {})
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => { active = false; subscription.remove() }
  }, [])
  const setSize = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout
    setBox(current => current.width === width && current.height === height ? current : { width, height })
  }
  useEffect(() => {
    let live = true
    if (presentationId === undefined || presentationFrom === undefined || presentationStage === 'waiting' || reduceMotion || !foreground) {
      pawn.setValue(coordinate(presentationStage === 'waiting' ? presentationFrom ?? arena.position : arena.position, scale))
      tumble.setValue(1)
      return
    }
    pawn.setValue(coordinate(presentationFrom, scale))
    if (presentationStage === 'dice') {
      let bounceDone = false, spinDone = false
      const finish = () => { if (live && bounceDone && spinDone) onPresentationComplete?.(presentationId, 'dice') }
      diceSettled.current = () => { spinDone = true; finish() }
      tumble.setValue(0)
      const bounce = Animated.timing(tumble, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true })
      bounce.start(({ finished }) => { bounceDone = finished; finish() })
      return () => { live = false; diceSettled.current = () => {}; bounce.stop() }
    }
    tumble.setValue(1)
    if (presentationFrom === arena.position) { onPresentationComplete?.(presentationId, 'pawn'); return }
    const steps: Animated.CompositeAnimation[] = []
    for (let p = (presentationFrom + 1) % arena.board.length; ; p = (p + 1) % arena.board.length) {
      const toValue = coordinate(p, scale)
      steps.push(Animated.timing(pawn, { toValue, duration: 145, easing: Easing.out(Easing.quad), useNativeDriver: true }))
      if (p === arena.position) break
    }
    const movement = Animated.sequence(steps)
    movement.start(({ finished }) => {
      if (!live) return
      if (finished) onPresentationComplete?.(presentationId, 'pawn')
    })
    return () => { live = false; movement.stop() }
  }, [arena.board.length, arena.position, foreground, onPresentationComplete, pawn, presentationId, presentationFrom, presentationStage, reduceMotion, scale, tumble])
  const canRoll = arena.phase === 'rolling' && !blocked && !peek
  const animatePawn = foreground && !reduceMotion && (moving || peek || canRoll)
  const fill = Math.max(0, Math.min(100, arena.proceeds / arena.target * 100))
  const canvas = { width: 940 * scale, height: 1672 * scale }
  const pawnWidth = canvas.width * .18
  const pawnHeight = canvas.width * .23
  const danger = arena.portfolio.cash < 5_000_000 && arena.phase !== 'finished'
  const rollWidth = Math.max(128, Math.min(156, width * .34))
  const rollHeight = Math.max(68, Math.min(86, width * .18))
  return <View testID="native-b18-board" style={{ flex: 1, backgroundColor: palette.dark, alignItems: 'center', justifyContent: 'center' }} onLayout={setSize}>
    <View style={canvas}>
      <Image source={art.city} style={StyleSheet.absoluteFill} contentFit="fill"/>
      <Image source={art.board} accessibilityLabel="Bàn cờ B18, 18 ô" style={StyleSheet.absoluteFill} contentFit="fill"/>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -24, top: -13, width: 48, height: 26,
        borderRadius: 24, borderWidth: 2, borderColor: danger ? '#f87171' : '#ffec9e', backgroundColor: danger ? '#ef444433' : '#fbbf2444',
        transform: pawn.getTranslateTransform() }}/>
      {arena.board.map((tile, index) => {
        const { x, y } = coordinate(index, scale)
        const reached = peek && arena.reachable.includes(index)
        return <Pressable key={tile.index} accessibilityRole="button" accessibilityLabel={'Ô ' + (index + 1) + ' · ' + tileLabel(arena, index)}
          disabled={blocked && !peek} onPress={() => onTile(index)}
          style={{ position: 'absolute', top: y - 24, left: x - 24, width: 48, height: 48, borderRadius: 10,
            borderWidth: reached ? 2 : 0, borderColor: '#fff5bb' }}/>
      })}
      {pawnUri && <Animated.View pointerEvents="none" style={{ position: 'absolute', width: pawnWidth, height: pawnHeight, left: -pawnWidth / 2, top: -pawnHeight * .84,
        transform: pawn.getTranslateTransform() }}>
        <Canvas camera={pawnCamera} frameloop={animatePawn ? 'always' : 'demand'}>
          <ambientLight intensity={2.2}/><directionalLight position={[3, 6, 7]} intensity={2.4}/>
          <Suspense fallback={null}><Model uri={pawnUri} running={animatePawn} moving={moving}/></Suspense>
        </Canvas>
      </Animated.View>}
    </View>
    {danger && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { borderWidth: 5, borderColor: '#ef444477' }]}/>}
    <View style={styles.hud} pointerEvents="box-none">
      <View style={styles.row}>
        <ArtButton label="Bản đồ" icon={art.boardHome} onPress={onHome} disabled={blocked || peek} size={36}/>
        <View style={[styles.tray, { flex: 1, minHeight: 34, borderColor: danger ? '#f87171' : '#cba35d88' }]}>
          <Image source={art.money} style={{ width: 26, height: 26 }} contentFit="contain"/>
          <View>
            <Copy variant="note" style={[styles.gold, danger && { color: '#f87171' }]}>{danger ? 'ĐỆM NGUY CẤP' : 'TIỀN MẶT'}</Copy>
            <Copy variant="heading" testID="b18-cash" numberOfLines={1}
              style={[styles.white, { fontSize: 13, lineHeight: 17 }]}>{money(arena.portfolio.cash)}</Copy>
          </View>
        </View>
        <ArtButton label="Âm thanh" icon={art.soundButton} onPress={onSound} disabled={peek} size={36}/>
        {onSettings && <ArtButton label="Cài đặt" icon={art.settings} onPress={onSettings} disabled={peek || blocked} size={36}/>}
      </View>
      <View style={[styles.row, { gap: 8 }]}>
        <View style={styles.tray}><Image source={art.round} style={styles.icon} contentFit="contain"/>
          <Copy style={styles.white}>VÒNG {String(arena.lap).padStart(2, '0')} / {String(arena.totalLaps).padStart(2, '0')}</Copy></View>
        <View style={styles.tray}><Image source={art.goal} style={styles.icon} contentFit="contain"/>
          <Copy style={styles.white}>Mục tiêu · {(arena.proceeds / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/{arena.target / 1_000_000}M</Copy></View>
      </View>
      <View style={{ height: 4, overflow: 'hidden', borderRadius: 4, backgroundColor: '#534c34' }}>
        <LinearGradient colors={['#d97706', '#f59e0b', '#fbbf24', '#fde047']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${fill}%`, height: 4 }}/>
      </View>
    </View>
    {peek && <View style={{ position: 'absolute', right: 14, bottom: 106 }}><Eye open onPress={onReturn}/></View>}
    <View testID="native-board-dock" pointerEvents="box-none" style={styles.dock}>
      <ArtButton label="Túi đồ" icon={art.wallet} onPress={onWallet} disabled={peek || !!presentation} size={Math.max(56, Math.min(68, width * .16))}/>
      <View style={{ alignItems: 'center' }}>
        {arena.dice > 0 && <Animated.View pointerEvents="none" style={{ transform: [
          { translateY: tumble.interpolate({ inputRange: [0, .38, .7, 1], outputRange: [0, -80, -13, 0] }) },
          { rotate: tumble.interpolate({ inputRange: [0, 1], outputRange: ['-360deg', '0deg'] }) },
          { scale: tumble.interpolate({ inputRange: [0, .38, 1], outputRange: [.9, 1.7, 1] }) },
        ] }}><View style={[styles.tray, { gap: 2, marginBottom: 6 }]}>
          <Dice3D value={arena.dice} rollSequence={rollSequence} motion={foreground && !reduceMotion}
            animationId={presentation?.stage === 'dice' ? presentation.id : undefined} onSettled={() => diceSettled.current()}/>
          <Copy style={{ color: '#fff', fontSize: 20, fontFamily: 'Fredoka700' }}>{arena.dice}</Copy></View></Animated.View>}
        <ArtButton label="Lắc xúc xắc" icon={art.roll} onPress={onRoll} disabled={!canRoll || moving} width={rollWidth} height={rollHeight}/>
      </View>
      <ArtButton label="Sổ tay" icon={art.mapGuide} onPress={onGuide} disabled={peek || !!presentation} size={Math.max(56, Math.min(68, width * .16))}/>
    </View>
  </View>
}
