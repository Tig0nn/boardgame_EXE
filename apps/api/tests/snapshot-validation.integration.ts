import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { PgDialect } from 'drizzle-orm/pg-core'
import { localDatabaseUrl } from '../src/config.ts'
import { createDatabase } from '../src/db/client.ts'
import { migrateDatabase, verifyMigrationJournal } from '../src/db/migrations.ts'
import { createGameSession } from '../src/services/game-sessions.ts'
import { transitionB18 } from '../src/services/b18-actions.ts'
import { gameActionBody } from '../src/validation.ts'
import { snapshotPayloadForInsert } from '../src/repositories/snapshot-payload.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { serializeLog } from '../../../src/game/log.ts'

const hash = (text: string) => createHash('sha256').update(text).digest('hex')

test('single-pass snapshot validation upgrades legacy rows without rewriting schema 7 bytes', async t => {
  const url = localDatabaseUrl(process.env.DATABASE_URL)
  const admin = createDatabase(url.href)
  const name = 'exe_snapshot_validation_' + randomUUID().replaceAll('-', '')
  url.pathname = '/' + name
  const database = createDatabase(url.href)
  const folder = await mkdtemp(join(tmpdir(), 'exe-snapshot-legacy-'))
  let created = false
  t.after(async () => {
    await database.close()
    try { if (created) await admin.pool.query('DROP DATABASE "' + name + '"') }
    finally {
      await admin.close()
      assert.ok(resolve(folder).startsWith(resolve(tmpdir(), 'exe-snapshot-legacy-')))
      await rm(folder, { recursive: true, force: true })
    }
  })
  await admin.pool.query('CREATE DATABASE "' + name + '" TEMPLATE template0')
  created = true
  await mkdir(join(folder, 'meta'))
  const source = new URL('../drizzle/', import.meta.url)
  const journal = JSON.parse(await readFile(new URL('meta/_journal.json', source), 'utf8'))
  journal.entries = journal.entries.slice(0, 5)
  await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify(journal))
  for (const { tag } of journal.entries) await copyFile(new URL(tag + '.sql', source), join(folder, tag + '.sql'))
  await migrate(database.db, { migrationsFolder: folder })
  const { session } = await createGameSession(database.db, randomUUID(), randomUUID(), { initialSavings: 0, savingsTerm: 1 })
  const before = await database.pool.query('SELECT payload FROM game_snapshots WHERE session_id=$1', [session.id])
  await migrateDatabase(database.db)

  await t.test('checks the large JSON document once per row', async () => {
    const { rows: [constraint] } = await database.pool.query<{ definition: string; convalidated: boolean }>(
      "SELECT pg_get_constraintdef(oid) AS definition,convalidated FROM pg_constraint WHERE conrelid='game_snapshots'::regclass AND conname='game_snapshots_schema_version_check'",
    )
    assert.equal((constraint.definition.match(/::jsonb/g) ?? []).length, 1,
      'Parsing a complete snapshot twice doubles validation work; keep one document conversion')
    assert.equal(constraint.convalidated, true)
  })
  await t.test('keeps old snapshots, migration hashes, and idempotent migrations intact', async () => {
    assert.equal((await database.pool.query('SELECT payload FROM game_snapshots WHERE session_id=$1', [session.id])).rows[0].payload, before.rows[0].payload)
    await migrateDatabase(database.db)
    const client = await database.pool.connect()
    try {
      await verifyMigrationJournal(client)
      assert.equal((await client.query('SHOW statement_timeout')).rows[0].statement_timeout, '5s')
      assert.equal((await client.query('SHOW lock_timeout')).rows[0].lock_timeout, '0')
    } finally { client.release() }
  })
  await t.test('retains the exact validation boundary for JSON objects and positive matching versions', async () => {
    const client = await database.pool.connect()
    try {
      await client.query('CREATE TEMP TABLE validation_probe (version integer NOT NULL,payload text NOT NULL)')
      const { rows: [constraint] } = await client.query<{ definition: string }>(
        "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='game_snapshots'::regclass AND conname='game_snapshots_schema_version_check'",
      )
      const definition = constraint.definition.replaceAll('schema_version', 'version')
      await client.query('ALTER TABLE validation_probe ADD ' + definition)
      for (const [version, payload, valid] of [
        [7, '{"schemaVersion":7}', true], [4, '{"schemaVersion":4,"unicode":"Tiết kiệm 🧾"}', true],
        [7, '{"schemaVersion":7.0}', true], [7, '{"schemaVersion":6,"schemaVersion":7}', true],
        [7, '{}', false], [7, 'null', false], [7, '[]', false], [7, '[{"schemaVersion":7}]', false],
        [7, '"7"', false], [7, '7', false], [7, '{"schemaVersion":"7"}', false],
        [7, '{"schemaVersion":[7]}', false], [7, '{"schemaVersion":[7,8]}', false],
        [7, '{"schemaVersion":{"value":7}}', false], [7, '{"schemaVersion":true}', false],
        [7, '{"schemaVersion":7.1}', false], [7, '{"schemaVersion":null}', false],
        [0, '{"schemaVersion":0}', false], [-1, '{"schemaVersion":-1}', false],
      ] as const) {
        const write = () => client.query('INSERT INTO validation_probe VALUES($1,$2)', [version, payload])
        if (valid) await write()
        else await assert.rejects(write, { code: '23514' })
      }
      await assert.rejects(client.query('INSERT INTO validation_probe VALUES(7,$1)', ['not-json']), { code: '22P02' })
    } finally { client.release() }
  })
  await t.test('round-trips the recorded 9.16 MB and 16.59 MB canonical snapshots with two parameters', async () => {
    const fixture = JSON.parse(await readFile(new URL('./fixtures/android-b18-history.json', import.meta.url), 'utf8'))
    let game = createMultiCourseGame(fixture.seed, 0, 1)
    const client = await database.pool.connect()
    try {
      for (const entry of fixture.actions) {
        game = transitionB18(game, gameActionBody.parse({ actionId: entry.action_type, expectedStateVersion: entry.sequence - 1, payload: entry.payload }))
        if (![36, 60].includes(entry.sequence)) continue
        const payload = serializeLog(game)
        assert.equal(Buffer.byteLength(payload), entry.sequence === 36 ? 9_161_902 : 16_586_551)
        assert.equal(hash(payload), fixture.hashes.find((row: { state_version: number }) => row.state_version === entry.sequence).sha256)
        const expression = snapshotPayloadForInsert(payload)
        assert.notEqual(typeof expression, 'string')
        if (typeof expression === 'string') throw Error('Expected dictionary transport')
        const compiled = new PgDialect().sqlToQuery(expression)
        assert.equal(compiled.params.length, 2)
        const query = compiled.sql.replace(/\$(\d+)/g, (_, n: string) => '$' + (Number(n) + 1))
        await client.query('BEGIN')
        try {
          await client.query('INSERT INTO game_snapshots(session_id,state_version,schema_version,payload) VALUES($1,1,7,' + query + ')', [session.id, ...compiled.params])
          const saved = (await client.query('SELECT payload FROM game_snapshots WHERE session_id=$1 AND state_version=1', [session.id])).rows[0].payload
          assert.equal(saved, payload)
          assert.equal(hash(saved), hash(payload))
        } finally { await client.query('ROLLBACK') }
      }
    } finally { client.release() }
    assert.equal((await database.pool.query('SELECT count(*)::int AS n FROM game_snapshots WHERE session_id=$1', [session.id])).rows[0].n, 1)
  })
})
