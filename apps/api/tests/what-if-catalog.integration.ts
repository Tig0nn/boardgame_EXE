import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, sep } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { eventsForGame } from '../../../src/data/events.ts'
import { canChoose } from '../../../src/game/engine.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import type { Term } from '../../../src/game/types.ts'
import { buildApp } from '../src/app.ts'
import { localDatabaseUrl } from '../src/config.ts'
import { createDatabase } from '../src/db/client.ts'
import { migrateDatabase } from '../src/db/migrations.ts'
import { gameActions, gameResults, gameSessions, profiles } from '../src/db/schema.ts'
import { ApiError } from '../src/errors.ts'
import { sessionRepository } from '../src/repositories/game-sessions.ts'
import { snapshotPayloadForInsert } from '../src/repositories/snapshot-payload.ts'
import { b18Scenario } from '../src/services/b18.ts'
import { officialB18Result, transitionB18 } from '../src/services/b18-actions.ts'
import { analyzeSavedGame } from '../src/services/what-if.ts'
import { WhatIfTrace } from '../src/services/what-if-timing.ts'
import type { WhatIfTiming } from '../src/services/what-if-timing.ts'
import { gameActionBody } from '../src/validation.ts'
import { startJwtIssuer } from './jwks.ts'
import { startWhatIfNetworkProxy, whatIfNetworkBytesPerSecond } from './what-if-network.ts'

type Fixture = {
  seed: string
  setup: { initialSavings: number; savingsTerm: Term }
  actions: { sequence: number; action_type: string; payload: Record<string, unknown> }[]
  hashes: { state_version: number; schema_version: number; sha256: string; bytes: number }[]
}

const hash = (payload: string) => createHash('sha256').update(payload).digest('hex')

