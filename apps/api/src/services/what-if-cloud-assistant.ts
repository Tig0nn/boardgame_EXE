import { extractTrustedIntentFacts, interpretDeterministically } from '../../../../src/ai/what-if/natural-language.ts'
import type { IntentReply } from '../../../../src/ai/what-if/natural-language.ts'
import { explanationClaim } from '../../../../src/ai/what-if/orchestrator.ts'
import type { ExplanationFacts } from '../../../../src/ai/what-if/orchestrator.ts'
import { validateProviderRequest } from '../../../../src/ai/what-if/contracts.ts'
import type { Database } from '../db/client.ts'
import { ApiError, notFound } from '../errors.ts'
import type { WhatIfAssistantRequest } from '../validation.ts'
import type { AssistantFailure, WhatIfAssistant } from './what-if-assistance.ts'
import { sessionRepository } from '../repositories/game-sessions.ts'
import { assertSupportedB18 } from './game-state.ts'
import { evaluateVerifiedWhatIf, loadVerifiedWhatIf } from './what-if.ts'
import { WhatIfBudget } from './what-if-replay.ts'
import { buildProposalCandidates, recordedKind } from './what-if-proposals.ts'

type Assistance = AssistantFailure | 'not-requested' | 'used' | 'not-applicable'

function checkedQuestion(question: string) {
  if (/\S+@\S+|https?:\/\/|AIza[\w-]+|\bBearer\s+[\w.-]{12,}|\beyJ[\w-]+\.[\w-]+\.[\w-]+|[\p{Cf}\p{Cc}]/iu.test(question)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'Remove links and personal or credential information from the question')
  }
  const trusted = extractTrustedIntentFacts(question)
  if (trusted.status === 'ambiguous') return { status: 'ambiguous' as const }
  // Reuse the provider input boundary even if the language provider is off.
  try { validateProviderRequest({ operation: 'interpret', question }) }
  catch { throw new ApiError(400, 'INVALID_REQUEST', 'Use a What-if question without contact details or unformatted long numbers') }
  return trusted
}

function localClaim(facts: ExplanationFacts) {
  const effect = { up: 'cao hơn', down: 'thấp hơn', unchanged: 'bằng' }[facts.direction]
  return 'Tiền mặt cuối vòng 4 của nhánh giả lập ' + effect + ' ván thật theo replay đã xác minh.'
}

export async function assistSavedWhatIf(db: Database, userId: string, id: string,
  input: WhatIfAssistantRequest, assistant?: WhatIfAssistant, signal?: AbortSignal) {
  let assistance: Assistance = input.allowGemini ? 'disabled' : 'not-requested'
  const provider = input.allowGemini ? assistant : undefined
  const base = { version: 1 as const, stateVersion: input.stateVersion }

  if (input.operation === 'explain') {
    const { operation, stateVersion, sequence, alternative } = input
    const request = { stateVersion, sequence, alternative }
    const budget = new WhatIfBudget(signal)
    const source = await loadVerifiedWhatIf(db, userId, id, budget, stateVersion, sequence)
    const evaluation = await evaluateVerifiedWhatIf(source, request, budget)
    if (evaluation.status === 'limited') return {
      ...base, operation, status: 'limited' as const, assistance: 'not-applicable' as const, evaluation, claim: null,
    }

    // Only a category and the direction of the verified cash delta leave the API.
    const kind = recordedKind(source.steps[sequence - 1])
    if (!kind) return { ...base, operation, status: 'completed' as const, assistance: 'not-applicable' as const, evaluation, claim: null }
    const facts: ExplanationFacts = { kind,
      direction: evaluation.delta.cash > 0 ? 'up' : evaluation.delta.cash < 0 ? 'down' : 'unchanged',
      confirmedFollowUp: false,
    }
    if (provider) {
      const response = await provider(userId, { operation, facts }, signal)
      assistance = response.status
    }
    return { ...base, operation, status: 'completed' as const, assistance, evaluation,
      claim: { id: explanationClaim(facts), text: localClaim(facts), basis: 'verified-final-cash' as const },
    }
  }

  const source = input.operation === 'propose'
    ? await loadVerifiedWhatIf(db, userId, id, new WhatIfBudget(signal), input.stateVersion) : undefined
  if (!source) {
    // Parsing language needs only version, eligibility and ownership.
    const header = await sessionRepository(db).findOwnedHeader(userId, id)
    if (!header) throw notFound()
    assertSupportedB18(header)
    if (header.status !== 'completed' || !header.outcome || header.outcome === 'insolvent') {
      throw new ApiError(409, 'WHAT_IF_REQUIRES_FOUR_LAPS', 'What-if requires an original game completed through lap four')
    }
    if (header.stateVersion !== input.stateVersion) {
      throw new ApiError(409, 'STATE_VERSION_CONFLICT', 'Reload the decision list for this game')
    }
  }
  const question = checkedQuestion(input.question)
  let interpretation: IntentReply = question.status === 'ambiguous' ? { status: 'ambiguous' } : interpretDeterministically(input.question)
  if (provider && question.status !== 'ambiguous') {
    const response = await provider(userId, { operation: 'interpret', question: input.question }, signal)
    assistance = response.status
    if (response.status === 'used') interpretation = response.value
  } else if (question.status === 'ambiguous') assistance = 'not-applicable'

  if (input.operation === 'interpret') return {
    ...base, operation: input.operation, status: interpretation.status, interpretation, assistance,
  }
  const reply = { ...base, operation: input.operation, interpretation }
  if (interpretation.status !== 'intent') return { ...reply, status: interpretation.status, assistance }
  if (!source) throw new Error('Expected verified proposal history')
  const candidate = buildProposalCandidates(source.steps, input.stateVersion, interpretation.intent)
  if (candidate.status !== 'ready') return { ...reply, ...candidate, assistance }

  if (provider && assistance === 'used') {
    const response = await provider(userId, { operation: 'propose', question: input.question, catalog: candidate.candidates.map(item => item.choice) }, signal)
    assistance = response.status
    if (response.status === 'used' && response.value.status !== 'proposal') {
      return { ...reply, status: response.value.status, assistance }
    }
  }
  const [selected] = candidate.candidates
  return { ...reply, status: 'proposal' as const, assistance,
    proposal: selected.request, preview: { original: selected.original, replacement: selected.replacement }, requiresConfirmation: true as const,
  }
}

export type WhatIfAssistantReply = Awaited<ReturnType<typeof assistSavedWhatIf>>
