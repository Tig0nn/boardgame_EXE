import { palette, styles } from './theme'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { BackHandler, TextInput, View } from 'react-native'
import { randomUUID } from 'expo-crypto'
import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { money, signedMoney } from '../../../src/game/format'
import { tileInformation } from '../../../src/components/tile-information'
import { localizePlayerText } from '../../../src/components/player-language'
import { GAME_SAVE_KEY } from '../../../src/game/saved-game'
import { parseMoneyInput } from '../../../src/ui/money-input'
import { depositPreview, purchasePreview } from '../../../src/game/selectors'
import type { GameState } from '../../../src/game/types'
import { createMobileSession, type MobileCommand } from '../../src/game/session'
import { actionRequest, apiMessage, createServerSession, type createGameApi, type SessionDetail } from '../../src/game/server-session'
import { getLapQuarterInsight, marketBulletin } from '../../src/game/market-news'
import { evaluateMascotSignals, type MascotInsight } from '../../src/game/mascot-coach'
import { art } from './assets'
import { Action, Copy, Eye, Fox, Panel } from './ui'
import { Board } from './board'
import { fromLocal, fromServer, localQuote, setAmount, tileLabel, type Arena, type TradeChoice } from './arena-model'
import { CoachPanel, PortfolioContent, WhatIfContent } from './coach-and-what-if'
import { createLocalSaveQueue } from './local-save'
import { BusinessCard, CashStrip, DecisionActions, GoalMeter, MarketCard, ResultFinances, ResultHero } from './decision-presentation'
import { decisionPresentation } from './decision-heading'

const saveLocalGame = createLocalSaveQueue(payload => AsyncStorage.setItem(GAME_SAVE_KEY, payload))

type Api = ReturnType<typeof createGameApi>
type Session = ReturnType<typeof createServerSession>
type Screen = 'wallet' | 'guide' | 'coach' | 'what-if' | 'tile' | 'settings'
type ChoiceState = { item: TradeChoice; raw: string }
const isDecision = (arena: Arena) => arena.phase !== 'rolling' && arena.phase !== 'finished'
const moneyInputs = [
  ['cashAfterVnd', 'Tiền mặt sau thao tác'], ['cashAfter', 'Tiền mặt sau thao tác'],
  ['interestVnd', 'Lãi'], ['interest', 'Lãi'], ['netProceedsVnd', 'Thực nhận'],
  ['net', 'Thực nhận'], ['feeVnd', 'Phí'], ['fee', 'Phí'], ['debtAfterVnd', 'Dư nợ sau thao tác'],
] as const

function quoteLines(quote: unknown) {
  if (typeof quote !== 'object' || quote === null) return []
  const fields = quote as Record<string, unknown>
  const shown = new Map<string, string>()
  for (const [key, label] of moneyInputs) if (typeof fields[key] === 'number') shown.set(label, money(fields[key]))
  return [...shown].map(([label, text]) => label + ' · ' + text)
}

