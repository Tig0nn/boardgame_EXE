export type Asset = 'stocks' | 'bonds' | 'gold' | 'business'
export type GameModeId = 'original' | 'experimental-a' | 'experimental-b'
export type BoardLayoutId = 'A20' | 'C20'
export type TradableAsset = Exclude<Asset, 'business'>
export type FundingSource = 'savings' | TradableAsset | 'debt'
export type Phase = 'forecast' | 'rolling' | 'event' | 'funding' | 'summary' | 'rebalancing' | 'finished'
export type Category = 'investment' | 'income' | 'shock' | 'obligation'
export type TileType = 'start' | 'bank' | TradableAsset | 'business' | 'course' | 'living' | 'personal' | 'macro' | 'obligation'
export type Term = 1 | 2 | 3
export type SavingsProfileId = 'v2.1-standard' | 'v2.2-c20'
export type BusinessRulesVersion = 'v2.2-trend-shock' | 'v2.3-fixed-income'
export type EncounterRulesVersion = 'legacy-multi-action' | 'v2.3-single-action' | 'v2.4-business-purchase-complete'
export interface SavingsProfile { id: SavingsProfileId; rates: Record<Term, number> }
export interface DepositLot {
  id: string; principal: number; startLap: number; maturityLap: number; rate: number
  status: 'active' | 'matured' | 'withdrawn'; earnedInterest: number
}
export interface PricePoint {
  timestamp: number; lap: number; kind: 'history' | 'normal' | 'shock'; eventId?: string
  priceBefore: number; priceAfter: number; returnRate: number
}
export interface MarketInstrument { currentPrice: number; priceHistory: PricePoint[] }
export interface StockInstrument extends MarketInstrument { id: string; name: string; sector: string; volatility: number }
export interface MarketState {
  stocks: StockInstrument[]; gold: MarketInstrument; bond: MarketInstrument; historySeed: number
  appliedShocks: string[]; normalLaps: number[]
}
export interface Holding { units: number; costBasis: number }
export interface BondLot {
  id: string; units: number; principal: number; startLap: number; maturityLap: number
  lastCouponLap: number; status: 'active' | 'matured' | 'sold'
}
export interface BusinessState { capital: number; recoverableCapital: number; upgrades: Record<string, number>; economicMultiplier: number }
export type Portfolio = Record<Asset | 'cash' | 'savings' | 'debt', number>
export interface Option {
  id: string; label: string; detail: string; cost?: number; income?: number
  asset?: Asset; amount?: number; obligation?: number; recurringIncomeIncrease?: number
}
export interface GameEvent {
  id: string; category: Category; title: string; description: string; options: Option[]
}
export interface Snapshot {
  // Missing in historical logs, including V2.3 games before encounter limits.
  encounterRulesVersion?: EncounterRulesVersion
  // Missing metadata retains the V2.1/V2.2 income formula.
  businessRulesVersion?: BusinessRulesVersion
  // Absent only in historical V2.1 snapshots; absence always means legacy rates.
  savingsProfile?: SavingsProfile
  gameMode: GameModeId; boardLayout: BoardLayoutId; totalLaps: number
  businessPurchaseTurn: number | null
  lap: number; position: number; turn: number; portfolio: Portfolio
  savingsEligible: boolean; savingsMatured: boolean; obligations: number; rng: number
  phase: Phase; scenarioId: string; dice: number; recurringIncome: number
  unlockedAssets: Asset[]; pendingCost: number
  deposits: DepositLot[]; market: MarketState; stockHoldings: Record<string, Holding>
  goldUnits: number; goldCostBasis: number; bondLots: BondLot[]; business: BusinessState
  coursePurchased: boolean; borrowingLimit: number; termination: 'completed' | 'insolvent' | null
}
export interface FinancialEffects {
  cashDelta: number; savingsDelta: number; stockDelta: number; bondDelta: number
  goldDelta: number; businessDelta: number; debtDelta: number; recurringIncomeDelta: number
  forcedWithdrawalAmount: number; lostSavingsInterest: number; forcedAssetSaleAmount: number
  assetSaleAmounts: Record<TradableAsset, number>; obligationCreated: number
  cashProceeds: number; expensePaid: number; debtInterestPaid: number; debtInterestAccrued: number
}
export interface LogEntry extends FinancialEffects {
  sequence: number; kind: 'setup' | 'roll' | 'encounter' | 'decision' | 'event_resolution' | 'funding' | 'rebalancing' | 'settlement' | 'market' | 'schedule' | 'insolvency'
  lap: number; turn: number; tileId: number; category?: Category
  eventId?: string; decisionId?: string; title: string; decision: string; consequence: string
  before: Snapshot; after: Snapshot
}
export interface SummaryLine { label: string; amount: number }
export interface LapSummary {
  lap: number; before: number; after: number; lines: SummaryLine[]
  rates: Record<Asset, number>; incomeTotal: number
  debtPrincipalPaid: number; fundingNotes: string[]
}
export interface PendingPayment {
  origin: 'event' | 'settlement'; title: string; total: number; remaining: number
  eventId?: string; decisionId?: string
}
export interface SettlementProgress {
  step: number; before: Snapshot; lines: SummaryLine[]; rates: Partial<Record<Asset, number>>
  incomeTotal: number; debtPrincipalPaid: number; fundingNotes: string[]
}
export interface RebalanceAction {
  kind: 'deposit' | 'withdraw' | 'buy' | 'sell' | 'repay' | 'upgrade'; amount: number; asset?: Asset
  symbolId?: string; lotId?: string; term?: Term; trend?: string
  /** Atomic MVP stock purchase + encounter completion; omitted for historical multi-trade flows. */
  completeEncounter?: boolean
}
export interface GameState extends Snapshot {
  seed: string; eventId: string | null
  pendingLanding: boolean; log: LogEntry[]; summaries: LapSummary[]
  pendingPayment: PendingPayment | null; settlement: SettlementProgress | null
}
