import { readFileSync } from 'node:fs'
import { z } from 'zod'
import type { ClientBase } from 'pg'

const refPattern = /^[a-z0-9]{20}$/

export function stagingConnection(env: NodeJS.ProcessEnv, purpose: 'runtime' | 'migration') {
  const ref = env.EXE_STAGING_PROJECT_REF ?? ''
  const caPath = env.EXE_STAGING_DB_CA_FILE
  const raw = purpose === 'runtime' ? env.DATABASE_URL : env.EXE_STAGING_MIGRATION_URL
  if (env.EXE_ENV !== 'staging' || !refPattern.test(ref) || !raw || !caPath) {
    throw new Error('Staging project, database URL and CA file are required')
  }
  if (env.AUTH_ISSUER !== 'https://' + ref + '.supabase.co/auth/v1') {
    throw new Error('Staging Auth issuer must match the selected project')
  }
  const url = new URL(raw)
  const direct = url.hostname === 'db.' + ref + '.supabase.co'
  const sessionPooler = /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(url.hostname)
  const user = decodeURIComponent(url.username)
  const poolerRole = sessionPooler && user.endsWith('.' + ref) ? user.slice(0, -ref.length - 1) : ''
  const role = direct ? user : poolerRole
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || (url.port && url.port !== '5432') ||
      url.pathname !== '/postgres' || url.search || url.hash || !url.password ||
      (purpose === 'runtime' ? role !== 'exe_runtime' : role !== 'postgres')) {
    throw new Error('Invalid staging database target or role')
  }
  const max = purpose === 'migration' ? 1 : z.coerce.number().int().min(1).max(10).parse(env.EXE_DB_POOL_MAX ?? 4)
  return { url: url.href, caPath, max }
}

export function stagingPoolOptions(target: ReturnType<typeof stagingConnection>) {
  return {
    max: target.max,
    ssl: { ca: readFileSync(target.caPath, 'utf8'), rejectUnauthorized: true },
    // Supavisor session mode supports SET, independent of startup parameter forwarding.
    statement_timeout: false as const,
    onConnect: async (client: ClientBase) => {
      await client.query("SET statement_timeout TO '5s'")
      await client.query('SET search_path TO public')
    },
  }
}
