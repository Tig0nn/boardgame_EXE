import { parseQuestionRequest } from './question-contract.ts'
import { answerQuestion, parseQuestionResponse } from './question-response.ts'
import { QuestionApiError, QUESTION_ERROR_POLICY, parseQuestionError, questionErrorResponse } from './question-errors.ts'
import { runQuestionFeature } from './question-feature.ts'
import type { QuestionFeature } from './question-feature.ts'
import type { QuestionRequest, QuestionResponse, QuestionError } from './question-types.ts'
import { QUESTION_ENDPOINT, MAX_QUESTION_RESPONSE_BYTES } from './question-types.ts'

export type QuestionTransport = (request: QuestionRequest, signal: AbortSignal) => Promise<QuestionResponse>
export interface QuestionTransportOptions { feature?: QuestionFeature }
export class QuestionTransportError extends QuestionApiError {
  readonly response: QuestionError
  readonly status: number
  constructor(response: QuestionError) {
    super(response.error.code)
    this.name = 'QuestionTransportError'
    this.response = response
    this.status = QUESTION_ERROR_POLICY[response.error.code][0]
  }
}
export function createLocalQuestionTransport(options: QuestionTransportOptions = {}): QuestionTransport {
  const feature = options.feature
  return (request, signal) => answerQuestion(request, { feature, signal })
}
function bounded(value: number, max: number, min = 0) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new QuestionApiError('INVALID_REQUEST')
  return value
}
async function delay(ms: number, signal: AbortSignal) {
  signal.throwIfAborted()
  if (!ms) return
  await new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, ms)
    signal.addEventListener('abort', abort, { once: true })
  })
}
export function createMockQuestionTransport(options: QuestionTransportOptions & {
  delayMs?: number; scenario?: 'success' | 'unavailable' | 'rate-limited' | 'timeout'
} = {}): QuestionTransport {
  const ms = bounded(options.delayMs ?? 0, 30_000), feature = options.feature, scenario = options.scenario ?? 'success'
  if (!['success', 'unavailable', 'rate-limited', 'timeout'].includes(scenario)) throw new QuestionApiError('INVALID_REQUEST')
  return (raw, parent) => runQuestionFeature(feature, parent, async signal => {
    const request = await parseQuestionRequest(raw)
    await delay(ms, signal)
    signal.throwIfAborted()
    if (scenario !== 'success') throw new QuestionTransportError(questionErrorResponse(
      scenario === 'rate-limited' ? 'RATE_LIMITED' : 'SERVICE_UNAVAILABLE', request, scenario === 'rate-limited' ? 1000 : undefined))
    return answerQuestion(request, { feature, signal })
  })
}
function discard(response: Response) { void response.body?.cancel().catch(() => {}) }
async function boundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')
    || length !== null && (!/^\d{1,10}$/.test(length) || Number(length) > MAX_QUESTION_RESPONSE_BYTES) || !response.body) {
    discard(response); throw new QuestionApiError('INVALID_RESPONSE')
  }
  const reader = response.body.getReader(), chunks: Uint8Array[] = []
  const cancel = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', cancel, { once: true })
  let size = 0
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_QUESTION_RESPONSE_BYTES) throw new QuestionApiError('INVALID_RESPONSE')
      chunks.push(value)
    }
    signal.throwIfAborted()
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
    catch { throw new QuestionApiError('INVALID_RESPONSE') }
  } finally { signal.removeEventListener('abort', cancel); cancel(); reader.releaseLock() }
}
/** One fixed same-origin route. No retries, credentials, provider or automatic local failover. */
export function createRemoteQuestionTransport(options: QuestionTransportOptions & { fetch?: typeof fetch; timeoutMs?: number } = {}): QuestionTransport {
  const feature = options.feature, fetcher = options.fetch ?? globalThis.fetch
  const timeoutMs = bounded(options.timeoutMs ?? 8000, 8000, 10)
  return async (raw, parent) => {
    const deadline = new AbortController()
    const timer = setTimeout(() => deadline.abort(new QuestionApiError('SERVICE_UNAVAILABLE')), timeoutMs)
    const cancel = () => deadline.abort(parent.reason)
    parent.addEventListener('abort', cancel, { once: true })
    if (parent.aborted) cancel()
    try {
      return await runQuestionFeature(feature, deadline.signal, async signal => {
        const request = await parseQuestionRequest(raw)
        signal.throwIfAborted()
        if (typeof fetcher !== 'function') throw new QuestionApiError('SERVICE_UNAVAILABLE')
        let response: Response
        try { response = await fetcher(QUESTION_ENDPOINT, { method: 'POST', credentials: 'omit', redirect: 'error',
          cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal }) }
        catch (error) { signal.throwIfAborted(); throw error instanceof QuestionApiError ? error : new QuestionApiError('SERVICE_UNAVAILABLE') }
        if (signal.aborted) { discard(response); signal.throwIfAborted() }
        const body = await boundedJson(response, signal)
        signal.throwIfAborted()
        if (response.status !== 200) {
          const error = parseQuestionError(body, request, response.status)
          if (error.error.code === 'QUESTION_FEATURE_DISABLED') feature?.setEnabled(false)
          throw new QuestionTransportError(error)
        }
        return parseQuestionResponse(body, request, { feature, signal })
      })
    } finally { clearTimeout(timer); parent.removeEventListener('abort', cancel) }
  }
}
