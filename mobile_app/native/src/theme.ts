import { StyleSheet } from 'react-native'

export const palette = { ink: '#381f0b', muted: '#715236', parchment: '#faf6f0', paper: '#fffdf8', gold: '#b8905b',
  forest: '#163b30', dark: '#102820', green: '#16653c', red: '#a12525', orange: '#c65a12', line: '#e3d1b6' }
export const styles = StyleSheet.create({
  title: { color: palette.ink, fontFamily: 'Fredoka700', fontSize: 22 },
  heading: { color: palette.ink, fontFamily: 'Fredoka700', fontSize: 17 },
  body: { color: palette.ink, fontFamily: 'Fredoka500', fontSize: 15 },
  note: { color: palette.muted, fontFamily: 'Fredoka500', fontSize: 13 },
  card: { borderRadius: 16, backgroundColor: palette.paper, borderColor: palette.line, borderWidth: 1, padding: 12, gap: 6 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  input: { minHeight: 48, borderWidth: 1, borderColor: palette.gold, borderRadius: 12, paddingHorizontal: 12,
    backgroundColor: '#fff', color: palette.ink, fontSize: 16, fontFamily: 'Fredoka500' },
})
