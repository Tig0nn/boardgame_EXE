import { readBoundedJson } from '../bounded-json.ts'
import type { ExplanationFacts, WhatIfDecision } from '../../../mobile_app/src/game/what-if-ai/orchestrator.ts'
import { explanationClaim, parameterAlternativeId, WHAT_IF_KINDS, validAlternative } from '../../../mobile_app/src/game/what-if-ai/orchestrator.ts'
import { hasExplicitFinancialParameters, readIntentReply } from '../../../mobile_app/src/game/what-if-ai/natural-language.ts'
import type { IntentReply } from '../../../mobile_app/src/game/what-if-ai/natural-language.ts'

export const WHAT_IF_ENDPOINT = '/api/what-if-provider'
export const MAX_HTTP_BYTES = 8192
export const WHAT_IF_DEFAULT_SERVER_DEADLINE_MS = 5000
const WHAT_IF_MAX_DEV_DEADLINE_MS = 30_000

export function validateWhatIfDevDeadlineMs(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > WHAT_IF_MAX_DEV_DEADLINE_MS) {
    throw new Error('What-if DEV deadline must be an integer from 1 to 30000 ms')
  }
  return value
}
export type ProviderRequest = { operation: 'propose'; question: string; catalog: WhatIfDecision[] }
  | { operation: 'explain'; facts: ExplanationFacts }
  | { operation: 'interpret'; question: string }
export type ProposalReply = { status: 'proposal'; decisionId: string; alternativeId: string }
  | { status: 'unsupported' | 'ambiguous' }
export class WhatIfApiError extends Error {
  readonly code: 'INVALID_REQUEST' | 'PROVIDER_UNAVAILABLE' | 'PROVIDER_TIMEOUT' | 'OUTPUT_REJECTED' | 'RATE_LIMITED'
  constructor(code: WhatIfApiError['code']) { super(code); this.code = code }
}

export function fields(value: unknown, keys: string[], code: WhatIfApiError['code'] = 'INVALID_REQUEST'): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype
    || Reflect.ownKeys(value).length !== keys.length
    || keys.some(key => !Object.hasOwn(value, key) || !('value' in Object.getOwnPropertyDescriptor(value, key)!))) {
    throw new WhatIfApiError(code)
  }
}

