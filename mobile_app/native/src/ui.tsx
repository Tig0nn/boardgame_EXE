import { Image, type ImageSource } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, type TextProps } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import type { ReactNode } from 'react'

import { palette, styles } from './theme'

export function Copy({ variant = 'body', style, ...props }: TextProps & { variant?: 'title' | 'heading' | 'body' | 'note' }) {
  return <Text {...props} style={[styles[variant], style]} />
}

export function Action({ label, onPress, disabled, tone = 'secondary', selected, children, testID }: {
  label: string; onPress: () => void; disabled?: boolean; tone?: 'primary' | 'secondary'; selected?: boolean; children?: ReactNode; testID?: string
}) {
  const primary = tone === 'primary'
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 46, borderRadius: 13, overflow: 'hidden', borderWidth: 1,
      borderColor: selected ? '#aa550a' : palette.gold, opacity: disabled ? .5 : pressed ? .79 : 1,
      backgroundColor: selected ? '#ffeed0' : palette.paper })}>
    {primary && <LinearGradient colors={['#ffd66d', '#f48220', '#cf490b']} style={StyleSheet.absoluteFill} />}
    <View style={{ paddingVertical: 10, paddingHorizontal: 12, gap: 3 }}>
      <Copy variant="heading" style={primary ? { color: '#3e1705' } : undefined}>{label}</Copy>
      {children}
    </View>
  </Pressable>
}

export function ArtButton({ label, icon, onPress, disabled, size = 44 }: {
  label: string; icon: ImageSource | number; onPress: () => void; disabled?: boolean; size?: number
}) {
  return <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => ({
      width: size, height: size, opacity: disabled ? .42 : pressed ? .76 : 1,
    })}><Image source={icon} style={{ width: '100%', height: '100%' }} contentFit="contain" /></Pressable>
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

export function Panel({ title, subtitle, header, children, footer, visible = true, locked = false }: {
  title: string; subtitle?: string; header?: ReactNode; children: ReactNode; footer?: ReactNode;
  visible?: boolean; locked?: boolean
}) {
  return <View accessibilityViewIsModal={visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    pointerEvents={visible ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, {
      display: visible ? 'flex' : 'none', zIndex: 10, justifyContent: 'center', padding: 13, backgroundColor: '#0a111cd6',
    }]}>
    <LinearGradient colors={['#edc891', '#a26344', '#e9be7b']} style={{ maxHeight: '92%', borderRadius: 25, padding: 4 }}>
      <View style={{ borderRadius: 22, backgroundColor: palette.parchment, gap: 8, padding: 12, flexShrink: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: 2 }}>{subtitle && <Copy variant="note">{subtitle}</Copy>}<Copy variant="title">{title}</Copy></View>
          {header}
        </View>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
          keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          <View pointerEvents={locked ? 'none' : 'auto'} importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}
            style={{ gap: 10 }}>{children}</View>
        </ScrollView>
        {locked ? <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <ActivityIndicator color={palette.green}/><Copy variant="note">Đang gửi quyết định…</Copy>
        </View> : footer}
      </View>
    </LinearGradient>
  </View>
}
