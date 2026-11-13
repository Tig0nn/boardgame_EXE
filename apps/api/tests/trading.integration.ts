import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { and, eq, sql } from 'drizzle-orm'
import { eventsForGame } from '../../../src/data/events.ts'
import { creditBondLots } from '../../../src/game/bond-credit.ts'
import { advance, canChoose, decide, fundPayment, roll, transact } from '../../../src/game/engine.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { restoreSavedGame } from '../../../src/game/saved-game.ts'
import { saleQuote, victory } from '../../../src/game/selectors.ts'
import type { GameState, TradableAsset } from '../../../src/game/types.ts'
import { replayGameLog } from '../../../scripts/diagnostics/replay-game-log.ts'
import { buildApp } from '../src/app.ts'
import { localDatabaseUrl } from '../src/config.ts'
import { createDatabase } from '../src/db/client.ts'
import { migrateDatabase } from '../src/db/migrations.ts'
import { gameActions, gameResults, gameSessions, gameSnapshots } from '../src/db/schema.ts'
import { gameActionBody } from '../src/validation.ts'
import type { TradePayload } from '../src/validation.ts'
import { startJwtIssuer } from './jwks.ts'

type Command = { expectedStateVersion: number } & (
  | { actionId: 'advance' | 'roll'; payload: Record<string, never> }
  | { actionId: 'choose'; payload: { optionId: string } }
  | { actionId: 'fund'; payload: { source: 'debt'; amount: number } }
  | { actionId: 'trade'; payload: TradePayload }
)

const isTradingAsset = (value: string | null): value is TradableAsset =>
  value === 'gold' || value === 'stocks' || value === 'bonds'

function nextTrade(game: GameState, asset: TradableAsset): TradePayload | undefined {
  const symbolId = game.market.stocks[0].id
  if (asset === 'bonds') {
    const lot = creditBondLots(game).find(item => item.quote.executable && item.quote.gross >= 100_000)
    if (lot) return { kind: 'sell', asset, amount: 100_000, lotId: lot.lot.id }
    const issuer = game.bondCredit?.issuers.find(item => item.status === 'performing')
    if (issuer && game.portfolio.cash >= 1_000_000) {
      return { kind: 'buy', asset, amount: 1_000_000, issuerId: issuer.id }
    }
  } else if (game.portfolio[asset] >= 100_000) {
    return asset === 'stocks' ? { kind: 'sell', asset, amount: 100_000, symbolId } : { kind: 'sell', asset, amount: 100_000 }
  } else if (game.portfolio.cash >= 1_000_000) {
    return asset === 'stocks' ? { kind: 'buy', asset, amount: 1_000_000, symbolId } : { kind: 'buy', asset, amount: 1_000_000 }
  }
}

function canonicalStep(game: GameState, action: Command): GameState {
  switch (action.actionId) {
    case 'advance': return advance(game)
    case 'roll': return roll(game)
    case 'choose': return decide(game, action.payload.optionId)
    case 'fund': return fundPayment(game, action.payload.source, action.payload.amount)
    case 'trade': return transact(game, action.payload)
  }
}

function planJourney(seed: string) {
  const initial = createMultiCourseGame(seed)
  let game = initial
  const plan: Command[] = []
  const sold = new Set<TradableAsset>()
  while (game.phase !== 'finished' && plan.length < 140) {
    const expectedStateVersion = plan.length
    let command: Command
    if (game.phase === 'rolling') command = { actionId: 'roll', payload: {}, expectedStateVersion }
    else if (game.phase === 'funding') {
      const amount = game.pendingPayment!.remaining
      if (amount > game.borrowingLimit - game.portfolio.debt) break
      command = { actionId: 'fund', payload: { source: 'debt', amount }, expectedStateVersion }
    } else if (game.phase === 'event') {
      const asset = game.eventId
      const trade = isTradingAsset(asset) && !sold.has(asset) ? nextTrade(game, asset) : undefined
      if (trade) {
        command = { actionId: 'trade', payload: trade, expectedStateVersion }
        if (trade.kind === 'sell') sold.add(trade.asset)
      } else {
        const event = eventsForGame(game).find(item => item.id === asset)!
        const choice = ['skip', 'acknowledge', 'defer', 'temporary']
          .find(id => event.options.some(option => option.id === id) && canChoose(game, id))
        assert.ok(choice, event.id)
        command = { actionId: 'choose', payload: { optionId: choice }, expectedStateVersion }
      }
    } else command = { actionId: 'advance', payload: {}, expectedStateVersion }

    game = canonicalStep(game, command)
    plan.push(command)
  }
  return sold.size === 3 && game.phase === 'finished' ? { initial, plan } : null
}

