import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import type { PoolClient } from 'pg'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

const migrationsFolder = fileURLToPath(new URL('../../drizzle/', import.meta.url))

const gameObjects = ['admin_audit_logs', 'game_actions', 'game_results', 'game_sessions', 'game_snapshots', 'profiles',
  'scenario_versions', 'game_session_status', 'game_result_outcome']

export async function verifyMigrationJournal(client: Pick<PoolClient, 'query'>) {
  const { rows: [journal] } = await client.query<{ name: string | null }>(
    "SELECT to_regclass('drizzle.__drizzle_migrations')::text AS name",
  )
  const expected = readMigrationFiles({ migrationsFolder })
  const applied = journal.name ? (await client.query<{ hash: string; created_at: string }>(
    'SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id',
  )).rows : []
  if (applied.length > expected.length || applied.some((row, index) =>
    row.hash !== expected[index].hash || Number(row.created_at) !== expected[index].folderMillis)) {
    throw new Error('Unexpected migration history')
  }
  if (!applied.length) {
    const { rows: [existing] } = await client.query<{ present: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
      ) OR EXISTS (
        SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = ANY($1::text[])
      ) AS present
    `, [gameObjects])
    if (existing.present) throw new Error('Unmanaged game schema already exists')
  }
}

export function migrateDatabase(db: NodePgDatabase) {
  return migrate(db, { migrationsFolder })
}
