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
import { readGameState } from '../services/game-state.ts'
import { bankQuoteBody, businessQuoteBody, createSessionBody, gameActionBody, idempotencyKey, listSessionsQuery, sessionParams, tradeQuoteBody } from '../validation.ts'

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

export async function registerV1(api: FastifyInstance, db: Database, auth: JwtAuthConfig | undefined) {
  const authenticate = createAuthenticator(auth)
  const sessions = sessionRepository(db)
  api.decorateRequest('playerId', null)

  api.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    request.playerId = await authenticate(request.headers.authorization)
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

  api.get('/game-sessions/:id', async request => {
    const { id } = sessionParams.parse(request.params)
    return readGameState(db, playerId(request), id, snapshotObserver(request))
  })
}
