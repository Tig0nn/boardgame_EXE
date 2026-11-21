import { performance } from 'node:perf_hooks'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { createAuthenticator } from '../auth.ts'
import type { JwtAuthConfig } from '../auth.ts'
import type { Database } from '../db/client.ts'
import { elapsedMs } from '../observability.ts'
import type { SnapshotObserver } from '../observability.ts'
import { getOrCreateProfile } from '../repositories/profiles.ts'
import { sessionRepository } from '../repositories/game-sessions.ts'
import { executeGameAction } from '../services/game-actions.ts'
import { createGameSession } from '../services/game-sessions.ts'
import { quoteGameBusiness } from '../services/business-quotes.ts'
import { quoteGameBank } from '../services/bank-quotes.ts'
import { quoteGameTrade } from '../services/trading-quotes.ts'
import type { WhatIfAssistant } from '../services/what-if-assistance.ts'
import { assistSavedWhatIf } from '../services/what-if-cloud-assistant.ts'
import { analyzeSavedGame } from '../services/what-if.ts'
import { WhatIfTrace } from '../services/what-if-timing.ts'
import type { FoxAssist } from '../services/fox-assistance.ts'
import { readFoxCoach, learnWithFox } from '../services/fox-coach.ts'
import { readGameState } from '../services/game-state.ts'
import { bankQuoteBody, businessQuoteBody, createSessionBody, foxCoachQuery, foxLearningBody, gameActionBody, idempotencyKey, listSessionsQuery, sessionParams, tradeQuoteBody, whatIfAssistantBody, whatIfBody } from '../validation.ts'

declare module 'fastify' {
  interface FastifyRequest {
    playerId: string | null
  }
}

function playerId(request: FastifyRequest) {
  if (request.playerId === null) throw new Error('V1 authentication hook did not set the player')
  return request.playerId
}

function snapshotObserver(request: FastifyRequest): SnapshotObserver {
  return event => {
    const fields = { event: 'snapshot_query', ...event }
    if (event.outcome === 'error') request.log.warn(fields)
    else request.log.info(fields)
  }
}

