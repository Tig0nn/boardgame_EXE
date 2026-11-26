import type { ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Arena } from './arena-model'
import { ResultHero } from './decision-presentation'
import { Copy } from './ui'

// Result has its own Web-sized frame; decision Panel geometry stays unchanged.
// Journey already applies SafeAreaView, so only subtract insets when sizing.
export function ResultLayout({ arena, onClose, footer, children }: {
  arena: Arena; onClose: () => void; footer: ReactNode; children: ReactNode
}) {
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const won = arena.result?.outcome === 'victory'
  return <View accessibilityViewIsModal style={[StyleSheet.absoluteFill, { zIndex: 10,
    justifyContent: 'center', alignItems: 'center', padding: 10, backgroundColor: 'rgba(12,10,8,0.78)' }]}>
    <View testID="result-frame" style={{ width: Math.min(340, Math.max(0, width - insets.left - insets.right - 20) * .88),
      height: Math.min(660, height * .8, Math.max(0, height - insets.top - insets.bottom - 20)),
      borderRadius: 30, backgroundColor: '#fff', elevation: 16, shadowColor: '#000', shadowOpacity: .45,
      shadowRadius: 25, shadowOffset: { width: 0, height: 20 } }}>
      <View style={{ flex: 1, borderRadius: 30, overflow: 'hidden', borderWidth: 1.5,
        borderColor: won ? '#fcd34d99' : '#c7d2fe99' }}>
        <ResultHero arena={arena} onClose={onClose}/>
        <ScrollView testID="result-body" style={{ flex: 1, minHeight: 0 }} nestedScrollEnabled
          contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 13, gap: 8 }}>
          {children}
        </ScrollView>
        <View testID="result-footer" style={{ flexShrink: 0, paddingTop: 8, paddingHorizontal: 12,
          paddingBottom: 10, gap: 6, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#fff' }}>{footer}</View>
      </View>
    </View>
  </View>
}

export function ResultAction({ label, accessibilityLabel = label, primary = false, onPress }: {
  label: string; accessibilityLabel?: string; primary?: boolean; onPress: () => void
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 48, borderRadius: primary ? 20 : 16, overflow: 'hidden', justifyContent: 'center',
      borderWidth: 1, borderBottomWidth: primary ? 4 : 1, borderColor: primary ? '#c2410c' : '#cbd5e1',
      backgroundColor: '#f8fafc', opacity: pressed ? .8 : 1 })}>
    {primary && <LinearGradient colors={['#fb923c', '#f97316', '#ea580c']} style={StyleSheet.absoluteFill}/>}
    <Copy variant="heading" style={{ paddingVertical: 8, paddingHorizontal: 8, textAlign: 'center',
      color: primary ? '#fff' : '#475569', fontSize: primary ? 14 : 12, lineHeight: primary ? 20 : 16 }}>{label}</Copy>
  </Pressable>
}
