import { setImmediate } from 'node:timers/promises'
import { isDeepStrictEqual } from 'node:util'
import { eventsForGame } from '../../../../src/data/events.ts'
import { canChoose } from '../../../../src/game/engine.ts'
import { totalWorth } from '../../../../src/game/selectors.ts'
import type { GameState } from '../../../../src/game/types.ts'
import { ApiError } from '../errors.ts'
import type { GameActionRequest, WhatIfRequest } from '../validation.ts'
import { officialB18Result, transitionB18 } from './b18-actions.ts'
import { b18FundingOptions } from './b18-funding.ts'
import { publicBankState } from './b18-bank.ts'
import { publicBusinessState } from './b18-business.ts'
import { b18TradingAsset } from './b18-trading.ts'
import type { TradePayload, BankPayload, BusinessPayload } from '../validation.ts'
import type { WhatIfStage, WhatIfTrace } from './what-if-timing.ts'
import { createWhatIfSnapshotDigester } from './what-if-digest.ts'

export const maxHistory = 512
export const whatIfPolicy = 'retain-legal-then-required-v1'

export class WhatIfBudget {
  private readonly started = performance.now()
  private steps = 0
  constructor(signal?: AbortSignal, milliseconds = 2500, trace?: WhatIfTrace) {
    this.signal = signal
    this.milliseconds = milliseconds
    this.trace = trace
  }
  readonly trace?: WhatIfTrace
  private readonly signal?: AbortSignal
  private readonly milliseconds: number
  check() {
    if (this.signal?.aborted || performance.now() - this.started >= this.milliseconds || this.steps > 1536) {
      const error = new ApiError(503, 'WHAT_IF_BUDGET_EXCEEDED', 'Analysis was interrupted; try again')
      this.trace?.record('budget', this.started, 'error', {
        reason: this.signal?.aborted ? 'aborted' : this.steps > 1536 ? 'step-limit' : 'deadline',
        lastStage: this.trace.lastStage,
      }, error)
      throw error
    }
  }
  async step() {
    if (++this.steps % 8 === 0) await setImmediate()
    this.check()
  }
  time<T>(stage: WhatIfStage, operation: () => T, fields?: { payloadBytes?: number }): T {
    return this.trace ? this.trace.sync(stage, operation, fields) : operation()
  }
  run<T>(stage: WhatIfStage, operation: () => Promise<T>, fields?: (value: T) => { payloadBytes?: number }): Promise<T> {
    return this.trace ? this.trace.run(stage, operation, fields) : operation()
  }
}

export function snapshotDigest(game: GameState, trace?: WhatIfTrace) {
  return createWhatIfSnapshotDigester(trace).digest(game)
}

const contextKey = (game: GameState) => JSON.stringify([
  game.phase, game.lap, game.turn, game.position, game.eventId,
  game.pendingPayment?.origin, game.pendingPayment?.eventId, game.pendingPayment?.decisionId, game.settlement?.step,
])
const context = (game: GameState) => ({ phase: game.phase, lap: game.lap, turn: game.turn,
  position: game.position, eventId: game.eventId })
const event = (game: GameState) => eventsForGame(game).find(item => item.id === game.eventId)
const choices = (game: GameState) => game.phase === 'event' ? event(game)?.options.filter(option => canChoose(game, option.id)) ?? [] : []
const isDecision = (action: GameActionRequest) => action.actionId !== 'advance' && action.actionId !== 'roll'
const choose = (optionId: string): GameActionRequest => ({ actionId: 'choose', expectedStateVersion: 0, payload: { optionId } })
const omitAllowed = (action: GameActionRequest) => action.actionId === 'trade'

