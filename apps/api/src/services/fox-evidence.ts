import { eventsForGame } from '../../../../src/data/events.ts'
import { money, signedMoney } from '../../../../src/game/format.ts'
import { goalForGame } from '../../../../src/game/rules-profile.ts'
import { liquidatableFunds, totalWorth } from '../../../../src/game/selectors.ts'
import { borrowingAvailable } from '../../../../src/game/transactions.ts'
import type { GameState, LogEntry } from '../../../../src/game/types.ts'
import { b18FundingOptions } from './b18-funding.ts'

import type { officialB18Result } from './b18-actions.ts'
type B18Result = ReturnType<typeof officialB18Result>

export const foxCoachVersion = 1
export const eligibleKinds = new Set<LogEntry['kind']>(['decision', 'rebalancing', 'funding', 'event_resolution', 'insolvency'])
const outcomes = { victory: 'Đạt mục tiêu', defeat: 'Chưa đạt mục tiêu', insolvent: 'Mất khả năng thanh toán' }

export function journalEvidence({ sequence, lap, turn, kind, title, decision, consequence, action, eventId, decisionId, before, after,
  cashDelta, savingsDelta, stockDelta, bondDelta, goldDelta, businessDelta, debtDelta, expensePaid, lostSavingsInterest, obligationCreated,
}: LogEntry) {
  return {
    source: 'engine-journal' as const, sequence, lap, turn, kind, title, decision, consequence, action, eventId, decisionId,
    before: { portfolio: before.portfolio, obligations: before.obligations, shortfallVnd: before.pendingCost },
    after: { portfolio: after.portfolio, obligations: after.obligations, shortfallVnd: after.pendingCost },
    effects: { cashDelta, savingsDelta, stockDelta, bondDelta, goldDelta, businessDelta, debtDelta, expensePaid, lostSavingsInterest, obligationCreated },
  }
}

export function coachEvidence(game: GameState, entry: LogEntry | undefined, result: B18Result) {
  const event = game.phase === 'event' ? eventsForGame(game).find(item => item.id === game.eventId) : undefined
  const market = game.log.findLast(item => item.kind === 'market' && item.eventId && item.lap === game.lap)
  const goldPrice = game.market.gold.priceHistory.findLast(point => point.kind !== 'history')
  const lastStart = game.summaries.at(-1)
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

export function foxCoachView(game: GameState, result: B18Result,
  entry = game.log.findLast(item => eligibleKinds.has(item.kind))) {
  const evidence = coachEvidence(game, entry, result)
  return { version: foxCoachVersion, source: 'deterministic' as const, cards: explainPosition(evidence), evidence }
}