export function DecisionPanel({ arena, confirm, locked, quote, visible, onPeek, onCoach }: {
  arena: Arena; confirm: (command: MobileCommand) => void; locked: boolean
  quote?: (command: MobileCommand, signal: AbortSignal) => Promise<unknown>
  visible: boolean; onPeek: () => void; onCoach: () => void
}) {
  const [selection, setSelection] = useState<ChoiceState>()
  const [preview, setPreview] = useState<string[]>()
  const [message, setMessage] = useState('')
  const [pricing, setPricing] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  const amount = selection ? parseMoneyInput(selection.raw) : 0
  const valid = !!selection && typeof amount === 'number' && Number.isSafeInteger(amount) && amount >= selection.item.min && amount <= selection.item.max
  const command = valid ? setAmount(selection.item, amount) : null
  const selectedTrade = command?.type === 'trade' ? command.action : null
  const presentation = decisionPresentation(arena)
  const skip = arena.fixed.find(item => item.skip)
  function clearQuote() {
    request.current?.abort()
    request.current = null
    setPreview(undefined); setMessage(''); setPricing(false)
  }
  function showQuote() {
    if (!command || !quote || pricing) return
    setPricing(true)
    setMessage('')
    const controller = new AbortController()
    request.current = controller
    void quote(command, controller.signal).then(reply => {
      if (!controller.signal.aborted) setPreview(quoteLines(reply))
    }).catch(problem => {
      if (!controller.signal.aborted) setMessage(apiMessage(problem))
    }).finally(() => { if (!controller.signal.aborted) setPricing(false) })
  }
  const localPreview = !arena.local || !selectedTrade ? undefined : selectedTrade.kind === 'deposit'
    ? { ...depositPreview(arena.local, selectedTrade.amount, selectedTrade.term ?? 1), ...purchasePreview(arena.local, selectedTrade.amount) }
    : selectedTrade.kind === 'buy' ? purchasePreview(arena.local, selectedTrade.amount) : localQuote(arena.local, selectedTrade)
  return <Panel title={presentation.title} icon={presentation.icon} lap={arena.lap}
    subtitle={'VÒNG ' + arena.lap + ' / ' + arena.totalLaps + (arena.phase === 'event' ? ' · Ô ' + (arena.position + 1) : '')}
    visible={visible} locked={locked} header={!locked && <Eye open={false} onPress={onPeek}/>}
    footer={<>
      {command && <Action label={'Xác nhận · ' + money(amount ?? 0)} tone="primary" disabled={locked}
        onPress={() => confirm(command)}/>}
      <DecisionActions choices={arena.fixed} locked={locked} confirm={confirm}/>
      {skip && <Action label="BỎ QUA CƠ HỘI" disabled={locked} onPress={() => confirm(skip.command)}/>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Fox size={28}/>
        <View style={{ flex: 1 }}><Action label="Cáo EXE" disabled={locked} onPress={onCoach}/></View></View>
    </>}>
    {arena.note && arena.phase !== 'forecast' && !(arena.phase === 'event' && ['business', 'bank', 'stocks', 'bonds', 'gold'].includes(arena.eventId ?? '')) &&
      <View style={[styles.card, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}><Copy>{arena.note}</Copy></View>}
    {arena.phase === 'forecast' && <Market arena={arena}/>}
    {arena.phase === 'summary' && arena.summary && <Settlement arena={arena}/>}
    {arena.phase === 'event' && <CashStrip cash={arena.portfolio.cash}/>}
    {arena.phase === 'event' && arena.eventId === 'business' && arena.businessDetails && <BusinessCard details={arena.businessDetails}/>}
    {arena.trades.map((item, i) => <Action key={i} label={item.label} disabled={locked} selected={selection?.item === item}
      onPress={() => { clearQuote(); setSelection({ item, raw: String(item.min === item.max ? item.min : Math.min(1_000_000, item.max)) }) }}>
      {item.note && <Copy variant="note">{item.note}</Copy>}
    </Action>)}
    {selection && <View style={styles.card}>
      <Copy variant="heading">{selection.item.label}</Copy>
      <Copy variant="note">{selection.item.min === selection.item.max
        ? 'Số tiền · ' + money(selection.item.max) : 'Tối đa · ' + money(selection.item.max)}</Copy>
      {selection.item.min !== selection.item.max && <TextInput accessibilityLabel="Số tiền" value={selection.raw}
        keyboardType="number-pad" style={styles.input} editable={!locked} onChangeText={raw => { clearQuote(); setSelection({ ...selection, raw }) }}/>}
      {quote && command?.type === 'trade' && <Action label={pricing ? 'Đang tải báo giá…' : 'Xem báo giá'}
        disabled={!valid || pricing || locked} onPress={showQuote}/>}
      {message ? <Copy accessibilityRole="alert">{message}</Copy> : null}
      {preview?.map(line => <Copy key={line}>{line}</Copy>)}
      {localPreview && quoteLines(localPreview).map(line => <Copy key={line}>{line}</Copy>)}
    </View>}
  </Panel>
}

function Market({ arena }: { arena: Arena }) {
  const info = getLapQuarterInsight(arena.lap)
  const bulletin = arena.local ? marketBulletin(arena.local) : null
  return <>
    <View style={[styles.card, { backgroundColor: '#dbeafe', borderColor: '#93c5fd' }]}>
      <Copy variant="heading" style={{ color: '#1e40af' }}>{info.macroTheme}</Copy>
      <Copy style={{ color: '#1e3a8a' }}>{info.actionableAdvice}</Copy>
    </View>
    {bulletin?.available && bulletin.assets.map(item => <MarketCard key={item.asset} asset={item.asset} forecast={item.forecast}/>)}
    <View style={[styles.card, { backgroundColor: '#fffbeb', borderColor: '#fcd34d' }]}>
      <Copy variant="heading">Mục tiêu về đích · {money(arena.target)}</Copy>
      <GoalMeter proceeds={arena.proceeds} target={arena.target}/>
      <Copy variant="note">Đã có · {money(arena.proceeds)}</Copy>
    </View>
  </>
}
function Settlement({ arena }: { arena: Arena }) {
  const data = arena.summary
  if (!data) return null
  return <>
    <View style={[styles.card, { backgroundColor: '#dff8e9' }]}>
      <Copy variant="note">Dòng tiền ròng vòng {data.lap}</Copy><Copy variant="title">{signedMoney(data.after - data.before)}</Copy>
    </View>
    <View style={styles.card}>
      {data.lines.map((line, index) => <View key={index} style={[styles.footer, { justifyContent: 'space-between' }]}>
        <Copy style={{ flex: 1 }}>{localizePlayerText(line.label)}</Copy>
        <Copy style={{ color: line.amount < 0 ? palette.red : palette.green }}>{signedMoney(line.amount)}</Copy>
      </View>)}
      <Copy variant="heading">Tiền mặt sau quyết toán · {money(data.after)}</Copy>
      {data.fundingNotes.map((note, index) => <Copy key={index} variant="note">{localizePlayerText(note)}</Copy>)}
    </View>
  </>
}

export function GuideContent({ arena }: { arena?: Arena }) {
  const [section, setSection] = useState<'game' | 'board'>('game')
  return <>
    <View style={styles.footer}><Action label="Luật chơi" selected={section === 'game'} onPress={() => setSection('game')}/>
      <Action label="Các ô bàn cờ" selected={section === 'board'} onPress={() => setSection('board')}/></View>
    {section === 'game' ? <View style={styles.card}>
      <Copy variant="heading">Cờ tỷ phú tài chính B18</Copy>
      <Copy>Mục tiêu là đạt {money(arena?.target ?? 90_000_000)} nguồn huy động hợp lệ sau bốn vòng.</Copy>
      <Copy>Mỗi lượt gieo xúc xắc D6 rồi xử lý ô dừng. Đi qua ô Xuất phát sẽ quyết toán các khoản thu, chi và nghĩa vụ đến hạn.</Copy>
      <Copy>Quản lý tiền mặt, tiết kiệm, cổ phiếu, trái phiếu, vàng, kinh doanh và dư nợ. Chỉ giao dịch ở những ô game cho phép.</Copy>
      <Copy variant="note">Nhấn icon mắt trong quyết định để xem bàn cờ và trở lại bản nháp.</Copy>
    </View> : arena?.board.map((tile, index) => <View key={tile.index} style={styles.card}>
      <Copy variant="heading">{index + 1} · {tileLabel(arena, index)}</Copy><Copy>{tileInformation(tile.type, arena.local)}</Copy>
    </View>)}
  </>
}

function Endgame({ arena, onExit, onNew, onWhatIf, onWallet, onCoach }: {
  arena: Arena; onExit: () => void; onNew: () => void; onWhatIf?: () => void; onWallet: () => void; onCoach: () => void
}) {
  const result = arena.result
  if (!result) return null
  const won = result.outcome === 'victory'
  return <Panel title={won ? 'Hoàn thành mục tiêu' : result.outcome === 'insolvent' ? 'Mất khả năng thanh toán' : 'Kết quả hành trình'}
    lap={arena.lap} hero={<ResultHero arena={arena}/>} footer={<>
      {onWhatIf && result.outcome !== 'insolvent' && <Action label="Nếu chọn khác thì sao?" onPress={onWhatIf} tone="primary"/>}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Action label="Xem tài sản và nhật ký" onPress={onWallet}/></View>
        <View style={{ flex: 1 }}><Action label="Cáo giải thích kết quả" onPress={onCoach}/></View>
      </View>
      <Action label="Ván mới" onPress={onNew}/>
    </>}
    subtitle={'Hoàn tất ' + arena.finishedLaps + '/' + arena.totalLaps + ' vòng'} header={<Action label="Đóng" onPress={onExit}/>}>
    <View style={styles.card}><Copy variant="note">Nguồn huy động hợp lệ</Copy>
      <Copy variant="title">{money(Number(result.lawfulProceedsVnd))}</Copy>
      <Copy>Mục tiêu · {money(arena.target)}</Copy><GoalMeter proceeds={Number(result.lawfulProceedsVnd)} target={arena.target}/>
      <Copy>Tài sản ròng · {money(arena.totalWorth)}</Copy></View>
    <ResultFinances arena={arena}/>
  </Panel>
}

function ArenaScreen({ arena, revision, busy, pendingRetry, message, confirm, retry, exit, newGame, activateSound, playSound, api, sessionId, insight }: {
  arena: Arena; revision: string | number; busy: boolean; pendingRetry: boolean; message: string; confirm: (command: MobileCommand) => void
  retry: () => void; exit: () => void; newGame: () => void; activateSound: () => void; playSound: () => void
  api?: Api; sessionId?: string; insight?: MascotInsight | null
}) {
  const [peek, setPeek] = useState(false)
  const [screen, setScreen] = useState<Screen>()
  const [tile, setTile] = useState(0)
  const locked = busy || pendingRetry
  const quote = api && sessionId ? async (action: MobileCommand, signal: AbortSignal) => {
    if (typeof revision !== 'number' || action.type !== 'trade') return null
    const input = actionRequest(action, revision)
    const namespace = ['deposit', 'repay'].includes(action.action.kind) ? 'bank-quote'
      : action.action.asset === 'business' ? 'business-quote' : 'trade-quote'
    return api.quote(sessionId, namespace, namespace === 'bank-quote' ? input
      : { expectedStateVersion: revision, payload: input.payload }, signal)
  } : undefined
  const close = () => setScreen(undefined)
  const send = (command: MobileCommand) => {
    if (locked || peek || screen) return
    void Haptics.selectionAsync().catch(() => {})
    playSound()
    confirm(command)
  }
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen) { setScreen(undefined); return true }
      if (peek) { setPeek(false); return true }
      if (locked || isDecision(arena)) return true
      exit()
      return true
    })
    return () => listener.remove()
  }, [arena, exit, locked, peek, screen])
  return <View style={{ flex: 1 }}>
    <Board arena={arena} peek={peek} blocked={locked || !!screen || isDecision(arena)} onRoll={() => send({ type: 'roll' })}
      onReturn={() => setPeek(false)} onHome={exit} onWallet={() => setScreen('wallet')} onGuide={() => setScreen('guide')}
      onSound={activateSound} onSettings={() => setScreen('settings')} onTile={position => { setTile(position); setScreen('tile') }}/>
    {arena.phase === 'rolling' && !peek && !screen && <View style={{ position: 'absolute', left: 12, bottom: 106 }}>
      <Action label="Cáo EXE" onPress={() => setScreen('coach')}/>
    </View>}
    {isDecision(arena) && <DecisionPanel key={revision} arena={arena} confirm={send} locked={locked} quote={quote}
      visible={!peek && !screen} onPeek={() => setPeek(true)} onCoach={() => setScreen('coach')}/>}
    {arena.phase === 'finished' && !screen && <Endgame arena={arena} onExit={exit} onNew={newGame}
      onWhatIf={api ? () => setScreen('what-if') : undefined} onWallet={() => setScreen('wallet')} onCoach={() => setScreen('coach')}/>}
    {screen === 'wallet' && <Panel title="Ví và nhật ký" icon={art.wallet} lap={arena.lap} header={<Action label="Đóng" onPress={close}/>}><PortfolioContent arena={arena}/></Panel>}
    {screen === 'guide' && <Panel title="Sổ tay chiến lược" icon={art.guide} lap={arena.lap} header={<Action label="Đóng" onPress={close}/>}><GuideContent arena={arena}/></Panel>}
    {screen === 'coach' && <CoachPanel arena={arena} insight={insight} onClose={close}/>}
    {screen === 'what-if' && api && sessionId && <Panel title="Nếu chọn khác thì sao?" lap={arena.lap} icon={art.goal} header={<Action label="Đóng" onPress={close}/>}>
      <WhatIfContent api={api} sessionId={sessionId}/>
    </Panel>}
    {screen === 'tile' && <Panel title={tileLabel(arena, tile)} header={<Action label="Đóng" onPress={close}/>}>
      <Copy>{tileInformation(arena.board[tile].type, arena.local)}</Copy>
    </Panel>}
    {screen === 'settings' && <Panel title="Cài đặt" icon={art.settings} header={<Action label="Đóng" onPress={close}/>}>
      <Action label="Bật / tắt âm thanh" onPress={activateSound}/><Action label="Sổ tay" onPress={() => setScreen('guide')}/>
      <Copy>Giảm chuyển động được điều khiển bằng cài đặt trợ năng của thiết bị.</Copy>
    </Panel>}
    {!!message && <View accessibilityLiveRegion="polite" style={[styles.card, { position: 'absolute', top: 4, left: 14, right: 14, zIndex: 20 }]}>
      <Copy accessibilityRole="alert">{message}</Copy>
      {pendingRetry && <Action label="Thử lại" disabled={busy} onPress={retry}/>}
    </View>}
  </View>
}

