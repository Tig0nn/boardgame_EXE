import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { eq, sql } from 'drizzle-orm'
import { boardFor } from '../../../src/data/board.ts'
import { ECONOMY, RULES } from '../../../src/data/config.ts'
import { eventsForGame } from '../../../src/data/events.ts'
import { advance, decide, fundPayment, roll, transact } from '../../../src/game/engine.ts'
import { creditBondLots } from '../../../src/game/bond-credit.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { restoreSavedGame } from '../../../src/game/saved-game.ts'
import { liquidatableFunds, netWorth, saleQuote, totalWorth, victory } from '../../../src/game/selectors.ts'
import { borrowingAvailable, fundingSources } from '../../../src/game/transactions.ts'
import type { GameState, TradableAsset } from '../../../src/game/types.ts'
import { replayGameLog } from '../../../scripts/diagnostics/replay-game-log.ts'
import { buildApp } from '../src/app.ts'
import { localDatabaseUrl } from '../src/config.ts'
import { createDatabase } from '../src/db/client.ts'
import { migrateDatabase } from '../src/db/migrations.ts'
import { gameActions, gameResults, gameSessions, gameSnapshots } from '../src/db/schema.ts'
import { gameActionBody } from '../src/validation.ts'
import type { GameActionRequest, TradePayload } from '../src/validation.ts'
import { startJwtIssuer } from './jwks.ts'

const hash = (text: string) => createHash('sha256').update(text).digest('hex')
const digest = (game: GameState) => hash(serializeLog(game))
const command = (actionId: string, expectedStateVersion: number, payload = {}) =>
  gameActionBody.parse({ actionId, expectedStateVersion, payload })
const isAsset = (id: string | null): id is TradableAsset => id === 'gold' || id === 'stocks' || id === 'bonds'

function canonicalStep(game: GameState, input: GameActionRequest): GameState {
  switch (input.actionId) {
    case 'advance': return advance(game)
    case 'roll': return roll(game)
    case 'choose': return decide(game, input.payload.optionId)
    case 'trade': return transact(game, input.payload)
    case 'fund': return fundPayment(game, input.payload.source, input.payload.amount,
      'lotId' in input.payload ? input.payload.lotId : undefined)
  }
}

function planJourney(initial: GameState) {
  const plan: GameActionRequest[] = []
  const sold = new Set<TradableAsset>()
  let game = initial
  let finalSale = false
  while (game.phase !== 'finished' && plan.length < 140) {
    const version = plan.length
    let next: GameActionRequest
    if (game.phase === 'rolling') next = command('roll', version)
    else if (game.phase === 'funding') {
      const amount = game.pendingPayment!.remaining
      if (amount > borrowingAvailable(game)) return null
      next = command('fund', version, { source: 'debt', amount })
    } else if (game.phase === 'rebalancing') {
      const bond = creditBondLots(game).find(item => item.quote.executable)
      const sales: TradePayload[] = [
        { kind: 'sell', asset: 'stocks', amount: game.portfolio.stocks },
        ...(bond ? [{ kind: 'sell', asset: 'bonds', amount: bond.quote.gross, lotId: bond.lot.id } as const] : []),
        ...(game.lap === game.totalLaps ? [{ kind: 'sell', asset: 'gold', amount: game.portfolio.gold } as const] : []),
      ]
      const sale = sales.find(item => item.amount > 0 && !sold.has(item.asset))
      if (sale) {
        next = command('trade', version, sale)
        sold.add(sale.asset)
        finalSale ||= game.lap === game.totalLaps
      } else next = command('advance', version)
    } else if (game.phase !== 'event') next = command('advance', version)
    else {
      const asset = game.eventId
      const issuer = game.bondCredit?.issuers.find(item => item.status === 'performing')
      if (isAsset(asset) && !sold.has(asset) && !game.portfolio[asset] && game.portfolio.cash >= 1_500_001 &&
          (asset !== 'bonds' || issuer)) {
        next = command('trade', version, { kind: 'buy', asset, amount: 1_500_001, ...(asset === 'bonds' ? { issuerId: issuer!.id } : {}) })
      } else if (asset === 'bank' && !game.deposits.some(lot => lot.id === 'deposit-2') && game.portfolio.cash >= 1_234_567) {
        next = command('trade', version, { kind: 'deposit', amount: 1_234_567, term: 1 })
      } else if (asset === 'business' && !game.business.capital && game.portfolio.cash >= ECONOMY.business.cost) {
        next = command('trade', version, { kind: 'buy', asset, amount: ECONOMY.business.cost })
      } else {
        const event = eventsForGame(game).find(item => item.id === asset)!
        const optionId = ['skip', 'acknowledge', 'defer', 'temporary'].find(id => event.options.some(item => item.id === id))
        assert.ok(optionId, event.id)
        next = command('choose', version, { optionId })
      }
    }
    game = canonicalStep(game, next)
    plan.push(next)
  }
  return game.termination === 'completed' && sold.size === 3 && finalSale &&
    game.deposits.length === 2 && game.deposits.every(lot => lot.status === 'matured') && game.business.capital > 0 &&
    game.log.some(entry => entry.obligationCreated > 0) ? plan : null
}

