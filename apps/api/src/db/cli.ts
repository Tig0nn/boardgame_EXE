import { localDatabaseUrl } from '../config.ts'
import { createDatabase } from './client.ts'
import { migrateDatabase } from './migrations.ts'

async function run() {
  const command = process.argv[2]
  if (command !== 'migrate' && command !== 'check') throw new Error('Invalid database command')
  const database = createDatabase(localDatabaseUrl(process.env.DATABASE_URL).href)
  try {
    if (command === 'migrate') await migrateDatabase(database.db)
    else await database.check()
    console.log(command === 'migrate' ? 'Database migrations are up to date' : 'PostgreSQL connection verified')
  } finally {
    await database.close()
  }
}

run().catch(() => {
  console.error('Database command failed. Check apps/api/.env, Compose health, and database access.')
  process.exitCode = 1
})
