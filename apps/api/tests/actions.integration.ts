import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'node:test'
import { eq, sql } from 'drizzle-orm'
import { eventsForGame } from '../../../src/data/events.ts'
import { advance, canChoose, decide, roll } from '../../../src/game/engine.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { restoreSavedGame } from '../../../src/game/saved-game.ts'
import { liquidatableFunds, victory } from '../../../src/game/selectors.ts'
import { replayGameLog } from '../../../scripts/diagnostics/replay-game-log.ts'
import { buildApp } from '../src/app.ts'
import { localDatabaseUrl } from '../src/config.ts'
import { createDatabase } from '../src/db/client.ts'
import { migrateDatabase } from '../src/db/migrations.ts'
import { gameActions, gameResults, gameSessions, gameSnapshots } from '../src/db/schema.ts'
import { b18Scenario } from '../src/services/b18.ts'
import { startJwtIssuer } from './jwks.ts'

type Command = { actionId: string; payload: Record<string, unknown>; expectedStateVersion: number }

const command = (actionId: string, expectedStateVersion: number, payload = {}): Command =>
  ({ actionId, payload, expectedStateVersion })

test('Phase 2A actions on PostgreSQL', { timeout: 90_000 }, async t => {
  const url = localDatabaseUrl(process.env.DATABASE_URL)
  const admin = createDatabase(url.href)
  const name = 'exe_v2a_test_' + randomUUID().replaceAll('-', '')
  const identifier = '"' + name + '"'
  let createdDatabase = false
  const testUrl = new URL(url)
  testUrl.pathname = '/' + name
  const database = createDatabase(testUrl.href)
  const issuer = await startJwtIssuer()
  const app = buildApp(database, issuer.config)

  t.after(async () => {
    try {
      await Promise.all([app.close(), issuer.close()])
      if (createdDatabase) await admin.pool.query('DROP DATABASE ' + identifier)
    } finally {
      await admin.close()
    }
  })
  await admin.pool.query('CREATE DATABASE ' + identifier + ' TEMPLATE template0')
  createdDatabase = true
  await migrateDatabase(database.db)

  const owner = randomUUID()
  const authorization = 'Bearer ' + await issuer.sign(owner, { exp: Math.floor(Date.now() / 1000) + 120 })
  const other = 'Bearer ' + await issuer.sign(randomUUID())
  const lostKey = randomUUID()
  app.addHook('onSend', (request, reply, payload, done) => {
    if (request.headers['idempotency-key'] === lostKey && reply.statusCode === 200 && request.raw.socket.remotePort) {
      // At this point the route handler's transaction has already committed.
      reply.hijack()
      reply.raw.destroy()
    } else {
      done(null, payload)
    }
  })
  const base = await app.listen({ host: '127.0.0.1', port: 0 })
  const sessionsPath = '/v1/game-sessions'
  const actionPath = (id: string) => sessionsPath + '/' + id + '/actions'
  async function createSession(): Promise<string> {
    const response = await app.inject({
      method: 'POST', url: sessionsPath, payload: { scenarioId: 'b18' },
      headers: { authorization, 'idempotency-key': randomUUID() },
    })
    assert.equal(response.statusCode, 201, response.body)
    return response.json().session.id
  }
  const post = (id: string, payload: object, key: string = randomUUID(), bearer = authorization) => app.inject({
    method: 'POST', url: actionPath(id), payload,
    headers: { authorization: bearer, 'idempotency-key': key },
  })
  const httpPost = (id: string, payload: Command, key: string, signal?: AbortSignal) => fetch(base + actionPath(id), {
    method: 'POST', signal, body: JSON.stringify(payload),
    headers: { authorization, 'idempotency-key': key, 'content-type': 'application/json' },
  })
  const actions = (id: string) => database.db.select().from(gameActions)
    .where(eq(gameActions.sessionId, id)).orderBy(gameActions.sequence)
  const snapshots = (id: string) => database.db.select().from(gameSnapshots)
    .where(eq(gameSnapshots.sessionId, id)).orderBy(gameSnapshots.stateVersion)
  const session = async (id: string) => (await database.db.select().from(gameSessions).where(eq(gameSessions.id, id)))[0]
  const results = (id: string) => database.db.select().from(gameResults).where(eq(gameResults.sessionId, id))

  await t.test('strict command validation, phase checks and ownership do not mutate state', async () => {
    const id = await createSession()
    const initial = await snapshots(id)
    const action = command('advance', 0)
    const unauthorized = await app.inject({ method: 'POST', url: actionPath(id), payload: action })
    assert.equal(unauthorized.statusCode, 401)
    const denied = await post(id, action, randomUUID(), other)
    assert.equal(denied.statusCode, 404)
    assert.deepEqual(denied.json(), (await post(randomUUID(), action, randomUUID(), other)).json())
    for (const invalid of [
      command('trade', 0), command('advance', 0, { seed: 'x', cash: 0 }),
      command('choose', 0, { optionId: 'course-made-up' }), command('advance', -1),
      command('advance', 0.5), { ...action, state: {} }, { ...action, payload: [] },
    ]) {
      assert.equal((await post(id, invalid)).statusCode, 400)
    }
    assert.equal((await post(id, action, 'invalid-key')).statusCode, 400)
    const rejected = await post(id, command('roll', 0))
    assert.equal(rejected.statusCode, 422, rejected.body)
    assert.equal(rejected.json().error.code, 'ACTION_NOT_ALLOWED')
    assert.equal((await session(id)).stateVersion, 0)
    assert.deepEqual(await actions(id), [])
    assert.deepEqual(await snapshots(id), initial)
  })

  await t.test('concurrent same key commits once and historical retry survives later actions', async () => {
    const id = await createSession()
    const key = randomUUID()
    const original = command('advance', 0)
    const responses = await Promise.all([post(id, original, key), post(id, original, key)])
    assert.deepEqual(responses.map(response => response.statusCode), [200, 200])
    assert.deepEqual(responses[0].json(), responses[1].json())
    assert.equal(responses[0].json().state.phase, 'rolling')
    const rolled = await post(id, command('roll', 1))
    assert.equal(rolled.statusCode, 200, rolled.body)
    assert.equal(rolled.json().state.turn, 1)
    assert.deepEqual((await post(id, original, key)).json(), responses[0].json())
    assert.equal((await session(id)).stateVersion, 2)
    assert.equal((await actions(id)).length, 2)
    assert.equal((await snapshots(id)).length, 3)
    for (const changed of [command('roll', 0), command('advance', 1)]) {
      const conflict = await post(id, changed, key)
      assert.equal(conflict.statusCode, 409)
      assert.equal(conflict.json().error.code, 'IDEMPOTENCY_KEY_REUSED')
    }
  })

  await t.test('row lock serializes distinct keys and rejects stale versions', async () => {
    const id = await createSession()
    const responses = await Promise.all([post(id, command('advance', 0)), post(id, command('advance', 0))])
    assert.deepEqual(responses.map(response => response.statusCode).sort(), [200, 409])
    const conflict = responses.find(response => response.statusCode === 409)!
    assert.equal(conflict.json().error.code, 'STATE_VERSION_CONFLICT')
    const stale = await post(id, command('roll', 0))
    assert.deepEqual(stale.json(), conflict.json())
    assert.equal((await actions(id)).length, 1)
    assert.equal((await session(id)).stateVersion, 1)
  })

  await t.test('client timeout while waiting for a lock can retry the same action', async () => {
    const id = await createSession()
    const key = randomUUID()
    const blocker = await database.pool.connect()
    const controller = new AbortController()
    let request: Promise<unknown> | undefined
    try {
      await blocker.query('BEGIN')
      await blocker.query('SELECT id FROM game_sessions WHERE id = $1 FOR UPDATE', [id])
      request = httpPost(id, command('advance', 0), key, controller.signal).then(() => null, (error: unknown) => error)
      let waiting = false
      for (let attempt = 0; attempt < 100; attempt++) {
        const blocked = await admin.pool.query(
          "SELECT 1 FROM pg_stat_activity WHERE datname = $1 AND wait_event_type = 'Lock' AND query LIKE '%for update%'",
          [name],
        )
        if (blocked.rowCount) { waiting = true; break }
        await delay(20)
      }
      assert.ok(waiting, 'HTTP action reached the PostgreSQL row lock')
    } finally {
      controller.abort(new DOMException('Client deadline', 'TimeoutError'))
      // Release the row before awaiting browser-side cancellation. The server can still finish the request.
      try { await blocker.query('ROLLBACK') } finally { blocker.release() }
    }

    const error = await request
    assert.ok(error instanceof DOMException)
    assert.equal(error.name, 'TimeoutError')
    const retried = await post(id, command('advance', 0), key)
    assert.equal(retried.statusCode, 200, retried.body)
    assert.equal(retried.json().stateVersion, 1)
    assert.equal((await actions(id)).length, 1)
    assert.equal((await snapshots(id)).length, 2)
  })

  await t.test('lost HTTP response after commit returns the stored result on retry', async () => {
    const id = await createSession()
    const payload = command('advance', 0)
    await assert.rejects(httpPost(id, payload, lostKey))
    assert.equal((await session(id)).stateVersion, 1)
    assert.equal((await actions(id))[0].idempotencyKey, lostKey)
    const retry = await post(id, payload, lostKey)
    assert.equal(retry.statusCode, 200)
    assert.equal(retry.json().stateVersion, 1)
    assert.equal((await actions(id)).length, 1)
  })

  await t.test('snapshot write failure rolls back action and version and permits retry', async () => {
    const id = await createSession()
    const key = randomUUID()
    await database.pool.query('ALTER TABLE game_snapshots ADD CONSTRAINT test_no_snapshot CHECK (false) NOT VALID')
    try {
      const failure = await post(id, command('advance', 0), key)
      assert.equal(failure.statusCode, 500, failure.body)
      assert.equal((await session(id)).stateVersion, 0)
      assert.deepEqual(await actions(id), [])
      assert.equal((await snapshots(id)).length, 1)
    } finally {
      await database.pool.query('ALTER TABLE game_snapshots DROP CONSTRAINT test_no_snapshot')
    }
    assert.equal((await post(id, command('advance', 0), key)).statusCode, 200)
  })

  await t.test('PostgreSQL cancels a blocked snapshot INSERT and the same action key retries once', async () => {
    const id = await createSession()
    const key = randomUUID()
    const payload = command('advance', 0)
    const blocker = await database.pool.connect()
    let blocked: { pid: number; blockers: number[] } | undefined
    let request: ReturnType<typeof post> | undefined
    try {
      await blocker.query('BEGIN')
      const { rows: [{ pid }] } = await blocker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
      await blocker.query('LOCK TABLE game_snapshots IN SHARE MODE')
      request = post(id, payload, key)
      for (let attempt = 0; attempt < 50 && !blocked; attempt++) {
        const { rows } = await admin.pool.query<{ pid: number; blockers: number[] }>(
          "SELECT pid, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE datname = $1 AND wait_event_type = 'Lock' AND query LIKE 'insert into %game_snapshots%'",
          [name],
        )
        blocked = rows[0]
        if (!blocked) await delay(30)
      }
      assert.ok(blocked?.blockers.includes(pid))
      const response = await request
      assert.equal(response.statusCode, 500, response.body)
      assert.equal((await session(id)).stateVersion, 0)
      assert.equal((await actions(id)).length, 0)
      assert.equal((await snapshots(id)).length, 1)
    } finally {
      try { await blocker.query('ROLLBACK') } finally { blocker.release() }
      await request
    }
    const retry = await post(id, payload, key)
    assert.equal(retry.statusCode, 200, retry.body)
    assert.equal(retry.json().stateVersion, 1)
    assert.equal((await post(id, payload, key)).statusCode, 200)
    assert.equal((await actions(id)).length, 1)
    assert.equal((await snapshots(id)).length, 2)
  })

  await t.test('database disconnect recovers and an interrupted write can retry safely', async () => {
    const id = await createSession()
    const key = randomUUID()
    await admin.pool.query('ALTER DATABASE ' + identifier + ' ALLOW_CONNECTIONS false')
    try {
      await admin.pool.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1', [name])
      assert.equal((await app.inject('/ready')).statusCode, 503)
      const failed = await post(id, command('advance', 0), key)
      assert.equal(failed.statusCode, 500)
      assert.equal(failed.json().error.code, 'INTERNAL_ERROR')
    } finally {
      await admin.pool.query('ALTER DATABASE ' + identifier + ' ALLOW_CONNECTIONS true')
    }
    assert.equal((await app.inject('/ready')).statusCode, 200)
    assert.equal((await session(id)).stateVersion, 0)
    assert.equal((await post(id, command('advance', 0), key)).statusCode, 200)
    assert.equal((await actions(id)).length, 1)
  })

  await t.test('terminating the action connection during a write rolls back the transaction', async () => {
    const id = await createSession()
    const key = randomUUID()
    const blocker = await database.pool.connect()
    let request: ReturnType<typeof post> | undefined
    try {
      await blocker.query('BEGIN')
      await blocker.query('LOCK TABLE game_snapshots IN SHARE MODE')
      request = post(id, command('advance', 0), key)
      let pid: number | undefined
      for (let attempt = 0; attempt < 100; attempt++) {
        const blocked = await admin.pool.query<{ pid: number }>(
          "SELECT pid FROM pg_stat_activity WHERE datname = $1 AND wait_event_type = 'Lock' AND query LIKE 'insert into %game_snapshots%'",
          [name],
        )
        pid = blocked.rows[0]?.pid
        if (pid) break
        await delay(20)
      }
      assert.ok(pid, 'The action inserted its log row and is waiting to write the snapshot')
      await admin.pool.query('SELECT pg_terminate_backend($1)', [pid])
      assert.equal((await request).statusCode, 500)
    } finally {
      try { await blocker.query('ROLLBACK') } finally { blocker.release() }
      await request
    }
    assert.equal((await session(id)).stateVersion, 0)
    assert.deepEqual(await actions(id), [])
    assert.equal((await snapshots(id)).length, 1)
    assert.equal((await post(id, command('advance', 0), key)).statusCode, 200)
    assert.equal((await actions(id)).length, 1)
  })

  await t.test('losing a checked-out PostgreSQL connection does not crash the API', async () => {
    const checkedOut = await database.pool.connect()
    try {
      const backend = await checkedOut.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
      const ended = new Promise<void>(resolve => checkedOut.once('end', resolve))
      await admin.pool.query('SELECT pg_terminate_backend($1)', [backend.rows[0].pid])
      await ended
      await assert.rejects(checkedOut.query('SELECT 1'))
    } finally {
      checkedOut.release()
    }
    assert.equal((await app.inject('/ready')).statusCode, 200)
  })

  await t.test('plays a complete B18 game, verifies all snapshots and writes the official result atomically', async () => {
    const id = await createSession()
    // Known canonical genesis in the disposable test database gives reproducible event and market coverage.
    const seed = '00000000000000000000000000000000'
    const initial = createMultiCourseGame(seed)
    await database.db.transaction(async tx => {
      await tx.update(gameSessions).set({ seed }).where(eq(gameSessions.id, id))
      await tx.update(gameSnapshots).set({ payload: serializeLog(initial) }).where(eq(gameSnapshots.sessionId, id))
    })

    let game = initial
    let version = 0
    let finalCommand: Command | undefined
    let finalKey = ''
    let finalResponse: unknown
    let choice: Command | undefined
    let choiceKey = ''
    while (game.phase !== 'finished' && version < 150) {
      const key = randomUUID()
      let action: Command
      let next
      if (game.phase === 'rolling') {
        action = command('roll', version)
        next = roll(game)
      } else if (game.phase === 'event') {
        const event = eventsForGame(game).find(event => event.id === game.eventId)!
        const options = event.options.map(option => option.id)
        const optionId = ['course-basic', 'course-advanced', 'skip', 'acknowledge', 'defer', 'temporary']
          .find(id => options.includes(id) && canChoose(game, id))
        assert.ok(optionId, event.id)
        action = command('choose', version, { optionId })
        next = decide(game, optionId)
        choice = action
        choiceKey = key
      } else {
        action = command('advance', version)
        next = advance(game)
      }
      assert.notEqual(game, next, game.phase)

      if (next.phase === 'finished') {
        await database.pool.query('ALTER TABLE game_results ADD CONSTRAINT test_no_result CHECK (false) NOT VALID')
        try {
          const failed = await post(id, action, key)
          assert.equal(failed.statusCode, 500, failed.body)
          assert.equal((await session(id)).stateVersion, version)
          assert.equal((await session(id)).status, 'active')
          assert.equal((await actions(id)).length, version)
          const snapshotCount = await database.db.$count(gameSnapshots, eq(gameSnapshots.sessionId, id))
          assert.equal(snapshotCount, version + 1)
          assert.deepEqual(await results(id), [])
        } finally {
          await database.pool.query('ALTER TABLE game_results DROP CONSTRAINT test_no_result')
        }
      }

      const response = await post(id, action, key)
      assert.equal(response.statusCode, 200, response.body)
      const value = response.json()
      assert.equal(value.stateVersion, version + 1)
      assert.equal(value.sessionId, id)
      assert.equal(value.state.phase, next.phase)
      assert.equal(value.state.dice, next.dice)
      assert.deepEqual(value.state.portfolio, next.portfolio)
      assert.deepEqual(value.state.market.appliedShocks, next.market.appliedShocks)
      assert.equal(value.state.market.gold.currentPrice, next.market.gold.currentPrice)
      assert.deepEqual(value.state.market.stocks.map((stock: { currentPrice: number }) => stock.currentPrice),
        next.market.stocks.map(stock => stock.currentPrice))
      assert.doesNotMatch(response.body, /"(seed|rng|historySeed|priceHistory|jitter|log|settlement)"\s*:/)
      assert.equal(value.result === null, next.phase !== 'finished')
      if (next.phase === 'finished') {
        finalCommand = action
        finalKey = key
        finalResponse = value
      }
      game = next
      version++
    }
    assert.ok(finalCommand && choice)
    assert.equal(game.phase, 'finished')
    assert.equal(game.summaries.length, 4)
    assert.deepEqual(game.ownedCourses, ['basic', 'advanced'])
    assert.ok(game.market.appliedShocks.length > 0)
    assert.deepEqual(game.market.normalLaps, [1, 2, 3, 4])

    const history = await actions(id)
    const saved = await database.db.select({
      stateVersion: gameSnapshots.stateVersion,
      digest: sql<string>`encode(sha256(convert_to(${gameSnapshots.payload}, 'UTF8')), 'hex')`,
    }).from(gameSnapshots).where(eq(gameSnapshots.sessionId, id)).orderBy(gameSnapshots.stateVersion)
    const digest = (state: typeof game) => createHash('sha256').update(serializeLog(state)).digest('hex')
    let replay = createMultiCourseGame(seed)
    assert.equal(history.length, version)
    assert.equal(saved.length, version + 1)
    assert.equal(saved[0].digest, digest(replay))
    for (const [index, row] of history.entries()) {
      assert.equal(row.sequence, index + 1)
      assert.equal(row.engineVersion, b18Scenario.engineVersion)
      assert.equal(row.resultVersion, b18Scenario.resultVersion)
      if (row.actionType === 'advance') replay = advance(replay)
      else if (row.actionType === 'roll') replay = roll(replay)
      else {
        assert.equal(row.actionType, 'choose')
        assert.equal(typeof row.payload.optionId, 'string')
        replay = decide(replay, row.payload.optionId as string)
      }
      assert.equal(saved[row.sequence].stateVersion, row.sequence)
      assert.equal(saved[row.sequence].digest, digest(replay), 'Snapshot parity at action ' + row.sequence)
    }
    const [terminalSnapshot] = await database.db.select().from(gameSnapshots)
      .where(eq(gameSnapshots.sessionId, id)).orderBy(sql`${gameSnapshots.stateVersion} desc`).limit(1)
    const finalSnapshot = terminalSnapshot.payload
    // The canonical JSON format represents engine -0 values as 0.
    assert.equal(digest(restoreSavedGame(finalSnapshot)), digest(game))
    assert.equal(digest(replayGameLog(JSON.parse(finalSnapshot))), digest(game))
    const result = (await results(id))[0]
    assert.equal((await session(id)).status, 'completed')
    assert.equal(result.stateVersion, version)
    assert.equal(result.outcome, victory(game).won ? 'victory' : 'defeat')
    assert.equal(result.lawfulProceedsVnd, BigInt(liquidatableFunds(game)))
    assert.deepEqual((await post(id, finalCommand, finalKey)).json(), finalResponse)
    const changed = await post(id, { ...choice, payload: { optionId: choice.payload.optionId === 'skip' ? 'acknowledge' : 'skip' } }, choiceKey)
    assert.equal(changed.statusCode, 409)
    assert.equal(changed.json().error.code, 'IDEMPOTENCY_KEY_REUSED')
    const finished = await post(id, command('roll', version))
    assert.equal(finished.statusCode, 409)
    assert.equal(finished.json().error.code, 'SESSION_NOT_ACTIVE')
    assert.equal((await actions(id)).length, version)
    assert.equal((await results(id)).length, 1)
  })
})
