import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { restoreSavedGame } from '../../../src/game/saved-game.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { buildApp } from '../src/app.ts'
import { localDatabaseUrl } from '../src/config.ts'
import { createDatabase } from '../src/db/client.ts'
import { migrateDatabase, verifyMigrationJournal } from '../src/db/migrations.ts'
import { gameSessions, gameSnapshots, profiles, scenarioVersions } from '../src/db/schema.ts'
import { b18Scenario } from '../src/services/b18.ts'
import { startJwtIssuer } from './jwks.ts'

test('V1 foundation on PostgreSQL', async t => {
  const url = localDatabaseUrl(process.env.DATABASE_URL)
  const admin = createDatabase(url.href)
  const name = 'exe_v1_test_' + randomUUID().replaceAll('-', '')
  let createdDatabase = false
  const testUrl = new URL(url)
  testUrl.pathname = '/' + name
  const database = createDatabase(testUrl.href)
  const issuer = await startJwtIssuer()
  const app = buildApp(database, issuer.config)

  t.after(async () => {
    try {
      await Promise.all([app.close(), issuer.close()])
      if (createdDatabase) await admin.pool.query('DROP DATABASE "' + name + '"')
    } finally {
      await admin.close()
    }
  })

  const legacyOwner = randomUUID()
  const legacyKey = randomUUID()
  const legacySeed = randomUUID().replaceAll('-', '')
  const legacySnapshot = serializeLog(createMultiCourseGame(legacySeed))

  const version = await admin.pool.query<{ server_version_num: string }>('SHOW server_version_num')
  assert.match(version.rows[0].server_version_num, /^\d+$/)
  await admin.pool.query('CREATE DATABASE "' + name + '" TEMPLATE template0')
  createdDatabase = true

  await t.test('applies V2D to existing V2C4 data and reruns safely', async () => {
    const publicTables = () => database.pool.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
    )
    assert.deepEqual((await publicTables()).rows, [])
    const preflight = await database.pool.connect()
    try {
      await verifyMigrationJournal(preflight)
      await preflight.query('BEGIN')
      await preflight.query('CREATE TABLE public.game_sessions (id integer)')
      await assert.rejects(verifyMigrationJournal(preflight), /Unmanaged game schema/)
    } finally {
      try { await preflight.query('ROLLBACK') } finally { preflight.release() }
    }
    const legacyFolder = await mkdtemp(join(tmpdir(), 'exe-v2d-migrations-'))
    const sourceFolder = fileURLToPath(new URL('../drizzle/', import.meta.url))
    try {
      await mkdir(join(legacyFolder, 'meta'))
      const journal = JSON.parse(await readFile(join(sourceFolder, 'meta', '_journal.json'), 'utf8'))
      journal.entries = journal.entries.slice(0, 3)
      await writeFile(join(legacyFolder, 'meta', '_journal.json'), JSON.stringify(journal))
      for (const { tag } of journal.entries) {
        await copyFile(join(sourceFolder, tag + '.sql'), join(legacyFolder, tag + '.sql'))
      }
      await migrate(database.db, { migrationsFolder: legacyFolder })
    } finally {
      await rm(legacyFolder, { recursive: true, force: true })
    }
    await database.pool.query('INSERT INTO profiles (user_id) VALUES ($1)', [legacyOwner])
    const { rows: [legacy] } = await database.pool.query<{ id: string }>(
      'INSERT INTO game_sessions (user_id, scenario_id, scenario_version, creation_key, seed) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [legacyOwner, b18Scenario.scenarioId, b18Scenario.version, legacyKey, legacySeed],
    )
    await database.pool.query('INSERT INTO game_snapshots (session_id, state_version, schema_version, payload) VALUES ($1, 0, 7, $2)',
      [legacy.id, legacySnapshot])

    await migrateDatabase(database.db)
    await migrateDatabase(database.db)
    const legacyHeaders = { authorization: 'Bearer ' + await issuer.sign(legacyOwner), 'idempotency-key': legacyKey }
    const retry = await app.inject({ method: 'POST', url: '/v1/game-sessions', headers: legacyHeaders, payload: { scenarioId: 'b18' } })
    assert.equal(retry.statusCode, 200)
    assert.equal(retry.json().session.id, legacy.id)
    assert.deepEqual(retry.json().session.setup, { initialSavings: 0, savingsTerm: 1 })
    const [storedSnapshot] = await database.db.select().from(gameSnapshots).where(eq(gameSnapshots.sessionId, legacy.id))
    assert.equal(storedSnapshot.payload, legacySnapshot)
    assert.deepEqual((await publicTables()).rows.map(row => row.tablename), [
      'admin_audit_logs', 'game_actions', 'game_results', 'game_sessions',
      'game_snapshots', 'profiles', 'scenario_versions',
    ])
    assert.deepEqual(await database.db.select().from(scenarioVersions), [b18Scenario])
    const applied = await database.pool.query('SELECT id FROM drizzle.__drizzle_migrations')
    assert.equal(applied.rowCount, 6)
    const client = await database.pool.connect()
    try {
      await verifyMigrationJournal(client)
      await client.query('BEGIN')
      await client.query("UPDATE drizzle.__drizzle_migrations SET hash = 'different' WHERE id = 1")
      await assert.rejects(verifyMigrationJournal(client), /Unexpected migration history/)
    } finally {
      try { await client.query('ROLLBACK') } finally { client.release() }
    }
  })

  await t.test('isolates direct SQL roles and allows the limited runtime to use the API tables', async () => {
    const client = await database.pool.connect()
    const privileges = await readFile(new URL('../drizzle/runtime-grants.sql', import.meta.url), 'utf8')
    try {
      // Role creation, grants and test writes are scoped to this transaction.
      await client.query('BEGIN')
      await client.query('CREATE ROLE exe_runtime NOLOGIN')
      await client.query(privileges)
      await client.query('SET LOCAL ROLE exe_runtime')
      const user = randomUUID()
      await client.query('INSERT INTO public.profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user])
      const { rowCount } = await client.query('SELECT user_id FROM public.profiles WHERE user_id = $1', [user])
      assert.equal(rowCount, 1)
      const stored = await client.query('SELECT id FROM public.game_sessions')
      assert.equal(stored.rowCount, 1)
      assert.equal((await client.query("SELECT has_table_privilege(current_user, 'public.game_sessions', 'DELETE') AS allowed")).rows[0].allowed, false)
      await client.query('RESET ROLE')
      await client.query('CREATE ROLE exe_browser_test NOLOGIN')
      await client.query('GRANT SELECT ON public.game_sessions, public.game_snapshots TO exe_browser_test')
      await client.query('SET LOCAL ROLE exe_browser_test')
      assert.equal((await client.query('SELECT id FROM public.game_sessions')).rowCount, 0)
      assert.equal((await client.query('SELECT payload FROM public.game_snapshots')).rowCount, 0)
    } finally {
      try { await client.query('ROLLBACK') } finally { client.release() }
    }
  })

  const userA = randomUUID()
  const userB = randomUUID()
  const headersA = { authorization: 'Bearer ' + await issuer.sign(userA) }
  const headersB = { authorization: 'Bearer ' + await issuer.sign(userB) }
  const path = '/v1/game-sessions'
  const key = randomUUID()
  const create = (headers: typeof headersA, idempotencyKey: string, setup?: object) => app.inject({
    method: 'POST', url: path, headers: { ...headers, 'idempotency-key': idempotencyKey },
    payload: { scenarioId: 'b18', ...(setup === undefined ? {} : { setup }) },
  })

  await t.test('serves health and readiness against PostgreSQL', async () => {
    const health = await app.inject('/health')
    assert.equal(health.statusCode, 200)
    assert.deepEqual(health.json(), { status: 'ok' })
    const ready = await app.inject('/ready')
    assert.equal(ready.statusCode, 200)
    assert.deepEqual(ready.json(), { status: 'ready' })
  })

  await t.test('requires a signed player JWT on each V1 endpoint', async () => {
    const protectedRoutes = [
      { method: 'GET', url: '/v1/me' },
      { method: 'GET', url: path },
      { method: 'GET', url: path + '/' + randomUUID() },
      { method: 'POST', url: path, payload: { scenarioId: 'b18' } },
    ] as const
    for (const route of protectedRoutes) {
      const response = await app.inject(route)
      assert.equal(response.statusCode, 401)
      assert.equal(response.headers['www-authenticate'], 'Bearer')
      assert.equal(response.json().error.code, 'UNAUTHORIZED')
    }
    const bad = await app.inject({
      url: '/v1/me', headers: { authorization: 'Bearer ' + await issuer.sign(userA, {}, true) },
    })
    assert.equal(bad.statusCode, 401)
    const first = await app.inject({ url: '/v1/me', headers: headersA })
    assert.equal(first.statusCode, 200)
    assert.equal(first.headers['cache-control'], 'no-store')
    const profile = first.json().profile
    assert.equal(profile.userId, userA)
    assert.deepEqual(Object.keys(profile).sort(), ['createdAt', 'userId'])
    const second = await app.inject({ url: '/v1/me', headers: headersA })
    assert.deepEqual(second.json(), first.json())
  })

  let sessionId = ''
  await t.test('creates a canonical B18 session once under concurrent retries and restores it', async () => {
    const concurrent = await Promise.all([create(headersA, key), create(headersA, key)])
    assert.deepEqual(concurrent.map(response => response.statusCode).sort(), [200, 201])
    const [left, right] = concurrent
    const session = left.json().session
    sessionId = session.id
    assert.deepEqual(left.json(), right.json())
    assert.equal(left.headers.location, path + '/' + sessionId)
    assert.equal(session.status, 'active')
    assert.equal(session.stateVersion, 0)
    assert.deepEqual(session.setup, { initialSavings: 0, savingsTerm: 1 })
    const retry = await create(headersA, key, { initialSavings: 0, savingsTerm: 1 })
    assert.equal(retry.statusCode, 200)
    assert.deepEqual(retry.json(), left.json())
    assert.equal(session.tiles, 18)
    assert.equal(session.laps, 4)
    assert.equal(session.gameplayProfile, b18Scenario.gameplayProfile)
    assert.equal(session.engineVersion, b18Scenario.engineVersion)
    assert.equal(session.resultVersion, b18Scenario.resultVersion)
    for (const hidden of ['seed', 'userId', 'creationKey', 'payload']) {
      assert.equal(Object.hasOwn(session, hidden), false)
    }

    const [stored] = await database.db.select().from(gameSessions).where(eq(gameSessions.id, sessionId))
    assert.equal(stored.userId, userA)
    const snapshots = await database.db.select().from(gameSnapshots).where(eq(gameSnapshots.sessionId, sessionId))
    assert.equal(snapshots.length, 1)
    assert.equal(snapshots[0].schemaVersion, 7)
    assert.equal(snapshots[0].stateVersion, 0)
    assert.match(stored.seed, /^[a-f0-9]{32}$/)
    assert.equal(snapshots[0].payload, serializeLog(createMultiCourseGame(stored.seed)))
    assert.equal(restoreSavedGame(snapshots[0].payload).seed, stored.seed)

    const detail = await app.inject({ url: path + '/' + sessionId, headers: headersA })
    assert.equal(detail.statusCode, 200)
    assert.deepEqual(detail.json().session, session)
  })

  await t.test('isolates two players and applies bounded list pagination', async () => {
    const ownB = await create(headersB, key)
    assert.equal(ownB.statusCode, 201)
    assert.notEqual(ownB.json().session.id, sessionId)
    const response = await app.inject({ url: path + '/' + sessionId, headers: headersB })
    const unknown = await app.inject({ url: path + '/' + randomUUID(), headers: headersB })
    assert.equal(response.statusCode, 404)
    assert.deepEqual(response.json(), unknown.json())

    const listB = await app.inject({ url: path, headers: headersB })
    assert.equal(listB.statusCode, 200)
    assert.deepEqual(listB.json().sessions.map((session: { id: string }) => session.id), [ownB.json().session.id])
    assert.equal(listB.json().limit, 20)
    const ownA = await create(headersA, randomUUID())
    assert.equal(ownA.statusCode, 201)
    const page = await app.inject({ url: path + '?limit=1&offset=1', headers: headersA })
    assert.equal(page.statusCode, 200)
    assert.equal(page.json().limit, 1)
    assert.equal(page.json().offset, 1)
    assert.deepEqual(page.json().sessions.map((session: { id: string }) => session.id), [sessionId])
  })

  await t.test('stores setup and balances for each term and the inclusive capital boundaries', async () => {
    for (const [initialSavings, savingsTerm] of [[0, 3], [1, 1], [10_000_000, 1], [20_000_000, 2], [50_000_000, 3]] as const) {
      const setup = { initialSavings, savingsTerm }
      const created = await create(headersA, randomUUID(), setup)
      assert.equal(created.statusCode, 201)
      const { session } = created.json()
      assert.deepEqual(session.setup, setup)
      const [row] = await database.db.select().from(gameSessions).where(eq(gameSessions.id, session.id))
      assert.equal(row.initialSavings, initialSavings)
      assert.equal(row.savingsTerm, savingsTerm)
      const [genesis] = await database.db.select().from(gameSnapshots).where(eq(gameSnapshots.sessionId, session.id))
      assert.equal(genesis.payload, serializeLog(createMultiCourseGame(row.seed, initialSavings, savingsTerm)))
      const loaded = await app.inject({ url: path + '/' + session.id, headers: headersA })
      assert.equal(loaded.statusCode, 200)
      const { state } = loaded.json()
      assert.deepEqual(loaded.json().session.setup, setup)
      assert.equal(state.portfolio.cash, 50_000_000 - initialSavings)
      assert.equal(state.portfolio.savings, initialSavings)
      assert.equal(state.bank.netWorth, 50_000_000)
      assert.equal(state.bank.liquidatableFunds, 50_000_000)
      assert.deepEqual(state.bank.deposits, initialSavings ? [{
        id: 'deposit-1', principal: initialSavings, startLap: 1, maturityLap: savingsTerm,
        rate: [0, 0.04, 0.05, 0.06][savingsTerm], status: 'active', earnedInterest: 0,
      }] : [])
    }
  })

  await t.test('conflicts on concurrent creation with different setup under the same owner and key', async () => {
    const raceKey = randomUUID()
    const options = [{ initialSavings: 10_000_000, savingsTerm: 1 }, { initialSavings: 20_000_000, savingsTerm: 3 }]
    const pair = await Promise.all(options.map(setup => create(headersA, raceKey, setup)))
    assert.deepEqual(pair.map(response => response.statusCode).sort(), [201, 409])
    const winnerIndex = pair.findIndex(response => response.statusCode === 201)
    const { session } = pair[winnerIndex].json()
    assert.equal(pair[1 - winnerIndex].json().error.code, 'IDEMPOTENCY_KEY_REUSED')
    const retry = await create(headersA, raceKey, options[winnerIndex])
    assert.equal(retry.statusCode, 200)
    assert.deepEqual(retry.json().session, session)
    const otherOwner = await create(headersB, raceKey, options[1 - winnerIndex])
    assert.equal(otherOwner.statusCode, 201)
    assert.notEqual(otherOwner.json().session.id, session.id)
    const denied = await app.inject({ url: path + '/' + session.id, headers: headersB })
    assert.equal(denied.statusCode, 404)
    const stored = await database.db.select().from(gameSnapshots).where(eq(gameSnapshots.sessionId, session.id))
    assert.equal(stored.length, 1)
  })

  await t.test('rejects invalid input, player-supplied state, and oversized bodies', async () => {
    const postHeaders = { ...headersA, 'idempotency-key': randomUUID(), 'content-type': 'application/json' }
    const invalidBodies = [
      {},
      { scenarioId: 'first-job' },
      { scenarioId: 'b18', userId: userB },
      { scenarioId: 'b18', cash: 1, portfolio: {}, won: true },
      { scenarioId: 'b18', seed: 'client-seed' },
      { scenarioId: 'b18', setup: { initialSavings: 50_000_001, savingsTerm: 3 } },
      { scenarioId: 'b18', setup: { initialSavings: '20000000', savingsTerm: 2 } },
      { scenarioId: 'b18', setup: { initialSavings: 1, savingsTerm: 4 } },
      { scenarioId: 'b18', setup: { initialSavings: 1, savingsTerm: 1, seed: 'client-seed' } },
      '{"scenarioId":',
    ]
    for (const payload of invalidBodies) {
      const response = await app.inject({ method: 'POST', url: path, headers: postHeaders, payload })
      assert.equal(response.statusCode, 400)
      assert.deepEqual(response.json(), { error: { code: 'INVALID_REQUEST', message: 'Invalid request' } })
    }
    for (const url of [path + '/not-a-uuid', path + '?limit=101', path + '?offset=-1', path + '?userId=' + userB]) {
      const response = await app.inject({ url, headers: headersA })
      assert.equal(response.statusCode, 400)
    }
    const missingKey = await app.inject({ method: 'POST', url: path, headers: headersA, payload: { scenarioId: 'b18' } })
    assert.equal(missingKey.statusCode, 400)
    const large = await app.inject({
      method: 'POST', url: path, headers: postHeaders,
      payload: { scenarioId: 'b18', data: 'x'.repeat(16 * 1024) },
    })
    assert.equal(large.statusCode, 413)
    assert.equal(large.json().error.code, 'PAYLOAD_TOO_LARGE')
  })

  await t.test('PostgreSQL enforces session and action uniqueness, foreign keys, and version checks', async () => {
    await assert.rejects(database.pool.query(
      'INSERT INTO game_sessions (user_id, scenario_id, scenario_version, creation_key, seed) ' +
      'SELECT user_id, scenario_id, scenario_version, creation_key, seed FROM game_sessions WHERE id = $1',
      [sessionId],
    ), { code: '23505', constraint: 'game_sessions_user_creation_key_unique' })

    await assert.rejects(database.pool.query(
      'UPDATE game_sessions SET initial_savings = 50000001 WHERE id = $1', [sessionId],
    ), { code: '23514', constraint: 'game_sessions_initial_savings_check' })
    await assert.rejects(database.pool.query(
      'UPDATE game_sessions SET savings_term = 4 WHERE id = $1', [sessionId],
    ), { code: '23514', constraint: 'game_sessions_savings_term_check' })

    const writeAction = (id: string, sequence: number, actionKey: string) => database.pool.query(
      'INSERT INTO game_actions (session_id, sequence, idempotency_key, action_type, payload, engine_version, result_version) ' +
      "VALUES ($1, $2, $3, 'advance', '{}', $4, $5)",
      [id, sequence, actionKey, b18Scenario.engineVersion, b18Scenario.resultVersion],
    )
    const actionKey = randomUUID()
    await writeAction(sessionId, 1, actionKey)
    await assert.rejects(writeAction(sessionId, 1, randomUUID()), {
      code: '23505', constraint: 'game_actions_session_id_sequence_pk',
    })
    await assert.rejects(writeAction(sessionId, 2, actionKey), {
      code: '23505', constraint: 'game_actions_session_key_unique',
    })
    await assert.rejects(writeAction(randomUUID(), 1, randomUUID()), { code: '23503' })
    await assert.rejects(writeAction(sessionId, 0, randomUUID()), { code: '23514' })
    await assert.rejects(database.pool.query(
      "INSERT INTO game_snapshots (session_id, state_version, schema_version, payload) VALUES ($1, 2, 7, '{}')",
      [sessionId],
    ), { code: '23514', constraint: 'game_snapshots_schema_version_check' })
  })

  await t.test('retains signed integer VND and requires a final snapshot for each result', async () => {
    const result = (version: number, proceeds: string) => database.pool.query(
      'INSERT INTO game_results (session_id, state_version, outcome, lawful_proceeds_vnd, engine_version, result_version) ' +
      "VALUES ($1, $2, 'insolvent', $3, $4, $5)",
      [sessionId, version, proceeds, b18Scenario.engineVersion, b18Scenario.resultVersion],
    )
    await assert.rejects(result(1, '-1'), { code: '23503' })
    await database.pool.query(
      'INSERT INTO game_snapshots (session_id, state_version, schema_version, payload) ' +
      'SELECT session_id, 1, schema_version, payload FROM game_snapshots WHERE session_id = $1 AND state_version = 0',
      [sessionId],
    )
    await assert.rejects(result(1, '9007199254740992'), { code: '23514' })
    await result(1, '-1')
    await assert.rejects(result(1, '-2'), { code: '23505' })
    const stored = await database.pool.query<{ lawful_proceeds_vnd: string }>(
      'SELECT lawful_proceeds_vnd::text FROM game_results WHERE session_id = $1', [sessionId],
    )
    assert.equal(stored.rows[0].lawful_proceeds_vnd, '-1')
  })

  await t.test('rolls back profile and session if snapshot write fails, then retries', async () => {
    const user = randomUUID()
    const headers = { authorization: 'Bearer ' + await issuer.sign(user) }
    const rollbackKey = randomUUID()
    const setup = { initialSavings: 20_000_000, savingsTerm: 2 }
    await database.pool.query('ALTER TABLE game_snapshots ADD CONSTRAINT test_reject_snapshot CHECK (false) NOT VALID')
    try {
      const response = await create(headers, rollbackKey, setup)
      assert.equal(response.statusCode, 500)
      assert.deepEqual(response.json(), {
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      })
      assert.deepEqual(await database.db.select().from(profiles).where(eq(profiles.userId, user)), [])
      assert.deepEqual(await database.db.select().from(gameSessions).where(eq(gameSessions.userId, user)), [])
    } finally {
      await database.pool.query('ALTER TABLE game_snapshots DROP CONSTRAINT test_reject_snapshot')
    }
    const retried = await create(headers, rollbackKey, setup)
    assert.equal(retried.statusCode, 201)
    assert.deepEqual(retried.json().session.setup, setup)
  })

  await t.test('returns 503 readiness when PostgreSQL cannot open the configured database', async () => {
    const missing = new URL(testUrl)
    missing.pathname += '_missing'
    const disconnected = buildApp(createDatabase(missing.href))
    try {
      assert.equal((await disconnected.inject('/health')).statusCode, 200)
      const response = await disconnected.inject('/ready')
      assert.equal(response.statusCode, 503)
      assert.deepEqual(response.json(), {
        error: { code: 'DATABASE_UNAVAILABLE', message: 'Database unavailable' },
      })
    } finally {
      await disconnected.close()
    }
  })
})
