import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createInterface } from 'node:readline/promises'
import { performance } from 'node:perf_hooks'
import { sql } from 'drizzle-orm'
import { decodeJwt } from 'jose'
import { createDatabase } from '../src/db/client.ts'
import { stagingConnection, stagingPoolOptions } from '../src/db/staging.ts'
import { createAuthenticator } from '../src/auth.ts'
import { transitionB18, officialB18Result } from '../src/services/b18-actions.ts'
import { gameActionBody } from '../src/validation.ts'
import { createMultiCourseGame } from '../../../src/game/new-game.ts'
import { serializeLog } from '../../../src/game/log.ts'
import { replayGameLog } from '../../../scripts/diagnostics/replay-game-log.ts'

const ref = 'yqikecqeijeaygmmjdyg'
const issuer = 'https://' + ref + '.supabase.co/auth/v1'
const authenticate = createAuthenticator({ issuer, audience: 'authenticated', jwksUrl: new URL(issuer + '/.well-known/jwks.json') })
const require = createRequire(import.meta.url)

async function verifyReplay(owner: string, sessionId: string, expectedResult: unknown, lostKey: string, raceKey: string) {
  const env = {
    EXE_ENV: 'staging', EXE_STAGING_PROJECT_REF: ref, AUTH_ISSUER: issuer, EXE_DB_POOL_MAX: '1',
    DATABASE_URL: readFileSync(process.env.DATABASE_URL_FILE!, 'utf8').trim(),
    EXE_STAGING_DB_CA_FILE: process.env.EXE_STAGING_DB_CA_FILE,
  }
  const target = stagingConnection(env, 'runtime')
  const db = createDatabase(target.url, stagingPoolOptions(target))
  try {
    return await db.db.transaction(async tx => {
      const { rows: [session] } = await tx.execute<{
        seed: string; initial_savings: number; savings_term: 1 | 2 | 3; state_version: number; status: string;
      }>(sql`SELECT seed,initial_savings,savings_term,state_version,status FROM game_sessions
        WHERE id=${sessionId} AND user_id=${owner}`)
      assert.equal(session?.status, 'completed')
      assert.ok(session.state_version > 0 && session.state_version <= 120)
      const { rows: actions } = await tx.execute<{
        sequence: number; action_type: string; payload: unknown; idempotency_key: string;
      }>(sql`SELECT sequence,action_type,payload,idempotency_key FROM game_actions WHERE session_id=${sessionId} ORDER BY sequence`)
      assert.equal(actions.length, session.state_version)
      assert.equal(actions.filter(row => row.idempotency_key === lostKey).length, 1)
      assert.equal(actions.filter(row => row.idempotency_key === raceKey).length, 1)
      let game = createMultiCourseGame(session.seed, session.initial_savings, session.savings_term)
      let savedCount = 0
      for (let first = 0; first <= actions.length; first += 4) {
        // Bound the amount of JSON hashed by each database statement.
        const { rows: snapshots } = await tx.execute<{ state_version: number; schema_version: number; hash: string }>(
          sql`SELECT state_version,schema_version,encode(sha256(convert_to(payload,'UTF8')),'hex') AS hash
          FROM game_snapshots WHERE session_id=${sessionId} AND state_version BETWEEN ${first} AND ${first + 3}
          ORDER BY state_version`)
        for (const snapshot of snapshots) {
          const version = savedCount++
          assert.equal(snapshot.state_version, version)
          assert.equal(snapshot.schema_version, 7)
          if (version > 0) {
            const action = actions[version - 1]
            assert.equal(action.sequence, version)
            game = transitionB18(game, gameActionBody.parse({
              actionId: action.action_type, payload: action.payload, expectedStateVersion: version - 1,
            }))
          }
          const bytes = serializeLog(game)
          assert.equal(snapshot.hash, createHash('sha256').update(bytes).digest('hex'))
          if (version === actions.length) assert.equal(serializeLog(replayGameLog(JSON.parse(bytes))), bytes)
        }
      }
      assert.equal(savedCount, actions.length + 1)
      assert.equal(game.summaries.length, 4)
      const { rows: results } = await tx.execute<{ state_version: number; outcome: string; proceeds: string }>(
        sql`SELECT state_version,outcome,lawful_proceeds_vnd::text AS proceeds FROM game_results WHERE session_id=${sessionId}`)
      assert.equal(results.length, 1)
      assert.equal(results[0].state_version, actions.length)
      const result = { outcome: results[0].outcome, lawfulProceedsVnd: results[0].proceeds }
      assert.deepEqual(result, officialB18Result(game))
      assert.deepEqual(result, expectedResult)
      return { actions: actions.length, snapshots: savedCount, result }
    }, { accessMode: 'read only', isolationLevel: 'repeatable read' })
  } finally {
    await db.close()
  }
}

