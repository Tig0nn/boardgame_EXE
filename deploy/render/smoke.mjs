import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'

const timings = []

async function get(origin, path, expectedStatus, token, budgetMs = 12_000) {
  const started = performance.now()
  const response = await fetch(new URL(path, origin), {
    redirect: 'error',
    headers: token ? { authorization: 'Bearer ' + token } : {},
    signal: AbortSignal.timeout(budgetMs),
  })
  const durationMs = Math.round(performance.now() - started)
  assert.equal(response.status, expectedStatus, 'Unexpected response for ' + path.split('?')[0].replace(/\/game-sessions\/.+/, '/game-sessions/:id'))
  const requestId = response.headers.get('x-request-id')
  assert.match(requestId ?? '', /^[a-f0-9-]{36}$/)
  const data = await response.json()
  timings.push({ status: response.status, durationMs, requestId })
  return data
}

try {
  const origin = new URL(process.env.EXE_RENDER_ORIGIN ?? '')
  assert.ok(origin.protocol === 'https:' && origin.hostname.endsWith('.onrender.com') && origin.href === origin.origin + '/')
  assert.deepEqual(await get(origin, '/health', 200, undefined, 95_000), { status: 'ok' })
  assert.deepEqual(await get(origin, '/ready', 200), { status: 'ready' })
  assert.equal((await get(origin, '/v1/game-sessions', 401)).error.code, 'UNAUTHORIZED')
  let ownerIsolation = 'pending'
  const { EXE_SMOKE_TOKEN_A_FILE: a, EXE_SMOKE_TOKEN_B_FILE: b, EXE_SMOKE_SESSION_A: session } = process.env
  if (a || b || session) {
    assert.ok(a && b && session && /^[a-f0-9-]{36}$/i.test(session))
    const owner = readFileSync(a, 'utf8').trim()
    const outsider = readFileSync(b, 'utf8').trim()
    assert.ok(owner && outsider && owner !== outsider)
    assert.equal((await get(origin, '/v1/game-sessions/' + session, 200, owner)).session.id, session)
    assert.ok(Array.isArray((await get(origin, '/v1/game-sessions?limit=1', 200, outsider)).sessions))
    assert.equal((await get(origin, '/v1/game-sessions/' + session, 404, outsider)).error.code, 'NOT_FOUND')
    ownerIsolation = 'passed'
  }
  console.log(JSON.stringify({ origin: origin.origin, ownerIsolation, timings }))
} catch (error) {
  console.error(JSON.stringify({ event: 'render_smoke_failed', code: error.cause?.code ?? error.code ?? error.name, timings }))
  process.exitCode = 1
}
