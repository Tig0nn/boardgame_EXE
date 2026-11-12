import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadConfig, localDatabaseUrl } from '../src/config.ts'

const developmentUrl = 'postgresql://exe_v1@127.0.0.1:55432/exe_v1'

test('restricts development database commands to the dedicated loopback database', () => {
  assert.equal(localDatabaseUrl(developmentUrl).href, developmentUrl)
  for (const value of [
    undefined,
    'postgresql://exe_v1@192.0.2.1:5432/exe_v1',
    'postgresql://exe_v1@127.0.0.1:55432/postgres',
    developmentUrl + '?host=192.0.2.1',
  ]) {
    assert.throws(() => localDatabaseUrl(value))
  }
})

test('derives JWKS from the configured HTTPS issuer and requires its exact Auth path', () => {
  const issuer = 'https://project.example/auth/v1'
  const config = loadConfig({ DATABASE_URL: developmentUrl, AUTH_ISSUER: issuer })
  assert.equal(config.auth?.issuer, issuer)
  assert.equal(config.auth?.audience, 'authenticated')
  assert.equal(config.auth?.jwksUrl.href, issuer + '/.well-known/jwks.json')
  for (const value of [issuer.replace('https:', 'http:'), issuer + '/extra', issuer + '?query=1']) {
    assert.throws(() => loadConfig({ DATABASE_URL: developmentUrl, AUTH_ISSUER: value }))
  }
})
