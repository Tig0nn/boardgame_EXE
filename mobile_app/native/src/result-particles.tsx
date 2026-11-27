import { useEffect, useMemo } from 'react'
import { Animated, StyleSheet, View } from 'react-native'
import { useVisualMotion } from './visual-motion'

const confetti = ['#fbbf24', '#f59e0b', '#10b981', '#34d399', '#ec4899', '#60a5fa', '#a855f7']
const rain = ['#93c5fd', '#60a5fa', '#38bdf8', '#bae6fd']
// Fixed decorative positions avoid touching either the game's RNG or Math.random.
const particles = Array.from({ length: 24 }, (_, index) => ({
  x: (index * 37 + 13) % 100, delay: (index % 6) / 10, size: 3 + index % 4,
}))

export function ResultParticles({ won }: { won: boolean }) {
  const motion = useVisualMotion()
  const progress = useMemo(() => new Animated.Value(0), [])
  useEffect(() => {
    progress.setValue(0)
    if (!motion) return
    const animation = Animated.loop(Animated.timing(progress, { toValue: 1, duration: 3200, useNativeDriver: true }))
    animation.start()
    return () => { animation.stop(); progress.setValue(0) }
  }, [motion, progress, won])
  if (!motion) return null
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 18 }]}>
    {particles.map((particle, index) => <Animated.View key={index} style={{
      position: 'absolute', left: `${particle.x}%`, top: 0, width: won ? particle.size : 1.2,
      height: won ? particle.size * .8 : particle.size + 5, borderRadius: won ? .5 : 1,
      backgroundColor: (won ? confetti : rain)[index % (won ? confetti.length : rain.length)],
      opacity: progress.interpolate({ inputRange: [0, particle.delay + .05, particle.delay + .25, 1], outputRange: [0, 0, .75, 0] }),
      transform: [
        { translateY: progress.interpolate({ inputRange: [0, particle.delay + .05, 1], outputRange: [-10, -10, 240] }) },
        { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, won ? (index % 2 ? 28 : -28) : -30] }) },
        { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', won ? (index % 2 ? '280deg' : '-280deg') : '20deg'] }) },
      ],
    }}/>) }
  </View>
}
