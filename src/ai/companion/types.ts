export const API_VERSION = 1 as const
export const CONTEXT_VERSION = 'b18-advice.v1' as const
export const INTEGRITY = 'rules-checked-client-state-unverified' as const
export const MODES = ['explain', 'compare', 'guide'] as const
export type AdviceMode = typeof MODES[number]
export type RepairOptionId = 'full' | 'temporary'
export type FactId = string

export interface RepairProfile {
  gameplayProfile: 'core-mvp-b18-multi-course-v1'
  boardRevision: 'b18-l3-bonds-v1'
  goalRulesVersion: 'single-90m-v1'
  encounterRulesVersion: 'b18-tile-trading-v1'
  courseRulesVersion: 'b18-i2-choice-v1'
  bondRulesVersion: 'v2.5-credit-risk'
  livingExpenseRulesVersion: 'b18-periodic-start-v1'
  savingsProfileId: 'v2.2-c20'
  adviceRulesVersion: 'b18-repair.v1'
}
export interface RepairQuote {
  optionId: RepairOptionId
  engineAction: 'choose'
  allowed: true
  costNowVnd: number
  obligationAddedVnd: number
  totalCommittedCostVnd: number
  cashAfterImmediateVnd: number
  obligationsAfterImmediateVnd: number
  /** Conditional on completing any required funding; not an applied liability. */
  obligationsAfterResolutionVnd: number
  fundingShortfallVnd: number
  execution: 'cash-sufficient' | 'funding-required'
  due: 'none' | 'next-start-settlement'
  dueLap: number | null
}
export interface RepairContext {
  profile: RepairProfile
  decision: {
    decisionId: string; stateRevision: string; phase: 'event'; eventId: 'repair'
    encounterSequence: number; turn: number; lap: number; totalLaps: 4
    tileIndex: 3; tileType: 'personal'
  }
  financial: {
    cashVnd: number; savingsPrincipalVnd: number; assetLiquidationQuoteVnd: number
    netWorthVnd: number; debtVnd: number; obligationsVnd: number; goalTargetVnd: number
  }
  // Closed P2a scope: no history/market data needed for repair.
  revealedDecisions: []
  publicMarket: []
  options: RepairQuote[]
}
export interface CompanionRequest {
  apiVersion: typeof API_VERSION
  contextVersion: typeof CONTEXT_VERSION
  requestId: string; mode: AdviceMode; locale: 'vi-VN'; contextDigest: string
  context: RepairContext
  question?: string
}
export interface CandidateStatement { templateId: string; bindings: Record<string, FactId> }
export interface AdviceCandidate {
  summary: CandidateStatement
  tradeoffs: Array<{ optionId: RepairOptionId; statements: CandidateStatement[] }>
  risks: CandidateStatement[]
  reflectionQuestion: CandidateStatement
}
export interface GroundedStatement extends CandidateStatement { text: string; evidenceRefs: FactId[] }
export type FallbackReason = 'offline-prototype' | 'provider-unavailable' | 'provider-timeout'
  | 'output-rejected' | 'budget-exhausted' | 'funding-not-modeled' | 'question-out-of-scope'
export interface CompanionSuccess {
  apiVersion: typeof API_VERSION; contextVersion: typeof CONTEXT_VERSION
  requestId: string; decisionId: string; stateRevision: string; contextDigest: string
  mode: AdviceMode
  /** P1/P2a emits only mock or deterministic; model reserved for future P2b. */
  source: 'model' | 'mock' | 'deterministic'
  integrity: typeof INTEGRITY
  fallbackReason?: FallbackReason
  advice: {
    summary: GroundedStatement
    tradeoffs: Array<{ optionId: RepairOptionId; statements: GroundedStatement[] }>
    risks: GroundedStatement[]
    reflectionQuestion: GroundedStatement
    evidenceRefs: FactId[]
    limitations: Array<'simulated-game-only' | 'client-state-unverified'
      | 'future-outcomes-unknown' | 'funding-costs-not-included'>
  }
}
export type CompanionErrorCode = 'INVALID_JSON' | 'INVALID_REQUEST' | 'METHOD_NOT_ALLOWED'
  | 'UNSUPPORTED_VERSION' | 'UNSUPPORTED_PROFILE' | 'CONTEXT_MISMATCH'
  | 'DECISION_UNAVAILABLE' | 'PAYLOAD_TOO_LARGE' | 'INVALID_FINANCIAL_CONTEXT'
  | 'INVALID_OPTIONS' | 'RATE_LIMITED' | 'SERVICE_UNAVAILABLE' | 'INVALID_RESPONSE'
export interface CompanionError {
  apiVersion: typeof API_VERSION
  error: { code: CompanionErrorCode; message: string; retryable: boolean; retryAfterMs?: number }
  correlation: { requestId: string | null; decisionId: string | null; stateRevision: string | null }
}