// A reused lot ID must still point to the same acquisition, not an alternate lot.
function sameReferencedLot(actual: GameState, alternative: GameState, action: GameActionRequest) {
  const payload = action.payload
  if (action.actionId !== 'fund' && action.actionId !== 'trade') return true
  if (!('lotId' in payload) && !('source' in payload && payload.source === 'savings')) return true
  const id = 'lotId' in payload ? payload.lotId : undefined
  const savings = 'source' in payload && payload.source === 'savings'
  const logOrigin = (game: GameState) => {
    const index = savings
      ? game.deposits.findIndex(lot => id === undefined ? lot.status === 'active' : lot.id === id)
      : game.bondLots.findIndex(lot => lot.id === id)
    const lot = savings ? game.deposits[index] : game.bondLots[index]
    const entry = game.log.find(item => {
      const lots = savings ? item.after.deposits : item.after.bondLots
      return lot && lots.some(candidate => candidate.id === lot.id)
    })
    return entry && [entry.kind, entry.lap, entry.turn, entry.tileId, entry.action,
      savings ? entry.after.deposits[index] : entry.after.bondLots[index]]
  }
  const origin = logOrigin(actual)
  return !!origin && isDeepStrictEqual(origin, logOrigin(alternative))
}

function requiredStep(game: GameState): GameActionRequest {
  if (game.phase === 'rolling') return { actionId: 'roll', expectedStateVersion: 0, payload: {} }
  if (game.phase === 'funding') {
    const option = b18FundingOptions(game).find(item => item.maxAmount >= item.minAmount)
    if (!option) throw new Error('Funding state has no canonical option')
    const amount = Math.max(option.minAmount, Math.min(option.maxAmount, game.pendingPayment!.remaining))
    const { source, lotId } = option
    if (source === 'bonds' && lotId) return { actionId: 'fund', expectedStateVersion: 0, payload: { source, lotId, amount } }
    if (source === 'savings') return { actionId: 'fund', expectedStateVersion: 0, payload: { source, lotId, amount } }
    if (source !== 'bonds') return { actionId: 'fund', expectedStateVersion: 0, payload: { source, amount } }
    throw new Error('Canonical bond funding option has no lot')
  }
  if (game.phase === 'event') {
    const options = choices(game)
    const option = options.find(item => item.id === 'skip') ?? options[0]
    if (!option) throw new Error('Event has no canonical option')
    return choose(option.id)
  }
  return { actionId: 'advance', expectedStateVersion: 0, payload: {} }
}

export type HistoricalStep = { action: GameActionRequest; before: GameState; after: GameState }

export async function replayWhatIfHistory(genesis: GameState, actions: GameActionRequest[], budget: WhatIfBudget) {
  let final = genesis
  const steps: HistoricalStep[] = []
  for (const action of actions) {
    await budget.step()
    const after = transitionB18(final, action)
    if (after === final) throw new Error('Persisted B18 action did not replay')
    steps.push({ action, before: final, after })
    final = after
  }
  return { final, steps }
}

function tradeAlternatives(game: GameState, action: GameActionRequest) {
  if (action.actionId !== 'choose' || action.payload.optionId !== 'skip') return []
  const result: { label: string; payload: TradePayload | BankPayload | BusinessPayload }[] = []
  const amount = Math.min(1_000_000, game.portfolio.cash)
  const asset = b18TradingAsset(game)
  if (amount > 0) {
    if (asset === 'gold') result.push({ label: 'Mua vàng', payload: { kind: 'buy', asset, amount } })
    if (asset === 'stocks') for (const stock of game.market.stocks) {
      result.push({ label: 'Mua cổ phiếu ' + stock.id, payload: { kind: 'buy', asset, amount, symbolId: stock.id } })
    }
    if (asset === 'bonds') for (const issuer of game.bondCredit?.issuers ?? []) {
      result.push({ label: 'Mua trái phiếu ' + issuer.id, payload: { kind: 'buy', asset, amount, issuerId: issuer.id } })
    }
    if (game.eventId === 'bank' && publicBankState(game, true).canDeposit) {
      result.push({ label: 'Gửi tiết kiệm một vòng', payload: { kind: 'deposit', amount, term: 1 } })
    }
  }
  if (game.eventId === 'business') for (const payload of publicBusinessState(game, true).actions) {
    const label = payload.kind === 'buy' ? 'Mua cơ sở kinh doanh' : payload.kind === 'sell' ? 'Bán cơ sở kinh doanh' : 'Nâng cấp cơ sở kinh doanh'
    result.push({ label, payload })
  }
  return result.filter(({ payload }) => transitionB18(game, { actionId: 'trade', expectedStateVersion: 0, payload }) !== game)
}

