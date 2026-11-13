import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'node:test'
import { eq } from 'drizzle-orm'
import { boardFor } from '../../../src/data/board.ts'
import { advance, decide, fundPayment, roll, transact } from '../../../src/game/engine.ts'
import { bondLotQuote } from '../../../src/game/bond-credit.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { restoreSavedGame } from '../../../src/game/saved-game.ts'
import { liquidatableFunds } from '../../../src/game/selectors.ts'
import type { FundingSource, GameState } from '../../../src/game/types.ts'
import { replayGameLog } from '../../../scripts/diagnostics/replay-game-log.ts'
import { buildApp } from '../src/app.ts'
import { localDatabaseUrl } from '../src/config.ts'
import { createDatabase } from '../src/db/client.ts'
import { migrateDatabase } from '../src/db/migrations.ts'
import { gameActions, gameResults, gameSessions, gameSnapshots } from '../src/db/schema.ts'
import { startJwtIssuer } from './jwks.ts'

const seed = '00000000000000000000000000000002'
const newGame = (savings = 0) => createMultiCourseGame(seed, savings, 3)
const digest = (payload: string) => createHash('sha256').update(payload).digest('hex')
const visit = (game: GameState, tile: 'course' | 'personal' | 'stocks' | 'bonds' | 'gold', eventId: string = tile): GameState =>
  ({ ...game, phase: 'event', eventId, position: boardFor(game).findIndex(item => item.type === tile) })

const choose = (optionId: string, expectedStateVersion = 0) =>
  ({ actionId: 'choose', expectedStateVersion, payload: { optionId } })
const fund = (source: FundingSource, amount: number, expectedStateVersion = 0, lotId?: string) =>
  ({ actionId: 'fund', expectedStateVersion, payload: { source, amount, ...(lotId ? { lotId } : {}) } })

