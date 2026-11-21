import assert from 'node:assert/strict'
import { Writable } from 'node:stream'
import { test } from 'node:test'
import Fastify from 'fastify'
import { createDatabase } from '../src/db/client.ts'
import { sendError } from '../src/errors.ts'
import { registerV1 } from '../src/routes/v1.ts'
import { startJwtIssuer } from './jwks.ts'

test('What-if route logs correlate authentication, SQLSTATE and the actual 503 error code safely', async t => {
  const lines: string[] = []
  const stream = new Writable({ write(chunk, _encoding, done) { lines.push(String(chunk)); done() } })
  const app = Fastify({ logger: { stream } })
  const issuer = await startJwtIssuer()
  const failure = Object.assign(Error('private SQL, credentials and snapshot must not be logged'), {
    code: '57014', severity: 'ERROR',
  })
  const database = createDatabase('postgresql://127.0.0.1:1/unused')
  database.db.transaction = async () => { throw failure }
  app.setErrorHandler((error, _request, reply) => sendError(error, reply))
  await app.register(async api => registerV1(api, database.db, issuer.config), { prefix: '/v1' })
  t.after(async () => { await app.close(); await database.close(); await issuer.close() })
  const path = '/v1/game-sessions/00000000-0000-4000-8000-000000000005/what-if'
  assert.equal((await app.inject({ method: 'GET', url: path })).statusCode, 401)
  const token = await issuer.sign('00000000-0000-4000-8000-000000000006')
  const reply = await app.inject({ method: 'GET', url: path, headers: { authorization: 'Bearer ' + token } })
  assert.equal(reply.statusCode, 503)
  assert.equal(reply.json().error.code, 'WHAT_IF_BUDGET_EXCEEDED')
  const text = lines.join('')
  assert.equal(text.includes(token), false)
  assert.equal(text.includes(failure.message), false)
  const events = text.trim().split('\n').map(line => JSON.parse(line))
    .filter(event => event.event === 'what_if_timing')
  assert.ok(events.some(event => event.stage === 'authentication' && event.errorCode === 'UNAUTHORIZED'))
  const sql = events.find(event => event.stage === 'transaction' && event.sqlState === '57014')
  const classified = events.find(event => event.errorCode === 'WHAT_IF_BUDGET_EXCEEDED')
  assert.ok(sql && classified && sql.reqId === classified.reqId)
  assert.ok(events.some(event => event.stage === 'response_serialization' && event.payloadBytes > 0 &&
    event.errorCode === reply.json().error.code && event.reqId === classified.reqId))
})
