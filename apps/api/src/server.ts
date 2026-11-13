import { readFileSync } from 'node:fs'
import { buildApp } from './app.ts'
import { createWhatIfAssistant } from './services/what-if-assistance.ts'
import { createFoxAssistance } from './services/fox-assistance.ts'
import { loadConfig } from './config.ts'
import { createDatabase } from './db/client.ts'
import { stagingConnection, stagingPoolOptions } from './db/staging.ts'

async function main() {
  const env = { ...process.env }
  if (env.DATABASE_URL_FILE) {
    if (env.DATABASE_URL) throw new Error('Configure one database URL source')
    env.DATABASE_URL = readFileSync(env.DATABASE_URL_FILE, 'utf8').trim()
  }
  const config = loadConfig(env)
  const staging = env.EXE_ENV === 'staging' ? stagingConnection(env, 'runtime') : null
  const database = staging ? createDatabase(staging.url, stagingPoolOptions(staging)) : createDatabase(config.databaseUrl)
  const app = buildApp(database, config.auth, true, createFoxAssistance(env), createWhatIfAssistant(env))

  try {
    await app.listen({ host: config.host, port: config.port })
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
  console.error(JSON.stringify({ level: 'error', event: 'api_startup_failed' }))
  process.exitCode = 1
})
