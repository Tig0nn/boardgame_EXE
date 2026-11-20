import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { test } from 'node:test'
import { serializeLog } from '../../../src/game/log.ts'
import { restoreSavedGame } from '../../../src/game/saved-game.ts'
import { buildApp } from '../src/app.ts'
import { localDatabaseUrl } from '../src/config.ts'
import { createDatabase } from '../src/db/client.ts'
import { migrateDatabase } from '../src/db/migrations.ts'
import { postgresFailure } from '../src/observability.ts'
import { publicB18State, transitionB18 } from '../src/services/b18-actions.ts'
import { executeGameAction } from '../src/services/game-actions.ts'
import { gameActionBody } from '../src/validation.ts'
import type { GameActionRequest } from '../src/validation.ts'
import { startJwtIssuer } from './jwks.ts'

const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const command = (actionId: string, expectedStateVersion: number, payload: object = {}) =>
  gameActionBody.parse({ actionId, expectedStateVersion, payload })

test('snapshot cancellation and financial retries remain atomic on disposable PostgreSQL', { timeout: 180_000 }, async t => {
  const url = localDatabaseUrl(process.env.DATABASE_URL)
  const admin = createDatabase(url.href, { max: 1 })
  const name = 'exe_snapshot_retry_' + randomUUID().replaceAll('-', '')
  const identifier = '"' + name + '"'
  const testUrl = new URL(url)
  testUrl.pathname = '/' + name
  const database = createDatabase(testUrl.href, { max: 4 })
  const timeoutDatabase = createDatabase(testUrl.href, { max: 1, statement_timeout: 150 })
  const issuer = await startJwtIssuer()
  const app = buildApp(database, issuer.config)
  const timeoutApp = buildApp(timeoutDatabase, issuer.config)
  let created = false
  t.after(async () => {
    try {
      await Promise.all([app.close(), timeoutApp.close(), issuer.close()])
      if (created) await admin.pool.query('DROP DATABASE ' + identifier)
    } finally { await admin.close() }
  })
  await admin.pool.query('CREATE DATABASE ' + identifier + ' TEMPLATE template0')
  created = true
  await migrateDatabase(database.db)
  const owner = randomUUID()
  const expires = Math.floor(Date.now() / 1000) + 600
  const authorization = 'Bearer ' + await issuer.sign(owner, { exp: expires })
  const outsider = 'Bearer ' + await issuer.sign(randomUUID(), { exp: expires })
  let lostKey: string | undefined
  app.addHook('onSend', (request, reply, payload, done) => {
    if (lostKey && request.headers['idempotency-key'] === lostKey && reply.statusCode === 200 && request.raw.socket.remotePort) {
      lostKey = undefined
      // The handler has committed; only delivery of its HTTP response is lost.
      reply.hijack()
      reply.raw.destroy()
    } else done(null, payload)
  })
  const base = await app.listen({ host: '127.0.0.1', port: 0 })
  const path = (id: string) => '/v1/game-sessions/' + id
  const post = (id: string, input: GameActionRequest, key: string, bearer = authorization) => app.inject({
    method: 'POST', url: path(id) + '/actions', payload: input,
    headers: { authorization: bearer, 'idempotency-key': key },
  })
  const read = (id: string, bearer = authorization) => app.inject({ method: 'GET', url: path(id), headers: { authorization: bearer } })
  const latest = async (id: string) => (await database.pool.query<{ state_version: number; payload: string }>(
    'SELECT state_version,payload FROM game_snapshots WHERE session_id=$1 ORDER BY state_version DESC LIMIT 1', [id],
  )).rows[0]
  const counts = async (id: string) => (await database.pool.query<{
    state_version: number; actions: number; snapshots: number; results: number;
  }>('SELECT state_version,(SELECT count(*)::int FROM game_actions WHERE session_id=$1) AS actions,' +
    '(SELECT count(*)::int FROM game_snapshots WHERE session_id=$1) AS snapshots,' +
    '(SELECT count(*)::int FROM game_results WHERE session_id=$1) AS results FROM game_sessions WHERE id=$1', [id])).rows[0]
  async function createSession() {
    const response = await app.inject({ method: 'POST', url: '/v1/game-sessions', payload: { scenarioId: 'b18' },
      headers: { authorization, 'idempotency-key': randomUUID() } })
    assert.equal(response.statusCode, 201, response.body)
    return response.json<{ session: { id: string } }>().session.id
  }
  async function slowSnapshots(seconds: number) {
    assert.ok(seconds > 0 && seconds <= 1)
    await database.pool.query('CREATE FUNCTION test_slow_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(' +
      String(seconds) + '); RETURN NEW; END $$')
    await database.pool.query('CREATE TRIGGER test_slow_snapshot BEFORE INSERT ON game_snapshots FOR EACH ROW EXECUTE FUNCTION test_slow_snapshot()')
  }
  async function removeSlowSnapshots() {
    await database.pool.query('DROP TRIGGER IF EXISTS test_slow_snapshot ON game_snapshots')
    await database.pool.query('DROP FUNCTION IF EXISTS test_slow_snapshot()')
  }
  async function financialDecision(id: string) {
    const initial = await latest(id)
    let version = initial.state_version
    let game = restoreSavedGame(initial.payload)
    for (let step = 0; step < 100; step++) {
      const state = publicB18State(game)
      const candidates: GameActionRequest[] = state.options.map(option => command('choose', version, { optionId: option.id }))
      if (state.bank.canDeposit) candidates.unshift(command('trade', version, { kind: 'deposit', amount: 1_000_000, term: 1 }))
      if (state.availableActions.includes('advance')) candidates.push(command('advance', version))
      if (state.availableActions.includes('roll')) candidates.push(command('roll', version))
      if (state.availableActions.includes('fund')) {
        const option = state.fundingOptions[0]
        assert.ok(option)
        candidates.push(command('fund', version, { source: option.source, amount: option.maxAmount,
          ...(option.lotId ? { lotId: option.lotId } : {}) }))
      }
      assert.ok(candidates.length, 'A canonical journey must offer a legal action')
      const financial = candidates.find(input => {
        const next = transitionB18(game, input)
        return next !== game && next.portfolio.cash !== game.portfolio.cash
      })
      if (financial) return { input: financial, before: game, after: transitionB18(game, financial), version }
      const input = candidates.find(item => item.actionId === 'choose' && item.payload.optionId === 'skip') ?? candidates[0]
      const response = await post(id, input, randomUUID())
      assert.equal(response.statusCode, 200, response.body)
      game = transitionB18(game, input)
      version++
    }
    assert.fail('Expected a real cash-changing decision within the bounded canonical journey')
  }

  const timeoutId = await createSession()
  const timeoutKey = randomUUID()
  const advance = command('advance', 0)
  const genesis = await latest(timeoutId)
  await t.test('SQLSTATE 57014 during snapshot insert rolls back and is a retryable HTTP 503', async () => {
    const observed: { operation: string; sqlState?: string }[] = []
    await slowSnapshots(.4)
    let status: number | undefined
    let body: { error: { code: string; message: string } } | undefined
    try {
      await assert.rejects(executeGameAction(timeoutDatabase.db, owner, timeoutId, timeoutKey, advance, {
        snapshot: event => { observed.push(event) }, idempotency: () => {},
      }), error => postgresFailure(error)?.sqlState === '57014')
      assert.ok(observed.some(event => event.operation === 'snapshot_insert' && event.sqlState === '57014'))
      const response = await timeoutApp.inject({ method: 'POST', url: path(timeoutId) + '/actions', payload: advance,
        headers: { authorization, 'idempotency-key': timeoutKey } })
      status = response.statusCode
      body = response.json()
      t.diagnostic('Real snapshot cancellation: SQLSTATE 57014; HTTP ' + status)
      assert.deepEqual(await counts(timeoutId), { state_version: 0, actions: 0, snapshots: 1, results: 0 })
      assert.equal(digest((await latest(timeoutId)).payload), digest(genesis.payload))
    } finally { await removeSlowSnapshots() }
    assert.equal(status, 503)
    assert.ok(body)
    assert.equal(body.error.code, 'DATABASE_BUSY')
    assert.deepEqual(Object.keys(body.error).sort(), ['code', 'message'])
    assert.equal(typeof body.error.message, 'string')
    assert.doesNotMatch(JSON.stringify(body), /pg_sleep|game_snapshots|postgres(?:ql)?:\/\//i)
  })

  await t.test('one retry with the same key commits once and canonical reload agrees', async () => {
    const response = await post(timeoutId, advance, timeoutKey)
    assert.equal(response.statusCode, 200, response.body)
    assert.deepEqual((await post(timeoutId, advance, timeoutKey)).json(), response.json())
    assert.deepEqual(await counts(timeoutId), { state_version: 1, actions: 1, snapshots: 2, results: 0 })
    const expected = transitionB18(restoreSavedGame(genesis.payload), advance)
    assert.equal((await latest(timeoutId)).payload, serializeLog(expected))
    const restored = await read(timeoutId)
    assert.equal(restored.statusCode, 200, restored.body)
    assert.deepEqual(restored.json().state, response.json().state)
    assert.deepEqual(restored.json().result, response.json().result)
    const stale = await post(timeoutId, advance, randomUUID())
    assert.equal(stale.statusCode, 409)
    assert.equal(stale.json().error.code, 'STATE_VERSION_CONFLICT')
    assert.equal((await read(timeoutId, outsider)).statusCode, 404)
    assert.equal((await post(timeoutId, command('roll', 1), randomUUID(), outsider)).statusCode, 404)
  })

  await t.test('lost HTTP response after a financial commit replays without a second debit', async () => {
    const id = await createSession()
    const { input, before, after, version } = await financialDecision(id)
    assert.notEqual(before.portfolio.cash, after.portfolio.cash)
    const beforeCounts = await counts(id)
    const key = randomUUID()
    lostKey = key
    await assert.rejects(fetch(base + path(id) + '/actions', { method: 'POST',
      headers: { authorization, 'content-type': 'application/json', 'idempotency-key': key }, body: JSON.stringify(input) }))
    const committed = await counts(id)
    assert.deepEqual(committed, { state_version: version + 1, actions: beforeCounts.actions + 1,
      snapshots: beforeCounts.snapshots + 1, results: beforeCounts.results })
    assert.equal((await latest(id)).payload, serializeLog(after))
    const retried = await post(id, input, key)
    assert.equal(retried.statusCode, 200, retried.body)
    assert.equal(retried.json().state.portfolio.cash, after.portfolio.cash)
    assert.deepEqual((await post(id, input, key)).json(), retried.json())
    assert.deepEqual(await counts(id), committed)
    assert.deepEqual((await read(id)).json().state, retried.json().state)
  })

  await t.test('slow concurrent duplicate financial requests commit one version and one snapshot', async () => {
    const id = await createSession()
    const { input, after, version } = await financialDecision(id)
    const beforeCounts = await counts(id)
    const key = randomUUID()
    await slowSnapshots(.3)
    const started = performance.now()
    try {
      const replies = await Promise.all([post(id, input, key), post(id, input, key)])
      assert.deepEqual(replies.map(reply => reply.statusCode), [200, 200])
      assert.deepEqual(replies[0].json(), replies[1].json())
      assert.ok(performance.now() - started >= 250, 'The actual slow insert completed before either successful response')
      assert.equal(replies[0].json().state.portfolio.cash, after.portfolio.cash)
    } finally { await removeSlowSnapshots() }
    assert.deepEqual(await counts(id), { state_version: version + 1, actions: beforeCounts.actions + 1,
      snapshots: beforeCounts.snapshots + 1, results: beforeCounts.results })
    assert.equal((await latest(id)).payload, serializeLog(after))
  })
  const idle = await database.pool.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND state='idle in transaction'")
  assert.equal(idle.rows[0].count, 0)
})
