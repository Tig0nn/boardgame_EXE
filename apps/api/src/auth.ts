import { createRemoteJWKSet, errors, jwtVerify } from 'jose'
import { z } from 'zod'
import { ApiError } from './errors.ts'

export type JwtAuthConfig = {
  issuer: string
  audience: string
  jwksUrl: URL
}

const playerClaims = z.object({
  sub: z.uuid(),
  role: z.literal('authenticated'),
  is_anonymous: z.literal(false).optional(),
})

function unauthorized() {
  return new ApiError(401, 'UNAUTHORIZED', 'A valid player access token is required')
}

function authUnavailable() {
  return new ApiError(503, 'AUTH_UNAVAILABLE', 'Authentication unavailable')
}

// Supabase publishes its asymmetric Auth signing keys at the issuer's JWKS endpoint.
export function createAuthenticator(config: JwtAuthConfig | undefined) {
  if (!config) return async () => { throw authUnavailable() }

  const jwks = createRemoteJWKSet(config.jwksUrl, { timeoutDuration: 2_000 })
  return async (authorization: string | undefined) => {
    const token = /^Bearer ([\w.-]+)$/i.exec(authorization ?? '')?.[1]
    if (!token) throw unauthorized()

    try {
      const { payload } = await jwtVerify(token, jwks, {
        algorithms: ['ES256', 'RS256'],
        issuer: config.issuer,
        audience: config.audience,
        requiredClaims: ['sub', 'exp'],
      })
      const claims = playerClaims.safeParse(payload)
      if (claims.success) return claims.data.sub
    } catch (error) {
      if (!(error instanceof errors.JOSEError) || [
        'ERR_JWKS_TIMEOUT', 'ERR_JWKS_INVALID', 'ERR_JOSE_GENERIC',
      ].includes(error.code)) throw authUnavailable()
    }

    throw unauthorized()
  }
}