export function decisionCatalog(steps: HistoricalStep[]) {
  return steps.flatMap(({ action, before, after }) => {
    if (!isDecision(action)) return []
    const eventChoices = choices(before)
      .filter(item => action.actionId !== 'choose' || item.id !== action.payload.optionId)
      .map(({ id, label, detail }) => ({ optionId: id, label, detail }))
    const trades = tradeAlternatives(before, action)
    if (!eventChoices.length && !trades.length && action.actionId === 'choose') return []
    const entry = after.log[before.log.length]
    return [{ sequence: action.expectedStateVersion + 1, ...context(before),
      title: entry?.title ?? event(before)?.title, label: entry?.decision,
      original: { actionId: action.actionId, payload: action.payload }, eventChoices,
      canOmit: omitAllowed(action), tradeAlternatives: trades,
      fundingOptions: b18FundingOptions(before),
    }]
  })
}

export function completedFour(game: GameState) {
  return game.phase === 'finished' && game.termination === 'completed' && game.lap === 4 && game.totalLaps === 4 &&
    game.position === 0 && !game.pendingLanding && !game.settlement && !game.pendingPayment && !game.pendingCost &&
    isDeepStrictEqual(game.summaries.map(item => item.lap), [1, 2, 3, 4])
}

function comparableEnvironment(a: GameState, b: GameState) {
  const route = (game: GameState) => game.log.filter(entry => entry.kind === 'roll' || entry.kind === 'encounter')
    .map(({ kind, lap, turn, eventId, after }) => [kind, lap, turn, eventId, after.dice, after.position, after.rng])
  return a.rng === b.rng && isDeepStrictEqual(a.market, b.market) &&
    isDeepStrictEqual(a.bondCredit, b.bondCredit) && isDeepStrictEqual(route(a), route(b))
}

const metrics = (game: GameState) => ({
  ...officialB18Result(game)!, completedLaps: game.summaries.map(summary => summary.lap),
  cash: game.portfolio.cash, totalWorth: totalWorth(game), debt: game.portfolio.debt,
  obligations: game.obligations, recurringIncome: game.recurringIncome, portfolio: game.portfolio,
})

function decisionEffects(fork: HistoricalStep, forkAfter: GameState) {
  const entries = (game: GameState) => game.log.slice(fork.before.log.length)
    .map(({ decision, consequence }) => ({ decision, consequence }))
  return {
    actual: entries(fork.after), alternative: entries(forkAfter),
    cashDeltaVnd: forkAfter.portfolio.cash - fork.after.portfolio.cash,
  }
}

function comparison(actual: GameState, alternative: GameState, fork: HistoricalStep, forkAfter: GameState) {
  const a = metrics(actual), b = metrics(alternative)
  const startDifferences = actual.summaries.map((summary, index) => {
    const other = alternative.summaries[index]
    const totals = (lines: typeof summary.lines) => {
      const result = new Map<string, number>()
      for (const { label, amount } of lines) result.set(label, (result.get(label) ?? 0) + amount)
      return result
    }
    const lhs = totals(summary.lines), rhs = totals(other.lines)
    return { lap: summary.lap, lines: [...new Set([...lhs.keys(), ...rhs.keys()])].flatMap(label => {
      const actual = lhs.get(label) ?? 0, alternative = rhs.get(label) ?? 0
      return actual === alternative ? [] : [{ label, actual, alternative, delta: alternative - actual }]
    }) }
  }).filter(item => item.lines.length > 0)
  return {
    actual: a, alternative: b,
    delta: {
      lawfulProceedsVnd: (BigInt(b.lawfulProceedsVnd) - BigInt(a.lawfulProceedsVnd)).toString(),
      cash: b.cash - a.cash, totalWorth: b.totalWorth - a.totalWorth, debt: b.debt - a.debt,
      obligations: b.obligations - a.obligations, recurringIncome: b.recurringIncome - a.recurringIncome,
    },
    explanation: {
      decision: decisionEffects(fork, forkAfter),
      startDifferences,
    },
  }
}

