import { parseCompanionRequest } from './contracts.ts'
import { buildRepairFacts } from './facts.ts'
import { createAdviceCandidate, renderStatement, TEMPLATE_IDS } from './templates.ts'
import { array, enumeration, literal, object, optional, plainText, text } from './schema.ts'
import type { Schema } from './schema.ts'
import { canonicalJson } from './serialization.ts'
import { CompanionContractError } from './errors.ts'
import { MODES } from './types.ts'
import type { AdviceCandidate, CandidateStatement, CompanionRequest, CompanionSuccess, FallbackReason, GroundedStatement } from './types.ts'

export const FALLBACK_REASONS = ['offline-prototype', 'provider-unavailable', 'provider-timeout', 'output-rejected',
  'budget-exhausted', 'funding-not-modeled', 'question-out-of-scope'] as const
const ref = text(96, /^[A-Za-z][A-Za-z0-9.-]*$/)
const bindingsShape = object({ now: optional(ref), after: optional(ref), later: optional(ref), total: optional(ref),
  due: optional(ref), shortfall: optional(ref), extraCost: optional(ref), retainedCash: optional(ref),
  before: optional(ref), concept: optional(ref) })
const bindings: Schema<Record<string, string>> = raw => Object.fromEntries(Object.entries(bindingsShape(raw))
  .filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
const candidateStatement = object({ templateId: enumeration(TEMPLATE_IDS), bindings })
const statementSchema: Schema<GroundedStatement> = object({ templateId: enumeration(TEMPLATE_IDS), bindings,
  text: plainText(400), evidenceRefs: array(ref, 0, 16) })
const optionId = enumeration(['full', 'temporary'])
const candidateSchema: Schema<AdviceCandidate> = object({
  summary: candidateStatement, tradeoffs: array(object({ optionId, statements: array(candidateStatement, 1, 2) }), 2, 2),
  risks: array(candidateStatement, 0, 2), reflectionQuestion: candidateStatement,
})
const successSchema: Schema<CompanionSuccess> = object({
  apiVersion: literal(1), contextVersion: literal('b18-advice.v1'), requestId: text(), decisionId: text(),
  stateRevision: text(), contextDigest: text(71, /^sha256:[0-9a-f]{64}$/), mode: enumeration(MODES),
  source: enumeration(['model', 'mock', 'deterministic']), integrity: literal('rules-checked-client-state-unverified'),
  fallbackReason: optional(enumeration(FALLBACK_REASONS)),
  advice: object({ summary: statementSchema,
    tradeoffs: array(object({ optionId, statements: array(statementSchema, 1, 2) }), 2, 2),
    risks: array(statementSchema, 0, 2), reflectionQuestion: statementSchema, evidenceRefs: array(ref, 0, 16),
    limitations: array(enumeration(['simulated-game-only', 'client-state-unverified', 'future-outcomes-unknown', 'funding-costs-not-included']), 3, 4) }),
})

/** Reject the whole candidate, including right IDs in the wrong semantic role. */
function validateCandidate(raw: unknown, request: CompanionRequest): AdviceCandidate {
  const candidate = candidateSchema(raw)
  if (canonicalJson(candidate) !== canonicalJson(createAdviceCandidate(request))) throw new CompanionContractError('INVALID_RESPONSE')
  return candidate
}

function renderValidated(request: CompanionRequest, candidate: AdviceCandidate, source: CompanionSuccess['source'], reason?: FallbackReason): CompanionSuccess {
  const funding = request.context.options.some(option => option.fundingShortfallVnd > 0)
  if (source === 'deterministic' ? !reason : reason !== undefined) throw new CompanionContractError('INVALID_RESPONSE')
  if (request.question && (source !== 'deterministic' || reason !== 'question-out-of-scope')
    || !request.question && funding && (source !== 'deterministic' || reason !== 'funding-not-modeled')) {
    throw new CompanionContractError('INVALID_RESPONSE')
  }
  const facts = buildRepairFacts(request.context)
  const render = (statement: CandidateStatement) => renderStatement(statement, facts)
  const summary = render(candidate.summary), tradeoffs = candidate.tradeoffs.map(group => ({ optionId: group.optionId, statements: group.statements.map(render) }))
  const risks = candidate.risks.map(render), reflectionQuestion = render(candidate.reflectionQuestion)
  if (summary.text.length > 300 || reflectionQuestion.text.length > 240) throw new CompanionContractError('INVALID_RESPONSE')
  return successSchema({ apiVersion: 1, contextVersion: request.contextVersion, requestId: request.requestId,
    decisionId: request.context.decision.decisionId, stateRevision: request.context.decision.stateRevision,
    contextDigest: request.contextDigest, mode: request.mode, source, integrity: 'rules-checked-client-state-unverified',
    ...(reason ? { fallbackReason: reason } : {}),
    advice: { summary, tradeoffs, risks, reflectionQuestion,
      evidenceRefs: [...new Set([summary, ...tradeoffs.flatMap(group => group.statements), ...risks, reflectionQuestion].flatMap(s => s.evidenceRefs))].sort(),
      limitations: ['simulated-game-only', 'client-state-unverified', 'future-outcomes-unknown', ...(funding ? ['funding-costs-not-included'] : [])] } })
}

export async function deterministicAdvice(rawRequest: unknown, reason: FallbackReason = 'offline-prototype'): Promise<CompanionSuccess> {
  const request = await parseCompanionRequest(rawRequest)
  const funding = request.context.options.some(option => option.fundingShortfallVnd > 0)
  return renderValidated(request, createAdviceCandidate(request), 'deterministic', request.question
    ? 'question-out-of-scope' : funding ? 'funding-not-modeled' : reason)
}

/** Synthetic model contract only. This function never calls or claims Gemini. */
export async function renderMockAdvice(rawRequest: unknown, rawCandidate: unknown): Promise<CompanionSuccess> {
  return renderProviderAdvice(rawRequest, rawCandidate, 'mock')
}

/** Provenance is supplied by the server adapter, never by a provider candidate. */
export async function renderProviderAdvice(rawRequest: unknown, rawCandidate: unknown, source: 'mock' | 'model'): Promise<CompanionSuccess> {
  const request = await parseCompanionRequest(rawRequest)
  const candidate = validateCandidate(rawCandidate, request)
  return renderValidated(request, candidate, source)
}

/** Validate not just shape/IDs: every sentence must equal the deterministic rendering. */
export async function parseCompanionSuccess(raw: unknown, rawRequest: unknown): Promise<CompanionSuccess> {
  const request = await parseCompanionRequest(rawRequest)
  try {
    const response = successSchema(raw)
    const expected = renderValidated(request, createAdviceCandidate(request), response.source, response.fallbackReason)
    if (new TextEncoder().encode(JSON.stringify(response)).length > 12288
      || canonicalJson(expected) !== canonicalJson(response)) throw new CompanionContractError('INVALID_RESPONSE')
    return response
  } catch { throw new CompanionContractError('INVALID_RESPONSE') }
}
