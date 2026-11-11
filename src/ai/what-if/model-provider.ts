import type { WhatIfProvider } from '../../../mobile_app/src/game/what-if-ai/orchestrator.ts'
import { explanationReply, intentReply, proposalReply, validateProviderRequest, WhatIfApiError } from './contracts.ts'
import type { ProviderRequest } from './contracts.ts'

type Complete = (input: ProviderRequest, signal: AbortSignal) => Promise<string>

/** Server adapter. The caller supplies the transport and returns only the model's JSON text. */
export function createModelWhatIfProvider(complete: Complete): Required<WhatIfProvider> {
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
    if (typeof text !== 'string' || text.length > 4096 || new TextEncoder().encode(text).length > 4096) {
      throw new WhatIfApiError('OUTPUT_REJECTED')
    }
    try {
      return JSON.parse(text) as unknown
    } catch {
      throw new WhatIfApiError('OUTPUT_REJECTED')
    }
  }
  return {
    async interpret({ question }, signal) {
      return intentReply(await request({ operation: 'interpret', question }, signal), question)
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
