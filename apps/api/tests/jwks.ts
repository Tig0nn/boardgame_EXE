import { createServer } from 'node:http'
import { once } from 'node:events'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import type { JWTPayload } from 'jose'

export async function startJwtIssuer() {
  const key = await generateKeyPair('ES256')
  const wrongKey = await generateKeyPair('ES256')
  const kid = 'integration-test'
  const jwk = { ...await exportJWK(key.publicKey), kid, alg: 'ES256' }
  const jwksPath = '/auth/v1/.well-known/jwks.json'
  const server = createServer((request, response) => {
    if (request.url !== jwksPath) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify({ keys: [jwk] }))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No JWKS listener')
  const issuer = 'http://127.0.0.1:' + address.port + '/auth/v1'

  return {
    config: { issuer, jwksUrl: new URL(jwksPath, issuer), audience: 'authenticated' },
    async sign(userId: string, claims: JWTPayload = {}, badSignature = false) {
      return new SignJWT({
        sub: userId,
        role: 'authenticated',
        iss: issuer,
        aud: 'authenticated',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
        ...claims,
      }).setProtectedHeader({ alg: 'ES256', kid }).sign(badSignature ? wrongKey.privateKey : key.privateKey)
    },
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
    }),
  }
}
