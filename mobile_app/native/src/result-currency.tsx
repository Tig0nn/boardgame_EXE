import { Children } from 'react'
import { Platform, Text } from 'react-native'
import { Copy } from './ui'

// The bundled Fredoka fonts have no U+20AB glyph. Use explicit native metrics
// for the symbol instead of relying on Android's implicit font substitution.
export function ResultCopy({ children, accessibilityLabel, style, ...props }: Parameters<typeof Copy>[0]) {
  const parts = Children.toArray(children)
  if (!parts.some(part => typeof part === 'string' && part.includes('₫'))) {
    return <Copy {...props} accessibilityLabel={accessibilityLabel} style={style}>{children}</Copy>
  }
  const label = parts.every(part => typeof part === 'string' || typeof part === 'number') ? parts.join('') : undefined
  return <Copy {...props} accessibilityLabel={accessibilityLabel ?? label}
    style={[{ includeFontPadding: true, maxWidth: '100%' }, style]}>
    {/* Keep the formatted amount and symbol together without changing the accessible source text. */}
    {Children.map(children, part => typeof part !== 'string' ? part : part.replace(/(\d) (?=₫)/gu, '$1\u00a0').split(/(₫)/u).map((text, index) => text === '₫'
      ? <Text key={index} style={{ fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif', fontWeight: '400', fontStyle: 'normal' }}>{text}</Text>
      : text))}
  </Copy>
}
