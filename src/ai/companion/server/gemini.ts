import { ProviderFailure } from './provider.ts'
import type { CompanionProvider, ProviderInput } from './provider.ts'

export const MAX_PROVIDER_BYTES = 32768
export const MAX_CANDIDATE_BYTES = 8192

export interface GeminiOptions {
  enabled?: boolean
  provenance: 'mock' | 'live'
  allowLiveTraffic?: boolean
  model?: string
  apiKey?: string
  fetch?: typeof fetch
}

// Schema is derived from the canonical plan, not a second financial rules implementation.
function planSchema(value: unknown): object {
  if (typeof value === 'string') return { type: 'string', enum: [value] }
  if (Array.isArray(value)) return { type: 'array', prefixItems: value.map(planSchema), minItems: value.length, maxItems: value.length }
  if (value && typeof value === 'object') {
    return { type: 'object', properties: Object.fromEntries(Object.entries(value).map(([key, child]) => [key, planSchema(child)])),
      required: Object.keys(value), additionalProperties: false }
  }
  throw new ProviderFailure('output-rejected')
}

function discard(response: Response) { void response.body?.cancel().catch(() => {}) }

async function boundedResponse(response: Response, signal: AbortSignal): Promise<string> {
  const length = response.headers.get('content-length')
  if (length !== null && (!/^\d{1,10}$/.test(length) || Number(length) > MAX_PROVIDER_BYTES)) {
    discard(response)
    throw new ProviderFailure('output-rejected')
  }
  if (!response.body) throw new ProviderFailure('output-rejected')
  const reader = response.body.getReader()
  const cancel = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', cancel, { once: true })
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_PROVIDER_BYTES) throw new ProviderFailure('output-rejected')
      chunks.push(value)
    }
    signal.throwIfAborted()
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
    catch { throw new ProviderFailure('output-rejected') }
  } finally {
    signal.removeEventListener('abort', cancel)
    cancel()
    reader.releaseLock()
  }
}

function candidateFromEnvelope(text: string): unknown {
  try {
    const raw = JSON.parse(text)
    if (!Array.isArray(raw?.candidates) || raw.candidates.length !== 1) throw new Error()
    const candidate = raw.candidates[0]
    const parts = candidate?.content?.parts
    if (candidate?.finishReason !== 'STOP' || !Array.isArray(parts) || parts.length !== 1
      || Object.keys(parts[0]).length !== 1 || typeof parts[0]?.text !== 'string'
      || new TextEncoder().encode(parts[0].text).byteLength > MAX_CANDIDATE_BYTES) throw new Error()
    return JSON.parse(parts[0].text)
  } catch { throw new ProviderFailure('output-rejected') }
}

/** No SDK/env/global fetch. A future approved live smoke must inject every required setting. */
export function createGeminiProvider(options: GeminiOptions): CompanionProvider {
  const { model, apiKey, fetch: transport, provenance } = options
  const enabled = options.enabled === true
  const allowLive = options.allowLiveTraffic === true
  return {
    provenance,
    async generate(input: ProviderInput, signal: AbortSignal): Promise<unknown> {
      signal.throwIfAborted()
      if (!enabled || !model || !/^gemini-[a-z0-9.-]{1,64}$/.test(model) || !apiKey || !transport
        || provenance !== 'mock' && (provenance !== 'live' || !allowLive)) throw new ProviderFailure('provider-unavailable')
      try {
        const response = await transport(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', redirect: 'error', signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: JSON.stringify({
            task: 'Return exactly the supplied closed teaching plan. No prose, amounts, new facts or additional fields.',
            plan: input.plan, factIds: input.factIds,
          }) }] }], generationConfig: { candidateCount: 1, maxOutputTokens: 2048, temperature: 0,
            responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: planSchema(input.plan) } } } }),
        })
        if (!response.ok) { discard(response); throw new ProviderFailure('provider-unavailable') }
        if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
          discard(response); throw new ProviderFailure('output-rejected')
        }
        return candidateFromEnvelope(await boundedResponse(response, signal))
      } catch (cause) {
        signal.throwIfAborted()
        throw cause instanceof ProviderFailure ? cause : new ProviderFailure('provider-unavailable')
      }
    },
  }
}
