import { palette, styles } from './theme'
import { useEffect, useMemo, useRef, useState } from 'react'
import { View, TextInput, ActivityIndicator } from 'react-native'
import { money, signedMoney } from '../../../src/game/format'
import { investmentLotLabel, localizePlayerText } from '../../../src/components/player-language'
import { MULTI_COURSE_B18_BOARD } from '../../../src/data/board'
import { composeLearningAnswer, fallbackLearning, INSUFFICIENT, learningCards, offlineLearning, QUESTION_LIMIT, readLearningQuestion } from '../../../src/ai/mascot/learning'
import { choicesFor, originalLabel } from '../../src/game/what-if-choices'
import type { WhatIfCatalog, WhatIfEvaluation } from '../../src/game/cloud-contract'
import type { createGameApi } from '../../src/game/server-session'
import { ApiError, apiMessage } from '../../src/game/server-session'
import { explainMascot, explanationContext } from '../../src/game/mascot-explanation'
import type { MascotInsight } from '../../src/game/mascot-coach'
import { assetLabel, type Arena } from './arena-model'
import { Action, Copy, Fox, Panel } from './ui'

type Api = ReturnType<typeof createGameApi>


export function CoachPanel({ arena, insight, onClose }: { arena: Arena; insight?: MascotInsight | null; onClose: () => void }) {
  const [question, setQuestion] = useState('')
  const [reply, setReply] = useState<ReturnType<typeof composeLearningAnswer>>()
  const [questionError, setQuestionError] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const context = insight && explanationContext(insight)
  const reasoning = expanded && context && insight ? explainMascot(context, insight.evidence) : null
  function ask() {
    const text = readLearningQuestion(question)
    setQuestionError(!text)
    if (!text) return
    const cards = learningCards(arena.learning)
    setReply(composeLearningAnswer(offlineLearning(text, cards) ?? fallbackLearning(text, cards, arena.learning)))
  }
  const composer = <View style={{ gap: 10 }}>
    <TextInput accessibilityLabel="Câu hỏi về ván" placeholder="Ví dụ: Thanh khoản là gì?" placeholderTextColor={palette.muted}
      value={question} onChangeText={text => { setQuestion(text); setReply(undefined); setQuestionError(false) }}
      maxLength={QUESTION_LIMIT} style={styles.input}/>
    <Action label="Hỏi Cáo" disabled={!question.trim()} onPress={ask} tone="primary"/>
    {questionError && <Copy accessibilityRole="alert">Nhập câu hỏi từ 3 đến {QUESTION_LIMIT} ký tự.</Copy>}
  </View>
  return <Panel title="Cáo EXE" header={<Action label="Đóng" onPress={onClose}/>} footer={composer}>
    <View style={[styles.card, { flexDirection: 'row', alignItems: 'center' }]}>
      <Fox size={48}/><Copy style={{ flex: 1 }}>{insight?.message ?? 'Bạn muốn xem lại quyết định hay tìm hiểu một thuật ngữ?'}</Copy>
    </View>
    {context && <Action label="Vì sao?" onPress={() => setExpanded(!expanded)} />}
    {reasoning && <View style={styles.card}>
      <Copy>{reasoning.narrative}</Copy>
      {reasoning.facts.map(fact => <Copy variant="note" key={fact.label}>{fact.label} · {fact.value}</Copy>)}
    </View>}
    {arena.coachCards.map(card => <View key={card.id} style={styles.card}><Copy variant="heading">{card.title}</Copy><Copy>{localizePlayerText(card.text)}</Copy></View>)}
    {reply?.length === 0 && <View accessibilityLiveRegion="polite" style={styles.card}><Copy>{INSUFFICIENT}</Copy></View>}
    {reply?.map((card, index) => <View key={card.id + index} style={styles.card}>
      <Copy variant="note">{card.source}</Copy><Copy>{card.text}</Copy>
    </View>)}
  </Panel>
}
type Result = { evaluation: WhatIfEvaluation; explanation?: string }
const outcomes = { victory: 'Đạt mục tiêu', defeat: 'Chưa đạt mục tiêu', insolvent: 'Mất khả năng thanh toán' }

