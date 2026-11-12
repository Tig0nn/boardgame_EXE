import { isCoreMvp } from '../../../src/game/rules-profile.ts'
import { goalProgress, totalWorth, victory } from '../../../src/game/selectors.ts'
import type { GameState, LogEntry } from '../../../src/game/types.ts'
import { isMascotPurchaseAsset } from '../../../src/ai/mascot/contracts.ts'
import { isLearningEvent, learningChoiceLabel, learningKinds, readLearningContext } from '../../../src/ai/mascot/learning.ts'
import type { LearningEntry } from '../../../src/ai/mascot/learning.ts'

function projectEntry(entry: LogEntry): LearningEntry | null {
  const trade = entry.kind === 'rebalancing' ? /^(buy|sell|deposit|withdraw|repay|upgrade)-([a-z]+)(?:-complete)?$/u.exec(entry.decisionId ?? '') : null
  const kind = learningKinds.find(kind => kind === (trade?.[1] ?? (entry.kind === 'event_resolution' ? 'decision' : entry.kind)))
  if (!kind) return null
  const assetId = entry.action?.asset ?? trade?.[2]
  const asset = isMascotPurchaseAsset(assetId) ? assetId : null
  const event = isLearningEvent(entry.eventId) ? entry.eventId : null
  const choice = kind === 'decision' && learningChoiceLabel(event, entry.decisionId) ? entry.decisionId ?? null : null
  const before = entry.before.portfolio.cash
  const after = entry.after.portfolio.cash
  return {
    id: entry.sequence, lap: entry.lap, kind, asset, event, choice,
    amount: entry.action?.amount ?? (kind === 'buy' && asset === 'gold' ? before - after : null),
    before, after, obligations: entry.after.obligations,
  }
}
export function projectLearningContext(game: GameState) {
  const entries: LearningEntry[] = []
  let latestGoldBuy: LearningEntry | undefined
  for (let i = game.log.length - 1; i >= 0; i--) {
    const item = projectEntry(game.log[i])
    if (!item) continue
    if (entries.length < 6) entries.push(item)
    if (!latestGoldBuy && item.kind === 'buy' && item.asset === 'gold') latestGoldBuy = item
    if (latestGoldBuy && entries.length === 6) break
  }
  if (latestGoldBuy && !entries.includes(latestGoldBuy)) entries[5] = latestGoldBuy
  const point = game.market.gold.priceHistory.findLast(point => point.kind !== 'history')
  const goal = game.phase === 'finished' ? goalProgress(game) : null
  return readLearningContext({
    cash: game.portfolio.cash, obligations: game.obligations, lap: game.lap, scenario: game.scenarioId, entries,
    result: goal ? { funds: goal.funds, target: goal.target, won: victory(game).won,
      insolvent: game.termination === 'insolvent', worth: totalWorth(game),
      ...(isCoreMvp(game) ? { requiredRounds: game.totalLaps } : {}) } : null,
    gold: point ? { before: point.priceBefore, after: point.priceAfter, lap: point.lap } : null,
  })
}
