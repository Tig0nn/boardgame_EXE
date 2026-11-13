import type { FastifyInstance, FastifyRequest } from 'fastify'
import { createAuthenticator } from '../auth.ts'
import type { JwtAuthConfig } from '../auth.ts'
import type { Database } from '../db/client.ts'
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
    createSessionBody.parse(request.body)
    const key = idempotencyKey.parse(request.headers['idempotency-key'])
    const result = await createGameSession(db, playerId(request), key)
    return reply.code(result.created ? 201 : 200)
      .header('Location', '/v1/game-sessions/' + result.session.id)
      .send({ session: result.session })
  })

  api.post('/game-sessions/:id/actions', async request => {
    const { id } = sessionParams.parse(request.params)
    const action = gameActionBody.parse(request.body)
    const key = idempotencyKey.parse(request.headers['idempotency-key'])
    return executeGameAction(db, playerId(request), id, key, action)
  })

  api.post('/game-sessions/:id/trade-quote', async request => {
    const { id } = sessionParams.parse(request.params)
    const { expectedStateVersion, payload } = tradeQuoteBody.parse(request.body)
    return quoteGameTrade(db, playerId(request), id, expectedStateVersion, payload)
  })

  api.post('/game-sessions/:id/bank-quote', async request => {
    const { id } = sessionParams.parse(request.params)
    return quoteGameBank(db, playerId(request), id, bankQuoteBody.parse(request.body))
  })

  api.post('/game-sessions/:id/business-quote', async request => {
    const { id } = sessionParams.parse(request.params)
    return quoteGameBusiness(db, playerId(request), id, businessQuoteBody.parse(request.body))
  })

  api.get('/game-sessions/:id', async request => {
    const { id } = sessionParams.parse(request.params)
    return readGameState(db, playerId(request), id)
  })
}
