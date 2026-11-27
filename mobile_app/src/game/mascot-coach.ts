import { ASSETS } from '../../../src/data/config.ts'
import { money } from '../../../src/game/format.ts'
import { goalProgress } from '../../../src/game/selectors.ts'
import { exhaustsCash, isMascotPurchaseAsset, MASCOT_VERSION } from '../../../src/ai/mascot/contracts.ts'
import type { ExplanationContext, Facts, Topic } from '../../../src/ai/mascot/contracts.ts'
import type { GameState, LogEntry, Portfolio } from '../../../src/game/types.ts'

type JournalFacts = Pick<LogEntry, 'sequence' | 'kind' | 'action' | 'decisionId' | 'cashDelta' | 'debtDelta' | 'savingsDelta' | 'expensePaid'> & {
  before: Pick<LogEntry['before'], 'portfolio' | 'obligations' | 'pendingCost' | 'deposits'>
  after: Pick<LogEntry['after'], 'portfolio' | 'obligations' | 'pendingCost' | 'deposits'>
}
type CoachGame = Pick<GameState, 'portfolio' | 'obligations' | 'pendingPayment' | 'phase'> & {
  id: string; log: JournalFacts[]; goal: { remaining: number; target: number }
}

const localCoachGame = (game: GameState): CoachGame => ({ ...game, id: game.seed, goal: goalProgress(game) })
const coachGame = (game: GameState | CoachGame): CoachGame => 'id' in game ? game : localCoachGame(game)

type SignalId = 'concentration' | 'cash-exhaustion' | 'liquidity' | 'debt' | 'trade-off' | 'progress'
type Severity = 'informational' | 'warning' | 'positive'

export interface MascotInsight {
  signalId: SignalId
  severity: Severity
  priority: number
  message: string
  evidence: Facts
  explanation?: ExplanationContext
  boardAlert?: true
}

const groups = ['stocks', 'bonds', 'gold', 'business', 'savings'] as const
const checkedAmounts = [...groups, 'cash', 'debt'] as const
const CONCENTRATION_SHARE = 0.65
const MIN_EXPOSURE = 5_000_000
const MIN_PROGRESS = 1_000_000
const MIN_DEBT = 2_000_000
const GOAL_IMPROVEMENT_SHARE = 0.05
const GLOBAL_COOLDOWN = 12_000
const SIGNAL_COOLDOWN = 90_000
const explanation = (topic: Topic, facts: Facts): ExplanationContext => ({ version: MASCOT_VERSION, topic, facts })

function finances(game: CoachGame) {
  const { portfolio, obligations } = game
  const pending = game.pendingPayment?.remaining ?? 0
  const amounts = checkedAmounts.map(key => portfolio[key])
  if (![...amounts, obligations, pending].every(amount => Number.isFinite(amount) && amount >= 0)) return null
  const gross = portfolio.cash + groups.reduce((sum, group) => sum + portfolio[group], 0)
  const knownPayments = obligations + pending
  if (!Number.isFinite(gross) || !Number.isFinite(knownPayments)) return null
  return { portfolio, gross, knownPayments, pending }
}

function concentrationRisk({ portfolio, gross, knownPayments }: { portfolio: Portfolio; gross: number; knownPayments: number }) {
  // Use the share only when recorded payments already take most of the cash reserve.
  if (knownPayments <= portfolio.cash / 2 || knownPayments > portfolio.cash) return undefined
  return groups.find(group => portfolio[group] >= MIN_EXPOSURE && portfolio[group] / gross >= CONCENTRATION_SHARE)
}