test('Phase 2B funding, events and state reads on PostgreSQL', { timeout: 90_000 }, async t => {
  const url = localDatabaseUrl(process.env.DATABASE_URL)
  const admin = createDatabase(url.href)
  const name = 'exe_v2b_test_' + randomUUID().replaceAll('-', '')
  const identifier = '"' + name + '"'
  const testUrl = new URL(url)
  testUrl.pathname = '/' + name
  const database = createDatabase(testUrl.href)
  const issuer = await startJwtIssuer()
  const app = buildApp(database, issuer.config)
  let created = false

  t.after(async () => {
    try {
      await Promise.all([app.close(), issuer.close()])
      if (created) await admin.pool.query('DROP DATABASE ' + identifier)
    } finally {
      await admin.close()
    }
  })
  await admin.pool.query('CREATE DATABASE ' + identifier + ' TEMPLATE template0')
  created = true
  await migrateDatabase(database.db)

  const authorization = 'Bearer ' + await issuer.sign(randomUUID(), { exp: Math.floor(Date.now() / 1000) + 120 })
  const other = 'Bearer ' + await issuer.sign(randomUUID())
  const base = await app.listen({ host: '127.0.0.1', port: 0 })
  const path = '/v1/game-sessions'
  const post = (id: string, payload: object, key: string = randomUUID(), bearer = authorization) => app.inject({
    method: 'POST', url: path + '/' + id + '/actions', payload,
    headers: { authorization: bearer, 'idempotency-key': key },
  })
  const read = (id: string, bearer = authorization) => app.inject({ url: path + '/' + id, headers: { authorization: bearer } })
  const actions = (id: string) => database.db.select().from(gameActions)
    .where(eq(gameActions.sessionId, id)).orderBy(gameActions.sequence)

  async function withSnapshot(game: GameState): Promise<string> {
    const response = await app.inject({
      method: 'POST', url: path, payload: { scenarioId: 'b18' },
      headers: { authorization, 'idempotency-key': randomUUID() },
    })
    assert.equal(response.statusCode, 201)
    const id: string = response.json().session.id
    // Tests may set an existing canonical checkpoint. There is no import route.
    await database.db.transaction(async tx => {
      await tx.update(gameSessions).set({ seed: game.seed }).where(eq(gameSessions.id, id))
      await tx.update(gameSnapshots).set({ payload: serializeLog(game) }).where(eq(gameSnapshots.sessionId, id))
    })
    return id
  }

  async function assertSaved(id: string, version: number, expected: GameState) {
    const rows = await database.db.select().from(gameSnapshots)
      .where(eq(gameSnapshots.sessionId, id)).orderBy(gameSnapshots.stateVersion)
    assert.equal(rows.length, version + 1)
    const snapshot = rows[version]
    assert.equal(snapshot.stateVersion, version)
    assert.equal(snapshot.schemaVersion, 7)
    assert.equal(digest(snapshot.payload), digest(serializeLog(expected)))
    assert.deepEqual(restoreSavedGame(snapshot.payload).portfolio, expected.portfolio)
    return snapshot.payload
  }

  await t.test('simultaneous course buys charge once and require cash and the current course encounter', async () => {
    const game = visit(newGame(), 'course')
    const id = await withSnapshot(game)
    const [basic, advanced] = await Promise.all([post(id, choose('course-basic')), post(id, choose('course-advanced'))])
    assert.deepEqual([basic.statusCode, advanced.statusCode].sort(), [200, 409])
    const bought = basic.statusCode === 200 ? 'course-basic' : 'course-advanced'
    const expected = decide(game, bought)
    assert.equal((basic.statusCode === 409 ? basic : advanced).json().error.code, 'STATE_VERSION_CONFLICT')
    await assertSaved(id, 1, expected)
    assert.equal((await actions(id)).length, 1)
    assert.equal((await post(id, choose(bought, 1))).statusCode, 422)

    const owned = visit({ ...expected, turn: expected.turn + 1 }, 'course')
    const revisit = await withSnapshot(owned)
    assert.equal((await post(revisit, choose(bought))).statusCode, 422)
    const second = bought === 'course-basic' ? 'course-advanced' : 'course-basic'
    const secondPurchase = await post(revisit, choose(second))
    assert.equal(secondPurchase.statusCode, 200, secondPurchase.body)
    await assertSaved(revisit, 1, decide(owned, second))

    const poor = visit(newGame(45_000_000), 'course')
    const poorId = await withSnapshot(poor)
    for (const option of ['course-basic', 'course-advanced', 'pay']) {
      assert.equal((await post(poorId, choose(option))).statusCode, 422)
    }
    assert.equal((await read(poorId)).json().session.stateVersion, 0)
    assert.deepEqual((await read(poorId)).json().state.options.map((option: { id: string }) => option.id), ['skip'])
    assert.deepEqual(await actions(poorId), [])
    await assertSaved(poorId, 0, poor)
  })

  await t.test('event shortfall, partial debt and savings match every replayed schema 7 snapshot', async () => {
    const initial = newGame(49_000_000)
    const id = await withSnapshot(initial)
    const rolling = advance(initial)
    const encounter = roll(rolling)
    assert.equal(encounter.eventId, 'family')
    const pending = decide(encounter, 'pay')
    assert.equal(pending.pendingPayment?.remaining, 2_000_000)
    const partial = fundPayment(pending, 'debt', 1_000_000)
    const resolved = fundPayment(partial, 'savings', 49_000_000, 'deposit-1')
    const sequence = [
      [{ actionId: 'advance', expectedStateVersion: 0, payload: {} }, rolling],
      [{ actionId: 'roll', expectedStateVersion: 1, payload: {} }, encounter],
      [choose('pay', 2), pending],
      [fund('debt', 1_000_000, 3), partial],
      [fund('savings', 49_000_000, 4, 'deposit-1'), resolved],
    ] as const
    for (const [command, expected] of sequence) {
      const response = await post(id, command)
      assert.equal(response.statusCode, 200, response.body)
      const snapshot = await assertSaved(id, command.expectedStateVersion + 1, expected)
      assert.equal(digest(serializeLog(replayGameLog(JSON.parse(snapshot)))), digest(snapshot))
      assert.deepEqual(response.json().state.portfolio, expected.portfolio)
    }
    assert.equal(resolved.phase, 'rolling')
    assert.equal(resolved.pendingPayment, null)
    assert.equal(resolved.portfolio.debt, 1_000_000)
    assert.equal(resolved.portfolio.cash, 48_000_000)
    assert.equal(resolved.deposits[0].status, 'withdrawn')

    let replay = initial
    const log = await actions(id)
    assert.equal(log.length, sequence.length)
    for (const entry of log) {
      if (entry.actionType === 'advance') replay = advance(replay)
      else if (entry.actionType === 'roll') replay = roll(replay)
      else if (entry.actionType === 'choose') replay = decide(replay, entry.payload.optionId as string)
      else {
        assert.equal(entry.actionType, 'fund')
        replay = fundPayment(replay, entry.payload.source as FundingSource, entry.payload.amount as number, entry.payload.lotId as string | undefined)
      }
      assert.equal(digest(serializeLog(replay)), digest(serializeLog(sequence[entry.sequence - 1][1])))
    }
  })

  await t.test('stock, bond and gold liquidation use canonical fees, holdings and lot rules', async () => {
    let game = newGame(46_000_000)
    game = transact(visit(game, 'stocks'), { kind: 'buy', asset: 'stocks', amount: 1_000_000 })
    game = transact(visit({ ...game, turn: 1 }, 'bonds'), { kind: 'buy', asset: 'bonds', amount: 1_000_000, issuerId: 'an-tam' })
    game = transact(visit({ ...game, turn: 2 }, 'gold'), { kind: 'buy', asset: 'gold', amount: 1_000_000 })
    const pending = decide(visit({ ...game, turn: 3 }, 'personal', 'medical'), 'pay')
    const id = await withSnapshot(pending)
    const lot = pending.bondLots[0].id
    assert.equal((await post(id, { actionId: 'fund', expectedStateVersion: 0, payload: { source: 'business', amount: 1 } })).statusCode, 400)
    assert.equal((await post(id, fund('bonds', 1, 0, 'bond-404'))).statusCode, 422)
    assert.equal((await post(id, fund('savings', 1, 0, 'deposit-1'))).statusCode, 422)
    assert.equal((await post(id, fund('stocks', pending.portfolio.stocks + 1))).statusCode, 422)

    const detail = (await read(id)).json()
    assert.equal(detail.session.stateVersion, 0)
    assert.deepEqual(detail.state.fundingOptions.map((option: { source: string }) => option.source),
      ['savings', 'stocks', 'bonds', 'gold', 'debt'])
    const bond = detail.state.fundingOptions.find((option: { source: string }) => option.source === 'bonds')
    assert.equal(bond.lotId, lot)
    assert.equal(bond.maxAmount, bondLotQuote(pending, lot).gross)
    let expected = pending
    for (const [version, source] of (['stocks', 'bonds', 'gold'] as const).entries()) {
      const lotId = source === 'bonds' ? lot : undefined
      expected = fundPayment(expected, source, 400_000, lotId)
      const response = await post(id, fund(source, 400_000, version, lotId))
      assert.equal(response.statusCode, 200, response.body)
      assert.deepEqual(response.json().state.pendingPayment, expected.pendingPayment)
      await assertSaved(id, version + 1, expected)
    }
    assert.equal((await actions(id)).length, 3)
  })

  await t.test('funding exhaustion and an unfundable event commit only one official insolvency result', async () => {
    const game = visit(newGame(50_000_000), 'personal', 'repair')
    // A late-game fixture with exhausted liquid sources and nearly exhausted credit.
    const locked: GameState = {
      ...game, deposits: [], portfolio: { ...game.portfolio, savings: 0, debt: game.borrowingLimit - 1_000_000 },
    }
    const pending = decide(locked, 'full')
    const id = await withSnapshot(pending)
    assert.equal(pending.phase, 'funding')
    assert.equal((await post(id, fund('debt', 1_000_001))).statusCode, 422)
    const action = fund('debt', 1_000_000)
    const expected = fundPayment(pending, 'debt', 1_000_000)
    const key = randomUUID()

    await database.pool.query('ALTER TABLE game_results ADD CONSTRAINT test_v2b_result CHECK (false) NOT VALID')
    try {
      assert.equal((await post(id, action, key)).statusCode, 500)
      assert.deepEqual(await actions(id), [])
      assert.equal((await read(id)).json().session.status, 'active')
      await assertSaved(id, 0, pending)
    } finally {
      await database.pool.query('ALTER TABLE game_results DROP CONSTRAINT test_v2b_result')
    }

    const response = await post(id, action, key)
    assert.equal(response.statusCode, 200, response.body)
    assert.equal(expected.termination, 'insolvent')
    assert.equal(response.json().state.termination, expected.termination)
    assert.deepEqual(response.json().result, { outcome: 'insolvent', lawfulProceedsVnd: String(liquidatableFunds(expected)) })
    await assertSaved(id, 1, expected)
    const detail = (await read(id)).json()
    assert.equal(detail.session.status, 'completed')
    assert.deepEqual(detail.state.availableActions, [])
    assert.deepEqual(detail.state.fundingOptions, [])
    assert.deepEqual(detail.result, response.json().result)
    assert.equal((await post(id, fund('debt', 1, 1))).json().error.code, 'SESSION_NOT_ACTIVE')
    assert.deepEqual((await post(id, action, key)).json(), response.json())
    assert.equal((await actions(id)).length, 1)
    assert.equal((await database.db.select().from(gameResults).where(eq(gameResults.sessionId, id))).length, 1)

    const exhausted = { ...locked, portfolio: { ...locked.portfolio, debt: locked.borrowingLimit } }
    const immediate = await withSnapshot(exhausted)
    const decision = await post(immediate, choose('full'))
    assert.equal(decision.statusCode, 200)
    assert.equal(decision.json().result.outcome, 'insolvent')
    await assertSaved(immediate, 1, decide(exhausted, 'full'))
  })

  await t.test('settlement funding resumes at START without paying salary twice', async () => {
    const rolling: GameState = {
      ...newGame(), phase: 'rolling', position: 17, obligations: 62_000_000,
    }
    const pending = roll(rolling)
    assert.equal(pending.phase, 'funding')
    assert.equal(pending.pendingPayment?.origin, 'settlement')
    assert.equal(pending.pendingPayment?.remaining, 3_000_000)
    const id = await withSnapshot(pending)
    const expected = fundPayment(pending, 'debt', 3_000_000)
    const key = randomUUID()
    const action = fund('debt', 3_000_000)
    const completed = await post(id, action, key)
    assert.equal(completed.statusCode, 200, completed.body)
    assert.deepEqual((await post(id, action, key)).json(), completed.json())
    await assertSaved(id, 1, expected)
    assert.equal(expected.phase, 'summary')
    assert.equal(expected.log.filter(entry => entry.title === 'Nhận lương').length, 1)
    assert.deepEqual(expected.market.normalLaps, [1])
  })

  await t.test('funding retry after HTTP timeout returns one committed snapshot and state recovers after reconnect', async () => {
    const pending = decide(roll(advance(newGame(49_000_000))), 'pay')
    const id = await withSnapshot(pending)
    const key = randomUUID()
    const action = fund('debt', 1_000_000)
    const endpoint = base + path + '/' + id
    const blocker = await database.pool.connect()
    const controller = new AbortController()
    try {
      await blocker.query('BEGIN')
      await blocker.query('SELECT id FROM game_sessions WHERE id = $1 FOR UPDATE', [id])
      const request = fetch(endpoint + '/actions', {
        method: 'POST', signal: controller.signal, body: JSON.stringify(action),
        headers: { authorization, 'idempotency-key': key, 'content-type': 'application/json' },
      }).then(() => null, (error: unknown) => error)
      try {
        let waiting = false
        for (let attempt = 0; attempt < 100; attempt++) {
          const query = await admin.pool.query(
            "SELECT 1 FROM pg_stat_activity WHERE datname = $1 AND wait_event_type = 'Lock' AND query LIKE '%for update%'",
            [name],
          )
          if (query.rowCount) { waiting = true; break }
          await delay(20)
        }
        assert.ok(waiting)
        assert.equal((await read(id)).json().session.stateVersion, 0)
      } finally {
        controller.abort(new DOMException('Client deadline', 'TimeoutError'))
        const error = await request
        assert.ok(error instanceof DOMException && error.name === 'TimeoutError')
      }
    } finally {
      try { await blocker.query('ROLLBACK') } finally { blocker.release() }
    }

    const retry = await post(id, action, key)
    assert.equal(retry.statusCode, 200, retry.body)
    const reordered = { ...action, payload: { amount: 1_000_000, source: 'debt' } }
    assert.deepEqual((await post(id, reordered, key)).json(), retry.json())
    assert.equal((await post(id, fund('debt', 2_000_000), key)).json().error.code, 'IDEMPOTENCY_KEY_REUSED')
    assert.equal((await post(id, action)).json().error.code, 'STATE_VERSION_CONFLICT')
    assert.equal((await post(id, action, key, other)).statusCode, 404)
    assert.equal((await read(id, other)).statusCode, 404)

    const reconnected = await fetch(endpoint, { headers: { authorization, connection: 'close' } })
    assert.equal(reconnected.status, 200)
    assert.equal(reconnected.headers.get('cache-control'), 'no-store')
    const body = await reconnected.text()
    const detail = JSON.parse(body)
    assert.equal(detail.session.stateVersion, 1)
    assert.equal(detail.session.status, 'active')
    assert.deepEqual(detail.state, retry.json().state)
    assert.deepEqual(detail.state.availableActions, ['fund'])
    assert.doesNotMatch(body, /"(seed|rng|historySeed|jitter|log|snapshot|settlement|priceHistory)":/)
    assert.equal((await actions(id)).length, 1)
    await assertSaved(id, 1, fundPayment(pending, 'debt', 1_000_000))
  })
})