export function Comparison({ result, original, alternative }: { result: Result; original: string; alternative: string }) {
  const [details, setDetails] = useState(false)
  const replay = result.evaluation
  const completed = replay.status === 'completed'
  const delta = completed ? Number(replay.delta.lawfulProceedsVnd) : 0
  return <>
    <View style={styles.card}>
      <Copy variant="heading">{completed ? 'So sánh sau vòng 4' : 'Kết quả giả lập'}</Copy>
      <Copy>Đã chọn · {original}</Copy><Copy>Giả lập · {alternative}</Copy>
      {completed ? <>
        <Copy>Ván thật · {outcomes[replay.actual.outcome]} · {money(Number(replay.actual.lawfulProceedsVnd))}</Copy>
        <Copy>Giả lập · {outcomes[replay.alternative.outcome]} · {money(Number(replay.alternative.lawfulProceedsVnd))}</Copy>
      </> : <Copy>Nhánh giả lập hoàn tất {replay.completedLaps.length}/4 vòng. Chưa có kết quả để so sánh cùng điều kiện.</Copy>}
    </View>
    <View style={[styles.card, { backgroundColor: '#fff3df' }]}>
      <View style={styles.footer}><Fox/><Copy variant="heading">Cáo giải thích</Copy></View>
      {completed && <Copy variant="title" style={{ color: delta < 0 ? palette.red : palette.green }}>{signedMoney(delta)} nguồn huy động</Copy>}
      <Copy>{result.explanation ?? replay.coach.cards.find(card => ['cash-at-decision', 'limit', 'start'].includes(card.id))?.text ??
        'Các chỉ số được lấy từ kết quả replay của hai nhánh.'}</Copy>
      <Action label={details ? 'Ẩn chi tiết' : 'Xem chi tiết'} onPress={() => setDetails(!details)}/>
      {details && <>
        {completed && <>
          <Copy>Tiền mặt · {money(replay.actual.cash)} → {money(replay.alternative.cash)}</Copy>
          <Copy>Tài sản ròng · {money(replay.actual.totalWorth)} → {money(replay.alternative.totalWorth)}</Copy>
          <Copy>Dư nợ · {money(replay.actual.debt)} → {money(replay.alternative.debt)}</Copy>
          <Copy>Nghĩa vụ · {money(replay.actual.obligations)} → {money(replay.alternative.obligations)}</Copy>
          {replay.explanation.startDifferences.flatMap(item => item.lines.map(line => <Copy key={item.lap + line.label}>Xuất phát vòng {item.lap} · {line.label} · {signedMoney(line.delta)}</Copy>))}
        </>}
        {replay.coach.cards.map(card => <View key={card.id} style={styles.card}><Copy variant="heading">{card.title}</Copy><Copy>{card.text}</Copy></View>)}
        <Copy>Giữ {replay.continuation.retained} quyết định. Có {replay.continuation.notRetained} quyết định không áp dụng lại.</Copy>
      </>}
    </View>
  </>
}
export function WhatIfContent({ api, sessionId }: { api: Api; sessionId: string }) {
  const [catalog, setCatalog] = useState<WhatIfCatalog>()
  const [selected, setSelected] = useState<number>()
  const [choice, setChoice] = useState<number>()
  const [result, setResult] = useState<Result>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [about, setAbout] = useState(false)
  const [load, setLoad] = useState(0)
  const pending = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    void api.whatIfCatalog(sessionId, controller.signal).then(value => { if (!controller.signal.aborted) setCatalog(value) })
      .catch(problem => { if (!controller.signal.aborted) setError(apiMessage(problem)) })
    return () => controller.abort()
  }, [api, sessionId, load])
  const decisions = useMemo(() => catalog?.decisions.map(decision => ({ decision, choices: choicesFor(decision) }))
    .filter(item => item.choices.length).sort((a, b) => b.decision.sequence - a.decision.sequence), [catalog])
  const current = decisions?.find(item => item.decision.sequence === selected)
  const alternative = choice === undefined ? undefined : current?.choices[choice]
  function simulate() {
    if (!catalog || !current || !alternative || pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    setResult(undefined)
    void api.simulateWhatIf(sessionId, { stateVersion: catalog.stateVersion, sequence: current.decision.sequence, alternative: alternative.alternative })
      .then(setResult)
      .catch(problem => {
        setError(apiMessage(problem))
        if (problem instanceof ApiError && problem.status === 409) {
          setCatalog(undefined); setSelected(undefined); setChoice(undefined)
        }
      })
      .finally(() => { pending.current = false; setBusy(false) })
  }
  return <>
    <Action label="Về tính năng này" onPress={() => setAbout(!about)} />
    {about && <Copy variant="note">Nếu hỗ trợ AI được bật, chỉ loại quyết định và chiều thay đổi tiền mặt được gửi để hỗ trợ lời giải thích.</Copy>}
    {!catalog && !error && <ActivityIndicator color={palette.green} accessibilityLabel="Đang tải quyết định"/>}
    {error ? <><Copy accessibilityRole="alert">{error}</Copy>{!catalog && <Action label="Tải lại" onPress={() => { setError(''); setLoad(load + 1) }}/>}</> : null}
    {decisions?.length === 0 && <Copy>Ván này chưa có quyết định phù hợp để thử lại.</Copy>}
    {decisions?.map(({ decision }) => <Action key={decision.sequence} selected={selected === decision.sequence} disabled={busy}
      label={'Vòng ' + decision.lap + ' · ' + (decision.title ?? MULTI_COURSE_B18_BOARD[decision.position]?.label ?? 'Quyết định')}
      onPress={() => { setSelected(decision.sequence); setChoice(undefined); setResult(undefined); setError('') }}>
      <Copy>{'Đã chọn · ' + originalLabel(decision)}</Copy>
    </Action>)}
    {current?.choices.map((item, index) => <Action key={index} label={item.label} selected={choice === index} disabled={busy}
      onPress={() => { setChoice(index); setResult(undefined); setError('') }}>{item.detail && <Copy variant="note">{item.detail}</Copy>}</Action>)}
    {current && <Action label={busy ? 'Đang mô phỏng…' : 'Xem kết quả giả lập'} disabled={!alternative || busy} onPress={simulate} tone="primary"/>}
    {result && current && alternative && <Comparison result={result} original={originalLabel(current.decision)} alternative={alternative.label}/>}
  </>
}

