import type { BondCreditMarket, GameState, LogEntry, MarketState, Snapshot } from './game/types.ts'

type PublicMarket = Omit<MarketState, 'historySeed'>
type PublicBondMarket = { issuers: Omit<BondCreditMarket['issuers'][number], 'jitter'>[] }
type PresentationSnapshot = Omit<Snapshot, 'rng' | 'market' | 'bondCredit'> & {
  marketRef: number
  bondCredit?: PublicBondMarket
}
type PresentationLog = Omit<LogEntry, 'before' | 'after'> & {
  before: PresentationSnapshot
  after: PresentationSnapshot
}

export type GamePresentation = {
  version: 1
  markets: PublicMarket[]
  position: PresentationSnapshot
  history: PresentationLog[]
  eventId: GameState['eventId']
  pendingLanding: GameState['pendingLanding']
  pendingPayment: GameState['pendingPayment']
  summaries: GameState['summaries']
}

/** Cloud UI projection of an owned, restored snapshot. Seed and RNG stay server-side. */
export function projectGamePresentation(game: GameState): GamePresentation {
  const markets: PublicMarket[] = []
  const indices = new Map<string, number>()
  const marketReferences = new WeakMap<MarketState, number>()
  const project = (snapshot: Snapshot): PresentationSnapshot => {
    const { market, bondCredit } = snapshot
    let marketRef = marketReferences.get(market)
    if (marketRef === undefined) {
      const publicMarket = { catalogVersion: market.catalogVersion, stocks: market.stocks, gold: market.gold,
        bond: market.bond, appliedShocks: market.appliedShocks, normalLaps: market.normalLaps }
      const key = JSON.stringify(publicMarket)
      marketRef = indices.get(key)
      if (marketRef === undefined) {
        marketRef = markets.length
        indices.set(key, marketRef)
        markets.push(publicMarket)
      }
      marketReferences.set(market, marketRef)
    }
    return {
      gameplayProfile: snapshot.gameplayProfile, courseRulesVersion: snapshot.courseRulesVersion,
      ownedCourses: snapshot.ownedCourses, goalRulesVersion: snapshot.goalRulesVersion,
      livingExpenseRulesVersion: snapshot.livingExpenseRulesVersion, boardRevision: snapshot.boardRevision,
      bondRulesVersion: snapshot.bondRulesVersion, encounterRulesVersion: snapshot.encounterRulesVersion,
      businessRulesVersion: snapshot.businessRulesVersion, customerPreferenceId: snapshot.customerPreferenceId,
      savingsProfile: snapshot.savingsProfile, gameMode: snapshot.gameMode, boardLayout: snapshot.boardLayout,
      totalLaps: snapshot.totalLaps, businessPurchaseTurn: snapshot.businessPurchaseTurn, lap: snapshot.lap,
      position: snapshot.position, turn: snapshot.turn, portfolio: snapshot.portfolio, savingsEligible: snapshot.savingsEligible,
      savingsMatured: snapshot.savingsMatured, obligations: snapshot.obligations, phase: snapshot.phase,
      scenarioId: snapshot.scenarioId, dice: snapshot.dice, recurringIncome: snapshot.recurringIncome,
      unlockedAssets: snapshot.unlockedAssets, pendingCost: snapshot.pendingCost, deposits: snapshot.deposits, marketRef,
      stockHoldings: snapshot.stockHoldings, goldUnits: snapshot.goldUnits, goldCostBasis: snapshot.goldCostBasis,
      bondLots: snapshot.bondLots, business: snapshot.business, coursePurchased: snapshot.coursePurchased,
      borrowingLimit: snapshot.borrowingLimit, termination: snapshot.termination,
      ...(bondCredit && { bondCredit: { issuers: bondCredit.issuers.map(issuer => ({
        id: issuer.id, status: issuer.status, rating: issuer.rating, stress: issuer.stress,
        defaultLap: issuer.defaultLap, currentPrice: issuer.currentPrice, priceHistory: issuer.priceHistory, events: issuer.events,
      })) } }),
    }
  }
  const { log, eventId, pendingLanding, pendingPayment, summaries } = game
  return { version: 1, markets, position: project(game), eventId, pendingLanding, pendingPayment, summaries,
    history: log.map(({ before, after, ...entry }) => ({ ...entry, before: project(before), after: project(after) })),
  }
}

/** Input for the original read-only Mobile selectors. It cannot be resumed or exported as an engine save. */
export function mobileGamePresentation(presentation: GamePresentation): GameState {
  if (presentation.version !== 1) throw new Error('Unsupported game presentation')
  const restore = ({ marketRef, bondCredit, ...facts }: PresentationSnapshot): Snapshot => {
    const market = presentation.markets[marketRef]
    if (!market) throw new Error('Missing presentation market')
    return { ...facts, rng: Number.NaN, market: { ...market, historySeed: Number.NaN },
      ...(bondCredit && { bondCredit: { rng: Number.NaN, processedLaps: [],
        issuers: bondCredit.issuers.map(issuer => ({ ...issuer, jitter: Number.NaN })),
      } }),
    }
  }
  return {
    ...restore(presentation.position), seed: '', settlement: null,
    eventId: presentation.eventId, pendingLanding: presentation.pendingLanding,
    pendingPayment: presentation.pendingPayment, summaries: presentation.summaries,
    log: presentation.history.map(({ before, after, ...entry }) => ({ ...entry, before: restore(before), after: restore(after) })),
  }
}
