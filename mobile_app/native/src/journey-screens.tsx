import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { MAP_1_NODES } from '../../src/game/map-progress'
import { art } from './assets'
import { Action, ArtButton, Copy, Panel } from './ui'
import { palette, styles } from './theme'
import { useBreathing, useVisualMotion } from './visual-motion'

const chapterArt = [art.chapter1, art.chapter2, art.chapter3, art.chapter4, art.chapter5]

function SceneArrival({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const opacity = useMemo(() => new Animated.Value(1), [])
  useEffect(() => {
    if (!enabled) { opacity.setValue(1); return }
    opacity.setValue(0)
    const animation = Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true })
    animation.start()
    return () => { animation.stop(); opacity.setValue(1) }
  }, [enabled, opacity])
  return <Animated.View style={{ flex: 1, opacity }}>{children}</Animated.View>
}

export function IllustratedFrame({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions()
  const scale = Math.min(width / 940, height / 1672)
  return <View style={{ flex: 1, backgroundColor: '#193319', justifyContent: 'center', alignItems: 'center' }}>
    <View style={{ width: 940 * scale, height: 1672 * scale, overflow: 'hidden' }}>{children}</View>
  </View>
}

export function JourneyUtilities({ back, settings, sound, muted, scale = 1 }: {
  back?: () => void; settings: () => void; sound: () => void; muted: boolean; scale?: number
}) {
  return <View style={{ position: 'absolute', top: 12, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
    {back ? <ArtButton label="Trang chủ" icon={art.logo} onPress={back} width={160 * scale} height={74 * scale}/>
      : <ArtButton label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'} icon={art.soundButton} onPress={sound} selected={muted} size={Math.max(36, 84 * scale)}/>}
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {back && <ArtButton label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'} icon={art.soundButton} onPress={sound} selected={muted} size={Math.max(32, 74 * scale)}/>}
      <ArtButton label="Cài đặt" icon={art.settings} onPress={settings} size={Math.max(32, 74 * scale)}/>
    </View>
  </View>
}

export function Landing({ open, settings, sound, muted }: { open: () => void; settings: () => void; sound: () => void; muted: boolean }) {
  const { width, height } = useWindowDimensions()
  const scale = Math.min(width / 940, height / 1672)
  const motion = useVisualMotion()
  const pulse = useBreathing(motion, 1400)
  return <IllustratedFrame><SceneArrival enabled={motion}><View style={{ flex: 1, backgroundColor: palette.dark }}>
    <Image source={art.splash} style={StyleSheet.absoluteFill} contentFit="cover"/>
    <JourneyUtilities settings={settings} sound={sound} muted={muted} scale={scale}/>
    <Animated.View style={{ position: 'absolute', bottom: 120 * scale, alignSelf: 'center',
      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }] }}>
      <ArtButton label="Bắt đầu phiêu lưu" icon={art.play} onPress={open} width={Math.min(480, Math.max(280, width * .52)) * scale} height={165 * scale}/>
    </Animated.View>
  </View></SceneArrival></IllustratedFrame>
}

export function ChapterMap({ open, online, account, guide, back, continueGame, saved, settings, sound, muted }: {
  open: () => void; online: () => void; account: boolean; guide: () => void; back: () => void
  continueGame: () => void; saved: boolean; settings: () => void; sound: () => void; muted: boolean
}) {
  const { width, height } = useWindowDimensions()
  const scale = Math.min(width / 940, height / 1672)
  const frameWidth = 940 * scale
  const scroll = useRef<ScrollView>(null)
  const [notice, setNotice] = useState('')
  const [bag, setBag] = useState(false)
  const motion = useVisualMotion()
  const pulse = useBreathing(motion)
  return <IllustratedFrame><SceneArrival enabled={motion}><View style={{ flex: 1, backgroundColor: '#0284c7' }}>
    <ScrollView ref={scroll} showsVerticalScrollIndicator={false}
      onContentSizeChange={() => scroll.current?.scrollTo({ y: 728 * scale, animated: false })}>
      <View style={{ width: frameWidth, height: 2400 * scale }}>
        <Image source={art.map} style={StyleSheet.absoluteFill} contentFit="fill"/>
        {MAP_1_NODES.map(node => {
          const active = node.stageNumber === 1
          const size = Math.max(48, 136 * scale)
          return <Pressable key={node.id} accessibilityRole="button"
            accessibilityLabel={node.title + (active ? '' : ', đang cập nhật')}
            onPress={() => active ? open() : setNotice('Chương ' + node.stageNumber + ': Đang cập nhật!')}
            style={({ pressed }) => ({ position: 'absolute', left: `${node.x}%`, top: `${node.y}%`, width: size, height: size,
              transform: [{ translateX: -size / 2 }, { translateY: -size / 2 }, { scale: pressed ? .94 : 1 }],
              alignItems: 'center', justifyContent: 'center' })}>
            {active && <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size * 1.4, height: size * 1.4,
              borderRadius: size, backgroundColor: '#22c55e55', opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [.4, .8] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [.9, 1.12] }) }] }}/>}
            <Image source={chapterArt[node.stageNumber - 1]} tintColor={active ? undefined : '#10242b'} style={{ width: size, height: size, opacity: active ? 1 : .78 }} contentFit="contain"/>
            {active ? <Animated.View pointerEvents="none" style={{ position: 'absolute', top: -68 * scale,
              transform: [{ translateY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -8 * scale] }) }] }}>
              <Image source={art.pin} style={{ width: 64 * scale, height: 64 * scale }} contentFit="contain"/>
            </Animated.View> : <View pointerEvents="none" style={{ position: 'absolute', bottom: -10, minWidth: 70, paddingHorizontal: 5, paddingVertical: 2,
              borderRadius: 8, backgroundColor: '#0f172ae0' }}><Copy variant="note" numberOfLines={1} style={{ color: '#fbbf24', fontSize: 9, textAlign: 'center' }}>Đang cập nhật</Copy></View>}
          </Pressable>
        })}
      </View>
    </ScrollView>
    <LinearGradient pointerEvents="none" colors={['#0a192dc7', '#0a192d00']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180 * scale }}/>
    <JourneyUtilities back={back} settings={settings} sound={sound} muted={muted} scale={scale}/>
    <View style={{ position: 'absolute', bottom: 16, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <ArtButton label="Túi đồ và ván lưu" icon={art.wallet} onPress={() => setBag(true)} size={Math.max(48, 120 * scale)}/>
      <Pressable accessibilityRole="button" accessibilityLabel={account ? 'Cloud Save · Ván của tôi' : 'Đăng nhập để lưu ván'} onPress={online}
        style={({ pressed }) => ({ flex: 1, minHeight: 48, marginHorizontal: 10, padding: 8, borderRadius: 18, justifyContent: 'center',
          borderColor: '#fbbf2470', borderWidth: 1, backgroundColor: '#0f172acc', opacity: pressed ? .8 : 1 })}>
        <Copy variant="note" style={{ color: '#fff3bf', textAlign: 'center' }}>{account ? 'Cloud Save · Ván của tôi' : 'Đăng nhập để lưu ván'}</Copy>
      </Pressable>
      <ArtButton label="Sổ tay" icon={art.mapGuide} onPress={guide} size={Math.max(48, 120 * scale)}/>
    </View>
    {!!notice && <View accessibilityLiveRegion="polite" style={[styles.card, { position: 'absolute', bottom: 90, left: 20, right: 20 }]}>
      <Copy>{notice}</Copy><Action label="Đóng" onPress={() => setNotice('')}/></View>}
    {bag && <Panel title="Túi đồ và ván lưu" icon={art.wallet} header={<Action label="Đóng" onPress={() => setBag(false)}/>}>
      <Copy>Tiếp tục một ván để xem tài sản và nhật ký của ván đó.</Copy>
      {saved && <Action label="Tiếp tục ván trên thiết bị" onPress={continueGame} tone="primary"/>}
      <Action label="Mở Cloud Save" onPress={online}/>
    </Panel>}
  </View></SceneArrival></IllustratedFrame>
}