async function run() {
  assert.equal(process.env.EXE_ACCEPTANCE_PROJECT_REF, ref, 'Requires approved staging project confirmation')
  assert.ok(process.env.DATABASE_URL_FILE && process.env.EXE_STAGING_DB_CA_FILE, 'Missing staging DB secret file or CA')
  const origin = new URL(process.env.EXE_ACCEPTANCE_ORIGIN!)
  assert.equal(origin.protocol, 'https:')
  assert.equal(origin.href, origin.origin + '/')
  assert.ok(!['localhost', '127.0.0.1'].includes(origin.hostname))
  const health = await fetch(new URL('/ready', origin), { redirect: 'error', signal: AbortSignal.timeout(8000) })
  assert.equal(health.status, 200)
  assert.deepEqual(await health.json(), { status: 'ready' })
  const unauthorized = await fetch(new URL('/v1/game-sessions', origin), { redirect: 'error', signal: AbortSignal.timeout(8000) })
  assert.equal(unauthorized.status, 401)

  const { chromium } = require(process.env.EXE_PLAYWRIGHT_MODULE || 'playwright')
  const browser = await chromium.launch({ headless: false, executablePath: process.env.EXE_CHROMIUM_PATH || undefined })
  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  let writes = 0
  let createAllowed = true
  let sessionId: string | undefined
  let unexpectedFailures = 0
  const operations = new Set<string>()
  const timings: number[] = []
  try {
    async function device(name: string, storageState?: unknown) {
      const context = await browser.newContext({ viewport: { width: 390, height: 850 }, storageState })
      const page = await context.newPage()
      const observed = { bearer: undefined as string | undefined, pkce: false, refresh: false, reopenedVersion: undefined as number | undefined }
      await context.route('**/auth/v1/**', async (route: { request: () => { url: () => string }; continue: () => Promise<void>; abort: () => Promise<void> }) => {
        if (new URL(route.request().url()).origin !== new URL(issuer).origin) return route.abort()
        return route.continue()
      })
      type WireRequest = { method: () => string; url: () => string; headers: () => Record<string, string>; postDataJSON: () => unknown }
      type WireResponse = {
        url: () => string; status: () => number; request: () => WireRequest; json: () => Promise<unknown>;
        headers: () => Record<string, string>;
      }
      const started = new WeakMap<WireRequest, number>()
      page.on('request', (request: WireRequest) => { started.set(request, performance.now()) })
      page.on('response', (response: WireResponse) => {
        const url = new URL(response.url())
        if (url.origin === new URL(issuer).origin && response.status() === 200) {
          if (url.searchParams.get('grant_type') === 'pkce') observed.pkce = true
          if (url.searchParams.get('grant_type') === 'refresh_token') observed.refresh = true
        }
        if (url.origin !== origin.origin || !url.pathname.startsWith('/v1/game-sessions')) return
        const request = response.request()
        observed.bearer = request.headers().authorization ?? observed.bearer
        if (response.status() >= 500) {
          unexpectedFailures++
          const requestId = response.headers()['x-request-id'] ?? ''
          console.error(JSON.stringify({ event: 'hosted_api_error', status: response.status(),
            requestId: /^[0-9a-f-]{36}$/.test(requestId) ? requestId : undefined }))
        }
        if (request.method() === 'GET' && response.status() === 200 && url.pathname === '/v1/game-sessions/' + sessionId) {
          void response.json().then(data => {
            observed.reopenedVersion = (data as { session: { stateVersion: number } }).session.stateVersion
          }).catch(() => {})
        }
        if (response.status() !== 200 || !url.pathname.endsWith('/actions')) return
        const start = started.get(request)
        if (start !== undefined) timings.push(Math.round(performance.now() - start))
        const command = gameActionBody.safeParse(request.postDataJSON())
        if (!command.success) return
        const { actionId, payload } = command.data
        if (actionId === 'fund') operations.add('funding')
        if (actionId === 'trade') {
          if (!('asset' in payload)) operations.add('bank')
          else if (payload.asset === 'business') operations.add('business')
          else operations.add('trading')
        }
        void response.json().then(data => {
          const { state } = data as { state?: { phase: string } }
          if (state?.phase === 'summary') operations.add('start')
          if (state?.phase === 'rebalancing') operations.add('rebalance')
        }).catch(() => {})
      })
      await page.route('**/v1/game-sessions**', async (route: { request: () => WireRequest; continue: () => Promise<void>; abort: () => Promise<void> }) => {
        const request = route.request()
        const url = new URL(request.url())
        if (url.origin !== origin.origin) return route.abort()
        if (request.method() === 'GET') return route.continue()
        if (name === 'B' || unexpectedFailures >= 2 || ++writes > 140) return route.abort()
        if (url.pathname === '/v1/game-sessions') {
          if (name !== 'A' || !createAllowed) return route.abort()
          createAllowed = false
        } else if (!sessionId || !url.pathname.startsWith('/v1/game-sessions/' + sessionId + '/')) return route.abort()
        return route.continue()
      })
      await page.goto(origin.href, { waitUntil: 'domcontentloaded' })
      return { page, context, observed }
    }

    const a = await device('A')
    await prompt.question('A: đăng ký, xác nhận PKCE ở cửa sổ này, đăng xuất, đăng nhập lại, mở danh sách. Sau đó Enter. ')
    assert.ok(a.observed.pkce, 'Expected a real PKCE exchange for A')
    const owner = await authenticate(a.observed.bearer)
    const headers = (bearer: string | undefined) => ({ authorization: bearer ?? '' })
    async function get(path: string, bearer = a.observed.bearer) {
      return fetch(new URL(path, origin), { headers: headers(bearer), redirect: 'error', signal: AbortSignal.timeout(12_000) })
    }
    assert.deepEqual((await (await get('/v1/game-sessions')).json()).sessions, [])
    const created = a.page.waitForResponse((response: { url: () => string; status: () => number }) =>
      response.url() === origin.origin + '/v1/game-sessions' && response.status() === 201)
    await prompt.question('A: tạo đúng một ván B18 và dừng ở vòng 1. Sau đó Enter. ')
    sessionId = (await (await created).json()).session.id
    assert.match(sessionId!, /^[0-9a-f-]{36}$/)
    const base = '/v1/game-sessions/' + sessionId
    const other = await device('A2')
    const b = await device('B')
    await prompt.question('A2: đăng nhập A, mở ván vừa tạo. B: đăng ký, xác nhận PKCE, mở danh sách riêng. Sau đó Enter. ')
    assert.equal(await authenticate(other.observed.bearer), owner)
    assert.ok(b.observed.pkce)
    assert.notEqual(await authenticate(b.observed.bearer), owner)
    assert.deepEqual((await (await get('/v1/game-sessions', b.observed.bearer)).json()).sessions, [])
    assert.equal((await get(base, b.observed.bearer)).status, 404)

    const id = () => globalThis.crypto.randomUUID()
    async function advance(bearer: string | undefined, key: string, expectedStateVersion: number) {
      assert.ok(++writes <= 140)
      return fetch(new URL(base + '/actions', origin), {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12_000),
        headers: { ...headers(bearer), 'content-type': 'application/json', 'idempotency-key': key },
        body: JSON.stringify({ actionId: 'advance', payload: {}, expectedStateVersion }),
      })
    }
    const keyA = id()
    const keyB = id()
    const race = await Promise.all([advance(a.observed.bearer, keyA, 0), advance(other.observed.bearer, keyB, 0)])
    assert.deepEqual(race.map(response => response.status).sort(), [200, 409])
    const raceKey = race[0].status === 200 ? keyA : keyB
    assert.equal((await race.find(response => response.status === 409)!.json()).error.code, 'STATE_VERSION_CONFLICT')
    assert.equal((await advance(b.observed.bearer, id(), 1)).status, 404)

    let lostKey: string | undefined
    let retryMatched = false
    await a.page.route(origin.origin + base + '/actions', async (route: {
      request: () => { headers: () => Record<string, string> }; fallback: () => Promise<void>; abort: () => Promise<void>;
      fetch: () => Promise<{ status: () => number }>;
    }) => {
      if (retryMatched) return route.fallback()
      const key = route.request().headers()['idempotency-key']
      if (lostKey) {
        retryMatched = key === lostKey
        if (!retryMatched) return route.abort()
        return route.fallback()
      }
      assert.ok(++writes <= 140)
      const reply = await route.fetch()
      assert.equal(reply.status(), 200)
      lostKey = key
      await route.abort()
    })
    await prompt.question('A: reload, mở lại ván ở version 1, gieo xúc xắc, bấm thử lại khi mất phản hồi. Dừng và Enter. ')
    assert.ok(lostKey && retryMatched)
    const checkpoint = await (await get(base)).json()
    assert.equal(checkpoint.session.stateVersion, 2)
    // Close the first browser context and restore its session in memory only.
    const savedAuth = await a.context.storageState()
    await a.context.close()
    const reopened = await device('A-reopened', savedAuth)
    await prompt.question('A-reopened: mở danh sách và tiếp tục ván từ phiên đã lưu. Sau đó Enter. ')
    assert.equal(await authenticate(reopened.observed.bearer), owner)
    assert.equal(reopened.observed.reopenedVersion, 2)
    await reopened.context.close()
    await other.context.setOffline(true)
    await prompt.question('A2 hiện offline. Thử tải state trong giao diện, rồi Enter để khôi phục mạng. ')
    await other.context.setOffline(false)
    await prompt.question('A2: kiểm tra reconnect, mở ván version 2. Enter trước khi chơi tiếp. ')
    assert.equal(other.observed.reopenedVersion, 2)
    await prompt.question('A2: chơi đủ 4 vòng qua UI. Enter khi UI hiện kết quả chính thức. ')
    assert.ok(await other.page.getByText('Kết quả chính thức', { exact: false }).count(), 'A2 must display the official result')
    const finished = await (await get(base, other.observed.bearer)).json()
    assert.equal(finished.state.phase, 'finished')
    assert.equal(finished.state.summaries.length, 4)
    for (const operation of ['trading', 'bank', 'business', 'funding', 'start', 'rebalance']) {
      assert.ok(operations.has(operation), 'Missing ' + operation)
    }
    await prompt.question('Xác nhận đã đóng và mở lại trình duyệt bằng cùng hồ sơ khi thử bổ sung, và đã kiểm tra offline/reconnect. Nhập VERIFIED rồi Enter. ').then(answer => {
      assert.equal(answer, 'VERIFIED')
    })
    const capturedBearer = other.observed.bearer!
    const expiry = decodeJwt(capturedBearer.slice('Bearer '.length)).exp!
    const expiryTime = new Date(expiry * 1000).toISOString()
    await prompt.question('Giữ cửa sổ A2 mở để SDK refresh. Token đã giữ hết hạn lúc ' + expiryTime + '. Sau thời điểm này, dùng lại ván trong A2 rồi Enter. ')
    assert.ok(Date.now() >= expiry * 1000)
    assert.equal((await get(base, capturedBearer)).status, 401)
    assert.ok(other.observed.refresh, 'Expected a real hosted refresh response on A2')
    assert.equal((await get(base, other.observed.bearer)).status, 200)
    assert.equal(unexpectedFailures, 0)
    const evidence = await verifyReplay(owner, sessionId!, finished.result, lostKey, raceKey)
    console.log(JSON.stringify({ project: ref, writes, ...evidence, maxActionResponseMs: Math.max(0, ...timings) }))
  } finally {
    prompt.close()
    await browser.close()
  }
}

run().catch(error => {
  // Assertion values and Playwright errors may include tokens, confirmation links or email addresses.
  console.error(JSON.stringify({ event: 'hosted_acceptance_failed', code: error.cause?.code ?? error.code ?? error.name,
    check: error.stack?.split('\n').find((line: string) => line.includes('staging-acceptance.ts'))?.match(/staging-acceptance\.ts:\d+:\d+/)?.[0] }))
  process.exitCode = 1
})