export function PortfolioContent({ arena }: { arena: Arena }) {
  const [journal, setJournal] = useState(false)
  return <>
    <Action label={journal ? 'Danh mục tài sản' : 'Nhật ký quyết định'} onPress={() => setJournal(!journal)}/>
    {journal ? arena.journal.slice().reverse().map(entry => <View key={entry.sequence} style={styles.card}>
      <Copy variant="heading">{'Vòng ' + entry.lap + ' · ' + entry.title}</Copy>
      <Copy>{localizePlayerText(entry.decision)}</Copy><Copy variant="note">{localizePlayerText(entry.consequence)}</Copy>
    </View>) : <>
      <View style={styles.card}><Copy variant="heading">Nguồn huy động hợp lệ · {money(arena.proceeds)}</Copy>
        <Copy>Tài sản ròng · {money(arena.totalWorth)}</Copy><Copy>Nghĩa vụ · {money(arena.obligations)}</Copy>
      </View>
      {(Object.keys(arena.portfolio) as (keyof Arena['portfolio'])[]).map(key => <View key={key} style={styles.card}>
        <Copy>{assetLabel(key)} · {money(arena.portfolio[key])}</Copy>
      </View>)}
      {arena.local?.deposits.map(lot => <Copy key={lot.id}>{investmentLotLabel('savings', lot.id)} · {money(lot.principal)}</Copy>)}
    </>}
  </>
}
