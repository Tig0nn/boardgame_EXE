import { drizzle } from 'drizzle-orm/node-postgres'
import { createDatabase } from './client.ts'
import { migrateDatabase, verifyMigrationJournal } from './migrations.ts'
import { stagingConnection, stagingPoolOptions } from './staging.ts'

async function run() {
  const mode = process.argv[2]
  if (mode !== 'check' && mode !== 'migrate') throw new Error('Unknown staging database command')
  const target = stagingConnection(process.env, 'migration')
  if (mode === 'migrate' && process.env.EXE_CONFIRM_STAGING_MIGRATION !== process.env.EXE_STAGING_PROJECT_REF) {
    throw new Error('Migration requires the approved staging project ref as confirmation')
  }
  const database = createDatabase(target.url, stagingPoolOptions(target))
  try {
    const client = await database.pool.connect()
    try {
      if (mode === 'migrate') {
        const { rows: [lock] } = await client.query<{ acquired: boolean }>('SELECT pg_try_advisory_lock(742031, 3) AS acquired')
        if (!lock.acquired) throw new Error('Another EXE staging migration is active')
      }
      await verifyMigrationJournal(client)
      if (mode === 'migrate') {
        await migrateDatabase(drizzle(client))
        await verifyMigrationJournal(client)
      }
      console.log(mode === 'migrate' ? 'Staging migrations applied' : 'Staging migration preflight passed')
    } finally {
      // Close the checked-out session instead of returning its advisory lock to the pool.
      client.release(true)
    }
  } finally { await database.close() }
}

run().catch(() => {
  console.error('Staging database command failed. Check target, TLS, migration history and authorization.')
  process.exitCode = 1
})
