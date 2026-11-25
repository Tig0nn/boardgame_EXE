import { Image, type ImageSource } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextProps } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { useEffect, type ReactNode } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { palette, styles } from './theme'
import { foil, panelTheme } from './panel-theme'

export function Copy({ variant = 'body', style, ...props }: TextProps & { variant?: 'title' | 'heading' | 'body' | 'note' }) {
  return <Text {...props} style={[styles[variant], style]} />
}

export function Action({ label, onPress, disabled, tone = 'secondary', selected, children, testID }: {
  label: string; onPress: () => void; disabled?: boolean; tone?: 'primary' | 'secondary'; selected?: boolean; children?: ReactNode; testID?: string
}) {
  const primary = tone === 'primary'
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 48, borderRadius: 13, overflow: 'hidden', borderWidth: 1,
      borderColor: selected ? '#059669' : primary ? '#fb923c' : '#cbd5e1', opacity: disabled ? .5 : pressed ? .79 : 1,
      borderBottomWidth: primary ? 4 : 1, backgroundColor: selected ? '#ecfdf5' : palette.paper })}>
    {primary && <LinearGradient colors={['#FBBF24', '#F97316', '#EA580C']} locations={[0, .48, 1]} style={StyleSheet.absoluteFill} />}
    <View style={{ paddingVertical: 11, paddingHorizontal: 12, gap: 4 }}>
      <Copy variant="heading" style={primary ? { color: '#2d1003', textAlign: 'center' } : undefined}>{label}</Copy>
      {children}
    </View>
  </Pressable>
}

export function ArtButton({ label, icon, onPress, disabled, size = 44 }: {
  label: string; icon: ImageSource | number; onPress: () => void; disabled?: boolean; size?: number
}) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => ({
      width: Math.max(48, size), height: Math.max(48, size), alignItems: 'center', justifyContent: 'center',
      opacity: disabled ? .42 : pressed ? .76 : 1,
    })}><Image source={icon} style={{ width: size, height: size }} contentFit="contain" /></Pressable>
}

export function Eye({ open, onPress }: { open: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={open ? 'Quay lại quyết định' : 'Xem bàn cờ'}
    onPress={onPress} style={{ width: 48, height: 48, borderRadius: 13, borderWidth: 1,
      borderColor: palette.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.parchment }}>
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#78350f" strokeWidth={1.8}>
      <Path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" /><Circle cx={12} cy={12} r={2.5} />
    </Svg>
  </Pressable>
}

export function Fox({ size = 38 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 52 48" accessibilityLabel="Cáo EXE">
    <Path d="M10 26 7 5Q7 2 11 4L22 14h8L41 4q4-2 4 1l-3 21-16 16Z" fill="#d77834" stroke="#592c23" strokeWidth={2} strokeLinejoin="round"/>
    <Path d="m12 9 2 13 7-6zm28 0-2 13-7-6z" fill="#793d39"/>
    <Path d="M7 27c7-5 14-2 19 6 5-8 12-11 19-6L26 43Z" fill="#ffecd2" stroke="#592c23" strokeWidth={2} strokeLinejoin="round"/>
    <Path d="m23 33 3-1 3 1-3 3Z" fill="#391f1c"/>
    <Circle cx={17} cy={26} r={1.8} fill="#391f1c"/><Circle cx={35} cy={26} r={1.8} fill="#391f1c"/>
    <Path d="m19 42 7-3 7 3-7 4Z" fill="#497b61" stroke="#294d3a" strokeWidth={1.4}/>
  </Svg>
}

export function Panel({ title, subtitle, header, children, footer, lap, icon, hero, visible = true, locked = false }: {
  title: string; subtitle?: string; header?: ReactNode; children: ReactNode; footer?: ReactNode;
  lap?: number; icon?: ImageSource | number; hero?: ReactNode; visible?: boolean; locked?: boolean
}) {
  const insets = useSafeAreaInsets()
  const theme = panelTheme(lap)
  useEffect(() => { if (!visible) Keyboard.dismiss() }, [visible])
  return <KeyboardAvoidingView enabled={visible} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={insets.top}
    accessibilityViewIsModal={visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    pointerEvents={visible ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, {
      display: visible ? 'flex' : 'none', zIndex: 10, justifyContent: 'center', padding: 8, backgroundColor: '#0a0f1dd1',
    }]}>
    <LinearGradient colors={lap ? foil : ['#edc891', '#a26344', '#e9be7b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      testID="native-panel-frame" style={{ width: '94%', maxWidth: 370, alignSelf: 'center', height: lap ? '82%' : undefined,
        maxHeight: lap ? 690 : '92%', borderRadius: 28, padding: 3, flexShrink: 1 }}>
      <View style={{ borderRadius: 25, backgroundColor: palette.parchment, borderWidth: 1, borderColor: '#b4530940',
        gap: 10, padding: 13, paddingTop: subtitle && lap ? 22 : 12, flexShrink: 1, flexGrow: 1, minHeight: 0 }}>
        {subtitle && lap && <LinearGradient colors={theme.ribbon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          testID="native-panel-ribbon" style={{ position: 'absolute', top: -13, alignSelf: 'center', maxWidth: '94%',
            borderRadius: 22, borderWidth: 1, borderColor: theme.edge, paddingVertical: 5, paddingHorizontal: 12, zIndex: 1 }}>
          <Copy variant="note" style={{ color: '#fff', textAlign: 'center', fontFamily: 'Fredoka700', textShadowColor: '#0008', textShadowRadius: 2 }}>{subtitle}</Copy>
        </LinearGradient>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexShrink: 0 }}>
          {icon !== undefined && <Image source={icon} contentFit="contain" style={{ width: 30, height: 30 }} accessibilityIgnoresInvertColors/>}
          <View style={{ flex: 1, gap: 2 }}>{subtitle && !lap && <Copy variant="note">{subtitle}</Copy>}
            <Copy variant="heading" accessibilityRole="header" style={{ color: '#1e1b4b', textAlign: header ? 'left' : 'center', fontSize: 18 }}>{title}</Copy></View>
          {header}
        </View>
        {hero}
        <ScrollView style={{ flexShrink: 1, flexGrow: lap ? 1 : 0, minHeight: 0 }} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" nestedScrollEnabled>
          <View pointerEvents={locked ? 'none' : 'auto'} importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}
            style={{ gap: 10 }}>{children}</View>
        </ScrollView>
        {(locked || footer) && <View testID="native-panel-footer" style={{ flexShrink: 0, borderTopWidth: 1,
          borderStyle: 'dashed', borderTopColor: '#e2e8f0', paddingTop: 8, gap: 6 }}>
        {locked ? <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <ActivityIndicator color={palette.green}/><Copy variant="note">Đang gửi quyết định…</Copy>
        </View> : footer}
        </View>}
      </View>
    </LinearGradient>
  </KeyboardAvoidingView>
}
