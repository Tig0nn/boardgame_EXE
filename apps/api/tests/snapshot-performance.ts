import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { PgDialect } from 'drizzle-orm/pg-core'
import { createRequire } from 'node:module'
import { createDatabase } from '../src/db/client.ts'
import { localDatabaseUrl } from '../src/config.ts'
import { migrateDatabase } from '../src/db/migrations.ts'
import { snapshotPayloadForInsert } from '../src/repositories/snapshot-payload.ts'
import { createGameSession } from '../src/services/game-sessions.ts'
import { executeGameAction } from '../src/services/game-actions.ts'
import { loadGameState } from '../src/services/game-state.ts'
import { liquidatableFunds, victory } from '../../../src/game/selectors.ts'
import { advance, decide, fundPayment, roll } from '../../../src/game/engine.ts'
import { replayGameLog } from '../../../scripts/diagnostics/replay-game-log.ts'
import { gameActionBody } from '../src/validation.ts'
import type { GameActionRequest } from '../src/validation.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { publicB18State, transitionB18 } from '../src/services/b18-actions.ts'
import { serializeLog } from '../../../src/game/log.ts'
const setup = { initialSavings: 5_000_000, savingsTerm: 2 } as const
function plan(seed: string) {
  let game = createMultiCourseGame(seed, setup.initialSavings, setup.savingsTerm)
  const states = [game]
  const commands: GameActionRequest[] = []
  while (game.phase !== 'finished' && commands.length < 180) {
    const state = publicB18State(game)
    const expectedStateVersion = commands.length
    let command: GameActionRequest
    if (state.availableActions.includes('advance')) command = { expectedStateVersion, actionId: 'advance', payload: {} }
    else if (state.availableActions.includes('roll')) command = { expectedStateVersion, actionId: 'roll', payload: {} }
    else if (state.availableActions.includes('choose')) {
      const preferred = ['skip', 'acknowledge', 'defer', 'temporary'].find(id => state.options.some(option => option.id === id))
      command = { expectedStateVersion, actionId: 'choose', payload: { optionId: preferred ?? state.options[0].id } }
    } else if (state.availableActions.includes('fund')) {
      const option = ['cash', 'savings', 'debt', 'stocks', 'gold', 'bonds']
        .map(source => state.fundingOptions.find(item => item.source === source)).find(Boolean) ?? state.fundingOptions[0]
      command = gameActionBody.parse({
        expectedStateVersion, actionId: 'fund',
        payload: { source: option.source, amount: option.maxAmount, ...(option.lotId ? { lotId: option.lotId } : {}) },
      })
    } else break
    const next = transitionB18(game, command)
    if (next === game) break
    game = next
    commands.push(command)
    states.push(game)
  }
  return { states, commands, finished: game.phase === 'finished' && game.summaries.length === 4 }
}

const url = localDatabaseUrl(process.env.DATABASE_URL)
const admin = createDatabase(url.href)
const name = 'exe_snapshot_perf_' + randomUUID().replaceAll('-', '')
const identifier = '"' + name + '"'
url.pathname = '/' + name
const owner = createDatabase(url.href)
const runtimeOptions = {
  max: 4,
  statement_timeout: 5000,
  onConnect: async (client: Pick<import('pg').ClientBase, 'query'>) => { await client.query('SET ROLE exe_runtime') },
}
const runtime = createDatabase(url.href, runtimeOptions)
const dialect = new PgDialect()
const { utils: { prepareValue } } = createRequire(import.meta.url)('pg') as {
  utils: { prepareValue: (value: unknown) => string | Buffer | null }
}

type Sample = { operation: string; elapsedMs: number }
const samples: Sample[] = []
async function measure<T>(operation: string, work: () => Promise<T>) {
  const start = performance.now()
  try { return await work() }
  finally { samples.push({ operation, elapsedMs: performance.now() - start }) }
}

function digest(payload: string) {
  return createHash('sha256').update(payload).digest('hex')
}

function replayStep(game: ReturnType<typeof createMultiCourseGame>, command: GameActionRequest) {
  switch (command.actionId) {
    case 'advance': return advance(game)
    case 'roll': return roll(game)
    case 'choose': return decide(game, command.payload.optionId)
    case 'fund': return fundPayment(game, command.payload.source, command.payload.amount,
      'lotId' in command.payload ? command.payload.lotId : undefined)
    default: throw new Error('Unexpected benchmark action')
  }
}

