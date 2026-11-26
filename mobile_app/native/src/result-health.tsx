import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { Arena } from './arena-model'
import { resultReview } from './result-review'
import { Copy } from './ui'

export function ResultAccordion({ title, children, initialOpen = false, dark = false }: {
  title: string; children: ReactNode; initialOpen?: boolean; dark?: boolean
}) {
  const [open, setOpen] = useState(initialOpen)
  return <View style={{ borderRadius: 14, borderWidth: 1, borderColor: dark ? '#475569' : '#e2e8f0',
    backgroundColor: dark ? '#ffffff0a' : '#f8fafc', overflow: 'hidden' }}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: open }} aria-expanded={open}
      onPress={() => setOpen(value => !value)} style={({ pressed }) => ({ minHeight: 48, padding: 10,
        flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: pressed ? '#94a3b826' : 'transparent' })}>
      <Copy variant="note" style={{ flex: 1, fontFamily: 'Fredoka700', color: dark ? '#f8fafc' : '#334155' }}>{title}</Copy>
      <Copy style={{ color: dark ? '#cbd5e1' : '#64748b' }}>{open ? '−' : '+'}</Copy>
    </Pressable>
    {open && <View style={{ padding: 10, paddingTop: 0, gap: 8 }}>{children}</View>}
  </View>
}

const pillars = [
  ['cashflowScore', '🛡️ Dòng Tiền & Runway', '#38bdf8'],
  ['diversificationScore', '📊 Đa Dạng Hóa', '#a78bfa'],
  ['growthScore', '🚀 Hiệu Suất Sinh Lời', '#34d399'],
  ['riskControlScore', '⚖️ Quản Trị Rủi Ro', '#fbbf24'],
] as const

export function ResultHealth({ arena }: { arena: Arena }) {
  const review = useMemo(() => resultReview(arena), [arena])
  const report = review.health
  const won = arena.result?.outcome === 'victory'
  return <View style={{ gap: 10 }}>
    <LinearGradient colors={['#1e293b', '#0f172a']} testID="result-health-card"
      style={{ borderRadius: 16, padding: 12, gap: 10, borderWidth: 2, borderColor: won ? '#f59e0b' : '#64748b' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Copy variant="note" style={{ color: '#94a3b8', fontSize: 11, letterSpacing: .5 }}>HỒ SƠ TƯ DUY TÀI CHÍNH</Copy>
          <Copy variant="heading" style={{ color: '#fef08a', fontSize: 16 }}>{report?.title ?? 'Kết quả từ Cloud Save'}</Copy>
        </View>
        {report && <LinearGradient colors={won ? ['#f59e0b', '#d97706'] : ['#64748b', '#475569']}
          accessible accessibilityLabel={'Xếp hạng ' + report.grade + ', ' + report.overallScore + ' trên 100 điểm'}
          testID="result-health-grade" style={{ minWidth: 56, padding: 6, borderRadius: 12, alignItems: 'center', borderWidth: 2, borderColor: '#fff' }}>
          <Copy variant="title" style={{ color: '#fff' }}>{report.grade}</Copy>
          <Copy variant="note" style={{ color: '#fef3c7', fontSize: 11 }}>{report.overallScore}/100</Copy>
        </LinearGradient>}
      </View>
      <Copy variant="note" style={{ color: '#cbd5e1', lineHeight: 19 }}>{report?.verdict ?? review.limitation}</Copy>
      {report && <>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {pillars.map(([key, label, color]) => <View key={key} style={{ flexBasis: '47%', flexGrow: 1, padding: 8,
            gap: 5, borderRadius: 10, backgroundColor: '#ffffff0f' }}>
            <Copy variant="note" style={{ color: '#cbd5e1', fontSize: 11 }}>{label}</Copy>
            <Copy variant="note" style={{ color, fontFamily: 'Fredoka700' }}>{report.pillarScores[key]}/25</Copy>
            <View accessible accessibilityRole="progressbar" accessibilityLabel={label}
              accessibilityValue={{ min: 0, max: 25, now: report.pillarScores[key] }}
              style={{ height: 4, borderRadius: 4, backgroundColor: '#ffffff1a', overflow: 'hidden' }}>
              <View style={{ height: 4, backgroundColor: color, width: `${report.pillarScores[key] / 25 * 100}%` }}/>
            </View>
          </View>)}
        </View>
        {!!report.keyTurningPoints.length && <ResultAccordion title="⚡ Bước ngoặt then chốt" dark initialOpen>
          {report.keyTurningPoints.map((point, i) => <View key={i} style={{ borderLeftWidth: 3,
            borderLeftColor: point.impact === 'positive' ? '#10b981' : point.impact === 'negative' ? '#ef4444' : '#94a3b8',
            padding: 8, borderRadius: 6, backgroundColor: point.impact === 'positive' ? '#10b9811f' : '#ef44441f', gap: 4 }}>
            <Copy variant="note" style={{ fontFamily: 'Fredoka700', color: '#f8fafc' }}>{point.title}</Copy>
            <Copy variant="note" style={{ color: point.impact === 'positive' ? '#a7f3d0' : '#fecaca' }}>{point.description}</Copy>
          </View>)}
        </ResultAccordion>}
        {!!report.actionableInsights.length && <ResultAccordion title="Gợi ý cho hành trình tiếp theo" dark>
          {report.actionableInsights.map((insight, i) => <Copy key={i} variant="note" style={{ color: '#cbd5e1', lineHeight: 19 }}>• {insight}</Copy>)}
        </ResultAccordion>}
      </>}
    </LinearGradient>
    {!!review.facts.length && <View style={{ padding: 12, gap: 8, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' }}>
      <Copy variant="heading" style={{ color: '#334155', fontSize: 15 }}>Nhìn lại quyết định tài chính</Copy>
      {review.facts.slice(0, 3).map(fact => <Copy variant="note" key={fact.id} style={{ color: '#475569', lineHeight: 19 }}>• {fact.text}</Copy>)}
      {review.facts.length > 3 && <ResultAccordion title="Các khoản khác">
        {review.facts.slice(3).map(fact => <Copy variant="note" key={fact.id}>{fact.text}</Copy>)}
      </ResultAccordion>}
    </View>}
    {!!review.decisions.length && <ResultAccordion title="Quyết định đã ghi trong nhật ký">
      {review.decisions.map(entry => <View key={entry.sequence} style={{ gap: 4, borderLeftWidth: 2, borderLeftColor: '#cbd5e1', paddingLeft: 8 }}>
        <Copy variant="note" style={{ fontFamily: 'Fredoka700' }}>Vòng {entry.lap} · {entry.title}</Copy>
        {!!entry.decision && <Copy variant="note">{entry.decision}</Copy>}
        {!!entry.consequence && <Copy variant="note">{entry.consequence}</Copy>}
      </View>)}
    </ResultAccordion>}
  </View>
}
