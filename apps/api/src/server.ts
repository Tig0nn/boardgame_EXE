import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { createDatabase } from './db/client.ts'
import { stagingConnection, stagingPoolOptions } from './db/staging.ts'

async function main() {
  const config = loadConfig(process.env)
  const staging = process.env.EXE_ENV === 'staging' ? stagingConnection(process.env, 'runtime') : null
  const database = staging ? createDatabase(staging.url, stagingPoolOptions(staging)) : createDatabase(config.databaseUrl)
  const app = buildApp(database, config.auth, true)

  try {
    await app.listen({ host: '127.0.0.1', port: config.port })
  } catch (error) {
    await app.close()
    throw error
  }

  const stop = () => {
    app.close().catch(() => {
      console.error('API shutdown failed')
      process.exitCode = 1
    })
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}

main().catch(() => {
  console.error('API startup failed. Check apps/api/.env and local port availability.')
  process.exitCode = 1
})
