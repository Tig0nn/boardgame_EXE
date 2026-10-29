import type { IncomingMessage, ServerResponse } from 'node:http'
import { parseQuestionRequest } from '../question-contract.ts'
import { answerQuestion } from '../question-response.ts'
import { createQuestionFeature, runQuestionFeature } from '../question-feature.ts'
import type { QuestionFeature } from '../question-feature.ts'
import { QuestionApiError, QUESTION_ERROR_POLICY, questionFailure, questionErrorResponse } from '../question-errors.ts'
import type { QuestionRequest } from '../question-types.ts'
import { MAX_QUESTION_RESPONSE_BYTES } from '../question-types.ts'
import { readRequestBody } from './body.ts'
import { boundedInteger, createLocalLimiter } from './limits.ts'

export interface QuestionServerOptions {
  feature?: QuestionFeature
  rateLimit?: { maxRequests: number; windowMs: number; maxClients?: number }
  requestTimeoutMs?: number
  now?: () => number
}
/** Node/raw-JSON ingress only. Default OFF, process-local limits, no provider or environment access. */
export function createQuestionHandler(options: QuestionServerOptions = {}) {
  const feature = options.feature ?? createQuestionFeature()
  const rate = options.rateLimit ?? { maxRequests: 5, windowMs: 60_000 }
  const admit = createLocalLimiter(rate.maxRequests, rate.windowMs, rate.maxClients, options.now)
  const timeoutMs = boundedInteger(options.requestTimeoutMs ?? 8000, 10, 8000)
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const controller = new AbortController()
    let request: QuestionRequest | undefined
    const cancel = () => controller.abort(new QuestionApiError('SERVICE_UNAVAILABLE'))
    const closed = () => { if (!res.writableFinished) cancel() }
    const deadline = setTimeout(cancel, timeoutMs)
    req.once('aborted', cancel); res.once('close', closed)
    const send = (status: number, value: unknown) => {
      if (res.destroyed || res.writableEnded) return
      const json = JSON.stringify(value)
      if (new TextEncoder().encode(json).byteLength > MAX_QUESTION_RESPONSE_BYTES) throw new QuestionApiError('INVALID_RESPONSE')
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      if (!req.complete) { res.shouldKeepAlive = false; res.setHeader('Connection', 'close') }
      res.end(json)
    }
    try {
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new QuestionApiError('METHOD_NOT_ALLOWED') }
      if (!feature.isEnabled()) throw new QuestionApiError('QUESTION_FEATURE_DISABLED')
      const retryAfterMs = admit(req.socket.remoteAddress ?? 'unknown')
      if (retryAfterMs) {
        res.setHeader('Retry-After', Math.ceil(retryAfterMs / 1000))
        send(429, questionErrorResponse('RATE_LIMITED', undefined, retryAfterMs))
        return
      }
      const answer = await runQuestionFeature(feature, controller.signal, async signal => {
        request = await parseQuestionRequest(await readRequestBody(req, signal))
        signal.throwIfAborted()
        return answerQuestion(request, { feature, signal })
      })
      controller.signal.throwIfAborted()
      if (!feature.isEnabled()) throw new QuestionApiError('QUESTION_FEATURE_DISABLED')
      send(200, answer)
    } catch (cause) {
      const error = questionFailure(cause)
      send(QUESTION_ERROR_POLICY[error.code][0], questionErrorResponse(error.code, request))
    } finally {
      clearTimeout(deadline)
      req.off('aborted', cancel); res.off('close', closed)
    }
  }
}
