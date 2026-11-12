import type { IncomingMessage, ServerResponse } from 'node:http'
import { readRequestBody } from '../companion/server/body.ts'
import { boundedInteger, createLocalLimiter } from '../companion/server/limits.ts'
import { MASCOT_BODY_LIMIT, MASCOT_PROFILE_HEADER, MASCOT_RESPONSE_VERSION, MASCOT_SESSION_HEADER,
  isMascotProfile, isMascotSession, readExplanationContext } from './contracts.ts'
import { mockMascotAnalysis, readProviderAnalysis } from './analysis.ts'
import type { AnalysisDiagnostic } from './analysis.ts'
import type { ExplanationContext, ExplanationReply, MascotProfile } from './contracts.ts'
import type { GeminiResponseDiagnostic } from './gemini.ts'

export type MascotProvider = {
  source: ExplanationReply['source']
  explain(context: ExplanationContext, signal: AbortSignal, profile: MascotProfile,
    observe?: (status: number, diagnostic?: GeminiResponseDiagnostic) => void): unknown | Promise<unknown>
}

export const mockMascotProvider: MascotProvider = {
  source: 'mock',
  explain: context => ({ topic: context.topic, analysis: mockMascotAnalysis(context) }),
}

export const MASCOT_DEFAULT_DEADLINE_MS = 6500
export const MASCOT_MAX_DEADLINE_MS = 15000

type Diagnostic = {
  upstreamStatus: number | null
  elapsedMs: number
  adapter?: GeminiResponseDiagnostic
  validation?: AnalysisDiagnostic
  outcome: 'upstream-unavailable' | 'upstream-rate-limit' | 'upstream-http' | 'network'
    | 'timeout' | 'cancelled' | 'parse' | 'envelope' | 'schema' | 'claims' | 'validated'
}

type HandlerOptions = {
  provider?: MascotProvider; origin?: string; deadlineMs?: number; maxCalls?: number; maxSessionCalls?: number
  allowContext?: (context: ExplanationContext) => boolean
  onDiagnostic?: (event: Diagnostic) => void
}