export function validateProviderRequest(value: unknown): asserts value is ProviderRequest {
  if (!value || typeof value !== 'object') throw new WhatIfApiError('INVALID_REQUEST')
  const operation = Object.getOwnPropertyDescriptor(value, 'operation')?.value
  if (operation === 'interpret') {
    fields(value, ['operation', 'question'])
    if (typeof value.question !== 'string' || !value.question.trim() || value.question.length > 240
      || [...value.question].some(character => character.charCodeAt(0) < 32)
      || /\S+@\S+|https?:\/\/|(?:\+?\d[\d -]{7,}\d)|AIza[\w-]+/i.test(value.question)) throw new WhatIfApiError('INVALID_REQUEST')
    return
  }
  if (operation === 'explain') {
    fields(value, ['operation', 'facts'])
    fields(value.facts, ['kind', 'direction', 'confirmedFollowUp'])
    const facts = value.facts
    if (!WHAT_IF_KINDS.some(kind => kind === facts.kind) || !['up', 'down', 'unchanged'].some(direction => direction === facts.direction)
      || typeof facts.confirmedFollowUp !== 'boolean') throw new WhatIfApiError('INVALID_REQUEST')
    return
  }
  fields(value, ['operation', 'question', 'catalog'])
  if (operation !== 'propose' || typeof value.question !== 'string' || !value.question.trim() || value.question.length > 240
    || [...value.question].some(character => character.charCodeAt(0) < 32)
    || /\S+@\S+|https?:\/\/|AIza[\w-]+/i.test(value.question)
    || !Array.isArray(value.catalog) || !value.catalog.length || value.catalog.length > 16) throw new WhatIfApiError('INVALID_REQUEST')
  const ids = new Set<string>()
  for (const decision of value.catalog) {
    const hasParameters = !!decision && typeof decision === 'object' && Object.hasOwn(decision, 'parameters')
    fields(decision, ['kind', 'decisionId', 'alternativeId', 'lap', 'turn', ...(hasParameters ? ['parameters'] : [])])
    const kind = decision.kind
    if (!WHAT_IF_KINDS.some(candidate => candidate === kind) || typeof decision.decisionId !== 'string'
      || typeof decision.alternativeId !== 'string'
      || !new RegExp(`^${kind}:[1-9][0-9]{0,2}$`).test(decision.decisionId)
      || !(hasParameters ? parameterAlternativeId(String(kind), decision.parameters) === decision.alternativeId : validAlternative(String(kind), decision.alternativeId))
      || !Number.isSafeInteger(decision.lap) || Number(decision.lap) < 1 || Number(decision.lap) > 4
      || !Number.isSafeInteger(decision.turn) || Number(decision.turn) < 0 || Number(decision.turn) > 200) throw new WhatIfApiError('INVALID_REQUEST')
    const id = `${decision.decisionId}/${decision.alternativeId}`
    if (ids.has(id)) throw new WhatIfApiError('INVALID_REQUEST')
    ids.add(id)
  }
  // A verified monetary literal can have the same length as a phone number. Exempt only its explicit amount clause.
  const catalog = value.catalog
  const question = value.question.replace(/(?:số tiền|so tien) ([1-9][0-9]*)\b/gi, (clause, amount: string) =>
    catalog.some((choice: WhatIfDecision) => choice.parameters && String(choice.parameters.amount) === amount) ? 'số tiền [đã chọn]' : clause)
  if (/(?:\+?\d[\d -]{7,}\d)/.test(question)) throw new WhatIfApiError('INVALID_REQUEST')
}

export function intentReply(value: unknown, question: string, onReject?: (step: 'contract' | 'financial') => void): IntentReply {
  const reply = readIntentReply(value)
  if (!reply) {
    onReject?.('contract')
    throw new WhatIfApiError('OUTPUT_REJECTED')
  }
  if (reply.status === 'intent' && !hasExplicitFinancialParameters(question, reply.intent)) {
    onReject?.('financial')
    throw new WhatIfApiError('OUTPUT_REJECTED')
  }
  return reply
}

export function explanationReply(value: unknown, facts: ExplanationFacts): { claimId: string } {
  fields(value, ['claimId'], 'OUTPUT_REJECTED')
  const claimId = explanationClaim(facts)
  if (value.claimId !== claimId) throw new WhatIfApiError('OUTPUT_REJECTED')
  return { claimId }
}

export function proposalReply(value: unknown, catalog: readonly WhatIfDecision[]): ProposalReply {
  if (value && typeof value === 'object' && Object.hasOwn(value, 'status')) {
    fields(value, ['status'], 'OUTPUT_REJECTED')
    if (value.status === 'unsupported' || value.status === 'ambiguous') return value as ProposalReply
    throw new WhatIfApiError('OUTPUT_REJECTED')
  }
  fields(value, ['decisionId', 'alternativeId'], 'OUTPUT_REJECTED')
  if (!catalog.some(decision => decision.decisionId === value.decisionId && decision.alternativeId === value.alternativeId)) {
    throw new WhatIfApiError('OUTPUT_REJECTED')
  }
  return { status: 'proposal', decisionId: String(value.decisionId), alternativeId: String(value.alternativeId) }
}

export async function boundedJson(response: Response, signal: AbortSignal, maxBytes = MAX_HTTP_BYTES): Promise<unknown> {
  try {
    return await readBoundedJson(response, signal, maxBytes)
  } catch {
    signal.throwIfAborted()
    throw new WhatIfApiError('OUTPUT_REJECTED')
  }
}