test('Android B18 What-if catalog verifies all 60 actions without changing its canonical history', {
  timeout: process.env.EXE_WHATIF_BENCHMARK === '1' ? 600_000 : 180_000,
}, async t => {
  // The guard rejects cloud hosts and existing game databases. Every write below
  // targets a newly created, uniquely named disposable database on loopback.
  const url = localDatabaseUrl(process.env.DATABASE_URL)
  const admin = createDatabase(url.href)
  const name = 'exe_what_if_catalog_' + randomUUID().replaceAll('-', '')
  url.pathname = '/' + name
  const database = createDatabase(url.href)
  const issuer = await startJwtIssuer()
  const app = buildApp(database, issuer.config)
  let created = false
  t.after(async () => {
    try {
      await Promise.all([app.close(), issuer.close()])
      if (created) await admin.pool.query('DROP DATABASE "' + name + '"')
    } finally { await admin.close() }
  })
  await admin.pool.query('CREATE DATABASE "' + name + '" TEMPLATE template0')
  created = true
  await migrateDatabase(database.db)

  const fixture: Fixture = JSON.parse(await readFile(new URL('./fixtures/android-b18-history.json', import.meta.url), 'utf8'))
  assert.equal(fixture.actions.length, 60)
  assert.deepEqual(fixture.hashes.map(row => row.state_version), Array.from({ length: 61 }, (_, i) => i))
  assert.ok(fixture.hashes.every(row => row.schema_version === 7))
  const owner = randomUUID(), id = randomUUID()
  const authorization = 'Bearer ' + await issuer.sign(owner, { exp: Math.floor(Date.now() / 1000) + 240 })
  const outsider = 'Bearer ' + await issuer.sign(randomUUID(), { exp: Math.floor(Date.now() / 1000) + 240 })
  const path = '/v1/game-sessions/' + id + '/what-if'
  const catalog = (bearer = authorization, sessionId = id) => app.inject({
    method: 'GET', url: '/v1/game-sessions/' + sessionId + '/what-if', headers: { authorization: bearer },
  })
  const simulation = { stateVersion: 60, sequence: 53,
    alternative: { mode: 'replace', action: { actionId: 'choose', payload: { optionId: 'course-advanced' } } } }
  const simulate = (payload: object = simulation, bearer = authorization) => app.inject({
    method: 'POST', url: path, payload, headers: { authorization: bearer },
  })

  const expectedDecisions: { sequence: number; phase: string; lap: number; turn: number; position: number;
    eventId: string | null | undefined; original: { actionId: string; payload: Record<string, unknown> }; eventChoices: string[] }[] = []
  const saved = new Map<number, string>()
  let game = createMultiCourseGame(fixture.seed, fixture.setup.initialSavings, fixture.setup.savingsTerm)
  // Store engine-produced bytes through the normal dictionary transport; do not
  // import a saved final state or bypass the snapshot validation constraint.
  await database.db.transaction(async tx => {
    await tx.insert(profiles).values({ userId: owner })
    await tx.insert(gameSessions).values({ id, userId: owner, creationKey: randomUUID(), seed: fixture.seed,
      scenarioId: b18Scenario.scenarioId, scenarioVersion: b18Scenario.version, ...fixture.setup,
      stateVersion: 60, status: 'completed' })
    const store = async (version: number) => {
      const payload = serializeLog(game)
      const pin = fixture.hashes[version]
      assert.equal(hash(payload), pin.sha256, 'canonical snapshot ' + version)
      assert.equal(Buffer.byteLength(payload), pin.bytes, 'canonical snapshot bytes ' + version)
      await sessionRepository(tx).insertSnapshot({ sessionId: id, stateVersion: version, schemaVersion: 7, payload })
      if ([0, 52, 60].includes(version)) saved.set(version, payload)
    }
    await store(0)
    for (const entry of fixture.actions) {
      const action = gameActionBody.parse({ actionId: entry.action_type,
        expectedStateVersion: entry.sequence - 1, payload: entry.payload })
      if (action.actionId === 'choose' && entry.sequence !== 3) {
        const choices = eventsForGame(game).find(item => item.id === game.eventId)!.options
          .filter(option => option.id !== action.payload.optionId && canChoose(game, option.id)).map(option => option.id)
        expectedDecisions.push({ sequence: entry.sequence, phase: game.phase, lap: game.lap, turn: game.turn,
          position: game.position, eventId: game.eventId, original: { actionId: action.actionId, payload: action.payload }, eventChoices: choices })
      }
      const next = transitionB18(game, action)
      assert.notEqual(next, game, 'fixture action ' + entry.sequence + ' must progress')
      game = next
      await tx.insert(gameActions).values({ sessionId: id, sequence: entry.sequence, idempotencyKey: randomUUID(),
        actionType: entry.action_type, payload: entry.payload, engineVersion: b18Scenario.engineVersion, resultVersion: b18Scenario.resultVersion })
      await store(entry.sequence)
    }
    assert.deepEqual(officialB18Result(game), { outcome: 'defeat', lawfulProceedsVnd: '84000000' })
    await tx.insert(gameResults).values({ sessionId: id, stateVersion: 60, outcome: 'defeat', lawfulProceedsVnd: 84_000_000n,
      engineVersion: b18Scenario.engineVersion, resultVersion: b18Scenario.resultVersion })
  })

  const storedRows = async () => ({
    sessions: (await database.pool.query('SELECT * FROM game_sessions ORDER BY id')).rows,
    actions: (await database.pool.query('SELECT * FROM game_actions ORDER BY session_id,sequence')).rows,
    results: (await database.pool.query('SELECT * FROM game_results ORDER BY session_id')).rows,
    snapshots: (await database.pool.query('SELECT session_id,state_version,schema_version,created_at,octet_length(payload) AS bytes,' +
      "encode(sha256(convert_to(payload,'UTF8')),'hex') AS sha256 FROM game_snapshots ORDER BY session_id,state_version")).rows,
  })
  const before = await storedRows()
  assert.equal(before.sessions.length, 1)
  assert.equal(before.actions.length, 60)
  assert.equal(before.results.length, 1)
  assert.deepEqual(before.snapshots.map(({ state_version, schema_version, sha256, bytes }) => ({ state_version, schema_version, sha256, bytes })), fixture.hashes)

  await t.test('PostgreSQL UTF-8 SHA256 agrees with Node for Unicode and large poorly compressible text', async () => {
    const samples = ['', 'null', 'Tiếng Việt: Khởi nghiệp quán cà phê, tiết kiệm và lợi nhuận.',
      '🦊 ☕ 💰 🎲', '"quoted"\nnew line\r\ntab\tbackslash\\',
      randomBytes(4 * 1024 * 1024).toString('base64')]
    for (const payload of samples) {
      const { rows: [row] } = await database.pool.query<{ sha256: string }>(
        "SELECT encode(sha256(convert_to($1::text,'UTF8')),'hex') AS sha256", [payload])
      assert.equal(row.sha256, hash(payload), 'UTF-8 digest parity for ' + Buffer.byteLength(payload) + ' bytes')
    }
  })

  await t.test('returns the complete private decision catalog for the recorded Android history', async () => {
    const started = performance.now()
    const response = await catalog()
    t.diagnostic('Android catalog HTTP ' + Math.round(performance.now() - started) + ' ms; 16,586,551 byte final snapshot')
    assert.equal(response.statusCode, 200, response.body)
    assert.equal(response.headers['cache-control'], 'no-store')
    const body = response.json()
    assert.equal(body.stateVersion, 60)
    assert.equal(body.policy, 'retain-legal-then-required-v1')
    assert.deepEqual(body.decisions.map((entry: { sequence: number }) => entry.sequence),
      [5, 7, 9, 11, 13, 18, 20, 22, 24, 26, 28, 30, 32, 37, 39, 41, 43, 45, 51, 53, 55, 57])
    assert.deepEqual(body.decisions.map((entry: Omit<typeof expectedDecisions[number], 'eventChoices'> & { eventChoices: { optionId: string }[] }) => ({
      sequence: entry.sequence, phase: entry.phase, lap: entry.lap, turn: entry.turn, position: entry.position,
      eventId: entry.eventId, original: entry.original, eventChoices: entry.eventChoices.map(choice => choice.optionId),
    })), expectedDecisions)
    for (const entry of body.decisions) {
      assert.equal(entry.canOmit, false)
      if (['business', 'gold', 'bank', 'stocks', 'bonds'].includes(entry.eventId)) assert.ok(entry.tradeAlternatives.length > 0)
    }
    assert.doesNotMatch(response.body, /"(seed|rng|historySeed|snapshot|priceHistory)":/)
  })

  await t.test('checks ownership and stale simulation versions before analysis', async () => {
    const denied = await catalog(outsider)
    assert.equal(denied.statusCode, 404)
    assert.deepEqual(denied.json(), (await catalog(outsider, randomUUID())).json())
    assert.equal((await simulate(simulation, outsider)).statusCode, 404)
    const stale = await simulate({ ...simulation, stateVersion: 59 })
    assert.equal(stale.statusCode, 409, stale.body)
    assert.equal(stale.json().error.code, 'STATE_VERSION_CONFLICT')
    // Sequence one uses the verified genesis as its branch point. It still
    // selects an advance action, so the public contract rejects it as a fork.
    const genesisFork = await simulate({ ...simulation, sequence: 1 })
    assert.equal(genesisFork.statusCode, 422, genesisFork.body)
    assert.equal(genesisFork.json().error.code, 'WHAT_IF_INVALID_FORK')
  })

  for (const query of [
    { ...simulation, sequence: 5, alternative: { mode: 'replace', action: { actionId: 'choose', payload: { optionId: 'skip' } } } },
    simulation,
  ]) await t.test('simulates canonical alternative at decision ' + query.sequence + ' and preserves every row and hash', async () => {
    let alternative = createMultiCourseGame(fixture.seed, fixture.setup.initialSavings, fixture.setup.savingsTerm)
    for (const entry of fixture.actions) {
      const request = entry.sequence === query.sequence ? query.alternative.action
        : { actionId: entry.action_type, payload: entry.payload }
      const next = transitionB18(alternative, gameActionBody.parse({ ...request, expectedStateVersion: entry.sequence - 1 }))
      assert.notEqual(next, alternative, 'canonical alternative action ' + entry.sequence)
      alternative = next
    }
    const response = await simulate(query)
    assert.equal(response.statusCode, 200, response.body)
    const body = response.json()
    assert.equal(body.stateVersion, 60)
    assert.equal(body.sequence, query.sequence)
    assert.equal(body.status, 'completed')
    assert.equal(body.actual.lawfulProceedsVnd, '84000000')
    assert.equal(body.actual.outcome, 'defeat')
    assert.deepEqual(body.alternative.completedLaps, [1, 2, 3, 4])
    assert.equal(body.alternative.lawfulProceedsVnd, officialB18Result(alternative)!.lawfulProceedsVnd)
    assert.deepEqual(body.alternative.portfolio, alternative.portfolio)
    assert.equal(body.delta.lawfulProceedsVnd, String(BigInt(body.alternative.lawfulProceedsVnd) - 84_000_000n))
    assert.equal(body.continuation.notRetained, 0)
    assert.deepEqual(body.continuation.fallback, [])
    assert.equal(body.coach.source, 'verified-what-if-replay')
    assert.doesNotMatch(response.body, /"(seed|rng|historySeed|snapshot|priceHistory)":/)
    assert.deepEqual(await storedRows(), before)
  })

  async function replaceSnapshot(version: number, payload: string) {
    const expression = snapshotPayloadForInsert(payload)
    if (typeof expression === 'string') {
      await database.pool.query('UPDATE game_snapshots SET payload=$1 WHERE session_id=$2 AND state_version=$3', [expression, id, version])
    } else {
      const compiled = new PgDialect().sqlToQuery(expression)
      await database.pool.query('UPDATE game_snapshots SET payload=' + compiled.sql + ' WHERE session_id=$' + (compiled.params.length + 1) +
        ' AND state_version=$' + (compiled.params.length + 2), [...compiled.params, id, version])
    }
  }
  for (const [label, version, run] of [
    ['final', 60, catalog], ['genesis', 0, catalog], ['fork', 52, simulate],
  ] as const) {
    await t.test('rejects a tampered ' + label + ' snapshot after successful catalog verification', async () => {
      const original = saved.get(version)!
      const changed = JSON.parse(original)
      changed.state.portfolio.cash += 1
      try {
        await replaceSnapshot(version, JSON.stringify(changed, null, 2))
        const response = await run()
        assert.equal(response.statusCode, 500, response.body)
        assert.equal(response.json().error.code, 'INTERNAL_ERROR')
      } finally { await replaceSnapshot(version, original) }
    })
  }
  for (const [label, version, run] of [['genesis', 0, catalog], ['fork', 52, simulate]] as const) {
    await t.test('rejects a missing ' + label + ' snapshot without weakening the replay proof', async () => {
      try {
        await database.pool.query('DELETE FROM game_snapshots WHERE session_id=$1 AND state_version=$2', [id, version])
        const response = await run()
        assert.equal(response.statusCode, 500, response.body)
        assert.equal(response.json().error.code, 'INTERNAL_ERROR')
      } finally {
        const original = before.snapshots.find(row => row.state_version === version)!
        await sessionRepository(database.db).insertSnapshot({ sessionId: id, stateVersion: version, schemaVersion: 7,
          payload: saved.get(version)!, createdAt: original.created_at })
      }
    })
  }
  await t.test('rejects a tampered persisted action after successful catalog verification', async () => {
    try {
      await database.db.update(gameActions).set({ payload: { optionId: 'skip' } })
        .where(eq(gameActions.sequence, 5))
      const response = await catalog()
      assert.equal(response.statusCode, 500, response.body)
      assert.equal(response.json().error.code, 'INTERNAL_ERROR')
    } finally {
      await database.db.update(gameActions).set({ payload: fixture.actions[4].payload }).where(eq(gameActions.sequence, 5))
    }
    assert.equal((await catalog()).statusCode, 200)
    assert.deepEqual(await storedRows(), before)
  })

  if (process.env.EXE_WHATIF_BENCHMARK === '1') {
    await t.test('records optional local network sensitivity samples', async () => {
      const output = process.env.EXE_WHATIF_BENCHMARK_OUTPUT
      assert.ok(output && isAbsolute(output), 'Set an absolute private EXE_WHATIF_BENCHMARK_OUTPUT path outside Git')
      const root = fileURLToPath(new URL('../../../', import.meta.url))
      const outputRelative = relative(root, output)
      assert.ok(outputRelative.startsWith('..' + sep) || isAbsolute(outputRelative), 'Benchmark output must stay outside this checkout')
      const countText = process.env.EXE_WHATIF_BENCHMARK_SAMPLES ?? '20'
      assert.match(countText, /^(?:[1-9]|[12][0-9]|30)$/)
      const count = Number(countText)
      type Sample = { elapsedMs: number; status: number; errorCode?: string;
        responseBytes: number; dbBytes: number; events: WhatIfTiming[] }
      const results: { scenario: string; samples: Sample[]; fixtureFinalBytes: number; scope: string }[] = []
      for (const scenario of [
        { name: 'loopback', bytesPerSecond: undefined },
        { name: 'postgres-to-client-4MiB-per-second', bytesPerSecond: whatIfNetworkBytesPerSecond },
      ]) {
        const network = await startWhatIfNetworkProxy(url, scenario.bytesPerSecond)
        const measured = createDatabase(network.url.href, { max: 1 })
        try {
          const sample = async (): Promise<Sample> => {
            network.resetBytes()
            const events: WhatIfTiming[] = []
            const trace = new WhatIfTrace(event => events.push(event))
            const started = performance.now()
            let status = 200, errorCode: string | undefined, responseBytes = 0
            try {
              const value = await analyzeSavedGame(measured.db, owner, id, undefined, undefined, trace)
              const serialized = trace.sync('response_serialization', () => JSON.stringify(value))
              responseBytes = Buffer.byteLength(serialized)
            } catch (error) {
              status = error instanceof ApiError ? error.status : 500
              errorCode = error instanceof ApiError ? error.code : 'INTERNAL_ERROR'
            }
            return { elapsedMs: performance.now() - started, status, ...(errorCode ? { errorCode } : {}),
              responseBytes, dbBytes: network.bytes, events }
          }
          await sample()
          await sample()
          const samples: Sample[] = []
          for (let index = 0; index < count; index++) samples.push(await sample())
          results.push({ scenario: scenario.name, samples, fixtureFinalBytes: fixture.hashes[60].bytes,
            scope: 'local sensitivity model; not measured Render network' })
          await mkdir(dirname(output), { recursive: true })
          await writeFile(output, JSON.stringify(results, null, 2) + '\n', { mode: 0o600 })
        } finally {
          try { await measured.close() } finally { await network.close() }
        }
      }
      const bounded = results.find(result => result.scenario === 'postgres-to-client-4MiB-per-second')!
      // Preserve every failed sample and its stage/error evidence before this
      // opt-in resource contract fails on the unoptimized implementation.
      assert.ok(bounded.samples.every(sample => sample.status === 200),
        'The unchanged analysis budget must serve the Android catalog at 4 MiB/s: ' +
        JSON.stringify(bounded.samples.map(({ status, errorCode }) => ({ status, errorCode }))))
      assert.deepEqual(await storedRows(), before)
    })
  }
})