export function createMascotExplanationHandler({ provider, origin, deadlineMs = MASCOT_DEFAULT_DEADLINE_MS, allowContext, onDiagnostic,
  maxCalls = provider?.source === 'live' ? 12 : 100, maxSessionCalls = 6 }: HandlerOptions = {}) {
  const deadline = boundedInteger(deadlineMs, 1, MASCOT_MAX_DEADLINE_MS)
  const limit = boundedInteger(maxCalls, 0, 1000)
  const sessionLimit = boundedInteger(maxSessionCalls, 1, 20)
  const admit = createLocalLimiter(24, 60_000, 128)
  const sessionCalls = new Map<string, number>()
  const activeSessions = new Set<string>()
  let active = 0
  let calls = 0

  return async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, value: object) => {
      if (res.destroyed || res.writableEnded) return
      if (!req.complete) { res.shouldKeepAlive = false; res.setHeader('Connection', 'close') }
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
      res.end(JSON.stringify(value))
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); send(405, { error: 'METHOD_NOT_ALLOWED' }); return }
    if (!provider || !origin) { send(503, { error: 'PROVIDER_UNAVAILABLE' }); return }
    if (req.headers.origin !== origin || req.headers['x-mascot-request'] !== '1') { send(403, { error: 'INVALID_ORIGIN' }); return }
    const session = req.headers[MASCOT_SESSION_HEADER], profile = req.headers[MASCOT_PROFILE_HEADER]
    if (!isMascotSession(session) || !isMascotProfile(profile)) { send(400, { error: 'INVALID_CONTEXT' }); return }
    if (active >= 2 || calls >= limit || activeSessions.has(session)
      || (sessionCalls.get(session) ?? 0) >= sessionLimit || admit(req.socket.remoteAddress ?? 'unknown')) {
      send(429, { error: 'RATE_LIMITED' })
      return
    }

    const abort = new AbortController()
    const disconnect = () => abort.abort()
    const close = () => { if (!res.writableEnded) disconnect() }
    req.once('aborted', disconnect)
    res.once('close', close)
    const timer = setTimeout(() => abort.abort('timeout'), deadline)
    let onAbort = () => {}
    let startedAt: number | undefined
    let upstreamStatus: number | null = null
    let adapter: GeminiResponseDiagnostic | undefined
    let validation: AnalysisDiagnostic | undefined
    let outcome: Diagnostic['outcome'] = 'network'
    active++
    activeSessions.add(session)
    try {
      const type = req.headers['content-type']
      const length = req.headers['content-length']
      if (typeof type !== 'string' || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(type)
        || (length !== undefined && (typeof length !== 'string' || !/^\d{1,10}$/.test(length) || Number(length) > MASCOT_BODY_LIMIT))
        || (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity')) {
        send(400, { error: 'INVALID_CONTEXT' }); return
      }
      // Hosted Node functions may already have parsed JSON. The same closed schema applies.
      const supplied = (req as IncomingMessage & { body?: unknown }).body
      let input = supplied
      if (!supplied || typeof supplied !== 'object' || Buffer.isBuffer(supplied)) {
        const text = await readRequestBody(req, abort.signal)
        if (Buffer.byteLength(text, 'utf8') > MASCOT_BODY_LIMIT) { send(400, { error: 'INVALID_CONTEXT' }); return }
        input = JSON.parse(text)
      }
      const context = readExplanationContext(input)
      if (!context || (allowContext && !allowContext(context))) { send(400, { error: 'INVALID_CONTEXT' }); return }
      if (calls >= limit) { send(429, { error: 'RATE_LIMITED' }); return }
      abort.signal.throwIfAborted()
      startedAt = performance.now()
      calls++
      sessionCalls.set(session, (sessionCalls.get(session) ?? 0) + 1)
      const cancelled = new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(abort.signal.reason)
        abort.signal.addEventListener('abort', onAbort, { once: true })
      })
      const output = await Promise.race([
        cancelled,
        Promise.resolve().then(() => provider.explain(structuredClone(context), abort.signal, profile, (status, diagnostic) => {
          upstreamStatus = status
          adapter = diagnostic
        })),
      ])
      abort.signal.throwIfAborted()
      const analysis = readProviderAnalysis(output, context, diagnostic => {
        if (!adapter?.rejectionReason) validation = diagnostic
        outcome = adapter?.rejectionReason
          ? (adapter.jsonParse === 'invalid' || adapter.rejectionReason === 'response-json-invalid' ? 'parse' : 'envelope')
          : diagnostic.stage
      })
      if (!analysis) { send(503, { error: 'OUTPUT_REJECTED' }); return }
      const reply: ExplanationReply = { version: MASCOT_RESPONSE_VERSION, topic: context.topic, source: provider.source, analysis }
      outcome = 'validated'
      send(200, reply)
    } catch {
      if (abort.signal.reason === 'timeout') {
        outcome = 'timeout'
        send(504, { error: 'PROVIDER_TIMEOUT' })
      } else if (abort.signal.aborted) outcome = 'cancelled'
      else {
        if (upstreamStatus === 503) outcome = 'upstream-unavailable'
        else if (upstreamStatus === 429) outcome = 'upstream-rate-limit'
        else if (upstreamStatus !== null && upstreamStatus !== 200) outcome = 'upstream-http'
        send(startedAt === undefined ? 400 : 503, { error: startedAt === undefined ? 'INVALID_CONTEXT' : 'PROVIDER_UNAVAILABLE' })
      }
    } finally {
      active--
      activeSessions.delete(session)
      clearTimeout(timer)
      req.off('aborted', disconnect)
      res.off('close', close)
      abort.signal.removeEventListener('abort', onAbort)
      abort.abort()
      if (startedAt !== undefined) onDiagnostic?.({ upstreamStatus, outcome, elapsedMs: Math.round(performance.now() - startedAt), ...(adapter ? { adapter } : {}), ...(validation ? { validation } : {}) })
    }
  }
}