export async function registerV1(api: FastifyInstance, db: Database, auth: JwtAuthConfig | undefined, foxAssist?: FoxAssist, whatIfAssist?: WhatIfAssistant) {
  const authenticate = createAuthenticator(auth)
  const sessions = sessionRepository(db)
  const timings = new WeakMap<FastifyRequest, { trace: WhatIfTrace; started: number; serialization?: number }>()
  api.decorateRequest('playerId', null)

  api.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    const route = request.routeOptions.url
    const isWhatIf = route?.endsWith('/what-if') || route?.endsWith('/what-if/assistant')
    if (isWhatIf) {
      const trace = new WhatIfTrace(event => {
        const fields = { event: 'what_if_timing', ...event }
        if (event.outcome === 'error') request.log.warn(fields)
        else request.log.info(fields)
      })
      timings.set(request, { trace, started: performance.now() })
      request.playerId = await trace.run('authentication', () => authenticate(request.headers.authorization))
    } else request.playerId = await authenticate(request.headers.authorization)
  })
  api.addHook('onError', async (request, _reply, error) => {
    const timing = timings.get(request)
    timing?.trace.record('analysis', timing.started, 'error', {}, error)
  })
  api.addHook('preSerialization', async (request, _reply, payload) => {
    const timing = timings.get(request)
    if (timing) timing.serialization = performance.now()
    return payload
  })
  api.addHook('onSend', async (request, _reply, payload) => {
    const timing = timings.get(request)
    if (timing?.serialization !== undefined) {
      let errorCode: string | undefined
      if (_reply.statusCode >= 400 && typeof payload === 'string' && payload.length <= 4096) {
        try {
          const value: unknown = JSON.parse(payload)
          if (value && typeof value === 'object' && 'error' in value && value.error && typeof value.error === 'object' &&
              'code' in value.error && typeof value.error.code === 'string') errorCode = value.error.code
        } catch { /* A non-JSON error response is still returned unchanged. */ }
      }
      timing.trace.record('response_serialization', timing.serialization, _reply.statusCode >= 400 ? 'error' : 'ok',
        { payloadBytes: typeof payload === 'string' ? Buffer.byteLength(payload) : undefined, errorCode })
    }
    return payload
  })
  api.addHook('onResponse', async (request, reply) => {
    const timing = timings.get(request)
    timing?.trace.record('analysis', timing.started, reply.statusCode < 400 ? 'ok' : 'error')
  })

  api.get('/me', async request => ({
    profile: await getOrCreateProfile(db, playerId(request)),
  }))

  api.get('/game-sessions', async request => {
    const { limit, offset } = listSessionsQuery.parse(request.query)
    return { sessions: await sessions.list(playerId(request), limit, offset), limit, offset }
  })

  api.post('/game-sessions', async (request, reply) => {
    const { setup } = createSessionBody.parse(request.body)
    const key = idempotencyKey.parse(request.headers['idempotency-key'])
    const result = await createGameSession(db, playerId(request), key, setup, snapshotObserver(request))
    request.log.info({ event: 'game_session_create', idempotency: result.created ? 'new' : 'replayed' })
    return reply.code(result.created ? 201 : 200)
      .header('Location', '/v1/game-sessions/' + result.session.id)
      .send({ session: result.session })
  })

  api.post('/game-sessions/:id/actions', async request => {
    const { id } = sessionParams.parse(request.params)
    const action = gameActionBody.parse(request.body)
    const key = idempotencyKey.parse(request.headers['idempotency-key'])
    const started = performance.now()
    let idempotency: 'new' | 'replayed' | 'conflict' = 'new'
    try {
      const result = await executeGameAction(db, playerId(request), id, key, action, {
        snapshot: snapshotObserver(request),
        idempotency: outcome => { idempotency = outcome },
      })
      request.log.info({ event: 'game_action', outcome: 'ok', idempotency, action: action.actionId,
        stateVersion: result.stateVersion, durationMs: elapsedMs(started) })
      return result
    } catch (error) {
      request.log.info({ event: 'game_action', outcome: 'error', idempotency, action: action.actionId,
        expectedStateVersion: action.expectedStateVersion, durationMs: elapsedMs(started) })
      throw error
    }
  })

  api.post('/game-sessions/:id/trade-quote', async request => {
    const { id } = sessionParams.parse(request.params)
    const { expectedStateVersion, payload } = tradeQuoteBody.parse(request.body)
    return quoteGameTrade(db, playerId(request), id, expectedStateVersion, payload, snapshotObserver(request))
  })

  api.post('/game-sessions/:id/bank-quote', async request => {
    const { id } = sessionParams.parse(request.params)
    return quoteGameBank(db, playerId(request), id, bankQuoteBody.parse(request.body), snapshotObserver(request))
  })

  api.post('/game-sessions/:id/business-quote', async request => {
    const { id } = sessionParams.parse(request.params)
    return quoteGameBusiness(db, playerId(request), id, businessQuoteBody.parse(request.body), snapshotObserver(request))
  })

  api.route({
    method: ['GET', 'POST'],
    url: '/game-sessions/:id/what-if',
    async handler(request, reply) {
      const { id } = sessionParams.parse(request.params)
      const input = request.method === 'POST' ? whatIfBody.parse(request.body) : undefined
      const abort = new AbortController()
      const onClose = () => abort.abort()
      reply.raw.once('close', onClose)
      try {
        return await analyzeSavedGame(db, playerId(request), id, input, abort.signal, timings.get(request)?.trace)
      } finally {
        reply.raw.off('close', onClose)
      }
    },
  })

  api.post('/game-sessions/:id/what-if/assistant', { bodyLimit: 4096 }, async (request, reply) => {
    const { id } = sessionParams.parse(request.params)
    const input = whatIfAssistantBody.parse(request.body)
    const abort = new AbortController()
    const onClose = () => abort.abort()
    reply.raw.once('close', onClose)
    try {
      return await assistSavedWhatIf(db, playerId(request), id, input, whatIfAssist, abort.signal, timings.get(request)?.trace)
    } finally {
      reply.raw.off('close', onClose)
    }
  })

  api.get('/game-sessions/:id/coach', async request => {
    const { id } = sessionParams.parse(request.params)
    return readFoxCoach(db, playerId(request), id, foxCoachQuery.parse(request.query))
  })

  api.post('/game-sessions/:id/coach/learn', { bodyLimit: 4096 }, async (request, reply) => {
    const { id } = sessionParams.parse(request.params)
    const { question, stateVersion, allowGemini } = foxLearningBody.parse(request.body)
    const abort = new AbortController()
    const onClose = () => abort.abort()
    reply.raw.once('close', onClose)
    try {
      return await learnWithFox(db, playerId(request), id, question, stateVersion, {
        allowGemini, assist: foxAssist, signal: abort.signal,
      })
    } finally {
      reply.raw.off('close', onClose)
    }
  })

  api.get('/game-sessions/:id', async request => {
    const { id } = sessionParams.parse(request.params)
    return readGameState(db, playerId(request), id, snapshotObserver(request))
  })
}
