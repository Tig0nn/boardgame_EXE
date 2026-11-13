import { z } from 'zod'

const postgresUrl = z.url({ protocol: /^postgres(?:ql)?$/ })
const settings = z.object({
  DATABASE_URL: postgresUrl,
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3109),
  AUTH_ISSUER: z.union([z.literal(''), z.url({ protocol: /^https$/ })]).default(''),
  AUTH_AUDIENCE: z.string().trim().min(1).default('authenticated'),
})

export function loadConfig(env: NodeJS.ProcessEnv) {
  const result = settings.safeParse(env)
  if (!result.success) {
    const fields = result.error.issues.map(issue => issue.path.join('.')).join(', ')
    throw new Error('Invalid API configuration fields: ' + fields)
  }

  const { DATABASE_URL, API_PORT, AUTH_ISSUER, AUTH_AUDIENCE } = result.data
  let auth
  if (AUTH_ISSUER) {
    const url = new URL(AUTH_ISSUER)
    if (url.pathname !== '/auth/v1' || url.username || url.password || url.search || url.hash) {
      throw new Error('AUTH_ISSUER must be an HTTPS Supabase Auth URL ending in /auth/v1')
    }
    auth = {
      issuer: url.href,
      audience: AUTH_AUDIENCE,
      jwksUrl: new URL('/auth/v1/.well-known/jwks.json', url),
    }
  }

  return { databaseUrl: DATABASE_URL, port: API_PORT, auth }
}

// Development migrations and tests may only target the dedicated local Compose database.
export function localDatabaseUrl(value: string | undefined): URL {
  const result = postgresUrl.safeParse(value)
  if (!result.success) throw new Error('Set DATABASE_URL for the local exe_v1 database')
  const url = new URL(result.data)
  if (url.hostname !== '127.0.0.1' || url.pathname !== '/exe_v1' || url.search || url.hash) {
    throw new Error('Use a loopback DATABASE_URL for the dedicated exe_v1 database')
  }
  return url
}
