import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { eq, sql } from 'drizzle-orm'
import { boardFor } from '../../../src/data/board.ts'
import { eventsForGame } from '../../../src/data/events.ts'
import { advance, decide, fundPayment, roll, transact } from '../../../src/game/engine.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { restoreSavedGame } from '../../../src/game/saved-game.ts'
import { liquidatableFunds, netWorth, totalWorth, victory } from '../../../src/game/selectors.ts'
import { borrowingAvailable, fundingSources } from '../../../src/game/transactions.ts'
import type { GameState } from '../../../src/game/types.ts'
import { replayGameLog } from '../../../scripts/diagnostics/replay-game-log.ts'
import { buildApp } from '../src/app.ts'
import { localDatabaseUrl } from '../src/config.ts'
import { createDatabase } from '../src/db/client.ts'
import { migrateDatabase } from '../src/db/migrations.ts'
import { gameActions, gameResults, gameSessions, gameSnapshots } from '../src/db/schema.ts'
import { gameActionBody } from '../src/validation.ts'
import type { GameActionRequest } from '../src/validation.ts'
import { startJwtIssuer } from './jwks.ts'

type Input =
  | { actionId: 'advance' | 'roll'; payload: Record<string, never> }
  | { actionId: 'choose'; payload: { optionId: string } }
  | { actionId: 'trade'; payload: { kind: 'deposit'; amount: number; term: 1 | 3 }
      | { kind: 'repay'; amount: number } | { kind: 'buy'; asset: 'gold'; amount: number }
      | { kind: 'buy'; asset: 'bonds'; amount: number; issuerId: 'an-tam' } }
  | { actionId: 'fund'; payload: { source: 'debt'; amount: number } | { source: 'savings'; amount: number; lotId: string } }

const digest = (payload: string) => createHash('sha256').update(payload).digest('hex')
const shaState = (game: GameState) => digest(serializeLog(game))
const deposit = (amount: number, term: 1 | 3): Input => ({ actionId: 'trade', payload: { kind: 'deposit', amount, term } })
const repay = (amount: number): Input => ({ actionId: 'trade', payload: { kind: 'repay', amount } })
const borrow = (amount: number): Input => ({ actionId: 'fund', payload: { source: 'debt', amount } })
const withdraw = (amount: number, lotId: string): Input => ({ actionId: 'fund', payload: { source: 'savings', amount, lotId } })

function canonicalStep(game: GameState, command: GameActionRequest) {
  switch (command.actionId) {
    case 'advance': return advance(game)
    case 'roll': return roll(game)
    case 'choose': return decide(game, command.payload.optionId)
    case 'trade': return transact(game, command.payload)
    case 'fund': {
      const { source, amount } = command.payload
      return fundPayment(game, source, amount, 'lotId' in command.payload ? command.payload.lotId : undefined)
    }
  }
}

function nextCommand(game: GameState): Input | undefined {
  if (game.phase === 'rolling') return { actionId: 'roll', payload: {} }
  if (game.phase === 'funding') {
    const payment = game.pendingPayment!
    if (!game.log.some(entry => entry.decisionId === 'fund-debt') &&
        borrowingAvailable(game) >= payment.remaining && payment.remaining > 1) {
      return borrow(Math.floor(payment.remaining / 2))
    }
    const lot = game.deposits.find(lot => lot.status === 'active')
    if (lot) return withdraw(lot.principal, lot.id)
    if (borrowingAvailable(game) >= payment.remaining) return borrow(payment.remaining)
    return
  }
  if (game.phase !== 'event') return { actionId: 'advance', payload: {} }

  if (game.eventId === 'bank' && game.portfolio.cash > 0) {
    if (game.deposits.length === 0) return deposit(game.portfolio.cash, 3)
    if (game.portfolio.cash >= 1_234_567 && game.deposits.length === 1 && game.deposits[0].status === 'withdrawn') return deposit(1_234_567, 1)
  }
  // The bond tile at index 2 is just before the personal tile. An optional investment
  // can consume cash from START while a savings lot is still active.
  if (game.eventId === 'bonds' && game.position === 2 && game.portfolio.cash > 0 &&
      game.deposits[0]?.status === 'active' &&
      game.bondCredit?.issuers.some(issuer => issuer.id === 'an-tam' && issuer.status === 'performing')) {
    return { actionId: 'trade', payload: { kind: 'buy', asset: 'bonds', amount: game.portfolio.cash, issuerId: 'an-tam' } }
  }
  if (game.eventId === 'gold' && game.goldUnits === 0 && game.portfolio.cash >= 1_000_000) {
    return { actionId: 'trade', payload: { kind: 'buy', asset: 'gold', amount: 1_000_000 } }
  }

  const event = eventsForGame(game).find(item => item.id === game.eventId)!
  const option = ['pay', 'full', 'skip', 'acknowledge'].find(id => event.options.some(option => option.id === id))
  assert.ok(option, event.id)
  return { actionId: 'choose', payload: { optionId: option } }
}

