import { boundedInteger, createLocalLimiter } from '../../../../src/ai/companion/server/limits.ts'
import { createWhatIfGeminiProvider, hasWhatIfGeminiConfig } from '../../../../src/ai/what-if/gemini.ts'
import { explanationReply, intentReply, proposalReply, validateProviderRequest, WhatIfApiError } from '../../../../src/ai/what-if/contracts.ts'
import type { ProviderRequest, ProposalReply } from '../../../../src/ai/what-if/contracts.ts'
import type { IntentReply } from '../../../../src/ai/what-if/natural-language.ts'

type Replies = { interpret: IntentReply; propose: ProposalReply; explain: { claimId: string } }
type Operation = ProviderRequest['operation']
export type AssistantFailure = 'disabled' | 'unavailable' | 'timeout' | 'rate-limited' | 'output-rejected'
type CallResult<T> = { status: 'used'; value: T } | { status: AssistantFailure }
export type WhatIfAssistant = <K extends Operation>(
  userId: string, input: ProviderRequest & { operation: K }, disconnect?: AbortSignal,
) => Promise<CallResult<Replies[K]>>

export function createWhatIfAssistant(env: NodeJS.ProcessEnv, transport: typeof fetch = globalThis.fetch, deadlineMs = 2500): WhatIfAssistant | undefined {
  const config = {
    accessApproved: env.EXE_WHATIF_GEMINI_ENABLED === '1',
    allowLiveTraffic: env.EXE_WHATIF_GEMINI_ALLOW_LIVE_TRAFFIC === '1',
    model: env.EXE_WHATIF_GEMINI_MODEL, apiKey: env.EXE_WHATIF_GEMINI_API_KEY, fetch: transport,
  }
  if (!hasWhatIfGeminiConfig(config)) return undefined
  const provider = createWhatIfGeminiProvider(config)
  const deadline = boundedInteger(deadlineMs, 1, 5000)
  const byUser = createLocalLimiter(6, 60_000)
  const byInstance = createLocalLimiter(24, 60_000)
  const daily = createLocalLimiter(100, 86_400_000)
  let active = 0

  const call = async (userId: string, input: ProviderRequest, disconnect?: AbortSignal): Promise<CallResult<Replies[Operation]>> => {
    if (disconnect?.aborted) return { status: 'unavailable' }
    if (active >= 2 || byUser(userId) || byInstance('what-if') || daily('what-if')) return { status: 'rate-limited' }

    const timeout = AbortSignal.timeout(deadline)
    const signal = disconnect ? AbortSignal.any([timeout, disconnect]) : timeout
    active++
    let cancel = () => {}
    try {
      validateProviderRequest(input)
      signal.throwIfAborted()
      const cancelled = new Promise<never>((_, reject) => {
        cancel = () => reject(signal.reason)
        signal.addEventListener('abort', cancel, { once: true })
      })
      const request = async () => {
        if (input.operation === 'interpret') return intentReply(await provider.interpret({ question: input.question }, signal), input.question)
        if (input.operation === 'propose') return proposalReply(await provider.propose({ question: input.question, catalog: input.catalog }, signal), input.catalog)
        return explanationReply(await provider.explain(input.facts, signal), input.facts)
      }
      const value = await Promise.race([cancelled, request()])
      signal.throwIfAborted()
      return { status: 'used', value }
    } catch (error) {
      if (timeout.aborted) return { status: 'timeout' }
      if (error instanceof WhatIfApiError) {
        if (error.code === 'RATE_LIMITED') return { status: 'rate-limited' }
        if (error.code === 'OUTPUT_REJECTED') return { status: 'output-rejected' }
      }
      return { status: 'unavailable' }
    } finally {
      signal.removeEventListener('abort', cancel)
      active--
    }
  }
  // Each branch validates the reply for the matching request operation.
  return call as WhatIfAssistant
}