test('Phase 2C4 START and rebalancing on real HTTP and PostgreSQL', { timeout: 180_000 }, async t => {
  const url = localDatabaseUrl(process.env.DATABASE_URL)
  const admin = createDatabase(url.href)
  const name = 'exe_v2c4_test_' + randomUUID().replaceAll('-', '')
  url.pathname = '/' + name
  const database = createDatabase(url.href)
  const issuer = await startJwtIssuer()
  const app = buildApp(database, issuer.config)
  let created = false
  t.after(async () => {
    try {
      await Promise.all([app.close(), issuer.close()])
      if (created) await admin.pool.query('DROP DATABASE "' + name + '"')
    } finally {
      await admin.close()
    }
  })
  await admin.pool.query('CREATE DATABASE "' + name + '" TEMPLATE template0')
  created = true
  await migrateDatabase(database.db)

  const exp = Math.floor(Date.now() / 1000) + 240
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
  const execute = (id: string, action: object, key: string = randomUUID(), bearer = authorization) =>
    post(path + '/' + id + '/actions', action, key, bearer)
  const quote = (id: string, version: number, payload: object, bearer = authorization) =>
    post(path + '/' + id + '/trade-quote', { expectedStateVersion: version, payload }, undefined, bearer)
  const history = (id: string) => database.db.select().from(gameActions)
    .where(eq(gameActions.sessionId, id)).orderBy(gameActions.sequence)

  async function status(request: Promise<Response>, expected: number) {
    const response = await request
    if (response.status !== expected) assert.fail('Expected HTTP ' + expected + ', got ' + response.status + ': ' + await response.text())
    return response
  }
  async function createSession(setup?: { initialSavings: number; savingsTerm: 1 | 2 | 3 }) {
    const response = await status(post(path, { scenarioId: 'b18', ...(setup ? { setup } : {}) }, randomUUID()), 201)
    const { session } = await response.json()
    const id: string = session.id
    if (setup) assert.deepEqual(session.setup, setup)
    const [row] = await database.db.select({ seed: gameSessions.seed }).from(gameSessions).where(eq(gameSessions.id, id))
    return { id, game: createMultiCourseGame(row.seed, setup?.initialSavings, setup?.savingsTerm) }
  }
  async function read(id: string, reconnect = false) {
    const response = await status(fetch(base + path + '/' + id, {
      headers: { authorization, ...(reconnect ? { connection: 'close' } : {}) },
    }), 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const body = await response.text()
    assert.doesNotMatch(body, /"(seed|rng|historySeed|log|priceHistory|settlement|jitter)":/)
    return JSON.parse(body)
  }
  async function latest(id: string) {
    const [snapshot] = await database.db.select().from(gameSnapshots).where(eq(gameSnapshots.sessionId, id))
      .orderBy(sql`${gameSnapshots.stateVersion} desc`).limit(1)
    return snapshot
  }
  function assertState(state: Awaited<ReturnType<typeof read>>['state'], game: GameState) {
    assert.equal(state.phase, game.phase)
    assert.deepEqual(state.portfolio, game.portfolio)
    assert.deepEqual(state.holdings.stocks, game.stockHoldings)
    assert.deepEqual(state.holdings.gold, { units: game.goldUnits, costBasis: game.goldCostBasis })
    assert.deepEqual(state.holdings.bonds, game.bondLots.map(lot => ({
      id: lot.id, units: lot.units, principal: lot.principal, status: lot.status,
      issuerId: lot.credit?.issuerId, costBasis: lot.credit?.costBasis,
    })))
    assert.deepEqual(state.bank.deposits, game.deposits)
    assert.equal(state.business.capital, game.business.capital)
    assert.equal(state.bank.netWorth, netWorth(game.portfolio))
    assert.equal(state.bank.totalWorth, totalWorth(game))
    assert.equal(state.bank.liquidatableFunds, liquidatableFunds(game))
    assert.deepEqual(state.market.normalLaps, game.market.normalLaps)
    assert.deepEqual(state.start.summary, JSON.parse(JSON.stringify(game.summaries.find(item => item.lap === game.lap) ?? null)))
  }

  await t.test('rolls through four START checkpoints, trades at START and replays every committed action', async () => {
    const setup = { initialSavings: 10_000_000, savingsTerm: 3 } as const
    let session = await createSession(setup)
    let plan = planJourney(session.game)
    for (let attempt = 1; attempt < 96 && !plan; attempt++) {
      session = await createSession(setup)
      plan = planJourney(session.game)
    }
    assert.ok(plan, 'Natural path with all three START sales, Business income, Bank maturity and deferred obligations')
    const { id } = session
    let game = session.game
    const genesis = await read(id, true)
    assert.deepEqual(genesis.session.setup, setup)
    assert.equal(genesis.session.stateVersion, 0)
    assertState(genesis.state, game)
    assert.equal(genesis.state.portfolio.cash, 40_000_000)
    assert.equal(genesis.state.bank.deposits[0].maturityLap, 3)
    let testedSettlement = false
    const sold = new Set<TradableAsset>()
    for (const action of plan) {
      const version = action.expectedStateVersion
      const expected = canonicalStep(game, action)
      let response: Response
      let retry: unknown
      if (action.actionId === 'roll' && expected.phase === 'summary' && !testedSettlement) {
        const key = randomUUID()
        await database.pool.query('ALTER TABLE game_snapshots ADD CONSTRAINT test_no_start_snapshot CHECK (false) NOT VALID')
        try {
          await status(execute(id, action, key), 500)
          assert.equal((await history(id)).length, version)
          assert.equal((await read(id)).session.stateVersion, version)
          assert.equal(hash((await latest(id)).payload), digest(game))
        } finally {
          await database.pool.query('ALTER TABLE game_snapshots DROP CONSTRAINT test_no_start_snapshot')
        }
        response = await status(execute(id, action, key), 200)
        retry = await (await status(execute(id, action, key), 200)).json()
        const reconnected = await read(id, true)
        assert.equal(reconnected.session.stateVersion, version + 1)
        assert.equal(reconnected.state.start.settlementStatus, 'completed')
        assert.deepEqual(reconnected.state.start.sales, [])
        await status(execute(id, { ...action, expectedStateVersion: version + 1 }), 422)
        testedSettlement = true
      } else if (action.actionId === 'trade' && game.phase === 'rebalancing' &&
          'asset' in action.payload && action.payload.asset !== 'business' && action.payload.kind === 'sell') {
        const payload = action.payload
        const detail = await read(id, true)
        assert.equal(detail.state.start.canFinishRebalancing, true)
        assert.equal(detail.state.start.finalCheckpoint, game.lap === game.totalLaps)
        assert.ok(detail.state.availableActions.includes('trade'))
        const quoted = await (await status(quote(id, version, payload), 200)).json()
        const canonical = saleQuote(game, payload.asset, payload.amount, 'lotId' in payload ? payload.lotId : undefined)
        assert.equal(quoted.stateVersion, version)
        assert.equal(quoted.quote.cashReceived, canonical.net)
        assert.equal(quoted.quote.fee, canonical.fee)
        assert.equal(quoted.quote.spread, canonical.spread)
        assert.equal(quoted.quote.cashAfter, expected.portfolio.cash)
        assert.equal(hash((await latest(id)).payload), digest(game))
        assert.equal((await history(id)).length, version)
        await status(quote(id, version, payload, outsider), 404)
        await status(execute(id, action, randomUUID(), outsider), 404)
        const invalid = { ...payload, amount: quoted.quote.maxAmount + 1 }
        await status(execute(id, { ...action, payload: invalid }), 422)
        await status(execute(id, { ...action, payload: { ...payload, completeEncounter: true } }), 422)
        await status(execute(id, { ...action, payload: { kind: 'buy', asset: 'gold', amount: 1 } }), 422)
        await status(execute(id, { ...action, payload: { ...payload, cash: game.portfolio.cash } }), 400)
        if (!sold.size) {
          const pair = await Promise.all([execute(id, action), execute(id, action)])
          assert.deepEqual(pair.map(item => item.status).sort(), [200, 409])
          response = pair.find(item => item.status === 200)!
          assert.equal((await pair.find(item => item.status === 409)!.json()).error.code, 'STATE_VERSION_CONFLICT')
          const key = (await history(id)).at(-1)!.idempotencyKey
          retry = await (await status(execute(id, action, key), 200)).json()
          const conflict = await (await status(execute(id, { ...action, payload: invalid }, key), 409)).json()
          assert.equal(conflict.error.code, 'IDEMPOTENCY_KEY_REUSED')
        } else if (sold.size === 1) {
          loseReply = true
          await assert.rejects(execute(id, action, lostKey))
          assert.equal((await history(id)).at(-1)!.idempotencyKey, lostKey)
          response = await status(execute(id, action, lostKey), 200)
        } else response = await status(execute(id, action), 200)
        await status(quote(id, version, payload), 409)
        const stale = await (await status(execute(id, action), 409)).json()
        assert.equal(stale.error.code, 'STATE_VERSION_CONFLICT')
        assert.equal(expected.phase, 'rebalancing')
        assert.equal(expected.rng, game.rng)
        assert.deepEqual(expected.market, game.market)
        assert.deepEqual(expected.summaries, game.summaries)
        sold.add(payload.asset)
      } else response = await status(execute(id, action), 200)
      const value = await response.json()
      if (retry !== undefined) assert.deepEqual(retry, value)
      assert.equal(value.stateVersion, version + 1)
      assertState(value.state, expected)
      game = expected
    }
    assert.ok(testedSettlement)
    assert.deepEqual([...sold].sort(), ['bonds', 'gold', 'stocks'])
    assert.equal(game.phase, 'finished')
    assert.deepEqual(game.summaries.map(item => item.lap), [1, 2, 3, 4])
    assert.deepEqual(game.market.normalLaps, [1, 2, 3, 4])
    assert.equal(game.log.filter(entry => entry.title === 'Nhận lương').length, 4)
    assert.ok(game.summaries.some(item => item.lines.some(line => line.label === 'Dòng tiền kinh doanh' && line.amount > 0)))
    assert.ok(game.summaries.some(item => item.lines.some(line => line.label === 'Nghĩa vụ đã hẹn' && line.amount < 0)))
    assert.equal(game.deposits[0].earnedInterest, 1_800_000)
    assert.equal(game.deposits[1].earnedInterest, 49_383)

    const log = await history(id)
    const snapshots = await database.db.select({
      version: gameSnapshots.stateVersion, schema: gameSnapshots.schemaVersion,
      hash: sql<string>`encode(sha256(convert_to(${gameSnapshots.payload}, 'UTF8')), 'hex')`,
    }).from(gameSnapshots).where(eq(gameSnapshots.sessionId, id)).orderBy(gameSnapshots.stateVersion)
    assert.equal(log.length, plan.length)
    assert.equal(snapshots.length, plan.length + 1)
    let replay = session.game
    assert.deepEqual(snapshots[0], { version: 0, schema: 7, hash: digest(replay) })
    for (const [index, entry] of log.entries()) {
      assert.equal(entry.sequence, index + 1)
      const action = command(entry.actionType, index, entry.payload)
      assert.deepEqual(action, plan[index])
      replay = canonicalStep(replay, action)
      assert.deepEqual(snapshots[index + 1], { version: index + 1, schema: 7, hash: digest(replay) })
    }
    const { payload } = await latest(id)
    assert.equal(digest(restoreSavedGame(payload)), digest(game))
    assert.equal(digest(replayGameLog(JSON.parse(payload))), digest(game))
    const final = await read(id)
    const [result] = await database.db.select().from(gameResults).where(eq(gameResults.sessionId, id))
    assert.equal(result.lawfulProceedsVnd, BigInt(liquidatableFunds(game)))
    assert.equal(result.stateVersion, plan.length)
    assert.equal(final.result.outcome, victory(game).won ? 'victory' : 'defeat')
    assert.equal(final.result.lawfulProceedsVnd, String(result.lawfulProceedsVnd))
    assert.equal(final.session.status, 'completed')
    assert.deepEqual(final.session.setup, setup)
    assert.deepEqual(final.state.start.sales, [])
    await status(execute(id, command('trade', plan.length, { kind: 'sell', asset: 'gold', amount: 1 })), 409)
    t.diagnostic('Natural START journey completed ' + plan.length + ' HTTP actions and all three financial sales')
  })

  await t.test('final settlement pauses for Funding, accrues new interest once and allows sale and repayment', async () => {
    const { id, game: initial } = await createSession()
    const position = boardFor(initial).findIndex(tile => tile.type === 'gold')
    const held = transact({ ...initial, phase: 'event', eventId: 'gold', position }, { kind: 'buy', asset: 'gold', amount: 5_000_000 })
    const game: GameState = { ...held, lap: 4, position: 17, obligations: 60_000_000 }
    await database.db.update(gameSnapshots).set({ payload: serializeLog(game) }).where(eq(gameSnapshots.sessionId, id))
    let expected = roll(game)
    assert.equal(expected.phase, 'funding')
    assert.equal(expected.pendingPayment?.origin, 'settlement')
    const pending = await (await status(execute(id, command('roll', 0)), 200)).json()
    assert.equal(pending.state.start.settlementStatus, 'awaitingFunding')
    assert.equal(pending.state.start.finalCheckpoint, true)
    assert.deepEqual(pending.state.fundingOptions.map((item: { source: string }) => item.source), fundingSources(expected))
    assertState(pending.state, expected)
    const amount = expected.pendingPayment!.remaining
    const key = randomUUID()
    const funding = command('fund', 1, { source: 'debt', amount })
    expected = fundPayment(expected, 'debt', amount)
    assert.equal(expected.phase, 'summary')
    assert.equal(expected.portfolio.debt, amount + Math.round(amount * RULES.debtRate))
    const funded = await (await status(execute(id, funding, key), 200)).json()
    assertState(funded.state, expected)
    assert.deepEqual(await (await status(execute(id, funding, key), 200)).json(), funded)
    expected = advance(expected)
    await status(execute(id, command('advance', 2)), 200)
    const sale = { kind: 'sell', asset: 'gold', amount: expected.portfolio.gold } as const
    expected = transact(expected, sale)
    await status(execute(id, command('trade', 3, sale)), 200)
    const repay = { kind: 'repay', amount: Math.min(expected.portfolio.cash, expected.portfolio.debt) } as const
    assert.ok(repay.amount > 0)
    expected = transact(expected, repay)
    const repaid = await (await status(execute(id, command('trade', 4, repay)), 200)).json()
    assertState(repaid.state, expected)
    assert.equal(expected.log.at(-1)?.debtInterestPaid, 0)
    assert.equal(expected.log.filter(entry => entry.title === 'Nhận lương').length, 1)
    assert.equal(hash((await latest(id)).payload), digest(expected))
  })

  await t.test('insolvency during START is persisted atomically and cannot be resumed', async () => {
    const { id, game: initial } = await createSession()
    const game: GameState = { ...advance(initial), position: 17, obligations: 200_000_000 }
    await database.db.update(gameSnapshots).set({ payload: serializeLog(game) }).where(eq(gameSnapshots.sessionId, id))
    const pending = roll(game)
    await status(execute(id, command('roll', 0)), 200)
    assert.equal(pending.pendingPayment?.origin, 'settlement')
    const funding = command('fund', 1, { source: 'debt', amount: borrowingAvailable(pending) })
    const expected = canonicalStep(pending, funding)
    assert.equal(expected.termination, 'insolvent')
    const result = await (await status(execute(id, funding), 200)).json()
    assertState(result.state, expected)
    assert.equal(result.state.start.settlementStatus, 'interrupted')
    assert.deepEqual(result.result, { outcome: 'insolvent', lawfulProceedsVnd: String(liquidatableFunds(expected)) })
    assert.deepEqual((await read(id)).result, result.result)
    assert.equal(hash((await latest(id)).payload), digest(expected))
    await status(execute(id, command('advance', 2)), 409)
  })
})