function tradeOff(entry: JournalFacts): MascotInsight | null {
  const { cashDelta, debtDelta, savingsDelta } = entry
  const kind = entry.action?.kind ?? entry.decisionId?.split('-')[0]
  let message: string
  let context: ExplanationContext | undefined
  const cash = entry.after.portfolio.cash
  const cashBefore = entry.before.portfolio.cash
  if (entry.kind === 'funding' && entry.decisionId === 'fund-debt' && debtDelta > 0) {
    message = 'Đã dùng khoản vay để thanh toán.'
    context = explanation('borrow', { amount: debtDelta, debt: entry.after.portfolio.debt, paid: entry.expensePaid })
  } else if (entry.kind !== 'rebalancing') {
    return null
  } else if (kind === 'deposit' && cashDelta < 0 && savingsDelta > 0) {
    message = 'Đã mở khoản tiết kiệm mới.'
    const lot = entry.after.deposits.at(-1)
    if (lot?.status === 'active' && entry.after.deposits.length === entry.before.deposits.length + 1 && lot.principal === -cashDelta) {
      context = explanation('deposit', {
        amount: lot.principal, cashBefore, cash, rate: lot.rate, term: lot.maturityLap - lot.startLap + 1, maturityLap: lot.maturityLap,
        knownPayments: entry.after.obligations + entry.after.pendingCost,
      })
    }
  } else if ((kind === 'buy' || kind === 'upgrade') && cashDelta < 0) {
    message = kind === 'upgrade'
      ? 'Đã nâng cấp cơ sở kinh doanh.'
      : 'Đã mua tài sản.'
    const facts = { amount: -cashDelta, cashBefore, cash }
    context = explanation(kind, kind === 'buy' ? { ...facts, knownPayments: entry.after.obligations + entry.after.pendingCost } : facts)
  } else if (kind === 'sell' && cashDelta > 0) {
    message = 'Đã bán tài sản.'
    context = explanation('sell', { amount: cashDelta, cashBefore, cash })
  } else if (kind === 'repay' && cashDelta < 0 && debtDelta < 0) {
    message = 'Đã ghi nhận khoản trả nợ.'
    context = explanation('repay', { amount: -cashDelta, cashBefore, cash, debtReduced: -debtDelta })
  } else {
    return null
  }
  return {
    signalId: 'trade-off', severity: 'informational', priority: 20, message,
    evidence: { sequence: entry.sequence, cashDelta, debtDelta, savingsDelta,
      knownPayments: entry.after.obligations + entry.after.pendingCost }, explanation: context,
  }
}

function exhaustingPurchase(entry: JournalFacts | undefined, cashBefore: number, cash: number) {
  if (entry?.kind !== 'rebalancing' || entry.before.portfolio.cash !== cashBefore || entry.after.portfolio.cash !== cash) return null
  const amount = -entry.cashDelta
  if (!exhaustsCash(cashBefore, cash, amount)) return null
  const asset = entry.action ? entry.action.asset : entry.decisionId?.split('-')[1]
  if (!isMascotPurchaseAsset(asset)) return null
  const confirmed = entry.action
    ? entry.action.kind === 'buy' && entry.action.amount === amount
    : entry.decisionId === `buy-${asset}` || entry.decisionId === `buy-${asset}-complete`
  return confirmed ? { asset, amount, cashBefore, cash } : null
}

/** Coach thresholds only. Portfolio values and completed actions come from the engine. */
export function evaluateMascotSignals(before: GameState | undefined, after: GameState): MascotInsight[] {
  return evaluate(before && localCoachGame(before), localCoachGame(after))
}