export function LocalGame({ initial, ownerExit, sound, playSound, restart }: {
  initial: GameState; ownerExit: () => void; sound: () => void; playSound: () => void; restart: () => void
}) {
  const [controller] = useState(() => createMobileSession(initial))
  const game = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const [message, setMessage] = useState('')
  const [saveFailed, setSaveFailed] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [insight, setInsight] = useState<MascotInsight | null>(null)
  const arena = useMemo(() => fromLocal(game), [game])
  const exiting = useRef(false)
  const saves = useRef(Promise.resolve(false))
  const persist = useCallback((state: GameState) => {
    saves.current = saveLocalGame(state).then(() => {
      setSaveFailed(false); setMessage('')
      return true
    }, () => {
      setSaveFailed(true); setMessage('Chưa lưu được trên thiết bị. Hãy thử lại.')
      return false
    })
    return saves.current
  }, [])
  useEffect(() => { void persist(initial) }, [initial, persist])
  async function leave(next: () => void) {
    if (exiting.current) return
    exiting.current = true; setLeaving(true)
    try { if (await saves.current) next() }
    finally { exiting.current = false; setLeaving(false) }
  }
  const confirm = (command: MobileCommand) => {
    if (exiting.current || saveFailed) return
    setMessage('')
    try {
      if (!controller.dispatch(command, game)) { setMessage('Lựa chọn này chưa khả dụng.'); return }
      const next = controller.getSnapshot()
      setInsight(evaluateMascotSignals(game, next)[0] ?? null)
      persist(next)
    } catch {
      setMessage('Số tiền hoặc lựa chọn chưa hợp lệ. Hãy kiểm tra lại.')
    }
  }
  return <ArenaScreen arena={arena} revision={game.log.at(-1)?.sequence ?? 0} busy={leaving} pendingRetry={saveFailed}
    message={message} confirm={confirm} retry={() => { void persist(game) }} exit={() => { void leave(ownerExit) }}
    newGame={() => { void leave(restart) }} activateSound={sound} playSound={playSound} insight={insight}/>
}

export function CloudGame({ initial, api, ownerExit, sound, playSound, restart }: {
  initial: SessionDetail; api: Api; ownerExit: () => void; sound: () => void; playSound: () => void; restart: () => void
}) {
  const [controller] = useState<Session>(() => createServerSession(api, initial, randomUUID))
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot)
  const arena = useMemo(() => fromServer(view.detail.state, view.detail.result), [view.detail])
  return <ArenaScreen arena={arena} revision={view.detail.session.stateVersion} busy={view.busy} pendingRetry={view.retryable || view.needsReload}
    message={view.message} confirm={command => { void controller.send(command, view.detail.session.stateVersion) }}
    retry={() => { void (view.needsReload ? controller.reload() : controller.retry()) }} exit={() => { if (!controller.getSnapshot().busy) ownerExit() }}
    newGame={() => { if (!controller.getSnapshot().busy) restart() }} activateSound={sound} playSound={playSound} api={api} sessionId={initial.session.id}/>
}
