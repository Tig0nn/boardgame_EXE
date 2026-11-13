import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { eq, sql } from 'drizzle-orm'
import { boardFor } from '../../../src/data/board.ts'
import { ECONOMY } from '../../../src/data/config.ts'
import { eventsForGame } from '../../../src/data/events.ts'
import { businessIncome, businessSaleQuote } from '../../../src/game/business.ts'
import { advance, decide, fundPayment, roll, transact } from '../../../src/game/engine.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { applyMacroShock } from '../../../src/game/market.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { restoreSavedGame } from '../../../src/game/saved-game.ts'
import { liquidatableFunds, netWorth, victory } from '../../../src/game/selectors.ts'
import { borrowingAvailable, fundingSources } from '../../../src/game/transactions.ts'
import type { GameState } from '../../../src/game/types.ts'
import { replayGameLog } from '../../../scripts/diagnostics/replay-game-log.ts'
import { buildApp } from '../src/app.ts'
import { localDatabaseUrl } from '../src/config.ts'
import { createDatabase } from '../src/db/client.ts'
import { migrateDatabase } from '../src/db/migrations.ts'
import { gameActions, gameResults, gameSessions, gameSnapshots } from '../src/db/schema.ts'
import { gameActionBody } from '../src/validation.ts'
import type { BusinessPayload, GameActionRequest } from '../src/validation.ts'
import { startJwtIssuer } from './jwks.ts'

const buy = { kind: 'buy', asset: 'business', amount: ECONOMY.business.cost } as const
const upgrade = { kind: 'upgrade', asset: 'business', amount: ECONOMY.business.upgradeCost } as const
const sell = (game: GameState) => ({ kind: 'sell', asset: 'business', amount: game.portfolio.business }) as const
const hash = (payload: string) => createHash('sha256').update(payload).digest('hex')
const digest = (game: GameState) => hash(serializeLog(game))
const visit = (game: GameState, eventId: string, tile: 'business' | 'personal', turn = game.turn): GameState => ({
  ...game, phase: 'event', turn, eventId, position: boardFor(game).findIndex(item => item.type === tile),
})

function canonicalStep(game: GameState, action: GameActionRequest) {
  switch (action.actionId) {
    case 'advance': return advance(game)
    case 'roll': return roll(game)
    case 'choose': return decide(game, action.payload.optionId)
    case 'trade': return transact(game, action.payload)
    case 'fund': {
      const { source, amount } = action.payload
      return fundPayment(game, source, amount, 'lotId' in action.payload ? action.payload.lotId : undefined)
    }
  }
}

function planJourney(initial: GameState) {
  const plan: GameActionRequest[] = []
  let game = initial
  let upgradedLap: number | undefined
  const completed = new Set<BusinessPayload['kind']>()
  while (game.phase !== 'finished' && plan.length < 140) {
    let input: { actionId: string; payload: object }
    if (game.phase === 'rolling') input = { actionId: 'roll', payload: {} }
    else if (game.phase === 'funding') {
      const amount = game.pendingPayment!.remaining
      if (amount > borrowingAvailable(game)) return null
      input = { actionId: 'fund', payload: { source: 'debt', amount } }
    } else if (game.phase !== 'event') input = { actionId: 'advance', payload: {} }
    else if (game.eventId === 'business' && !completed.has('buy') && game.portfolio.cash >= buy.amount) {
      input = { actionId: 'trade', payload: buy }
      completed.add('buy')
    } else if (game.eventId === 'business' && completed.has('buy') && !completed.has('upgrade') &&
        game.turn > game.businessPurchaseTurn! && game.portfolio.cash >= upgrade.amount) {
      input = { actionId: 'trade', payload: { ...upgrade, customerPreferenceId: game.customerPreferenceId } }
      completed.add('upgrade')
      upgradedLap = game.lap
    } else if (game.eventId === 'business' && upgradedLap !== undefined && game.lap > upgradedLap && !completed.has('sell')) {
      input = { actionId: 'trade', payload: sell(game) }
      completed.add('sell')
    } else if (game.eventId === 'gold' && game.goldUnits === 0 && game.portfolio.cash >= 3_000_000) {
      input = { actionId: 'trade', payload: { kind: 'buy', asset: 'gold', amount: 1_000_000 } }
    } else if (game.eventId === 'bank' && !game.deposits.length && game.portfolio.cash >= 3_000_000) {
      input = { actionId: 'trade', payload: { kind: 'deposit', amount: 1_000_000, term: 1 } }
    } else {
      const event = eventsForGame(game).find(item => item.id === game.eventId)!
      const option = ['skip', 'acknowledge', 'defer', 'temporary'].find(id => event.options.some(item => item.id === id))
      assert.ok(option, event.id)
      input = { actionId: 'choose', payload: { optionId: option } }
    }
    const command = gameActionBody.parse({ ...input, expectedStateVersion: plan.length })
    game = canonicalStep(game, command)
    plan.push(command)
  }
  return game.termination === 'completed' && completed.size === 3 && game.deposits.some(lot => lot.status === 'matured') &&
    game.goldUnits > 0 ? plan : null
}

