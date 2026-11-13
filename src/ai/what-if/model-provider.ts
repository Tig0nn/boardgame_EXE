import type { WhatIfProvider } from './orchestrator.ts'
import { explanationReply, intentReply, proposalReply, validateProviderRequest, WhatIfApiError } from './contracts.ts'
import type { ProviderRequest } from './contracts.ts'

type Complete = (input: ProviderRequest, signal: AbortSignal) => Promise<string>
type IntentRejectStep = 'size' | 'json' | 'schema' | 'contract' | 'financial'

/** Server adapter. The caller supplies the transport and returns only the model's JSON text. */
export function createModelWhatIfProvider(complete: Complete, onIntentReject?: (step: IntentRejectStep) => void): Required<WhatIfProvider> {
  async function request(input: ProviderRequest, signal: AbortSignal): Promise<unknown> {
    validateProviderRequest(input)
    signal.throwIfAborted()
    let text: string
    try {
      text = await complete(structuredClone(input), signal)
    } catch (error) {
      signal.throwIfAborted()
      if (error instanceof WhatIfApiError) throw error
      throw new WhatIfApiError('PROVIDER_UNAVAILABLE')
    }
    signal.throwIfAborted()
    const diagnostic = input.operation === 'interpret' ? onIntentReject : undefined
    if (typeof text !== 'string' || text.length > 4096 || new TextEncoder().encode(text).length > 4096) {
      diagnostic?.('size')
      throw new WhatIfApiError('OUTPUT_REJECTED')
    }
    let value: unknown
    try {
      value = JSON.parse(text) as unknown
    } catch {
      diagnostic?.('json')
      throw new WhatIfApiError('OUTPUT_REJECTED')
    }
    if (diagnostic && (!value || typeof value !== 'object' || Array.isArray(value))) {
      diagnostic('schema')
      throw new WhatIfApiError('OUTPUT_REJECTED')
    }
    return value
  }
  return {
    async interpret({ question }, signal) {
      return intentReply(await request({ operation: 'interpret', question }, signal), question, onIntentReject)
    },
    async propose({ question, catalog }, signal) {
      const snapshot = structuredClone(catalog)
      const reply = proposalReply(await request({ operation: 'propose', question, catalog: snapshot }, signal), snapshot)
      return reply.status === 'proposal' ? { decisionId: reply.decisionId, alternativeId: reply.alternativeId } : reply
    },
    async explain(facts, signal) {
      const snapshot = structuredClone(facts)
      return explanationReply(await request({ operation: 'explain', facts: snapshot }, signal), snapshot)
    },
  }
}
