import type { IncomingMessage, ServerResponse } from 'node:http'
import { readRequestBody } from '../companion/server/body.ts'
import { boundedInteger, createLocalLimiter } from '../companion/server/limits.ts'
import type { WhatIfProvider } from '../../../mobile_app/src/game/what-if-ai/orchestrator.ts'
import { explanationReply, intentReply, proposalReply, validateProviderRequest, validateWhatIfDevDeadlineMs,
  WHAT_IF_DEFAULT_SERVER_DEADLINE_MS, WhatIfApiError } from './contracts.ts'

type WhatIfHandlerOptions = { deadlineMs?: number; devDiagnosticDeadlineMs?: number; maxRequests?: number; maxCalls?: number }

export function resolveWhatIfServerDeadlineMs(options: WhatIfHandlerOptions = {}) {
  if (options.devDiagnosticDeadlineMs === undefined) return boundedInteger(options.deadlineMs ?? WHAT_IF_DEFAULT_SERVER_DEADLINE_MS, 1, 7000)
  if (options.deadlineMs !== undefined) throw new Error('Choose one What-if deadline')
  return validateWhatIfDevDeadlineMs(options.devDiagnosticDeadlineMs)
}

/** Dedicated bounded endpoint. Callers mount it under WHAT_IF_ENDPOINT in an authorized server. */
export function createWhatIfHandler(provider: WhatIfProvider, options: WhatIfHandlerOptions = {}) {
  const admit = createLocalLimiter(options.maxRequests ?? 12, 600_000, 64)
  const deadlineMs = resolveWhatIfServerDeadlineMs(options)
  const maxCalls = boundedInteger(options.maxCalls ?? 100, 0, 1000)
  let running = 0, calls = 0
  return async (req: IncomingMessage, res: ServerResponse) => {
    const abort = new AbortController()
    let admitted = false
    const timer = setTimeout(() => abort.abort(new WhatIfApiError('PROVIDER_TIMEOUT')), deadlineMs)
    const cancel = () => abort.abort()
    const close = () => { if (!res.writableEnded) cancel() }
    req.once('aborted', cancel)
    res.once('close', close)
    const send = (status: number, value: unknown) => {
      if (res.destroyed || res.writableEnded) return
      if (!req.complete) { res.shouldKeepAlive = false; res.setHeader('Connection', 'close') }
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
      res.end(JSON.stringify(value))
    }
    try {
      if (req.method !== 'POST') { send(405, { error: 'INVALID_REQUEST' }); return }
      const origin = req.headers.origin
      if (!/^(?:127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(req.headers.host ?? '')
        || typeof origin !== 'string' || origin !== `http://${req.headers.host}` || req.headers['x-what-if-request'] !== '1') {
        send(403, { error: 'INVALID_REQUEST' }); return
      }
      if (admit(req.socket.remoteAddress ?? 'unknown') || calls >= maxCalls || running >= 2) {
        send(429, { error: 'RATE_LIMITED' }); return
      }
      running++
      admitted = true
      const input: unknown = JSON.parse(await readRequestBody(req, abort.signal))
      validateProviderRequest(input)
      if (calls >= maxCalls) { send(429, { error: 'RATE_LIMITED' }); return }
      calls++
      let onAbort = () => {}
      const cancelled = new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(abort.signal.reason)
        abort.signal.addEventListener('abort', onAbort, { once: true })
        if (abort.signal.aborted) onAbort()
      })
      try {
        // Structured input is copied, so an injected provider cannot replace the validation catalog or facts.
        const value = await Promise.race([cancelled, Promise.resolve().then(() => {
          if (input.operation === 'interpret') {
            if (!provider.interpret) throw new WhatIfApiError('PROVIDER_UNAVAILABLE')
            return provider.interpret({ question: input.question }, abort.signal)
          }
          return input.operation === 'propose' ? provider.propose(structuredClone({ question: input.question, catalog: input.catalog }), abort.signal)
            : provider.explain(structuredClone(input.facts), abort.signal)
        })])
        abort.signal.throwIfAborted()
        if (input.operation === 'interpret') send(200, intentReply(value, input.question))
        else if (input.operation === 'propose') send(200, proposalReply(value, input.catalog))
        else send(200, explanationReply(value, input.facts))
      } finally { abort.signal.removeEventListener('abort', onAbort) }
    } catch (error) {
      const code = error instanceof WhatIfApiError ? error.code : 'INVALID_REQUEST'
      const status = code === 'RATE_LIMITED' ? 429 : code === 'PROVIDER_TIMEOUT' ? 504
        : code === 'PROVIDER_UNAVAILABLE' || code === 'OUTPUT_REJECTED' ? 503 : 400
      send(status, { error: code })
    } finally {
      if (admitted) running--
      clearTimeout(timer)
      req.off('aborted', cancel)
      res.off('close', close)
      abort.abort()
    }
  }
}
