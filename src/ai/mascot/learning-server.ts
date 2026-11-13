import type { IncomingMessage, ServerResponse } from 'node:http'
import { CompanionContractError } from '../companion/errors.ts'
import { readRequestBody } from '../companion/server/body.ts'
import { boundedInteger, createLocalLimiter } from '../companion/server/limits.ts'
import { createGeminiLearningProvider } from './learning-gemini.ts'
import type { LearningProvider } from './learning-gemini.ts'
import { isMascotSession, MASCOT_SESSION_HEADER } from './contracts.ts'
import { deduplicateLearningIds, foldLearning, learningCards, LEARNING_BODY_LIMIT, LEARNING_DEADLINE, offlineLearning, readLearningIds, readLearningRequest } from './learning.ts'
import type { LearningReply } from './learning.ts'

export { createGeminiLearningProvider } from './learning-gemini.ts'
export type { LearningProvider } from './learning-gemini.ts'

export const mockLearningProvider: LearningProvider = {
  source: 'mock',
  async select(question, cards) {
    const q = foldLearning(question)
    const recorded = cards.filter(item => item.id.startsWith('entry-'))
    const ids = /cuoi van|ket qua|muc tieu|tai san rong/u.test(q) ? ['result', 'goal-rule']
      : /mua vang|tien mat/u.test(q) ? ['gold-cash-zero', 'cash', 'liquidity']
        : /sua xe|sua tam|sua ngay/u.test(q) ? recorded.filter(item => /chiec xe can sua/u.test(foldLearning(item.text))).slice(0, 2).map(item => item.id)
          : /su kien|quyet dinh|giao dich|dien bien/u.test(q) ? recorded.slice(0, 2).map(item => item.id) : []
    return { ids: ids.filter(id => cards.some(item => item.id === id)) }
  },
}

export function createHostedLearningHandler(env: NodeJS.ProcessEnv, transport: typeof fetch = globalThis.fetch) {
  if (env.MASCOT_LEARNING_ENABLED !== '1') return createLearningHandler()

  const origin = env.MASCOT_LEARNING_ORIGIN
  try {
    const url = new URL(origin ?? '')
    if (url.protocol !== 'https:' || url.origin !== origin) return createLearningHandler()
  } catch {
    return createLearningHandler()
  }
  const provider = createGeminiLearningProvider({
    credential: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, transport,
  })
  return provider ? createLearningHandler({ origin, provider }) : createLearningHandler()
}

export function createLearningHandler({ origin, provider, deadlineMs = LEARNING_DEADLINE }: {
  origin?: string; provider?: LearningProvider; deadlineMs?: number
} = {}) {
  const deadline = boundedInteger(deadlineMs, 1, 20_000)
  const byIp = createLocalLimiter(24, 60_000, 128)
  const bySession = createLocalLimiter(6, 60_000, 128)
  const active = new Set<string>()
  let remaining = 32
  return async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, body: LearningReply | { error: string }) => {
      if (res.destroyed || res.writableEnded) return
      if (!req.complete) { res.shouldKeepAlive = false; res.setHeader('Connection', 'close') }
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
      res.end(JSON.stringify(body))
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(405, { error: 'METHOD_NOT_ALLOWED' }) }
    if (!origin) return send(503, { error: 'UNAVAILABLE' })
    if (req.headers.origin !== origin || req.headers['x-mascot-learning'] !== '1') return send(403, { error: 'INVALID_ORIGIN' })
    const session = req.headers[MASCOT_SESSION_HEADER]
    if (!isMascotSession(session)) return send(400, { error: 'INVALID_REQUEST' })
    if (active.has(session) || active.size >= 2 || byIp(req.socket.remoteAddress ?? 'local') || bySession(session)) {
      return send(429, { error: 'RATE_LIMITED' })
    }
    const disconnect = new AbortController()
    const onClose = () => { if (!res.writableEnded) disconnect.abort() }
    res.once('close', onClose)
    const timeout = AbortSignal.timeout(deadline)
    const signal = AbortSignal.any([disconnect.signal, timeout])
    active.add(session)
    try {
      let parsed
      try {
        const body = await readRequestBody(req, signal, LEARNING_BODY_LIMIT)
        parsed = readLearningRequest(JSON.parse(body))
      } catch (error) {
        if (error instanceof CompanionContractError && error.code === 'PAYLOAD_TOO_LARGE') {
          return send(413, { error: 'REQUEST_TOO_LARGE' })
        }
        return send(timeout.aborted ? 504 : 400, { error: timeout.aborted ? 'TIMEOUT' : 'INVALID_REQUEST' })
      }
      if (!parsed) return send(400, { error: 'INVALID_REQUEST' })
      const cards = learningCards(parsed.context)
      const offline = offlineLearning(parsed.question, cards)
      if (offline) {
        const ids = offline.filter(item => cards.some(card => card.id === item.id)).map(item => item.id)
        return send(200, { source: ids.length ? 'offline' : 'fallback', ids })
      }
      if (!provider) return send(503, { error: 'UNAVAILABLE' })
      if (remaining <= 0) return send(429, { error: 'RATE_LIMITED' })
      remaining--
      signal.throwIfAborted()
      const cancelled = new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
      const ids = readLearningIds(await Promise.race([cancelled, provider.select(parsed.question, cards, signal)]), cards)
      signal.throwIfAborted()
      if (!ids) return send(503, { error: 'OUTPUT_REJECTED' })
      return send(200, ids.length ? { source: provider.source, ids: deduplicateLearningIds(ids, parsed.context) } : { source: 'fallback', ids: [] })
    } catch {
      return send(timeout.aborted ? 504 : 503, { error: timeout.aborted ? 'TIMEOUT' : 'UNAVAILABLE' })
    } finally {
      active.delete(session)
      res.off('close', onClose)
      disconnect.abort()
    }
  }
}