const digest = (text: string) => createHash('sha256').update(text).digest('hex')
const illegal = (payload: object, expectedStateVersion: number) => ({ actionId: 'trade', payload, expectedStateVersion })

test('Phase 2C1 real HTTP and PostgreSQL trading journey', { timeout: 120_000 }, async t => {
  const url = localDatabaseUrl(process.env.DATABASE_URL)
  const admin = createDatabase(url.href)
  const name = 'exe_v2c1_test_' + randomUUID().replaceAll('-', '')
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

  const exp = Math.floor(Date.now() / 1000) + 180
  const authorization = 'Bearer ' + await issuer.sign(randomUUID(), { exp })
  const other = 'Bearer ' + await issuer.sign(randomUUID(), { exp })
  const lostKey = randomUUID()
  let dropResponse = false
  app.addHook('onSend', (request, reply, payload, done) => {
    if (dropResponse && request.headers['idempotency-key'] === lostKey && reply.statusCode === 200) {
      dropResponse = false
      reply.hijack()
      reply.raw.destroy()
    } else done(null, payload)
  })
  const base = await app.listen({ host: '127.0.0.1', port: 0 })
  const path = '/v1/game-sessions'
  const post = (route: string, body: object, key?: string, bearer = authorization) => fetch(base + route, {
    method: 'POST', body: JSON.stringify(body),
    headers: { authorization: bearer, 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) },
  })
  const read = (id: string, bearer = authorization, reconnect = false) => fetch(base + path + '/' + id, {
    headers: { authorization: bearer, ...(reconnect ? { connection: 'close' } : {}) },
  })

  let journey: ReturnType<typeof planJourney> = null
  let id = ''
  // Use untouched API-generated genesis. Select a naturally playable board path that visits
  // each asset often enough, including a repeat bond visit while a lot is executable.
  for (let attempt = 0; attempt < 64 && !journey; attempt++) {
    const created = await post(path, { scenarioId: 'b18' }, randomUUID())
    assert.equal(created.status, 201, await created.clone().text())
    id = (await created.json()).session.id
    const [session] = await database.db.select({ seed: gameSessions.seed }).from(gameSessions).where(eq(gameSessions.id, id))
    journey = planJourney(session.seed)
  }
  assert.ok(journey, 'A real genesis with natural buys and later sales for all three assets')
  const actionPath = path + '/' + id + '/actions'
  const quotePath = path + '/' + id + '/trade-quote'
  const { initial, plan } = journey
  const history = () => database.db.select().from(gameActions).where(eq(gameActions.sessionId, id)).orderBy(gameActions.sequence)
  const publicState = async () => {
    const response = await read(id)
    assert.equal(response.status, 200)
    return response.json()
  }

  const first = plan.find(command => command.actionId === 'trade')!
  assert.equal((await post(actionPath, { ...first, expectedStateVersion: 0 }, randomUUID())).status, 422)
  assert.equal((await post(quotePath, { payload: first.payload, expectedStateVersion: 0 })).status, 422)
  assert.equal((await post(actionPath, first, randomUUID(), other)).status, 404)
  assert.equal((await post(quotePath, { payload: first.payload, expectedStateVersion: 0 }, undefined, other)).status, 404)

  const bought = new Set<TradableAsset>()
  const sold = new Set<TradableAsset>()
  let game = initial
  let concurrentBuy = false
  let concurrentSell = false
  let rollbackChecked = false
  let lostChecked = false
  for (const command of plan) {
    const { expectedStateVersion: version } = command
    const expected = canonicalStep(game, command)
    const key = randomUUID()
    let response: Response
    let retried: unknown
    if (command.actionId !== 'trade') {
      response = await post(actionPath, command, key)
    } else {
      const trade = command.payload
      const quoteRequest = { payload: trade, expectedStateVersion: version }
      const quoteResponse = await post(quotePath, quoteRequest)
      assert.equal(quoteResponse.status, 200, await quoteResponse.clone().text())
      const quoted = await quoteResponse.json()
      assert.equal(quoted.stateVersion, version)
      assert.equal(quoted.sessionId, id)
      assert.deepEqual(quoted.payload, trade)
      const quote = quoted.quote
      const detail = await publicState()
      assert.equal(detail.session.stateVersion, version)
      assert.equal(detail.state.tradingAsset, trade.asset)
      assert.ok(detail.state.availableActions.includes('trade'))
      assert.equal(quote.cashAfter, expected.portfolio.cash)
      assert.equal(quote.gross, trade.amount)

      if (trade.kind === 'buy' && !bought.has(trade.asset)) {
        assert.equal(quote.cashPaid, trade.amount)
        assert.equal(quote.maxAmount, game.portfolio.cash)
        assert.equal(quote.fee, 0)
        assert.equal(quote.spread, 0)
        const sellUnowned = { kind: 'sell', asset: trade.asset, amount: 1,
          ...(trade.asset === 'bonds' ? { lotId: 'bond-404' } : {}) }
        for (const bad of [{ ...trade, amount: game.portfolio.cash + 1 }, sellUnowned]) {
          assert.equal((await post(actionPath, illegal(bad, version), randomUUID())).status, 422)
          assert.equal((await post(quotePath, { payload: bad, expectedStateVersion: version })).status, 422)
        }
        for (const bad of [{ ...trade, amount: 0 }, { ...trade, amount: 1.25 }, { ...trade, price: 1 }, { ...trade, cash: 900_000_000 }]) {
          assert.equal((await post(actionPath, illegal(bad, version), randomUUID())).status, 400)
        }
        assert.equal((await post(actionPath, { ...command, portfolio: {} }, randomUUID())).status, 400)
        assert.equal((await publicState()).session.stateVersion, version)
        assert.equal((await history()).length, version)
      }

      if (trade.kind === 'sell') {
        const lotId = trade.asset === 'bonds' ? trade.lotId : undefined
        const canonical = saleQuote(game, trade.asset, trade.amount, lotId)
        assert.equal(quote.cashReceived, canonical.net)
        assert.equal(quote.fee, canonical.fee)
        assert.equal(quote.spread, canonical.spread)
        assert.ok(quote.quantity > 0)
        assert.equal((await post(actionPath, illegal({ ...trade, amount: quote.maxAmount + 1 }, version), randomUUID())).status, 422)
      }

      if (!rollbackChecked) {
        await database.pool.query('ALTER TABLE game_snapshots ADD CONSTRAINT test_no_trade_snapshot CHECK (false) NOT VALID')
        try {
          assert.equal((await post(actionPath, command, key)).status, 500)
          assert.equal((await history()).length, version)
          assert.equal((await publicState()).session.stateVersion, version)
        } finally {
          await database.pool.query('ALTER TABLE game_snapshots DROP CONSTRAINT test_no_trade_snapshot')
        }
        rollbackChecked = true
      }

      if ((trade.kind === 'buy' && !concurrentBuy) || (trade.kind === 'sell' && !concurrentSell)) {
        const pair = await Promise.all([post(actionPath, command, key), post(actionPath, command, randomUUID())])
        assert.deepEqual(pair.map(item => item.status).sort(), [200, 409])
        response = pair.find(item => item.status === 200)!
        const conflict = await pair.find(item => item.status === 409)!.json()
        assert.equal(conflict.error.code, 'STATE_VERSION_CONFLICT')
        const committedKey = (await history()).at(-1)!.idempotencyKey
        const duplicate = await post(actionPath, command, committedKey)
        assert.equal(duplicate.status, 200)
        retried = await duplicate.json()
        const changed = await post(actionPath, { ...command, payload: { ...trade, amount: trade.amount + 1 } }, committedKey)
        assert.equal(changed.status, 409)
        assert.equal((await changed.json()).error.code, 'IDEMPOTENCY_KEY_REUSED')
        if (trade.kind === 'buy') concurrentBuy = true
        else concurrentSell = true
      } else if (!lostChecked) {
        dropResponse = true
        await assert.rejects(post(actionPath, command, lostKey))
        assert.equal((await history()).at(-1)!.idempotencyKey, lostKey)
        response = await post(actionPath, command, lostKey)
        lostChecked = true
      } else response = await post(actionPath, command, key)

      const staleTrade = await post(actionPath, command, randomUUID())
      assert.equal(staleTrade.status, 409)
      assert.equal((await staleTrade.json()).error.code, 'STATE_VERSION_CONFLICT')
      const stale = await post(quotePath, quoteRequest)
      assert.equal(stale.status, 409)
      assert.equal((await stale.json()).error.code, 'STATE_VERSION_CONFLICT')
      assert.equal((await post(actionPath, { ...command, expectedStateVersion: version + 1 }, randomUUID())).status, 422)
      assert.equal(expected.phase, 'rolling')
      assert.equal(expected.rng, game.rng)
      assert.deepEqual(expected.market, game.market)
      const restored = await read(id, authorization, true)
      assert.equal(restored.status, 200)
      assert.equal(restored.headers.get('cache-control'), 'no-store')
      assert.equal((await restored.json()).session.stateVersion, version + 1)
      if (trade.kind === 'buy') bought.add(trade.asset)
      else sold.add(trade.asset)
    }

    if (response.status !== 200) assert.fail('Unexpected trade response ' + response.status + ': ' + await response.text())
    const value = await response.json()
    if (retried !== undefined) assert.deepEqual(retried, value)
    assert.equal(value.stateVersion, version + 1)
    assert.deepEqual(value.state.portfolio, expected.portfolio)
    assert.deepEqual(value.state.holdings.stocks, expected.stockHoldings)
    assert.deepEqual(value.state.holdings.gold, { units: expected.goldUnits, costBasis: expected.goldCostBasis })
    assert.deepEqual(value.state.holdings.bonds, expected.bondLots.map(lot => ({
      id: lot.id, units: lot.units, principal: lot.principal, status: lot.status,
      issuerId: lot.credit?.issuerId, costBasis: lot.credit?.costBasis,
    })))
    game = expected
  }

  assert.ok(concurrentBuy && concurrentSell && rollbackChecked && lostChecked)
  assert.deepEqual([...bought].sort(), ['bonds', 'gold', 'stocks'])
  assert.deepEqual([...sold].sort(), ['bonds', 'gold', 'stocks'])
  assert.equal(game.phase, 'finished')
  assert.equal(game.summaries.length, 4)
  const log = await history()
  const snapshots = await database.db.select({
    version: gameSnapshots.stateVersion,
    schemaVersion: gameSnapshots.schemaVersion,
    digest: sql<string>`encode(sha256(convert_to(${gameSnapshots.payload}, 'UTF8')), 'hex')`,
  }).from(gameSnapshots).where(eq(gameSnapshots.sessionId, id)).orderBy(gameSnapshots.stateVersion)
  assert.equal(log.length, plan.length)
  assert.equal(snapshots.length, plan.length + 1)
  let replay = initial
  assert.equal(snapshots[0].digest, digest(serializeLog(replay)))
  for (const [index, action] of log.entries()) {
    assert.equal(action.sequence, index + 1)
    const command = { actionId: action.actionType, payload: action.payload, expectedStateVersion: index } as Command
    assert.deepEqual(command, plan[index])
    // JSONB sorts object keys. Restore the action schema field order before canonical log serialization.
    const parsed = gameActionBody.parse(command) as Command
    replay = canonicalStep(replay, parsed)
    assert.equal(snapshots[index + 1].version, action.sequence)
    assert.equal(snapshots[index + 1].schemaVersion, 7)
    const replayJson = serializeLog(replay)
    if (snapshots[index + 1].digest !== digest(replayJson)) {
      const [stored] = await database.db.select({ payload: gameSnapshots.payload }).from(gameSnapshots)
        .where(and(eq(gameSnapshots.sessionId, id), eq(gameSnapshots.stateVersion, action.sequence)))
      const firstDifference = [...stored.payload].findIndex((value, index) => value !== replayJson[index])
      assert.fail('Snapshot mismatch at ' + action.sequence + ' (' + action.actionType + ') near offset ' + firstDifference +
        ': ' + stored.payload.slice(firstDifference, firstDifference + 90) + ' versus ' + replayJson.slice(firstDifference, firstDifference + 90))
    }
  }
  const [final] = await database.db.select({ payload: gameSnapshots.payload }).from(gameSnapshots)
    .where(eq(gameSnapshots.sessionId, id)).orderBy(sql`${gameSnapshots.stateVersion} desc`).limit(1)
  assert.equal(digest(serializeLog(restoreSavedGame(final.payload))), digest(serializeLog(game)))
  assert.equal(digest(serializeLog(replayGameLog(JSON.parse(final.payload)))), digest(serializeLog(game)))
  const [result] = await database.db.select().from(gameResults).where(eq(gameResults.sessionId, id))
  assert.equal(result.outcome, victory(game).won ? 'victory' : 'defeat')
  assert.equal(result.stateVersion, plan.length)
  const finalState = await publicState()
  assert.equal(finalState.session.status, 'completed')
  assert.equal(finalState.session.stateVersion, plan.length)
  assert.deepEqual(finalState.state.availableActions, [])
  assert.equal((await post(actionPath, { ...first, expectedStateVersion: plan.length }, randomUUID())).status, 409)
  t.diagnostic('Natural API journey completed ' + plan.length + ' actions across all three assets')
})
