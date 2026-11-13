import { isDeepStrictEqual } from 'node:util'
import { composeLearningAnswer, fallbackLearning, INSUFFICIENT, learningCards, offlineLearning } from '../../../../src/ai/mascot/learning.ts'
import { learningKnowledge } from '../../../../src/ai/mascot/learning-knowledge.ts'
import { projectLearningContext } from '../../../../src/ai/mascot/learning-context.ts'
import { eventsForGame } from '../../../../src/data/events.ts'
import { money, signedMoney } from '../../../../src/game/format.ts'
import { goalForGame } from '../../../../src/game/rules-profile.ts'
import { liquidatableFunds, totalWorth } from '../../../../src/game/selectors.ts'
import { borrowingAvailable } from '../../../../src/game/transactions.ts'
import type { GameState, LogEntry } from '../../../../src/game/types.ts'
import type { Database } from '../db/client.ts'
import { ApiError } from '../errors.ts'
import { postgresFailure } from '../observability.ts'
import { officialB18Result } from './b18-actions.ts'
import { b18FundingOptions } from './b18-funding.ts'
import { loadGameState } from './game-state.ts'

export const foxCoachVersion = 1
const eligibleKinds = new Set<LogEntry['kind']>(['decision', 'rebalancing', 'funding', 'event_resolution', 'insolvency'])
const outcomes = { victory: 'Đạt mục tiêu', defeat: 'Chưa đạt mục tiêu', insolvent: 'Mất khả năng thanh toán' }

function journalEvidence({ sequence, lap, turn, kind, title, decision, consequence, action, eventId, decisionId, before, after,
  cashDelta, savingsDelta, stockDelta, bondDelta, goldDelta, businessDelta, debtDelta, expensePaid, lostSavingsInterest, obligationCreated,
}: LogEntry) {
  return {
    source: 'engine-journal' as const, sequence, lap, turn, kind, title, decision, consequence, action, eventId, decisionId,
    before: { portfolio: before.portfolio, obligations: before.obligations, shortfallVnd: before.pendingCost },
    after: { portfolio: after.portfolio, obligations: after.obligations, shortfallVnd: after.pendingCost },
    effects: { cashDelta, savingsDelta, stockDelta, bondDelta, goldDelta, businessDelta, debtDelta, expensePaid, lostSavingsInterest, obligationCreated },
  }
}

function coachEvidence(game: GameState, entry: LogEntry | undefined) {
  const event = game.phase === 'event' ? eventsForGame(game).find(item => item.id === game.eventId) : undefined
  const market = game.log.findLast(item => item.kind === 'market' && item.eventId && item.lap === game.lap)
  const goldPrice = game.market.gold.priceHistory.findLast(point => point.kind !== 'history')
  const lastStart = game.summaries.at(-1)
  const result = officialB18Result(game)
  return {
    position: {
      source: 'engine-state-and-selectors' as const,
      lap: game.lap, phase: game.phase, portfolio: game.portfolio, deposits: game.deposits,
      obligationsVnd: game.obligations, liquidatableFundsVnd: liquidatableFunds(game),
      totalWorthVnd: totalWorth(game), borrowingAvailableVnd: borrowingAvailable(game),
      pendingPayment: game.pendingPayment, fundingOptions: b18FundingOptions(game),
    },
    decision: entry ? journalEvidence(entry) : null,
    event: event ? { source: 'engine-event' as const, id: event.id, title: event.title, description: event.description } : null,
    market: market ? {
      ...journalEvidence(market),
      goldPriceVnd: { before: market.before.market.gold.currentPrice, after: market.after.market.gold.currentPrice },
    } : null,
    goldPrice: goldPrice ? {
      source: 'engine-market' as const, lap: goldPrice.lap, beforeVnd: goldPrice.priceBefore, afterVnd: goldPrice.priceAfter,
    } : null,
    start: lastStart ? { source: 'engine-settlement' as const, lap: lastStart.lap, lines: lastStart.lines,
      incomeTotalVnd: lastStart.incomeTotal, debtPrincipalPaidVnd: lastStart.debtPrincipalPaid } : null,
    result: result ? { source: 'official-result-and-selectors' as const, ...result, targetVnd: goalForGame(game).target,
      totalWorthVnd: totalWorth(game), completedLaps: game.summaries.map(summary => summary.lap) } : null,
  }
}

