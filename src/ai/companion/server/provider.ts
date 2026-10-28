import type { AdviceCandidate } from '../types.ts'

/** No raw request, monetary values, identity, question or game state crosses this boundary. */
export interface ProviderInput { plan: AdviceCandidate; factIds: string[] }
export interface CompanionProvider {
  readonly provenance: 'mock' | 'live'
  generate(input: ProviderInput, signal: AbortSignal): Promise<unknown>
}
export class ProviderFailure extends Error {
  readonly reason: 'provider-unavailable' | 'provider-timeout' | 'output-rejected'
  constructor(reason: ProviderFailure['reason']) { super(reason); this.reason = reason }
}

/** Deadline still settles when an injected provider ignores its AbortSignal. No retries. */
export async function callProvider(provider: CompanionProvider, input: ProviderInput, parent: AbortSignal, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController()
  const cancel = () => controller.abort(parent.reason)
  parent.addEventListener('abort', cancel, { once: true })
  if (parent.aborted) cancel()
  const timer = setTimeout(() => controller.abort(new ProviderFailure('provider-timeout')), timeoutMs)
  let onAbort: () => void = () => {}
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(controller.signal.reason)
    controller.signal.addEventListener('abort', onAbort, { once: true })
    if (controller.signal.aborted) onAbort()
  })
  try {
    return await Promise.race([aborted, Promise.resolve().then(() => {
      controller.signal.throwIfAborted()
      return provider.generate(input, controller.signal)
    })])
  } finally {
    clearTimeout(timer)
    parent.removeEventListener('abort', cancel)
    controller.signal.removeEventListener('abort', onAbort)
    controller.abort()
  }
}