export function applyWhatIfAlternative(fork: HistoricalStep, alternative: WhatIfRequest['alternative']) {
  if (alternative.mode === 'omit' && !omitAllowed(fork.action)) {
    throw new ApiError(422, 'WHAT_IF_ILLEGAL_ALTERNATIVE', 'Only optional trades can be omitted')
  }

  let forkAfter = fork.before
  if (alternative.mode === 'replace') {
    const action = { ...alternative.action, expectedStateVersion: fork.action.expectedStateVersion }
    // Funding can only be changed at a payment, and an event may be replaced by an eligible trade.
    if (isDeepStrictEqual(action, fork.action) || !isDecision(action)) {
      throw new ApiError(422, 'WHAT_IF_ILLEGAL_ALTERNATIVE', 'Select a different decision')
    }
    forkAfter = transitionB18(fork.before, action)
    if (forkAfter === fork.before || isDeepStrictEqual(forkAfter, fork.after)) {
      throw new ApiError(422, 'WHAT_IF_ILLEGAL_ALTERNATIVE', 'Alternative is not legal or does not change the decision')
    }
  }
  return forkAfter
}

export async function evaluateWhatIf(actual: GameState, steps: HistoricalStep[], input: WhatIfRequest, budget: WhatIfBudget) {
  const fork = steps[input.sequence - 1]
  if (!fork || !isDecision(fork.action)) throw new ApiError(422, 'WHAT_IF_INVALID_FORK', 'Select a recorded decision')
  const forkAfter = applyWhatIfAlternative(fork, input.alternative)

  const suffix = steps.slice(input.sequence)
  const remaining = new Map<string, HistoricalStep[]>()
  for (const step of suffix) {
    const key = contextKey(step.before)
    const queue = remaining.get(key) ?? []
    queue.push(step)
    remaining.set(key, queue)
  }
  let game = forkAfter
  let retained = 0
  const fallback: { context: ReturnType<typeof context>; action: Pick<GameActionRequest, 'actionId' | 'payload'>; label: string }[] = []
  while (game.phase !== 'finished') {
    await budget.step()
    const queue = remaining.get(contextKey(game))
    const step = queue?.shift()
    if (step && sameReferencedLot(step.before, game, step.action)) {
      const next = transitionB18(game, step.action)
      if (next !== game) {
        game = next
        retained++
        continue
      }
    }
    // Try the next recorded action at this encounter before introducing any fallback.
    if (queue?.length) continue
    const action = requiredStep(game)
    const next = transitionB18(game, action)
    if (next === game) throw new Error('Canonical What-if continuation did not progress')
    if (isDecision(action)) fallback.push({ context: context(game), action: { actionId: action.actionId, payload: action.payload },
      label: next.log[game.log.length]?.decision ?? action.actionId })
    game = next
  }
  const continuation = { retained, notRetained: suffix.length - retained, fallback }
  budget.check()
  if (!completedFour(game) || !comparableEnvironment(actual, game)) {
    return { status: 'limited' as const, reason: game.termination === 'insolvent' ? 'EARLY_INSOLVENCY' : 'ENVIRONMENT_DIVERGED',
      completedLaps: game.summaries.map(item => item.lap), continuation, decision: decisionEffects(fork, forkAfter) }
  }
  const result = comparison(actual, game, fork, forkAfter)
  budget.check()
  return { status: 'completed' as const, ...result, continuation }
}