function explainPosition(evidence: ReturnType<typeof coachEvidence>) {
  const { position, decision, event, market, start, result } = evidence
  const cards = [{
    id: 'position', title: 'Tiền và khả năng huy động',
    text: 'Bạn có ' + money(position.portfolio.cash) + ' dùng ngay, ' + money(position.portfolio.savings) + ' tiết kiệm và ' +
      money(position.portfolio.debt) + ' dư nợ. Nguồn huy động hợp lệ là ' + money(position.liquidatableFundsVnd) + '.',
  }]
  if (position.pendingPayment) cards.push({
    id: 'funding', title: 'Khoản đang thiếu',
    text: position.pendingPayment.title + ' còn thiếu ' + money(position.pendingPayment.remaining) +
      '. Mỗi nguồn huy động có điều kiện và giới hạn riêng trong ván.',
  })
  if (decision) cards.push({
    id: 'decision', title: decision.title,
    text: decision.consequence + ' Tiền mặt thay đổi ' + signedMoney(decision.effects.cashDelta) + '.',
  })
  if (event) cards.push({ id: 'event', title: event.title, text: event.description })
  if (market) cards.push({ id: 'market', title: market.title, text: market.consequence + ' Giá vàng tại mốc này đi từ ' + money(market.goldPriceVnd.before) + ' đến ' + money(market.goldPriceVnd.after) + '.' })
  if (start) cards.push({
    id: 'start', title: 'Quyết toán START vòng ' + start.lap,
    text: 'Các dòng quyết toán ghi nhận ' + money(start.incomeTotalVnd) + ' thu nhập và ' +
      money(start.debtPrincipalPaidVnd) + ' nợ gốc đã trả.',
  })
  if (result) cards.push({
    id: 'result', title: outcomes[result.outcome],
    text: 'Ván đã hoàn tất ' + result.completedLaps.length + ' vòng. Nguồn huy động hợp lệ là ' +
      money(Number(result.lawfulProceedsVnd)) + ' so với mốc ' + money(result.targetVnd) +
      '. Tài sản ròng là ' + money(result.totalWorthVnd) + '.',
  })
  return cards
}

async function ownedState(db: Database, userId: string, id: string, version?: number) {
  let value
  try { value = await loadGameState(db, userId, id) }
  catch (error) {
    const failure = postgresFailure(error)
    if (failure?.sqlState === '57014' || failure?.category === 'database_connection') {
      throw new ApiError(503, 'COACH_UNAVAILABLE', 'Coach could not read the saved game; retry the request')
    }
    throw error
  }
  const { session, game, result } = value
  if (version !== undefined && version !== session.stateVersion) {
    throw new ApiError(409, 'STATE_VERSION_CONFLICT', 'Reload the game before requesting its explanation')
  }
  const stored = result ? { outcome: result.outcome, lawfulProceedsVnd: String(result.lawfulProceedsVnd) } : null
  if (!isDeepStrictEqual(stored, officialB18Result(game))) throw new Error('Coach result does not match saved state')
  return { stateVersion: session.stateVersion, game }
}

export async function readFoxCoach(db: Database, userId: string, id: string, options: { stateVersion?: number; journalSequence?: number }) {
  const { stateVersion, game } = await ownedState(db, userId, id, options.stateVersion)
  const decision = options.journalSequence === undefined
    ? game.log.findLast(item => eligibleKinds.has(item.kind))
    : game.log.find(item => item.sequence === options.journalSequence && eligibleKinds.has(item.kind))
  if (options.journalSequence !== undefined && !decision) {
    throw new ApiError(422, 'COACH_DECISION_NOT_FOUND', 'Select a decision from the saved journal')
  }
  const evidence = coachEvidence(game, decision)
  return { version: foxCoachVersion, stateVersion, source: 'deterministic' as const, cards: explainPosition(evidence), evidence }
}

export async function learnWithFox(db: Database, userId: string, id: string, question: string, version?: number) {
  const { stateVersion, game } = await ownedState(db, userId, id, version)
  const context = projectLearningContext(game)
  const catalog = learningCards(context)
  const cards = composeLearningAnswer(offlineLearning(question, catalog) ?? fallbackLearning(question, catalog, context))
  const evidence = coachEvidence(game, undefined)
  return {
    version: foxCoachVersion, stateVersion, source: 'deterministic' as const,
    status: cards.length && cards.some(card => card.scope !== 'UNKNOWN') ? 'answered' as const : 'insufficient' as const,
    cards: cards.map(card => ({ ...card, references: learningKnowledge.find(item => item.id === card.id)?.references ?? [] })),
    message: cards.length ? null : INSUFFICIENT,
    evidence: {
      position: cards.some(card => card.id === 'cash') ? evidence.position : null,
      result: cards.some(card => ['result', 'actual-result', 'prediction-result'].includes(card.id)) ? evidence.result : null,
      gold: cards.some(card => card.id === 'gold-market') ? evidence.goldPrice : null,
      journal: (context?.entries ?? []).filter(entry =>
        cards.some(card => card.id === 'entry-' + entry.id || card.id === 'gold-cash-zero' && entry.kind === 'buy' && entry.asset === 'gold'))
        .flatMap(entry => game.log.filter(item => item.sequence === entry.id).map(journalEvidence)),
    },
  }
}
export type FoxCoachReply = Awaited<ReturnType<typeof readFoxCoach>>
export type FoxLearningReply = Awaited<ReturnType<typeof learnWithFox>>
