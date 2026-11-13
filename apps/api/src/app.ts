import { randomUUID } from 'node:crypto'
import Fastify, { LogController } from 'fastify'
import type { JwtAuthConfig } from './auth.ts'
import type { DatabaseConnection } from './db/client.ts'
import { notFound, sendError, unavailable } from './errors.ts'
import { postgresFailure } from './observability.ts'
import type { FoxAssist } from './services/fox-assistance.ts'
import type { WhatIfAssistant } from './services/what-if-assistance.ts'
import { registerV1 } from './routes/v1.ts'

export function buildApp(database: DatabaseConnection, auth?: JwtAuthConfig, logger = false, foxAssist?: FoxAssist, whatIfAssist?: WhatIfAssistant) {
  const app = Fastify({
    logger,
    logController: new LogController({ disableRequestLogging: true }),
    requestIdHeader: false,
    genReqId: () => randomUUID(),
    bodyLimit: 16 * 1024,
    requestTimeout: 10_000,
    connectionTimeout: 15_000,
  })

  app.setErrorHandler((error, _request, reply) => sendError(error, reply))
  app.setNotFoundHandler(() => { throw notFound() })
  app.addHook('onClose', () => database.close())
  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-Id', request.id)
  })
  app.addHook('onResponse', async (request, reply) => {
    request.log.info({
      event: 'http_response', route: request.routeOptions.url ?? 'unmatched',
      method: request.method, statusCode: reply.statusCode, durationMs: reply.elapsedTime,
    })
  })

  app.get('/health', async () => ({ status: 'ok' }))
  app.get('/ready', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    try {
      await database.check()
    } catch (error) {
      request.log.warn({ event: 'database_readiness_failed', ...postgresFailure(error) })
      throw unavailable()
    }
    return { status: 'ready' }
  })

  app.register(async api => registerV1(api, database.db, auth, foxAssist, whatIfAssist), { prefix: '/v1' })
  return app
}
