import { boundedJson, explanationReply, fields, intentReply, proposalReply, validateProviderRequest, WHAT_IF_ENDPOINT, WhatIfApiError } from '../../../../src/ai/what-if/contracts.ts'
import type { ProviderRequest } from '../../../../src/ai/what-if/contracts.ts'
import type { WhatIfProvider } from './orchestrator.ts'

export function createHttpWhatIfProvider(transport: typeof fetch = fetch): WhatIfProvider {
  let calls = 0
  async function request(input: ProviderRequest, signal: AbortSignal) {
    validateProviderRequest(input)
    signal.throwIfAborted()
    if (++calls > 8) throw new WhatIfApiError('RATE_LIMITED')
    const timeout = AbortSignal.timeout(7000)
    const bounded = AbortSignal.any([signal, timeout])
    try {
      const response = await transport(WHAT_IF_ENDPOINT, { method: 'POST', credentials: 'same-origin', redirect: 'error',
        headers: { 'Content-Type': 'application/json', 'X-What-If-Request': '1' }, body: JSON.stringify(input), signal: bounded })
      const value = await boundedJson(response, bounded)
      bounded.throwIfAborted()
      if (!response.ok) {
        fields(value, ['error'])
        if (response.status === 429 && value.error === 'RATE_LIMITED') throw new WhatIfApiError('RATE_LIMITED')
        if (response.status === 503 && value.error === 'OUTPUT_REJECTED') throw new WhatIfApiError('OUTPUT_REJECTED')
        throw new WhatIfApiError(value.error === 'PROVIDER_TIMEOUT' ? 'PROVIDER_TIMEOUT' : 'PROVIDER_UNAVAILABLE')
      }
      if (input.operation === 'explain') return explanationReply(value, input.facts)
      if (input.operation === 'interpret') return intentReply(value, input.question)
      if (value && typeof value === 'object' && Object.getOwnPropertyDescriptor(value, 'status')?.value === 'proposal') {
        fields(value, ['status', 'decisionId', 'alternativeId'], 'OUTPUT_REJECTED')
        proposalReply({ decisionId: value.decisionId, alternativeId: value.alternativeId }, input.catalog)
        return { decisionId: value.decisionId, alternativeId: value.alternativeId }
      }
      return proposalReply(value, input.catalog)
    } catch (error) {
      if (signal.aborted) signal.throwIfAborted()
      if (timeout.aborted) throw new WhatIfApiError('PROVIDER_TIMEOUT')
      if (error instanceof WhatIfApiError) throw error
      throw new WhatIfApiError('PROVIDER_UNAVAILABLE')
    }
  }
  return { interpret: (input, signal) => request({ operation: 'interpret', ...input }, signal),
    propose: (input, signal) => request({ operation: 'propose', ...input }, signal),
    explain: (facts, signal) => request({ operation: 'explain', facts }, signal) }
}
