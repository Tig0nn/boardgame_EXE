import { parseQuestionRequest } from './question-contract.ts'
import { QuestionApiError, questionCorrelation } from './question-errors.ts'
import { runQuestionFeature } from './question-feature.ts'
import type { QuestionFeature } from './question-feature.ts'
import { answerRepairQuestion } from './questions/answer.ts'
import { QUESTION_INTENTS } from './questions/routing.ts'
import { TEMPLATE_IDS } from './templates.ts'
import { array, enumeration, literal, nullable, object, optional, plainText, text, integer } from './schema.ts'
import type { Schema } from './schema.ts'
import { canonicalJson } from './serialization.ts'
import { MAX_QUESTION_RESPONSE_BYTES, QUESTION_POLICY_VERSION } from './question-types.ts'
import type { QuestionRequest, QuestionResponse, QuestionResult } from './question-types.ts'

export interface QuestionExecution { feature?: QuestionFeature; signal?: AbortSignal }
const ref = text(96, /^[A-Za-z][A-Za-z0-9.-]*$/), digest = text(71, /^sha256:[0-9a-f]{64}$/)
const bindingFields = object({ now: optional(ref), after: optional(ref), later: optional(ref), total: optional(ref),
  due: optional(ref), shortfall: optional(ref), extraCost: optional(ref), retainedCash: optional(ref),
  before: optional(ref), concept: optional(ref) })
const bindings: Schema<Record<string, string>> = raw => Object.fromEntries(Object.entries(bindingFields(raw))
  .filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
const statement = object({ templateId: enumeration(TEMPLATE_IDS), bindings, text: plainText(400), evidenceRefs: array(ref, 0, 16) })
const labeled = object({ label: plainText(64), optionId: nullable(enumeration(['full', 'temporary'])), statement })
const answered = object({ status: literal('answered'), intent: enumeration(QUESTION_INTENTS), explanation: plainText(400),
  statements: array(labeled, 1, 4), reflectionQuestion: statement, evidenceRefs: array(ref, 0, 16) })
const empty: Schema<[]> = value => { array(ref, 0, 0)(value); return [] }
const fallback = object({ status: literal('fallback'),
  reason: enumeration(['clarification-needed', 'missing-data', 'hidden-or-future', 'real-world', 'unsupported-wording']),
  explanation: plainText(400), statements: empty, reflectionQuestion: literal(null), evidenceRefs: empty })
const result: Schema<QuestionResult> = raw => {
  const status = raw && typeof raw === 'object' ? Object.getOwnPropertyDescriptor(raw, 'status') : undefined
  if (status && 'value' in status && status.value === 'answered') return answered(raw)
  if (status && 'value' in status && status.value === 'fallback') return fallback(raw)
  throw new QuestionApiError('INVALID_RESPONSE')
}
const responseSchema: Schema<QuestionResponse> = object({
  questionApiVersion: literal(1), questionPolicyVersion: literal(QUESTION_POLICY_VERSION), contextVersion: literal('b18-advice.v1'),
  source: literal('deterministic'), integrity: literal('rules-checked-client-state-unverified'),
  correlation: object({ requestId: text(), sessionEpoch: text(48, /^[A-Za-z0-9_-]+$/), revision: integer(),
    decisionId: text(), stateRevision: text(), contextDigest: digest, questionDigest: digest }),
  limitations: array(enumeration(['simulated-game-only', 'client-state-unverified', 'future-outcomes-unknown', 'funding-costs-not-included']), 3, 4),
  result,
})
async function canonicalResponse(request: QuestionRequest, signal: AbortSignal): Promise<QuestionResponse> {
  const answer = await answerRepairQuestion({ apiVersion: 1, contextVersion: request.contextVersion,
    requestId: request.requestId, mode: 'compare', locale: request.locale, contextDigest: request.contextDigest,
    context: request.context, question: request.question }, signal)
  signal.throwIfAborted()
  let result: QuestionResult
  if (answer.route.intent === 'unsupported') {
    result = { status: 'fallback', reason: answer.route.reason, explanation: answer.explanation,
      statements: [], reflectionQuestion: null, evidenceRefs: [] }
  } else {
    if (!answer.reflectionQuestion) throw new QuestionApiError('INVALID_RESPONSE')
    result = { status: 'answered', intent: answer.route.intent, explanation: answer.explanation,
      statements: answer.statements, reflectionQuestion: answer.reflectionQuestion, evidenceRefs: answer.evidenceRefs }
  }
  const response = responseSchema({ questionApiVersion: 1, questionPolicyVersion: QUESTION_POLICY_VERSION,
    contextVersion: request.contextVersion, source: 'deterministic', integrity: 'rules-checked-client-state-unverified',
    correlation: questionCorrelation(request), limitations: answer.limitations, result })
  if (response.result.status === 'answered' && response.result.reflectionQuestion.text.length > 240
    || new TextEncoder().encode(JSON.stringify(response)).byteLength > MAX_QUESTION_RESPONSE_BYTES) throw new QuestionApiError('INVALID_RESPONSE')
  return response
}
export function answerQuestion(raw: unknown, options: QuestionExecution = {}): Promise<QuestionResponse> {
  return runQuestionFeature(options.feature, options.signal, async signal => {
    const request = await parseQuestionRequest(raw)
    signal.throwIfAborted()
    return canonicalResponse(request, signal)
  })
}
/** Closed schema AND exact canonical content; reconstruct the trusted object, never salvage raw output. */
export function parseQuestionResponse(raw: unknown, rawRequest: unknown, options: QuestionExecution = {}): Promise<QuestionResponse> {
  return runQuestionFeature(options.feature, options.signal, async signal => {
    let response: QuestionResponse
    try {
      if (typeof raw === 'string') {
        if (new TextEncoder().encode(raw).byteLength > MAX_QUESTION_RESPONSE_BYTES) throw new QuestionApiError('INVALID_RESPONSE')
        raw = JSON.parse(raw)
      }
      response = responseSchema(raw)
    } catch { throw new QuestionApiError('INVALID_RESPONSE') }
    const request = await parseQuestionRequest(rawRequest)
    signal.throwIfAborted()
    const expected = await canonicalResponse(request, signal)
    if (canonicalJson(response) !== canonicalJson(expected)) throw new QuestionApiError('INVALID_RESPONSE')
    return expected
  })
}
