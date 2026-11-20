// Diagnostic benchmark only; never targets a cloud or existing gameplay database.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PgDialect } from 'drizzle-orm/pg-core'
import { localDatabaseUrl } from '../src/config.ts'
import { createDatabase } from '../src/db/client.ts'
import { transitionB18 } from '../src/services/b18-actions.ts'
import { gameActionBody } from '../src/validation.ts'
import { snapshotPayloadForInsert } from '../src/repositories/snapshot-payload.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { serializeLog } from '../../../src/game/log.ts'

const url = localDatabaseUrl(process.env.DATABASE_URL)
assert.equal(url.port, '55439', 'Use the isolated reliability container, not the EXE local database')
const admin = createDatabase(url.href, { max: 1 })
const name = 'exe_snapshot_measure_' + randomUUID().replaceAll('-', '')
url.pathname = '/' + name
const database = createDatabase(url.href, { max: 1, statement_timeout: 5000 })
let created = false
try {
  await admin.pool.query('CREATE DATABASE "' + name + '" TEMPLATE template0')
  created = true
  const client = await database.pool.connect()
  try {
    const version = (await client.query('SHOW server_version_num')).rows[0].server_version_num
    assert.equal(version, '170011')
    assert.equal((await client.query('SHOW statement_timeout')).rows[0].statement_timeout, '5s')
    await client.query("CREATE TEMP TABLE old_guard(payload text NOT NULL CHECK(jsonb_typeof(payload::jsonb)='object' AND (payload::jsonb->'schemaVersion'=to_jsonb(7)) IS TRUE))")
    await client.query("CREATE TEMP TABLE new_guard(payload text NOT NULL CHECK((payload::jsonb @> jsonb_build_object('schemaVersion',7)) IS TRUE))")
    const fixture = JSON.parse(await readFile(new URL('./fixtures/android-b18-history.json', import.meta.url), 'utf8'))
    let game = createMultiCourseGame(fixture.seed, 0, 1)
    for (const entry of fixture.actions) {
      game = transitionB18(game, gameActionBody.parse({ actionId: entry.action_type, expectedStateVersion: entry.sequence - 1, payload: entry.payload }))
      if (![36, 60].includes(entry.sequence)) continue
      const payload = serializeLog(game)
      const expression = snapshotPayloadForInsert(payload)
      if (typeof expression === 'string') throw Error('Expected existing dictionary transport')
      const compiled = new PgDialect().sqlToQuery(expression)
      const samples = { old_guard: [] as number[], new_guard: [] as number[] }
      for (let sample = 0; sample < 24; sample++) {
        for (const table of ['old_guard', 'new_guard'] as const) {
          await client.query('BEGIN')
          try {
            const result = await client.query('EXPLAIN (ANALYZE, FORMAT JSON) INSERT INTO ' + table + '(payload) VALUES(' + compiled.sql + ')', compiled.params)
            samples[table].push(result.rows[0]['QUERY PLAN'][0]['Execution Time'])
          } finally { await client.query('ROLLBACK') }
        }
      }
      const stats = (values: number[]) => {
        const sorted = [...values].sort((a, b) => a - b)
        const percentile = (p: number) => sorted[Math.ceil(sorted.length * p) - 1]
        return { n: sorted.length, p50_ms: percentile(.5), p95_ms: percentile(.95), p99_ms: null, max_ms: sorted.at(-1) }
      }
      console.log(JSON.stringify({ version: entry.sequence, bytes: Buffer.byteLength(payload), statementTimeout: '5s',
        scope: 'constraint plus reconstruction and TOAST; excludes HTTP and lock contention', old: stats(samples.old_guard), singleParse: stats(samples.new_guard) }))
    }
  } finally { client.release() }
} finally {
  await database.close()
  try { if (created) await admin.pool.query('DROP DATABASE "' + name + '"') }
  finally { await admin.close() }
}