function evaluate(before: CoachGame | undefined, after: CoachGame, retained?: MascotInsight): MascotInsight[] {
  if (!before || before === after || before.id !== after.id || after.phase === 'finished'
    || after.log.length < before.log.length || (before.log.length && after.log[before.log.length - 1] !== before.log.at(-1))) return []
  const previous = finances(before)
  const current = finances(after)
  if (!previous || !current) return []
  const { portfolio, gross, knownPayments, pending } = current
  const { cash, debt } = portfolio
  const entries = after.log.slice(before.log.length)
  const decision = entries.findLast(entry => entry.kind === 'rebalancing' || entry.kind === 'funding'
    || (entry.kind === 'decision' && !entry.after.pendingCost))
  const signals: MascotInsight[] = []
  const purchase = exhaustingPurchase(decision, previous.portfolio.cash, cash)

  const uncovered = knownPayments - cash
  if (uncovered > 0 && (retained?.explanation?.topic === 'payment-gap'
    || uncovered > Math.max(0, previous.knownPayments - previous.portfolio.cash) || pending > previous.pending)) {
    signals.push({
      signalId: 'liquidity', severity: 'warning', priority: 100,
      message: `Tiền mặt thiếu ${money(uncovered)} so với các khoản cần trả đã ghi nhận.`,
      evidence: { cash, knownPayments, pending, uncovered },
      boardAlert: purchase || (retained?.signalId === 'liquidity' && retained.boardAlert) ? true : undefined,
      explanation: explanation('payment-gap', { cash, knownPayments, pending }),
    })
  } else if (purchase) {
    const asset = purchase.asset === 'business' ? 'cơ sở kinh doanh' : ASSETS[purchase.asset].label.toLocaleLowerCase('vi-VN')
    const facts = { ...purchase, knownPayments }
    signals.push({
      signalId: 'cash-exhaustion', severity: 'warning', priority: 98, boardAlert: true,
      message: cash === 0
        ? `Bạn vừa dùng hết tiền mặt để mua ${asset}. Nếu cần chi, bạn có thể phải bán tài sản khi game cho phép và chịu chi phí giao dịch.`
        : `Bạn còn rất ít tiền mặt sau khi mua ${asset}. Hãy kiểm tra phần tiền có thể dùng ngay trước khi chi tiếp.`,
      evidence: facts, explanation: explanation('cash-exhaustion', facts),
    })
  } else if (retained?.signalId === 'cash-exhaustion' && retained.evidence.cash === cash && retained.evidence.knownPayments === knownPayments) {
    signals.push(retained)
  }
  if (debt >= MIN_DEBT && debt >= cash && (retained?.signalId === 'debt' || debt > previous.portfolio.debt || previous.portfolio.debt < previous.portfolio.cash)) {
    signals.push({
      signalId: 'debt', severity: 'warning', priority: 80,
      message: 'Nợ gốc hiện bằng hoặc vượt tiền mặt.',
      evidence: { cash, debt }, explanation: explanation('debt', { cash, debt }),
    })
  }
  const group = concentrationRisk(current)
  if (group && (group === retained?.evidence.group || group !== concentrationRisk(previous))) {
    const value = portfolio[group]
    const label = group === 'savings' ? 'tiết kiệm' : ASSETS[group].label.toLocaleLowerCase('vi-VN')
    const share = Math.floor(value / gross * 100)
    signals.push({
      signalId: 'concentration', severity: 'warning', priority: 95,
      message: `Danh mục nghiêng về ${label}, trong khi các khoản đã ghi nhận lớn hơn nửa số tiền mặt.`,
      evidence: { group, value, gross, share, cash, knownPayments }, explanation: explanation('concentration', { group, value, gross, share, cash, knownPayments }),
    })
  }

  const debtReduced = previous.portfolio.debt - debt
  if ((debtReduced >= MIN_PROGRESS || (debtReduced > 0 && debt === 0)) && !pending && entries.some(entry => entry.debtDelta < 0)) {
    signals.push({
      signalId: 'progress', severity: 'positive', priority: 40,
      message: `Nợ gốc đã giảm ${money(debtReduced)}.`,

      evidence: { debtReduced, debt, cash }, explanation: explanation('debt-reduced', { debtReduced, debt, cash }),
    })
  } else if (previous.knownPayments - previous.portfolio.cash >= MIN_PROGRESS
    && cash >= knownPayments && knownPayments > 0 && cash > previous.portfolio.cash) {
    signals.push({
      signalId: 'progress', severity: 'positive', priority: 40,
      message: 'Tiền mặt giờ đã đủ cho các khoản cần trả đã ghi nhận.',
      evidence: { cash, knownPayments }, explanation: explanation('coverage-restored', { cash, knownPayments }),
    })
  }
  if (!pending && !signals.some(signal => signal.signalId === 'progress')
    && entries.some(entry => entry.kind === 'settlement' || entry.kind === 'event_resolution' || entry.kind === 'decision')) {
    const previousGoal = before.goal
    const goal = after.goal
    const improvement = previousGoal.remaining - goal.remaining
    if (goal.target === previousGoal.target && improvement >= goal.target * GOAL_IMPROVEMENT_SHARE && improvement > 0) {
      signals.push({
        signalId: 'progress', severity: 'positive', priority: 40,
        message: 'Bạn đã tiến gần hơn tới mục tiêu của ván!',
        evidence: { improvement, remaining: goal.remaining, target: goal.target },
        explanation: explanation('goal-progress', { improvement, remaining: goal.remaining, target: goal.target }),
      })
    }
  }
  const trade = decision && tradeOff(decision)
  if (trade) signals.push(trade)
  return signals.sort((left, right) => right.priority - left.priority)
}

