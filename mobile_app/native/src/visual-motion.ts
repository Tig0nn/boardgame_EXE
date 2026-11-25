import { useEffect, useMemo, useState } from 'react'
import { AccessibilityInfo, Animated, AppState, Easing } from 'react-native'

export function useVisualMotion() {
  const [reduced, setReduced] = useState(true)
  const [foreground, setForeground] = useState(() => AppState.currentState === 'active')
  useEffect(() => {
    let live = true
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReduced(value) }).catch(() => {})
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    const app = AppState.addEventListener('change', state => setForeground(state === 'active'))
    return () => { live = false; motion.remove(); app.remove() }
  }, [])
  return !reduced && foreground
}

export function useBreathing(enabled: boolean, duration = 1300) {
  const value = useMemo(() => new Animated.Value(0), [])
  useEffect(() => {
    if (!enabled) { value.setValue(0); return }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]))
    animation.start()
    return () => { animation.stop(); value.setValue(0) }
  }, [duration, enabled, value])
  return value
}
