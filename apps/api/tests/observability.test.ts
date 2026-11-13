import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../src/app.ts'
import { createDatabase } from '../src/db/client.ts'
import { observeSnapshot, postgresFailure } from '../src/observability.ts'

test('reports a wrapped PostgreSQL cancellation using only allowlisted fields', async () => {
  const queryError = Object.assign(new Error('private query detail'), { severity: 'ERROR', code: '57014' })
  const wrapped = new Error('SQL and bound parameters', { cause: queryError })
  assert.deepEqual(postgresFailure(wrapped), { sqlState: '57014', category: 'query_cancelled' })
  const events: unknown[] = []
  await assert.rejects(observeSnapshot(event => events.push(event), 'snapshot_insert', { stateVersion: 3 }, async () => {
    throw wrapped
  }), error => error === wrapped)
  assert.deepEqual(events, [{
    operation: 'snapshot_insert', stateVersion: 3, durationMs: (events[0] as { durationMs: number }).durationMs,
    outcome: 'error', sqlState: '57014', category: 'query_cancelled',
  }])
  assert.equal(postgresFailure(Object.assign(new Error('unrelated'), { code: '57014' })), undefined)
})

test('issues an independent correlation ID and preserves the readiness error contract', async t => {
  const database = createDatabase('postgresql://unused@127.0.0.1/unused')
  database.check = async () => { throw Object.assign(new Error('private connection detail'), { code: 'ECONNREFUSED' }) }
  const app = buildApp(database)
  t.after(() => app.close())
  const headers = { 'x-request-id': 'user-supplied', 'request-id': 'also-user-supplied' }
  const health = await app.inject({ url: '/health', headers })
  const ready = await app.inject({ url: '/ready', headers })
  assert.equal(health.statusCode, 200)
  assert.equal(ready.statusCode, 503)
  assert.match(String(health.headers['x-request-id']), /^[a-f0-9-]{36}$/)
  assert.match(String(ready.headers['x-request-id']), /^[a-f0-9-]{36}$/)
  assert.notEqual(ready.headers['x-request-id'], health.headers['x-request-id'])
  assert.deepEqual(ready.json(), { error: { code: 'DATABASE_UNAVAILABLE', message: 'Database unavailable' } })
})
