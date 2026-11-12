import Fastify, { LogController } from 'fastify'
import type { JwtAuthConfig } from './auth.ts'
import type { DatabaseConnection } from './db/client.ts'
import { notFound, sendError, unavailable } from './errors.ts'
import { registerV1 } from './routes/v1.ts'

export function buildApp(database: DatabaseConnection, auth?: JwtAuthConfig, logger = false) {
  const app = Fastify({
    logger,
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 16 * 1024,
    requestTimeout: 10_000,
    connectionTimeout: 15_000,
  })

  app.setErrorHandler((error, _request, reply) => sendError(error, reply))
  app.setNotFoundHandler(() => { throw notFound() })
  app.addHook('onClose', () => database.close())

  app.get('/health', async () => ({ status: 'ok' }))
  app.get('/ready', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store')
    try {
      await database.check()
    } catch {
      throw unavailable()
    }
    return { status: 'ready' }
  })

  app.register(async api => registerV1(api, database.db, auth), { prefix: '/v1' })
  return app
}
