import assert from 'node:assert/strict'
import { test } from 'node:test'
import { stagingConnection } from '../src/db/staging.ts'

const ref = 'abcdefghijklmnopqrst'
const env = {
  EXE_ENV: 'staging',
  EXE_STAGING_PROJECT_REF: ref,
  AUTH_ISSUER: 'https://' + ref + '.supabase.co/auth/v1',
  DATABASE_URL: 'postgresql://exe_runtime:placeholder@db.' + ref + '.supabase.co:5432/postgres',
  EXE_STAGING_MIGRATION_URL: 'postgresql://postgres.' + ref + ':placeholder@aws-0-test.pooler.supabase.com:5432/postgres',
  EXE_STAGING_DB_CA_FILE: 'provider-root.pem',
}

test('binds staging runtime and migrations to the same project and separate DB roles', () => {
  assert.deepEqual(stagingConnection(env, 'runtime'), { url: env.DATABASE_URL, caPath: 'provider-root.pem', max: 4 })
  assert.equal(stagingConnection(env, 'migration').max, 1)
  assert.equal(stagingConnection({ ...env, EXE_DB_POOL_MAX: '6' }, 'runtime').max, 6)
  for (const change of [
    { EXE_ENV: 'production' },
    { AUTH_ISSUER: env.AUTH_ISSUER.replace(ref, 'xxxxxxxxxxxxxxxxxxxx') },
    { EXE_STAGING_DB_CA_FILE: '' },
    { DATABASE_URL: env.DATABASE_URL.replace('exe_runtime', 'postgres') },
    { DATABASE_URL: env.DATABASE_URL + '?sslmode=no-verify' },
    { DATABASE_URL: env.DATABASE_URL.replace(':5432', ':6543') },
    { DATABASE_URL: env.DATABASE_URL.replace(ref, 'xxxxxxxxxxxxxxxxxxxx') },
    { EXE_DB_POOL_MAX: '11' },
  ]) assert.throws(() => stagingConnection({ ...env, ...change }, 'runtime'))
  assert.throws(() => stagingConnection({
    ...env, EXE_STAGING_MIGRATION_URL: env.EXE_STAGING_MIGRATION_URL.replace(ref, 'xxxxxxxxxxxxxxxxxxxx'),
  }, 'migration'))
})