test('Phase 2C3 Business on real HTTP and PostgreSQL', { timeout: 150_000 }, async t => {
  const url = localDatabaseUrl(process.env.DATABASE_URL)
  const admin = createDatabase(url.href)
  const name = 'exe_v2c3_test_' + randomUUID().replaceAll('-', '')
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
  const execute = (id: string, command: object, key: string = randomUUID(), bearer = authorization) =>
    post(path + '/' + id + '/actions', command, key, bearer)
  const trade = (id: string, version: number, payload: object, key?: string) =>
    execute(id, { actionId: 'trade', expectedStateVersion: version, payload }, key)
  const quote = (id: string, version: number, payload: object, bearer = authorization) =>
    post(path + '/' + id + '/business-quote', { expectedStateVersion: version, payload }, undefined, bearer)
  const history = (id: string) => database.db.select().from(gameActions)
    .where(eq(gameActions.sessionId, id)).orderBy(gameActions.sequence)

  async function status(request: Promise<Response>, code: number) {
    const response = await request
    if (response.status !== code) assert.fail('Expected HTTP ' + code + ', got ' + response.status + ': ' + await response.text())
    return response
  }
  async function createSession() {
    const response = await status(post(path, { scenarioId: 'b18' }, randomUUID()), 201)
    const id: string = (await response.json()).session.id
    const [row] = await database.db.select({ seed: gameSessions.seed }).from(gameSessions).where(eq(gameSessions.id, id))
    return { id, game: createMultiCourseGame(row.seed) }
  }
  async function read(id: string, reconnect = false) {
    const response = await status(fetch(base + path + '/' + id, {
      headers: { authorization, ...(reconnect ? { connection: 'close' } : {}) },
    }), 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const body = await response.text()
    assert.doesNotMatch(body, /"(seed|rng|historySeed|log|priceHistory|jitter)":/)
    return JSON.parse(body)
  }
  async function latest(id: string) {
    const [snapshot] = await database.db.select().from(gameSnapshots).where(eq(gameSnapshots.sessionId, id))
      .orderBy(sql`${gameSnapshots.stateVersion} desc`).limit(1)
    return snapshot
  }
  async function setFixture(id: string, game: GameState) {
    await database.db.update(gameSnapshots).set({ payload: serializeLog(game) }).where(eq(gameSnapshots.sessionId, id))
  }
  function assertFinancial(state: Awaited<ReturnType<typeof read>>['state'], game: GameState) {
    assert.deepEqual(state.portfolio, game.portfolio)
    assert.equal(state.business.capital, game.business.capital)
    assert.equal(state.business.owned, game.business.capital > 0)
    assert.deepEqual(state.business.upgrades, game.business.upgrades)
    assert.equal(state.business.currentSaleValue, businessSaleQuote(game))
    assert.equal(state.business.currentStartIncome, businessIncome(game))
    assert.equal(state.business.currentCustomerPreference.id, game.customerPreferenceId)
    assert.equal(state.bank.netWorth, netWorth(game.portfolio))
    assert.equal(state.bank.liquidatableFunds, liquidatableFunds(game))
    if (game.phase === 'funding') {
      assert.deepEqual([...new Set(state.fundingOptions.map((option: { source: string }) => option.source))], fundingSources(game))
    }
  }

  await t.test('buys, upgrades, earns START income and sells from untouched API genesis', async () => {
    let session = await createSession()
    let plan = planJourney(session.game)
    for (let attempt = 1; attempt < 96 && !plan; attempt++) {
      session = await createSession()
      plan = planJourney(session.game)
    }
    assert.ok(plan, 'Natural Business path with all three operations, Bank and Trading')
    const { id } = session
    let game = session.game
    let upgradedIncome: number | undefined
    let matchedSettlement = false
    const checked = new Set<BusinessPayload['kind']>()
    await status(trade(id, 0, buy), 422)
    await status(quote(id, 0, buy), 422)
    await status(quote(id, 0, buy, outsider), 404)
    await status(execute(id, { actionId: 'trade', expectedStateVersion: 0, payload: buy }, randomUUID(), outsider), 404)

    for (const command of plan) {
      const version = command.expectedStateVersion
      const expected = canonicalStep(game, command)
      const business = command.actionId === 'trade' && 'asset' in command.payload && command.payload.asset === 'business'
        ? command.payload : null
      let response: Response
      let retryBody: unknown
      if (!business) response = await execute(id, command)
      else {
        const before = await read(id)
        assert.ok(before.state.availableActions.includes('trade'))
        assert.ok(before.state.business.actions.some((item: BusinessPayload) => item.kind === business.kind && item.amount === business.amount))
        const quoted = await (await status(quote(id, version, business), 200)).json()
        assert.equal(quoted.stateVersion, version)
        assert.equal(quoted.quote.cashAfter, expected.portfolio.cash)
        assert.equal(quoted.quote.cashPaid, Math.max(0, game.portfolio.cash - expected.portfolio.cash))
        assert.equal(quoted.quote.cashReceived, Math.max(0, expected.portfolio.cash - game.portfolio.cash))
        assert.equal(quoted.quote.businessAfter.currentStartIncome, businessIncome(expected))
        assert.equal(quoted.quote.liquidatableFundsAfter, liquidatableFunds(expected))
        assert.equal(hash((await latest(id)).payload), digest(game))
        assert.equal((await history(id)).length, version)
        assert.equal(game.rng, expected.rng)
        assert.deepEqual(game.market, expected.market)
        await status(trade(id, version, { ...business, amount: business.amount + 1 }), 422)
        await status(trade(id, version, { ...business, cash: 100_000_000, businessValue: 1, profit: 1 }), 400)

        if (business.kind === 'buy') {
          const key = randomUUID()
          await database.pool.query('ALTER TABLE game_snapshots ADD CONSTRAINT test_no_business_snapshot CHECK (false) NOT VALID')
          try {
            await status(execute(id, command, key), 500)
            assert.equal((await history(id)).length, version)
            assert.equal(hash((await latest(id)).payload), digest(game))
            assert.equal((await read(id)).session.stateVersion, version)
          } finally {
            await database.pool.query('ALTER TABLE game_snapshots DROP CONSTRAINT test_no_business_snapshot')
          }
          const pair = await Promise.all([execute(id, command, key), execute(id, command)])
          assert.deepEqual(pair.map(item => item.status).sort(), [200, 409])
          response = pair.find(item => item.status === 200)!
          assert.equal((await pair.find(item => item.status === 409)!.json()).error.code, 'STATE_VERSION_CONFLICT')
          const committed = (await history(id)).at(-1)!
          retryBody = await (await status(execute(id, command, committed.idempotencyKey), 200)).json()
          const conflict = await (await status(trade(id, version, { ...business, amount: business.amount + 1 }, committed.idempotencyKey), 409)).json()
          assert.equal(conflict.error.code, 'IDEMPOTENCY_KEY_REUSED')
          await status(trade(id, version + 1, sell(expected)), 422)
        } else if (business.kind === 'upgrade') {
          loseReply = true
          await assert.rejects(execute(id, command, lostKey))
          assert.equal((await history(id)).at(-1)!.idempotencyKey, lostKey)
          response = await execute(id, command, lostKey)
          await status(trade(id, version + 1, business), 422)
          upgradedIncome = businessIncome(expected)
        } else response = await execute(id, command)

        const stale = await (await status(quote(id, version, business), 409)).json()
        assert.equal(stale.error.code, 'STATE_VERSION_CONFLICT')
        const reconnected = await read(id, true)
        assert.equal(reconnected.session.stateVersion, version + 1)
        assertFinancial(reconnected.state, expected)
        assert.equal(hash((await latest(id)).payload), digest(expected))
        assert.equal((await history(id)).length, version + 1)
        checked.add(business.kind)
      }
      if (response.status !== 200) assert.fail('Unexpected action response ' + response.status + ': ' + await response.text())
      const value = await response.json()
      if (retryBody !== undefined) assert.deepEqual(value, retryBody)
      assert.equal(value.stateVersion, version + 1)
      assertFinancial(value.state, expected)
      if (expected.summaries.length > game.summaries.length && upgradedIncome !== undefined && !checked.has('sell')) {
        assert.equal(value.state.summaries.at(-1).lines.find((item: { label: string }) =>
          item.label === 'Dòng tiền kinh doanh').amount, businessIncome(game))
        matchedSettlement = true
      }
      game = expected
    }

    assert.deepEqual([...checked].sort(), ['buy', 'sell', 'upgrade'])
    assert.ok(matchedSettlement)
    assert.equal(game.business.capital, 0)
    assert.equal(game.summaries.length, 4)
    assert.equal(game.phase, 'finished')
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
      const command = gameActionBody.parse({
        actionId: entry.actionType, payload: entry.payload, expectedStateVersion: index,
      })
      assert.deepEqual(command, plan[index])
      replay = canonicalStep(replay, command)
      assert.deepEqual(snapshots[index + 1], { version: index + 1, schema: 7, hash: digest(replay) })
    }
    const { payload } = await latest(id)
    assert.equal(digest(restoreSavedGame(payload)), digest(game))
    assert.equal(digest(replayGameLog(JSON.parse(payload))), digest(game))
    const [result] = await database.db.select().from(gameResults).where(eq(gameResults.sessionId, id))
    assert.equal(result.outcome, victory(game).won ? 'victory' : 'defeat')
    assert.equal(result.lawfulProceedsVnd, BigInt(liquidatableFunds(game)))
    assert.equal((await read(id)).session.status, 'completed')
    await status(trade(id, plan.length, buy), 409)
    await status(quote(id, plan.length, buy), 409)
    t.diagnostic('Natural Business, Bank and Trading journey completed ' + plan.length + ' HTTP actions')
  })

  await t.test('enforces cash, upgrade cap, same-visit rules and the current full-sale value', async () => {
    const { id, game: initial } = await createSession()
    const poor = visit({ ...initial, portfolio: { ...initial.portfolio, cash: buy.amount - 1 } }, 'business', 'business', 1)
    await setFixture(id, poor)
    await status(trade(id, 0, buy), 422)
    assert.deepEqual((await read(id)).state.business.actions, [])
    const owned = transact(visit(initial, 'business', 'business', 1), buy)
    const shocked = applyMacroShock(owned, 'credit-tightening')
    assert.notEqual(businessSaleQuote(shocked), businessSaleQuote(owned))
    assert.equal(businessIncome(shocked), businessIncome(owned))
    const capped = visit({ ...shocked, business: { ...shocked.business, upgrades: { taste: ECONOMY.business.maxUpgrades } } },
      'business', 'business', 2)
    await setFixture(id, capped)
    await status(trade(id, 0, upgrade), 422)
    await status(trade(id, 0, sell(owned)), 422)
    const payload = sell(capped)
    const quoted = await (await status(quote(id, 0, payload), 200)).json()
    assert.equal(quoted.quote.cashReceived, businessSaleQuote(shocked))
    assert.deepEqual((await read(id)).state.business.actions, [payload])
    const expected = transact(capped, payload)
    const response = await (await status(trade(id, 0, payload), 200)).json()
    assertFinancial(response.state, expected)
    assert.equal(response.state.phase, 'event')
    assert.equal(hash((await latest(id)).payload), digest(expected))
  })

  await t.test('unsold Business stays out of Funding and the official insolvency result', async () => {
    const { id, game: initial } = await createSession()
    const owned = transact(visit(initial, 'business', 'business', 1), buy)
    const short = visit({ ...owned, portfolio: { ...owned.portfolio, cash: 0, debt: owned.borrowingLimit - 1 } },
      'medical', 'personal', 2)
    const pending = decide(short, 'pay')
    await setFixture(id, pending)
    assert.deepEqual(fundingSources(pending), ['debt'])
    const before = await read(id)
    assertFinancial(before.state, pending)
    assert.equal(before.state.bank.netWorth - before.state.bank.liquidatableFunds,
      pending.portfolio.business + pending.pendingPayment!.remaining)
    await status(trade(id, 0, sell(pending)), 422)
    await status(execute(id, { actionId: 'fund', expectedStateVersion: 0, payload: { source: 'business', amount: 1 } }), 400)
    const expected = fundPayment(pending, 'debt', 1)
    const action = { actionId: 'fund', expectedStateVersion: 0, payload: { source: 'debt', amount: 1 } }
    const result = await (await status(execute(id, action), 200)).json()
    assert.equal(expected.termination, 'insolvent')
    assertFinancial(result.state, expected)
    assert.deepEqual(result.result, { outcome: 'insolvent', lawfulProceedsVnd: String(liquidatableFunds(expected)) })
    assert.equal(hash((await latest(id)).payload), digest(expected))
    assert.deepEqual((await read(id)).result, result.result)
  })
})
