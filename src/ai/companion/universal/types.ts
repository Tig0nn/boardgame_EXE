export const GAMEPLAY_POLICY = 'b18-gameplay-question.v1' as const
export const GAMEPLAY_CONTEXT = 'b18-gameplay-context.v1' as const
export const DOMAINS = ['bank','stocks','bonds','gold','business','course','personal','macro','funding','summary','rebalancing','forecast','overview'] as const
export type GameplayDomain = typeof DOMAINS[number]
export interface GameplayIdentity { sessionEpoch: string; revision: number }
export interface GameplayFact { code: string; subject: string; value: number }
export interface GameplayContext extends GameplayIdentity {
  version: typeof GAMEPLAY_CONTEXT
  profile: 'core-mvp-b18-v1' | 'core-mvp-b18-multi-course-v1'
  domain: GameplayDomain
  phase: 'forecast'|'rolling'|'event'|'funding'|'summary'|'rebalancing'
  eventId: string | null
  lap: number; totalLaps: number; turn: number
  facts: GameplayFact[]
  actions: string[]; resources: string[]
  entries: { label: string; amount: number }[]
}
export interface GameplayRequest extends GameplayIdentity {
  version: 1; policy: typeof GAMEPLAY_POLICY; requestId: string
  context: GameplayContext; contextDigest: string; question: string; questionDigest: string
}
export type GameplayIntent = 'explain'|'compare'|'risk'|'cashflow'|'learn'
export interface GameplayResponse extends GameplayIdentity {
  version: 1; policy: typeof GAMEPLAY_POLICY; requestId: string
  contextDigest: string; questionDigest: string
  source: 'deterministic'; integrity: 'client-state-unverified'
  status: 'answered'|'fallback'
  reason: 'supported'|'unsupported'|'future'|'outside-game'|'multi-intent'|'missing-data'
  intent: GameplayIntent | null
  conclusion: string; explanation: string
  facts: GameplayFact[]; entries: {label: string; amount: number}[]
  actions: string[]; resources: string[]
  reflection: string | null; limitations: string[]
}