export type MascotSurface = 'board' | 'summary' | 'context'

export function createMascotCoach() {
  type Note = { insight: MascotInsight; current: boolean; shown: boolean }
  let view = { open: false, latest: null as MascotInsight | null, current: false, surface: null as MascotSurface | null }
  let recent: Note | null = null
  let roundNote: Note | null = null
  let boardPending: Note | null = null
  let summaryOffered = false
  let phase: GameState['phase'] | undefined
  let lastDisplay = -Infinity
  const lastSignal = new Map<SignalId, number>()
  const observed = new WeakSet<GameState | CoachGame>()
  const listeners = new Set<() => void>()
  function publish(next: typeof view) {
    if (view.open === next.open && view.current === next.current && view.latest === next.latest
      && view.surface === next.surface) return
    view = next
    for (const listener of listeners) listener()
  }

  function refresh(note: Note, before: CoachGame, after: CoachGame) {
    const previous = note.insight
    const refreshed = previous.severity === 'warning' && evaluate(before, after, previous)
      .find(candidate => candidate.explanation?.topic === previous.explanation?.topic
        && (previous.signalId !== 'concentration' || candidate.evidence.group === previous.evidence.group))
    note.insight = refreshed || previous
    note.current = !!refreshed
  }

  function offer(note: Note, now: number) {
    const id = note.insight.signalId
    if (note.shown || (note.insight.boardAlert && !note.current)
      || now - lastDisplay < GLOBAL_COOLDOWN || now - (lastSignal.get(id) ?? -Infinity) < SIGNAL_COOLDOWN) return false
    note.shown = true
    lastDisplay = now
    lastSignal.set(id, now)
    return true
  }

  return {
    getSnapshot: () => view,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    observe(previous: GameState | CoachGame, current: GameState | CoachGame) {
      if (previous === current || observed.has(current)) return
      observed.add(current)
      const before = coachGame(previous)
      const after = coachGame(current)
      phase = after.phase
      if (before.phase === 'summary' && after.phase !== 'summary') {
        roundNote = null
        boardPending = null
        summaryOffered = false
      }
      if (recent) recent.current = false
      if (roundNote) refresh(roundNote, before, after)
      if (boardPending && boardPending !== roundNote) refresh(boardPending, before, after)

      const insight = evaluate(before, after)[0]
      if (insight) {
        recent = { insight, current: true, shown: false }
        if (insight.boardAlert) boardPending = recent
        if (insight.severity !== 'informational'
          && (!roundNote || (insight.boardAlert && !roundNote.current) || insight.priority >= roundNote.insight.priority)) roundNote = recent
      }

      // Only the shell can present a note after the actual decision screen has closed.
      if (after.phase !== before.phase) publish({ ...view, surface: null, open: false, latest: null, current: false })
      else publish({ ...view, current: false })
    },
    present(surface: MascotSurface | null, now: number) {
      if (phase && ((surface === 'board' && phase !== 'rolling') || (surface === 'summary' && phase !== 'summary' && phase !== 'finished'))) surface = null
      const boardAlert = surface === 'board' && boardPending?.current ? boardPending : null
      const note = surface === 'summary' ? roundNote ?? recent : surface === 'board' ? boardAlert ?? recent : surface === 'context' ? recent : null
      let open = !!surface && view.surface === surface && view.open && view.latest === note?.insight
      if (surface === 'board' || surface === 'summary') boardPending = null
      if (boardAlert) {
        if (offer(boardAlert, now)) open = true
      } else if (surface === 'summary' && phase !== 'finished' && !summaryOffered) {
        summaryOffered = true
        if (roundNote && offer(roundNote, now)) open = true
      }
      publish({ ...view, surface, open, latest: note?.insight ?? null, current: !!note?.current })
    },
    toggle() { if (view.surface) publish({ ...view, open: !view.open }) },
    dismiss() { if (view.open) publish({ ...view, open: false }) },
  }
}
