import { parseRepairContext, contextDigest } from './contracts.ts'
import { integer, literal, object, plainText, text } from './schema.ts'
import type { Schema } from './schema.ts'
import { sha256 } from './serialization.ts'
import { QuestionApiError, questionFailure } from './question-errors.ts'
import { MAX_QUESTION_REQUEST_BYTES, QUESTION_API_VERSION, QUESTION_POLICY_VERSION, QUESTION_CONTEXT_VERSION } from './question-types.ts'
import type { QuestionIdentity, QuestionRequest } from './question-types.ts'

const digest = text(71, /^sha256:[0-9a-f]{64}$/)
const identitySchema: Schema<QuestionIdentity> = object({ sessionEpoch: text(48, /^[A-Za-z0-9_-]+$/), revision: integer() })
function version<const T extends number | string>(expected: T): Schema<T> {
  return value => {
    if (value === expected) return expected
    throw new QuestionApiError(typeof value === typeof expected ? 'UNSUPPORTED_VERSION' : 'INVALID_REQUEST')
  }
}
export function parseQuestionText(raw: unknown): string {
  const question = plainText(400)(raw)
  if (!question.trim()) throw new QuestionApiError('INVALID_REQUEST')
  for (let index = 0; index < question.length; index++) {
    const unit = question.charCodeAt(index)
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = question.charCodeAt(++index)
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new QuestionApiError('INVALID_REQUEST')
    } else if (unit >= 0xdc00 && unit <= 0xdfff) throw new QuestionApiError('INVALID_REQUEST')
  }
  return question
}
export async function questionDigest(raw: unknown): Promise<string> {
  try { return await sha256(parseQuestionText(raw)) } catch (error) { throw questionFailure(error) }
}
const requestSchema: Schema<QuestionRequest> = object({
  questionApiVersion: version(QUESTION_API_VERSION), questionPolicyVersion: version(QUESTION_POLICY_VERSION),
  contextVersion: version(QUESTION_CONTEXT_VERSION), locale: literal('vi-VN'),
  requestId: text(), sessionEpoch: text(48, /^[A-Za-z0-9_-]+$/), revision: integer(),
  context: parseRepairContext, contextDigest: digest, question: parseQuestionText, questionDigest: digest,
})
function decode(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  if (new TextEncoder().encode(raw).byteLength > MAX_QUESTION_REQUEST_BYTES) throw new QuestionApiError('PAYLOAD_TOO_LARGE')
  try { return JSON.parse(raw) } catch { throw new QuestionApiError('INVALID_JSON') }
}
/** Schema detaches every field before awaiting; checksum is identity, never proof of client state. */
export async function parseQuestionRequest(raw: unknown): Promise<QuestionRequest> {
  try {
    const request = requestSchema(decode(raw))
    if (new TextEncoder().encode(JSON.stringify(request)).byteLength > MAX_QUESTION_REQUEST_BYTES) throw new QuestionApiError('PAYLOAD_TOO_LARGE')
    const decision = request.context.decision
    if (decision.stateRevision !== `${request.sessionEpoch}:${request.revision}`
      || decision.decisionId !== `${request.sessionEpoch}:repair:${decision.encounterSequence}`) throw new QuestionApiError('CONTEXT_MISMATCH')
    const [contextHash, questionHash] = await Promise.all([contextDigest(request.context), questionDigest(request.question)])
    if (contextHash !== request.contextDigest || questionHash !== request.questionDigest) throw new QuestionApiError('CONTEXT_MISMATCH')
    return request
  } catch (error) { throw questionFailure(error) }
}
export async function createQuestionRequest(context: unknown, rawIdentity: unknown, rawQuestion: unknown, rawId: unknown): Promise<QuestionRequest> {
  try {
    const dto = parseRepairContext(context), identity = identitySchema(rawIdentity)
    const question = parseQuestionText(rawQuestion), requestId = text()(rawId)
    const [contextHash, questionHash] = await Promise.all([contextDigest(dto), questionDigest(question)])
    return parseQuestionRequest({ questionApiVersion: 1, questionPolicyVersion: QUESTION_POLICY_VERSION,
      contextVersion: QUESTION_CONTEXT_VERSION, locale: 'vi-VN', requestId, ...identity, context: dto,
      contextDigest: contextHash, question, questionDigest: questionHash })
  } catch (error) { throw questionFailure(error) }
}