function summarize() {
  const report: Record<string, { count: number; p50_ms: number; p95_ms: number | null; p99_ms: number | null; max_ms: number }> = {}
  for (const operation of new Set(samples.map(sample => sample.operation))) {
    const elapsed = samples.filter(sample => sample.operation === operation).map(sample => sample.elapsedMs).sort((a, b) => a - b)
    const percentile = (p: number) => Math.round(elapsed[Math.ceil(p * elapsed.length) - 1] * 10) / 10
    report[operation] = { count: elapsed.length, p50_ms: percentile(.50), p95_ms: elapsed.length >= 20 ? percentile(.95) : null,
      p99_ms: elapsed.length >= 100 ? percentile(.99) : null, max_ms: percentile(1) }
  }
  return report
}

async function runJourney() {
  const user = randomUUID()
  const key = randomUUID()
  const created = await measure('create', () => createGameSession(runtime.db, user, key, setup))
  const session = created.session.id
  const retry = await createGameSession(runtime.db, user, key, setup)
  assert.equal(retry.created, false)
  assert.equal(retry.session.id, session)
  const genesis = await loadGameState(runtime.db, user, session)
  const route = plan(genesis.game.seed)
  assert.ok(route.finished, 'Expected an entire four-lap B18 journey')
  const expectedDigests = [digest(serializeLog(genesis.game))]
  let replay = genesis.game
  for (const command of route.commands) {
    const action = await measure('action_transaction', () => executeGameAction(runtime.db, user, session, randomUUID(), command))
    replay = replayStep(replay, command)
    expectedDigests.push(digest(serializeLog(replay)))
    assert.deepEqual(action.state.portfolio, replay.portfolio)
  }
  const stored = await measure('resume', () => loadGameState(runtime.db, user, session))
  const { rows } = await runtime.pool.query<{ state_version: number; schema_version: number; hash: string }>(
    "SELECT state_version,schema_version,encode(sha256(convert_to(payload,'UTF8')),'hex') AS hash FROM game_snapshots WHERE session_id=$1 ORDER BY state_version",
    [session],
  )
  assert.deepEqual(rows.map(row => [row.state_version, row.schema_version, row.hash]),
    expectedDigests.map((hash, version) => [version, 7, hash]))
  const actions = await runtime.pool.query<{ action_type: string; payload: Record<string, unknown> }>(
    'SELECT action_type,payload FROM game_actions WHERE session_id=$1 ORDER BY sequence', [session],
  )
  assert.deepEqual(actions.rows.map(row => [row.action_type, row.payload]), route.commands.map(command => [command.actionId, command.payload]))
  assert.equal(serializeLog(replayGameLog(JSON.parse(serializeLog(stored.game)))), serializeLog(replay))
  assert.equal(stored.game.summaries.length, 4)
  assert.equal(stored.result?.lawfulProceedsVnd, BigInt(liquidatableFunds(replay)))
  assert.equal(stored.result?.outcome, replay.termination === 'insolvent' ? 'insolvent' : victory(replay).won ? 'victory' : 'defeat')
  return { actions: route.commands.length, snapshots: rows.length, outcome: stored.result.outcome }
}