function planJourney(initial: GameState) {
  const plan: GameActionRequest[] = []
  let game = initial
  while (game.phase !== 'finished' && plan.length < 140) {
    const input = nextCommand(game)
    if (!input) break
    const command = gameActionBody.parse({ ...input, expectedStateVersion: plan.length })
    game = canonicalStep(game, command)
    plan.push(command)
  }
  return game.termination === 'completed' && game.deposits.length === 2 &&
    game.deposits[0].status === 'withdrawn' && game.deposits[1].status === 'matured' &&
    game.log.some(entry => entry.decisionId === 'buy-gold-complete') &&
    game.log.some(entry => entry.debtInterestPaid > 0)
    ? plan : null
}

test('Phase 2C2 Bank on real HTTP and PostgreSQL', { timeout: 150_000 }, async t => {
  const url = localDatabaseUrl(process.env.DATABASE_URL)
  const admin = createDatabase(url.href)
  const identifier = '"exe_v2c2_test_' + randomUUID().replaceAll('-', '') + '"'
  url.pathname = '/' + identifier.slice(1, -1)
  const database = createDatabase(url.href)
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

  const exp = Math.floor(Date.now() / 1000) + 180
  const authorization = 'Bearer ' + await issuer.sign(randomUUID(), { exp })
  const outsider = 'Bearer ' + await issuer.sign(randomUUID(), { exp })
  const lostKey = randomUUID()
  let loseReply = false
  app.addHook('onSend', (request, reply, payload, done) => {
    if (loseReply && request.headers['idempotency-key'] === lostKey && reply.statusCode === 200) {
      loseReply = false
      reply.hijack()
      reply.raw.destroy()
    } else done(null, payload)
  })
  const base = await app.listen({ host: '127.0.0.1', port: 0 })
  const path = '/v1/game-sessions'
  const post = (route: string, payload: object, key?: string, bearer = authorization) => fetch(base + route, {
    method: 'POST', body: JSON.stringify(payload),
    headers: { authorization: bearer, 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) },
  })
  const execute = (id: string, version: number, input: object, key: string = randomUUID(), bearer = authorization) =>
    post(path + '/' + id + '/actions', { ...input, expectedStateVersion: version }, key, bearer)
  const quote = (id: string, version: number, input: object, bearer = authorization) =>
    post(path + '/' + id + '/bank-quote', { ...input, expectedStateVersion: version }, undefined, bearer)
  const history = (id: string) => database.db.select().from(gameActions)
    .where(eq(gameActions.sessionId, id)).orderBy(gameActions.sequence)

  async function createSession() {
    const response = await post(path, { scenarioId: 'b18' }, randomUUID())
    assert.equal(response.status, 201)
    const id: string = (await response.json()).session.id
    const [row] = await database.db.select({ seed: gameSessions.seed }).from(gameSessions).where(eq(gameSessions.id, id))
    return { id, game: createMultiCourseGame(row.seed) }
  }
  async function read(id: string, reconnect = false) {
    const response = await fetch(base + path + '/' + id, {
      headers: { authorization, ...(reconnect ? { connection: 'close' } : {}) },
    })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    return response.json()
  }
  function assertFinancial(state: Awaited<ReturnType<typeof read>>['state'], expected: GameState) {
    assert.deepEqual(state.portfolio, expected.portfolio)
    assert.deepEqual(state.bank.deposits, expected.deposits)
    assert.equal(state.bank.borrowingLimit, expected.borrowingLimit)
    assert.equal(state.bank.borrowingAvailable, borrowingAvailable(expected))
    assert.equal(state.bank.netWorth, netWorth(expected.portfolio))
    assert.equal(state.bank.totalWorth, totalWorth(expected))
    assert.equal(state.bank.liquidatableFunds, liquidatableFunds(expected))
    if (expected.phase === 'funding') {
      assert.deepEqual([...new Set(state.fundingOptions.map((item: { source: string }) => item.source))], fundingSources(expected))
    }
  }
  async function latest(id: string) {
    const [row] = await database.db.select().from(gameSnapshots).where(eq(gameSnapshots.sessionId, id))
      .orderBy(sql`${gameSnapshots.stateVersion} desc`).limit(1)
    return row
  }
  async function assertStatus(request: Promise<Response>, status: number) {
    const response = await request
    if (response.status !== status) assert.fail('Expected HTTP ' + status + ', got ' + response.status + ': ' + await response.text())
    return response
  }

  await t.test('opens savings through API, borrows and withdraws in Funding, then matures savings and finishes with Trading', async () => {
    let session = await createSession()
    let plan = planJourney(session.game)
    for (let attempt = 1; attempt < 256 && !plan; attempt++) {
      session = await createSession()
      plan = planJourney(session.game)
    }
    assert.ok(plan, 'Natural B18 path with bank visits, early withdrawal, later maturity, debt and gold')
    const { id } = session
    let game = session.game
    const checked = new Set<string>()
    let lostChecked = false
    const firstDeposit = deposit(1, 1)
    await assertStatus(execute(id, 0, firstDeposit), 422)
    await assertStatus(quote(id, 0, firstDeposit), 422)
    await assertStatus(execute(id, 0, firstDeposit, randomUUID(), outsider), 404)
    await assertStatus(quote(id, 0, firstDeposit, outsider), 404)

    for (const command of plan) {
      const version = command.expectedStateVersion
      const expected = canonicalStep(game, command)
      const key = randomUUID()
      const kind = command.actionId === 'trade' && command.payload.kind === 'deposit' ? 'deposit'
        : command.actionId === 'fund' ? command.payload.source : null
      let response: Response
      let retried: unknown
      if (!kind) response = await execute(id, version, command, key)
      else {
        const result = await (await assertStatus(quote(id, version, command), 200)).json()
        assert.equal(result.stateVersion, version)
        assert.equal(result.quote.cashAfter, expected.portfolio.cash)
        assert.equal(result.quote.savingsAfter, expected.portfolio.savings)
        assert.equal(result.quote.debtAfter, expected.portfolio.debt)
        assert.equal(result.quote.phaseAfter, expected.phase)
        const before = await latest(id)
        assert.equal(before.stateVersion, version)
        assert.equal(digest(before.payload), shaState(game))
        assert.doesNotMatch(JSON.stringify(result), /"(seed|rng|log|snapshot|priceHistory)":/)

        if (kind === 'deposit') {
          assert.equal(result.quote.deposit.id, expected.deposits.at(-1)!.id)
          assert.equal(result.quote.deposit.maturityLap, expected.deposits.at(-1)!.maturityLap)
          await assertStatus(execute(id, version, deposit(game.portfolio.cash + 1, 1)), 422)
          await assertStatus(execute(id, version, { ...command, payload: { ...command.payload, rate: 0.5 } }), 400)
        } else if (kind === 'debt') {
          await assertStatus(execute(id, version, borrow(borrowingAvailable(game) + 1)), 422)
          await assertStatus(execute(id, version, borrow(game.pendingPayment!.remaining + 1)), 422)
        } else {
          assert.equal(result.quote.funding.lotId, game.deposits[0].id)
          assert.equal(result.quote.funding.lostInterest, expected.log[game.log.length].lostSavingsInterest)
        }

        if (!checked.size) {
          await database.pool.query('ALTER TABLE game_snapshots ADD CONSTRAINT test_no_bank_snapshot CHECK (false) NOT VALID')
          try {
            await assertStatus(execute(id, version, command, key), 500)
            assert.equal((await history(id)).length, version)
            assert.equal(digest((await latest(id)).payload), shaState(game))
          } finally {
            await database.pool.query('ALTER TABLE game_snapshots DROP CONSTRAINT test_no_bank_snapshot')
          }
        }

        if (!checked.has(kind)) {
          const pair = await Promise.all([execute(id, version, command, key), execute(id, version, command)])
          assert.deepEqual(pair.map(item => item.status).sort(), [200, 409])
          response = pair.find(item => item.status === 200)!
          assert.equal((await pair.find(item => item.status === 409)!.json()).error.code, 'STATE_VERSION_CONFLICT')
          const committed = (await history(id)).at(-1)!
          const retry = await assertStatus(execute(id, version, command, committed.idempotencyKey), 200)
          retried = await retry.json()
          const changed = { ...command, payload: { ...command.payload, amount: ('amount' in command.payload ? command.payload.amount : 0) + 1 } }
          const rejected = await assertStatus(execute(id, version, changed, committed.idempotencyKey), 409)
          assert.equal((await rejected.json()).error.code, 'IDEMPOTENCY_KEY_REUSED')
          checked.add(kind)
        } else if (!lostChecked) {
          loseReply = true
          await assert.rejects(execute(id, version, command, lostKey))
          assert.equal((await history(id)).at(-1)!.idempotencyKey, lostKey)
          response = await execute(id, version, command, lostKey)
          lostChecked = true
        } else response = await execute(id, version, command, key)
        await assertStatus(quote(id, version, command), 409)
        const reconnected = await read(id, true)
        assert.equal(reconnected.session.stateVersion, version + 1)
        assertFinancial(reconnected.state, expected)
        if (kind === 'savings') await assertStatus(execute(id, version + 1, command), 422)
      }
      if (response.status !== 200) assert.fail('Unexpected action response ' + response.status + ': ' + await response.text())
      const value = await response.json()
      if (retried !== undefined) assert.deepEqual(retried, value)
      assert.equal(value.stateVersion, version + 1)
      assertFinancial(value.state, expected)
      game = expected
    }

    assert.ok(lostChecked)
    assert.deepEqual([...checked].sort(), ['debt', 'deposit', 'savings'])
    assert.equal(game.deposits[0].earnedInterest, 0)
    assert.equal(game.deposits[1].earnedInterest, 49_383)
    assert.ok(game.log.some(entry => entry.debtInterestPaid > 0))
    assert.equal(game.phase, 'finished')
    assert.equal(game.summaries.length, 4)
    const historyRows = await history(id)
    const snapshots = await database.db.select({
      version: gameSnapshots.stateVersion, schema: gameSnapshots.schemaVersion,
      hash: sql<string>`encode(sha256(convert_to(${gameSnapshots.payload}, 'UTF8')), 'hex')`,
    }).from(gameSnapshots).where(eq(gameSnapshots.sessionId, id)).orderBy(gameSnapshots.stateVersion)
    assert.equal(historyRows.length, plan.length)
    assert.equal(snapshots.length, plan.length + 1)
    let replay = session.game
    for (const [index, entry] of historyRows.entries()) {
      assert.equal(entry.sequence, index + 1)
      const command = gameActionBody.parse({ actionId: entry.actionType, payload: entry.payload, expectedStateVersion: index })
      assert.deepEqual(command, plan[index])
      replay = canonicalStep(replay, command)
      assert.deepEqual(snapshots[index + 1], { version: index + 1, schema: 7, hash: shaState(replay) })
    }
    const final = await latest(id)
    assert.equal(shaState(restoreSavedGame(final.payload)), shaState(game))
    assert.equal(shaState(replayGameLog(JSON.parse(final.payload))), shaState(game))
    const [result] = await database.db.select().from(gameResults).where(eq(gameResults.sessionId, id))
    assert.equal(result.outcome, victory(game).won ? 'victory' : 'defeat')
    assert.equal(result.lawfulProceedsVnd, BigInt(liquidatableFunds(game)))
    assert.equal((await read(id)).session.status, 'completed')
    await assertStatus(execute(id, plan.length, firstDeposit), 409)
    await assertStatus(quote(id, plan.length, firstDeposit), 409)
    t.diagnostic('Natural Bank and Trading journey completed ' + plan.length + ' HTTP actions')
  })

  await t.test('using the last savings lot can end in canonical insolvency', async () => {
    const { id, game: initial } = await createSession()
    const seeded = createMultiCourseGame(initial.seed, 2_000_000, 3)
    const encounter: GameState = {
      ...seeded, phase: 'event', eventId: 'medical',
      position: boardFor(seeded).findIndex(tile => tile.type === 'personal'),
      portfolio: { ...seeded.portfolio, cash: 0, debt: seeded.borrowingLimit },
    }
    const pending = decide(encounter, 'pay')
    await database.db.update(gameSnapshots).set({ payload: serializeLog(pending) }).where(eq(gameSnapshots.sessionId, id))
    const lot = pending.deposits[0]
    const input = withdraw(lot.principal, lot.id)
    const expected = fundPayment(pending, 'savings', lot.principal, lot.id)
    assert.equal(expected.termination, 'insolvent')

    const quoted = await (await assertStatus(quote(id, 0, input), 200)).json()
    assert.equal(quoted.quote.terminationAfter, 'insolvent')
    assert.equal(quoted.quote.funding.appliedToPayment, lot.principal)
    assert.equal(digest((await latest(id)).payload), shaState(pending))
    const result = await (await assertStatus(execute(id, 0, input), 200)).json()
    assertFinancial(result.state, expected)
    assert.deepEqual(result.result, { outcome: 'insolvent', lawfulProceedsVnd: String(liquidatableFunds(expected)) })
    assert.equal(digest((await latest(id)).payload), shaState(expected))
    const [stored] = await database.db.select().from(gameResults).where(eq(gameResults.sessionId, id))
    assert.equal(stored.outcome, 'insolvent')
    assert.equal(stored.stateVersion, 1)
    await assertStatus(execute(id, 1, input), 409)
  })

  await t.test('repays debt at START with exact interest and prevents out-of-phase or unaffordable repayment', async () => {
    for (const lap of [1, 4]) {
      const { id, game: initial } = await createSession()
      const game: GameState = {
        ...initial, phase: 'rebalancing', lap, portfolio: { ...initial.portfolio, cash: 2_000_000, debt: 3_000_000 },
      }
      // A focused START checkpoint with remaining debt, separate from the natural journey.
      await database.db.update(gameSnapshots).set({ payload: serializeLog(game) }).where(eq(gameSnapshots.sessionId, id))
      await assertStatus(execute(id, 0, repay(2_000_001)), 422)
      await assertStatus(execute(id, 0, repay(3_000_001)), 422)
      await assertStatus(execute(id, 0, deposit(1, 1)), 422)
      if (lap === 1) await assertStatus(quote(id, 0, repay(2_000_000)), 422)
      const amount = 1_234_567
      const command = repay(amount)
      const before = await read(id)
      assert.equal(before.state.bank.canRepay, true)
      const result = await (await assertStatus(quote(id, 0, command), 200)).json()
      const expected = transact(game, { kind: 'repay', amount })
      assert.deepEqual(result.quote.repayment, {
        principal: amount, interest: lap === 4 ? 0 : 123_457, cashPaid: game.portfolio.cash - expected.portfolio.cash,
      })
      const key = randomUUID()
      const response = await (await assertStatus(execute(id, 0, command, key), 200)).json()
      assertFinancial(response.state, expected)
      assert.equal(response.state.phase, 'rebalancing')
      assert.equal(digest((await latest(id)).payload), shaState(expected))
      assert.deepEqual(await (await assertStatus(execute(id, 0, command, key), 200)).json(), response)
      assert.equal((await history(id)).length, 1)
    }
  })
})
