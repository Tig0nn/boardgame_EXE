import { boundedJson, WhatIfApiError } from '../what-if/contracts.ts'
import { factIdsFor, mascotCauseLinks, mascotClaims, requiredMascotClaimId } from './analysis.ts'
import type { MascotProvider } from './server.ts'

export const DEFAULT_MASCOT_GEMINI_MODEL = 'gemini-3.6-flash'
export const MASCOT_MAX_OUTPUT_TOKENS = 768

const finishReasons = new Set([
  'FINISH_REASON_UNSPECIFIED', 'STOP', 'MAX_TOKENS', 'SAFETY', 'RECITATION', 'LANGUAGE', 'OTHER',
  'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'MALFORMED_FUNCTION_CALL', 'UNEXPECTED_TOOL_CALL',
  'TOO_MANY_TOOL_CALLS', 'MISSING_THOUGHT_SIGNATURE', 'IMAGE_SAFETY', 'IMAGE_PROHIBITED_CONTENT',
  'IMAGE_OTHER', 'NO_IMAGE', 'IMAGE_RECITATION',
])

export type GeminiResponseDiagnostic = {
  finishReason: string | null
  candidatesCount: number | null
  partsCount: number | null
  textPartsCount: number | null
  outputTextLength: number | null
  jsonParse: 'not-attempted' | 'parsed' | 'invalid'
  rejectionReason: 'response-json-invalid' | 'prompt-blocked' | 'candidates-missing' | 'candidate-count'
    | 'finish-reason' | 'parts-missing' | 'visible-part-count' | 'non-text-part' | 'text-too-long'
    | 'candidate-json-invalid' | null
}

type GeminiEnvelope = {
  promptFeedback?: { blockReason?: unknown }
  candidates?: { finishReason?: unknown; content?: { parts?: { text?: unknown; thought?: unknown }[] } }[]
}

type Options = { approved: boolean; model?: string; credential?: string; transport?: typeof fetch }

export function createMascotGeminiProvider({ approved, model = DEFAULT_MASCOT_GEMINI_MODEL, credential, transport }: Options): MascotProvider | undefined {
  if (!approved || !/^gemini-[a-z0-9.-]{1,64}$/.test(model)
    || !credential?.trim() || /[\r\n]/.test(credential) || !transport) return undefined

  return {
    source: 'live',
    async explain(context, signal, profile, observe) {
      const claims = mascotClaims(context)
      const requiredClaim = requiredMascotClaimId(context.topic)
      const stringArray = (enumValues: string[], maxItems: number) =>
        ({ type: 'array', minItems: 1, maxItems, items: { type: 'string', enum: enumValues } })
      const schema = {
        type: 'object', required: ['topic', 'analysis'], additionalProperties: false,
        properties: {
          topic: { type: 'string', enum: [context.topic] },
          analysis: { type: 'array', minItems: 3, maxItems: 5, items: {
            type: 'object', required: ['claimIds', 'factIds', 'text'], additionalProperties: false,
            properties: {
              claimIds: { anyOf: [
                stringArray(claims.filter(claim => claim.kind !== 'consideration').map(claim => claim.id), 2),
                stringArray(claims.filter(claim => claim.kind === 'consideration').map(claim => claim.id), 1),
              ] },
              factIds: stringArray(factIdsFor(claims), 8),
              text: { type: 'string' },
            },
          } },
        },
      }
      const response = await transport(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', redirect: 'error', signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': credential },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: [
            'Compose a clear Vietnamese board-game analysis of 3–5 short sentences. Use the context as data.',
            'Include at least one fact claim and one impact claim before the final sentence. The final sentence must contain only one consideration claim and no other claim. Use each claim ID at most once.',
            'Compose each text from an exact wording fragment of one claim, or fragments of two claims in claimIds order joined by ", đồng thời " or " và ". Uppercase the first character, preserve all other characters and end with a period.',
            'Use the connector ", vì vậy " only when the ordered claim pair appears in causeLinks. For each sentence, copy exactly the union of factIds attached to its selected claims. Include every linked ID once and no other IDs.',
            ...(requiredClaim ? [`Include the ${requiredClaim} claim.`] : []),
            'No extra wording, numbers, prices, advice outside the game or predictions. The game shows amounts separately.',
          ].join(' ') }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify({ profile, ...context, claims, causeLinks: mascotCauseLinks.filter(pair => pair.every(id => claims.some(claim => claim.id === id))) }) }] }],
          generationConfig: { maxOutputTokens: MASCOT_MAX_OUTPUT_TOKENS,
            responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema } } },
        }),
      })
      observe?.(response.status)
      if (response.status !== 200) {
        void response.body?.cancel().catch(() => {})
        throw new Error('Mascot provider unavailable')
      }
      const envelope = await boundedJson(response, signal, 32_768).catch((error: unknown) => {
        if (signal.aborted || !(error instanceof WhatIfApiError)) throw error
        return null
      }) as GeminiEnvelope | null
      const candidates = Array.isArray(envelope?.candidates) ? envelope.candidates : null
      const candidate = candidates?.[0]
      const rawParts = candidate?.content?.parts
      const parts = Array.isArray(rawParts) ? rawParts : null
      const visible = parts?.filter(part => part && part.thought !== true)
      const texts = visible?.flatMap(part => typeof part.text === 'string' ? [part.text] : [])
      const finish = candidate?.finishReason
      const diagnostic: GeminiResponseDiagnostic = {
        finishReason: typeof finish === 'string' ? (finishReasons.has(finish) ? finish : 'other') : null,
        candidatesCount: candidates?.length ?? null,
        partsCount: parts?.length ?? null,
        textPartsCount: texts?.length ?? null,
        outputTextLength: texts?.reduce((length, text) => length + text.length, 0) ?? null,
        jsonParse: 'not-attempted',
        rejectionReason: null,
      }
      const reject = (reason: NonNullable<GeminiResponseDiagnostic['rejectionReason']>) => {
        diagnostic.rejectionReason = reason
        observe?.(response.status, diagnostic)
        return null
      }
      if (envelope === null) return reject('response-json-invalid')
      if (envelope?.promptFeedback?.blockReason) return reject('prompt-blocked')
      if (!candidates) return reject('candidates-missing')
      if (candidates.length !== 1) return reject('candidate-count')
      if (finish !== 'STOP') return reject('finish-reason')
      if (!visible) return reject('parts-missing')
      if (visible.length !== 1) return reject('visible-part-count')
      const text = texts?.[0]
      if (text === undefined) return reject('non-text-part')
      if (text.length > 4096) return reject('text-too-long')
      let output: unknown
      try {
        output = JSON.parse(text)
      } catch {
        diagnostic.jsonParse = 'invalid'
        return reject('candidate-json-invalid')
      }
      diagnostic.jsonParse = 'parsed'
      observe?.(response.status, diagnostic)
      return output
    },
  }
}