async function benchmarkWrites() {
  const route = plan(createHash('md5').update('exe-staging-timeout-4').digest('hex'))
  assert.ok(route.finished)
  const inputs = [0, 5, 15, 30, 45, route.states.length - 1].map(version => ({
    label: 'B18 v' + version, payload: serializeLog(route.states[version]),
  }))
  const uncommon = Array.from({ length: 32_768 }, (_, index) => createHash('sha256').update(String(index)).digest('hex')).join('')
  inputs.push({ label: 'fallback', payload: JSON.stringify({ schemaVersion: 7, data: uncommon }) })
  const unicode = JSON.stringify({ schemaVersion: 7, data: Array(550).fill({ text: 'Tiết kiệm 🧾 \\ " % {},[] \r\n', values: Array(200).fill(1) }) }, null, 2)
  inputs.push({ label: 'unicode', payload: unicode })
  const report = []
  const user = randomUUID()
  const { session } = await createGameSession(runtime.db, user, randomUUID(), setup)
  const client = await runtime.pool.connect()
  try {
    for (const { label, payload } of inputs) {
      const bytes = Buffer.byteLength(payload)
      const prepared = snapshotPayloadForInsert(payload)
      const compiled = typeof prepared === 'string' ? null : dialect.sqlToQuery(prepared)
      const encodedBytes = compiled ? compiled.params.reduce<number>(
        (sum, parameter) => sum + Buffer.byteLength(String(prepareValue(parameter))), 0,
      ) : bytes
      assert.equal(compiled?.params.length ?? 1, label === 'fallback' || label === 'B18 v0' ? 1 : 2)
      for (let sample = 0; sample < 24; sample++) {
        const compressed = sample % 4 !== 0 && compiled
        const expression = compressed ? compiled.sql.replace(/\$(\d+)/g, (_, n: string) => '$' + (Number(n) + 2)) : '$3'
        const params = compressed ? compiled.params : [payload]
        await client.query('BEGIN')
        try {
          const start = performance.now()
          await client.query('INSERT INTO game_snapshots(session_id,state_version,schema_version,payload) VALUES ($1,$2,7,' + expression + ')',
            [session.id, 1, ...params])
          const write = { operation: compressed ? 'insert_encoded' : 'insert_plain', elapsedMs: performance.now() - start }
          samples.push(write, { ...write, operation: write.operation + ' ' + label })
          const readStart = performance.now()
          const saved = await client.query<{ payload: string }>(
            'SELECT payload FROM game_snapshots WHERE session_id=$1 AND state_version=1', [session.id])
          const read = { operation: 'read_raw_snapshot', elapsedMs: performance.now() - readStart }
          samples.push(read, { ...read, operation: read.operation + ' ' + label })
          assert.equal(digest(saved.rows[0].payload), digest(payload))
        } finally { await client.query('ROLLBACK') }
      }
      report.push({ label, bytes, encodedBytes })
    }
    assert.equal((await client.query('SELECT 1 FROM game_snapshots WHERE session_id=$1 AND state_version=1', [session.id])).rowCount, 0)
  } finally { client.release() }
  return report
}

async function run() {
  let created = false
  let createdRole = false
  try {
    assert.equal(url.port, '55442', 'Use the separate PostgreSQL benchmark port')
    const { rows: [version] } = await admin.pool.query('SHOW server_version_num')
    assert.equal(version.server_version_num, '170011')
    assert.equal((await admin.pool.query("SELECT 1 FROM pg_roles WHERE rolname='exe_runtime'")).rowCount, 0)
    await admin.pool.query('CREATE ROLE exe_runtime NOLOGIN NOINHERIT NOBYPASSRLS')
    createdRole = true
    await admin.pool.query('CREATE DATABASE ' + identifier + ' TEMPLATE template0')
    created = true
    await migrateDatabase(owner.db)
    await owner.pool.query(readFileSync(new URL('../drizzle/runtime-grants.sql', import.meta.url), 'utf8'))
    const { rows: [settings] } = await runtime.pool.query(
      "SELECT current_user AS role,current_setting('statement_timeout') AS statement_timeout",
    )
    assert.deepEqual(settings, { role: 'exe_runtime', statement_timeout: '5s' })
    const writes = await benchmarkWrites()
    console.log(JSON.stringify({ version: version.server_version_num, writes }))
    const journeys = await Promise.allSettled(Array.from({ length: 4 }, () => runJourney()))
    const finished = journeys.map(result => {
      if (result.status === 'rejected') throw result.reason
      return result.value
    })
    const { rows: [open] } = await owner.pool.query(
      "SELECT count(*)::int AS transactions FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND xact_start IS NOT NULL",
    )
    assert.equal(open.transactions, 0)
    console.log(JSON.stringify({ journeys: finished, poolMax: runtimeOptions.max, stats: summarize() }))
  } finally {
    await Promise.all([runtime.close(), owner.close()])
    try {
      if (created) await admin.pool.query('DROP DATABASE ' + identifier)
      if (createdRole) await admin.pool.query('DROP ROLE exe_runtime')
    } finally { await admin.close() }
  }
}

try {
  await run()
} catch (error) {
  const failure = error as { code?: string; cause?: { code?: string }; name?: string; stack?: string }
  console.error(JSON.stringify({ failure: failure.cause?.code ?? failure.code ?? failure.name, location: failure.stack?.split('\n').slice(1, 4) }))
  process.exitCode = 1
}
