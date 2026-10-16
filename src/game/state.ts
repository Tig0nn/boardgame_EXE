import type { FinancialEffects, GameState, LogEntry, Snapshot } from './types.ts'
import { random } from './random.ts'
import { EVENTS } from '../data/events.ts'
import { savingsProfileForGame } from './savings.ts'

export function snapshot(s: GameState): Snapshot {
  return { gameMode:s.gameMode, boardLayout:s.boardLayout, totalLaps:s.totalLaps, businessPurchaseTurn:s.businessPurchaseTurn,
    ...(s.gameplayProfile ? { gameplayProfile:s.gameplayProfile } : {}),
    ...(s.courseRulesVersion ? { courseRulesVersion:s.courseRulesVersion } : {}),
    ...(s.ownedCourses ? { ownedCourses:[...s.ownedCourses] } : {}),
    ...(s.goalRulesVersion ? { goalRulesVersion:s.goalRulesVersion } : {}),
    ...(s.livingExpenseRulesVersion ? { livingExpenseRulesVersion: s.livingExpenseRulesVersion } : {}),
    ...(s.boardRevision ? { boardRevision: s.boardRevision } : {}),
    ...(s.bondRulesVersion ? { bondRulesVersion: s.bondRulesVersion } : {}),
    ...(s.bondCredit ? { bondCredit: structuredClone(s.bondCredit) } : {}),
    ...(s.encounterRulesVersion ? { encounterRulesVersion: s.encounterRulesVersion } : {}),
    ...(s.businessRulesVersion ? { businessRulesVersion: s.businessRulesVersion } : {}),
    ...(s.customerPreferenceId ? { customerPreferenceId: s.customerPreferenceId } : {}),
    ...(s.savingsProfile ? { savingsProfile: savingsProfileForGame(s) } : {}),
    lap: s.lap, position: s.position, turn: s.turn, portfolio: { ...s.portfolio },
    savingsEligible: s.savingsEligible, savingsMatured: s.savingsMatured,
    obligations: s.obligations, rng: s.rng, phase: s.phase, scenarioId: s.scenarioId,
    dice: s.dice, recurringIncome: s.recurringIncome, unlockedAssets: [...s.unlockedAssets],
    pendingCost: s.pendingPayment?.remaining ?? 0,
    deposits: s.deposits.map(lot => ({ ...lot })), market: s.market,
    stockHoldings: Object.fromEntries(Object.entries(s.stockHoldings).map(([id, holding]) => [id, { ...holding }])),
    goldUnits: s.goldUnits, goldCostBasis: s.goldCostBasis, bondLots: s.bondLots.map(lot => ({ ...lot, ...(lot.credit ? { credit: structuredClone(lot.credit) } : {}) })),
    business: { ...s.business, upgrades: { ...s.business.upgrades } }, coursePurchased: s.coursePurchased,
    borrowingLimit: s.borrowingLimit, termination: s.termination }
}
type Entry = Pick<LogEntry, 'kind' | 'title' | 'decision' | 'consequence'> &
  Partial<Pick<LogEntry, 'eventId' | 'decisionId'>> & Partial<FinancialEffects>

export function record(s: GameState, before: Snapshot, entry: Entry): GameState {
  const after = snapshot(s)
  const category = EVENTS.find(e => e.id === entry.eventId)?.category
  const defaults: FinancialEffects = {
    cashDelta: after.portfolio.cash - before.portfolio.cash,
    savingsDelta: after.portfolio.savings - before.portfolio.savings,
    stockDelta: after.portfolio.stocks - before.portfolio.stocks,
    bondDelta: after.portfolio.bonds - before.portfolio.bonds,
    goldDelta: after.portfolio.gold - before.portfolio.gold,
    businessDelta: after.portfolio.business - before.portfolio.business,
    debtDelta: after.portfolio.debt - before.portfolio.debt,
    recurringIncomeDelta: after.recurringIncome - before.recurringIncome,
    forcedWithdrawalAmount: 0, lostSavingsInterest: 0, forcedAssetSaleAmount: 0,
    assetSaleAmounts: { stocks: 0, bonds: 0, gold: 0 },
    obligationCreated: Math.max(0, after.obligations - before.obligations),
    cashProceeds: 0, expensePaid: 0, debtInterestPaid: 0, debtInterestAccrued: 0,
  }
  const definedEntry = Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined)) as Entry
  return { ...s, pendingCost: after.pendingCost, log: [...s.log, { ...defaults, ...definedEntry,
    sequence: s.log.length + 1, lap: before.lap, turn: before.turn,
    tileId: before.position, ...(category ? { category } : {}), before, after }] }
}

export function copyState(s: GameState): GameState {
  return { ...s, portfolio: { ...s.portfolio }, unlockedAssets: [...s.unlockedAssets],
    ...(s.ownedCourses ? { ownedCourses:[...s.ownedCourses] } : {}),
    ...(s.bondCredit ? { bondCredit: structuredClone(s.bondCredit) } : {}),
    ...(s.savingsProfile ? { savingsProfile: savingsProfileForGame(s) } : {}),
    deposits: s.deposits.map(lot => ({ ...lot })),
    stockHoldings: Object.fromEntries(Object.entries(s.stockHoldings).map(([id, holding]) => [id, { ...holding }])),
    bondLots: s.bondLots.map(lot => ({ ...lot, ...(lot.credit ? { credit: structuredClone(lot.credit) } : {}) })), business: { ...s.business, upgrades: { ...s.business.upgrades } },
    market: { ...s.market, stocks: s.market.stocks.map(stock => ({ ...stock })), gold: { ...s.market.gold }, bond: { ...s.market.bond } },
    pendingPayment: s.pendingPayment ? { ...s.pendingPayment } : null,
    settlement: s.settlement ? { ...s.settlement, lines: [...s.settlement.lines],
      rates: { ...s.settlement.rates }, fundingNotes: [...s.settlement.fundingNotes] } : null }
}

export function draw(s: GameState): number {
  const [value, next] = random(s.rng)
  s.rng = next
  return value
}
