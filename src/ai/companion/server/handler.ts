import type { IncomingMessage, ServerResponse } from 'node:http'
import { parseCompanionRequest } from '../contracts.ts'
import { deterministicAdvice, parseCompanionSuccess, renderProviderAdvice } from '../advice.ts'
import { CompanionContractError, ERROR_POLICY, errorResponse } from '../errors.ts'
import type { CompanionRequest } from '../types.ts'
import type { CompanionProvider } from './provider.ts'
import { readRequestBody } from './body.ts'
import { buildRepairFacts } from '../facts.ts'
import { createAdviceCandidate } from '../templates.ts'
import { callProvider, ProviderFailure } from './provider.ts'
import { boundedInteger, createLocalLimiter } from './limits.ts'

export interface CompanionServerOptions {
  provider?: CompanionProvider
  providerEnabled?: boolean
  allowLiveProvider?: boolean
  providerBudget?: { maxCalls: number; windowMs: number }
  rateLimit?: { maxRequests: number; windowMs: number; maxClients?: number }
  providerTimeoutMs?: number
  requestTimeoutMs?: number
  now?: () => number
}

export function createCompanionHandler(options: CompanionServerOptions = {}) {
  const rate = options.rateLimit ?? { maxRequests: 5, windowMs: 60_000 }
  const admit = createLocalLimiter(rate.maxRequests, rate.windowMs, rate.maxClients, options.now)
  const budget = options.providerBudget ?? { maxCalls: 0, windowMs: 60_000 }
  const reserve = createLocalLimiter(budget.maxCalls, budget.windowMs, 1, options.now)
  const requestTimeout = boundedInteger(options.requestTimeoutMs ?? 8000, 10, 8000)
  const providerTimeout = boundedInteger(options.providerTimeoutMs ?? 6500, 1, requestTimeout - 1)
  // Capture configuration once. Caller mutation cannot enable traffic later.
  const provider = options.provider
  const providerEnabled = options.providerEnabled === true
  const liveAllowed = options.allowLiveProvider === true
  const provenance = provider?.provenance
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const controller = new AbortController()
    let request: CompanionRequest | undefined
    const cancel = () => controller.abort(new CompanionContractError('SERVICE_UNAVAILABLE'))
    const closed = () => { if (!res.writableFinished) cancel() }
    req.once('aborted', cancel)
    res.once('close', closed)
    const deadline = setTimeout(cancel, requestTimeout)
    let retryAfterMs: number | undefined
    const send = (status: number, value: unknown) => {
      if (res.destroyed || res.writableEnded) return
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      if (!req.complete) { res.shouldKeepAlive = false; res.setHeader('Connection', 'close') }
      res.end(JSON.stringify(value))
    }
    try {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST')
        throw new CompanionContractError('METHOD_NOT_ALLOWED')
      }
      retryAfterMs = admit(req.socket.remoteAddress ?? 'unknown') || undefined
      if (retryAfterMs) {
        res.setHeader('Retry-After', Math.ceil(retryAfterMs / 1000))
        throw new CompanionContractError('RATE_LIMITED')
      }
      request = await parseCompanionRequest(await readRequestBody(req, controller.signal))
      controller.signal.throwIfAborted()
      const facts = buildRepairFacts(request.context)
      let advice = await deterministicAdvice(request)
      if (advice.fallbackReason === 'offline-prototype' && providerEnabled) {
        if (!provider || provenance !== 'mock' && (provenance !== 'live' || !liveAllowed)) {
          advice = await deterministicAdvice(request, 'provider-unavailable')
        } else if (reserve('provider')) {
          advice = await deterministicAdvice(request, 'budget-exhausted')
        } else {
          // Reserve synchronously before await; no refund after failure/cancellation.
          try {
            const candidate = await callProvider(provider, {
              plan: createAdviceCandidate(request), factIds: Object.keys(facts).sort(),
            }, controller.signal, providerTimeout)
            controller.signal.throwIfAborted()
            try { advice = await renderProviderAdvice(request, candidate, provenance === 'mock' ? 'mock' : 'model') }
            catch { throw new ProviderFailure('output-rejected') }
          } catch (cause) {
            controller.signal.throwIfAborted()
            advice = await deterministicAdvice(request, cause instanceof ProviderFailure ? cause.reason : 'provider-unavailable')
          }
        }
      }
      controller.signal.throwIfAborted()
      const validated = await parseCompanionSuccess(advice, request)
      controller.signal.throwIfAborted()
      send(200, validated)
    } catch (cause) {
      const code = cause instanceof CompanionContractError ? cause.code : 'SERVICE_UNAVAILABLE'
      send(ERROR_POLICY[code][0], errorResponse(code, request, code === 'RATE_LIMITED' ? retryAfterMs : undefined))
    } finally {
      clearTimeout(deadline)
      req.off('aborted', cancel)
      res.off('close', closed)
    }
  }
}
