import { parseCompanionRequest } from '../contracts.ts'
import { CompanionContractError } from '../errors.ts'
import { canonicalJson, sha256 } from '../serialization.ts'
import type { CompanionRequest } from '../types.ts'
import { classifyRepairQuestion } from './routing.ts'
import type { QuestionRoute } from './routing.ts'
import { selectQuestionLesson } from './lesson.ts'
import type { QuestionLesson } from './lesson.ts'

async function correlate(request: CompanionRequest) {
  if (!request.question?.trim()) throw new CompanionContractError('INVALID_REQUEST')
  // TextEncoder replaces lone surrogates; reject them so distinct accepted questions cannot alias.
  for (let index = 0; index < request.question.length; index++) {
    const unit = request.question.charCodeAt(index)
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = request.question.charCodeAt(++index)
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new CompanionContractError('INVALID_REQUEST')
    } else if (unit >= 0xdc00 && unit <= 0xdfff) throw new CompanionContractError('INVALID_REQUEST')
  }
  return { requestId: request.requestId, mode: request.mode,
    decisionId: request.context.decision.decisionId, stateRevision: request.context.decision.stateRevision,
    contextDigest: request.contextDigest, questionDigest: await sha256(request.question) }
}

/** Private evaluation DTO, NOT CompanionSuccess/API1. No public index or endpoint export. */
export interface QuestionAnswer extends QuestionLesson {
  policy: 'repair-questions.p3-internal'
  source: 'deterministic'
  correlation: Awaited<ReturnType<typeof correlate>>
  route: QuestionRoute
  evidenceRefs: string[]
}

/** Full literal comparison against a regenerated plan; never invoke untrusted getters. */
function exactValue(raw: unknown, expected: unknown): boolean {
  if (expected === null || typeof expected !== 'object') return raw === expected
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) !== Array.isArray(expected)
    || ![Object.prototype, null, Array.prototype].includes(Object.getPrototypeOf(raw))) return false
  const actualKeys = Reflect.ownKeys(raw), expectedKeys = Reflect.ownKeys(expected)
  if (actualKeys.length !== expectedKeys.length) return false
  const actual = Object.getOwnPropertyDescriptors(raw), wanted = Object.getOwnPropertyDescriptors(expected)
  return expectedKeys.every(key => typeof key === 'string' && Object.hasOwn(actual, key)
    && 'value' in actual[key] && exactValue(actual[key].value, wanted[key].value))
}

export async function answerRepairQuestion(rawRequest: unknown, signal?: AbortSignal): Promise<QuestionAnswer> {
  signal?.throwIfAborted()
  // Existing parser detaches before its first await and verifies profile, rules, quotes and digest.
  const request = await parseCompanionRequest(rawRequest)
  signal?.throwIfAborted()
  const correlation = await correlate(request)
  const route = classifyRepairQuestion(request.question)
  const lesson = await selectQuestionLesson(request, route)
  signal?.throwIfAborted()
  return { policy: 'repair-questions.p3-internal', source: 'deterministic', correlation, route, ...lesson,
    evidenceRefs: [...new Set([...lesson.statements.map(row => row.statement), ...(lesson.reflectionQuestion ? [lesson.reflectionQuestion] : [])].flatMap(s => s.evidenceRefs))].sort() }
}

/** Return reconstructed trusted output rather than any object supplied by a caller/model. */
export async function parseQuestionAnswer(raw: unknown, rawRequest: unknown): Promise<QuestionAnswer> {
  const expected = await answerRepairQuestion(rawRequest)
  try {
    if (!exactValue(raw, expected)) throw new CompanionContractError('INVALID_RESPONSE')
    return expected
  } catch { throw new CompanionContractError('INVALID_RESPONSE') }
}

/** Caller must sample current context immediately before rendering, and invalidate on every snapshot change. */
export async function matchesQuestionAnswer(raw: unknown, pending: unknown, current: unknown): Promise<boolean> {
  try {
    // Detach both input requests before awaiting so caller mutation cannot retarget a pending response.
    const pendingRead = parseCompanionRequest(pending), currentRead = parseCompanionRequest(current)
    const [pendingRequest, currentRequest] = await Promise.all([pendingRead, currentRead])
    const checked = await parseQuestionAnswer(raw, pendingRequest)
    return canonicalJson(checked.correlation) === canonicalJson(await correlate(currentRequest))
  } catch { return false }
}
