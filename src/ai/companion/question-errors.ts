import { CompanionContractError, ERROR_POLICY } from './errors.ts'
import { enumeration, integer, literal, nullable, object, optional, plainText, text, invalid } from './schema.ts'
import type { Schema } from './schema.ts'
import type { QuestionCorrelation, QuestionError, QuestionErrorCode, QuestionRequest } from './question-types.ts'
import { canonicalJson } from './serialization.ts'

export const QUESTION_ERROR_POLICY = {
  ...ERROR_POLICY,
  QUESTION_FEATURE_DISABLED: [503, 'Tính năng hỏi về sửa chữa đang tắt.', false],
} as const satisfies Record<QuestionErrorCode, readonly [number, string, boolean]>

export class QuestionApiError extends Error {
  readonly code: QuestionErrorCode
  constructor(code: QuestionErrorCode) {
    super(QUESTION_ERROR_POLICY[code][1])
    this.name = 'QuestionApiError'
    this.code = code
  }
}
export function questionFailure(error: unknown): QuestionApiError {
  if (error instanceof QuestionApiError) return error
  return new QuestionApiError(error instanceof CompanionContractError ? error.code : 'SERVICE_UNAVAILABLE')
}
export function questionCorrelation(request: QuestionRequest): QuestionCorrelation {
  return { requestId: request.requestId, sessionEpoch: request.sessionEpoch, revision: request.revision,
    decisionId: request.context.decision.decisionId, stateRevision: request.context.decision.stateRevision,
    contextDigest: request.contextDigest, questionDigest: request.questionDigest }
}
const absent = { requestId: null, sessionEpoch: null, revision: null, decisionId: null,
  stateRevision: null, contextDigest: null, questionDigest: null }
export function questionErrorResponse(code: QuestionErrorCode, request?: QuestionRequest, retryAfterMs?: number): QuestionError {
  if (retryAfterMs !== undefined && (code !== 'RATE_LIMITED' || !Number.isSafeInteger(retryAfterMs)
    || retryAfterMs < 1 || retryAfterMs > 86_400_000)) throw new QuestionApiError('INVALID_RESPONSE')
  const policy = QUESTION_ERROR_POLICY[code]
  return { questionApiVersion: 1, error: { code, message: policy[1], retryable: policy[2],
    ...(retryAfterMs === undefined ? {} : { retryAfterMs }) },
    correlation: request ? questionCorrelation(request) : { ...absent } }
}
const digest = text(71, /^sha256:[0-9a-f]{64}$/)
const errorSchema: Schema<QuestionError> = object({
  questionApiVersion: literal(1),
  error: object({ code: enumeration(Object.keys(QUESTION_ERROR_POLICY) as QuestionErrorCode[]),
    message: plainText(150), retryable: value => typeof value === 'boolean' ? value : invalid(),
    retryAfterMs: optional(integer(1, 86_400_000)) }),
  correlation: object({ requestId: nullable(text()), sessionEpoch: nullable(text(48, /^[A-Za-z0-9_-]+$/)),
    revision: nullable(integer()), decisionId: nullable(text()), stateRevision: nullable(text()),
    contextDigest: nullable(digest), questionDigest: nullable(digest) }),
})
export function parseQuestionError(raw: unknown, request?: QuestionRequest, status?: number): QuestionError {
  try {
    const parsed = errorSchema(raw), expected = questionErrorResponse(parsed.error.code, undefined, parsed.error.retryAfterMs)
    if (canonicalJson(parsed.error) !== canonicalJson(expected.error)
      || status !== undefined && status !== QUESTION_ERROR_POLICY[parsed.error.code][0]) throw new QuestionApiError('INVALID_RESPONSE')
    const correlation = parsed.correlation
    if (canonicalJson(correlation) !== canonicalJson(absent)
      && (!request || canonicalJson(correlation) !== canonicalJson(questionCorrelation(request)))) throw new QuestionApiError('INVALID_RESPONSE')
    return parsed
  } catch { throw new QuestionApiError('INVALID_RESPONSE') }
}
// Keep this module browser-safe; no HTTP/server/provider imports.
