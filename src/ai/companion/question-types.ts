import type { RepairContext, GroundedStatement, RepairOptionId, CompanionSuccess, CompanionErrorCode } from './types.ts'
import type { QuestionIntent, QuestionFallback } from './questions/routing.ts'

export const QUESTION_API_VERSION = 1 as const
export const QUESTION_POLICY_VERSION = 'b18-repair-question.v1' as const
export const QUESTION_CONTEXT_VERSION = 'b18-advice.v1' as const
export const MAX_QUESTION_REQUEST_BYTES = 8192
export const MAX_QUESTION_RESPONSE_BYTES = 12288
export const QUESTION_ENDPOINT = '/api/ai-companion-question' as const

export interface QuestionIdentity { sessionEpoch: string; revision: number }
export interface QuestionRequest extends QuestionIdentity {
  questionApiVersion: typeof QUESTION_API_VERSION
  questionPolicyVersion: typeof QUESTION_POLICY_VERSION
  contextVersion: typeof QUESTION_CONTEXT_VERSION
  locale: 'vi-VN'
  requestId: string
  context: RepairContext
  contextDigest: string
  question: string
  questionDigest: string
}
export interface QuestionCorrelation extends QuestionIdentity {
  requestId: string
  decisionId: string
  stateRevision: string
  contextDigest: string
  questionDigest: string
}
export interface QuestionStatement {
  label: string
  optionId: RepairOptionId | null
  statement: GroundedStatement
}
export type QuestionResult =
  | { status: 'answered'; intent: QuestionIntent; explanation: string; statements: QuestionStatement[]
      reflectionQuestion: GroundedStatement; evidenceRefs: string[] }
  | { status: 'fallback'; reason: QuestionFallback; explanation: string; statements: []
      reflectionQuestion: null; evidenceRefs: [] }
export interface QuestionResponse {
  questionApiVersion: typeof QUESTION_API_VERSION
  questionPolicyVersion: typeof QUESTION_POLICY_VERSION
  contextVersion: typeof QUESTION_CONTEXT_VERSION
  source: 'deterministic'
  integrity: 'rules-checked-client-state-unverified'
  correlation: QuestionCorrelation
  limitations: CompanionSuccess['advice']['limitations']
  result: QuestionResult
}
export type QuestionErrorCode = CompanionErrorCode | 'QUESTION_FEATURE_DISABLED'
export interface QuestionError {
  questionApiVersion: typeof QUESTION_API_VERSION
  error: { code: QuestionErrorCode; message: string; retryable: boolean; retryAfterMs?: number }
  correlation: { [K in keyof QuestionCorrelation]: QuestionCorrelation[K] | null }
}
