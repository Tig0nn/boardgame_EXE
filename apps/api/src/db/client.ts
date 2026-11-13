import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

export function createDatabase(connectionString: string, options: Pick<pg.PoolConfig, 'ssl' | 'max' | 'statement_timeout' | 'onConnect'> = {}) {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 2_000,
    statement_timeout: 5_000,
    ...options,
  })
  // pg emits errors for idle sockets after a database restart. The pool discards them.
  pool.on('error', () => {})
  // A server restart can also disconnect a client checked out by a transaction.
  pool.on('connect', client => {
    client.on('error', () => {})
  })

  return {
    pool,
    db: drizzle(pool),
    async check() {
      await pool.query('SELECT 1')
    },
    close: () => pool.end(),
  }
}

export type DatabaseConnection = ReturnType<typeof createDatabase>
export type Database = DatabaseConnection['db']
