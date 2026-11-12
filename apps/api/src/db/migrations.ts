import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { Database } from './client.ts'

const migrationsFolder = fileURLToPath(new URL('../../drizzle/', import.meta.url))

export function migrateDatabase(db: Database) {
  return migrate(db, { migrationsFolder })
}
