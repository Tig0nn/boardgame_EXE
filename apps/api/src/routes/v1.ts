import type { FastifyInstance, FastifyRequest } from 'fastify'
import { createAuthenticator } from '../auth.ts'
import type { JwtAuthConfig } from '../auth.ts'
import type { Database } from '../db/client.ts'
import { notFound } from '../errors.ts'
import { getOrCreateProfile } from '../repositories/profiles.ts'
import { sessionRepository } from '../repositories/game-sessions.ts'
import { createGameSession } from '../services/game-sessions.ts'
import { createSessionBody, idempotencyKey, listSessionsQuery, sessionParams } from '../validation.ts'

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

  api.get('/game-sessions/:id', async request => {
    const { id } = sessionParams.parse(request.params)
    const session = await sessions.find(playerId(request), id)
    if (!session) throw notFound()
    return { session }
  })
}
