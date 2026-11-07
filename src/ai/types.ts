export type CoachEvidenceKind =
  | 'bond-credit'
  | 'bond-choice'
  | 'goal-result'
  | 'liquidity-gap'
  | 'business-locked'
  | 'savings-withdrawal'
  | 'savings-maturity'
  | 'borrowing'
  | 'business-buy'
  | 'business-upgrade'
  | 'business-sale'
  | 'course'
  | 'asset-trade'
  | 'macro-shock'
  | 'expense'
  | 'insolvency'

export interface CoachEvidence {
  id: string
  kind: CoachEvidenceKind
  lap?: number
  turn?: number
  fact: string
}

export interface CoachFacts {
  version: 1
  mode: 'original' | 'experimental-a' | 'experimental-b'
  board: 'A20' | 'C20' | 'B18'
  totalLaps: number
  completed: true
  won: boolean
  insolvent: boolean
  goalCostVnd: number
  requiredReserveVnd: number
  targetProceedsVnd: number
  lawfulProceedsVnd: number
  netWorthVnd: number
  cashVnd: number
  debtVnd: number
  obligationsVnd: number
  businessLockedQuoteVnd: number
  savingsProfileId: string
  evidence: CoachEvidence[]
}

export interface CoachInsight {
  title: string
  explanation: string
  evidenceIds: string[]
}

export interface CoachOutput {
  version: 1
  headline: string
  insights: CoachInsight[]
  tryNext: string
}

export interface CoachErrorResponse {
  error: string
  fallback: string
}
