import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { createServer, request } from 'node:http'
import { once } from 'node:events'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'node:test'
import { buildApp } from '../src/app.ts'
import { localDatabaseUrl } from '../src/config.ts'
import { createDatabase } from '../src/db/client.ts'
import { migrateDatabase } from '../src/db/migrations.ts'

const require = createRequire(import.meta.url)
const { chromium } = require(process.env.EXE_PLAYWRIGHT_MODULE || 'playwright')
const authOrigin = 'http://127.0.0.1:58243'
const mobileOrigin = 'http://127.0.0.1:58244'
const mailOrigin = 'http://127.0.0.1:58245'
const issuer = mobileOrigin + '/auth/v1'

async function confirmationLink(email: string) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const search = await fetch(mailOrigin + '/api/v1/search?query=' + encodeURIComponent('to:' + email))
    assert.equal(search.status, 200)
    const { messages } = await search.json()
    if (messages?.length) {
      const response = await fetch(mailOrigin + '/api/v1/message/' + encodeURIComponent(messages[0].ID))
      assert.equal(response.status, 200)
      const { HTML, Text } = await response.json()
      const link = (HTML || Text).match(/https?:\/\/[^\s"<]+\/auth\/v1\/verify\?[^\s"<]+/)?.[0]?.replaceAll('&amp;', '&')
      assert.ok(link, 'Mailpit message includes the confirmation link')
      assert.equal(new URL(link).origin, mobileOrigin)
      return link
    }
    await delay(500)
  }
  throw new Error('No local confirmation mail arrived')
}

test('Mobile registers and confirms through local Supabase Auth PKCE, then resumes on another device', { timeout: 120_000 }, async t => {
  const url = localDatabaseUrl(process.env.DATABASE_URL)
  const admin = createDatabase(url.href)
  const name = 'exe_phase3c_auth_' + randomUUID().replaceAll('-', '')
  url.pathname = '/' + name
  const database = createDatabase(url.href)
  const app = buildApp(database, { issuer, audience: 'authenticated', jwksUrl: new URL(issuer + '/.well-known/jwks.json') })
  let created = false
  t.after(async () => {
    try {
      await app.close()
      if (created) await admin.pool.query('DROP DATABASE "' + name + '"')
    } finally { await admin.close() }
  })
  await admin.pool.query('CREATE DATABASE "' + name + '" TEMPLATE template0')
  created = true
  await migrateDatabase(database.db)
  const api = await app.listen({ host: '127.0.0.1', port: 0 })

  const mobileRoot = fileURLToPath(new URL('../../../mobile_app/', import.meta.url))
  const mobileRequire = createRequire(new URL('../../../mobile_app/package.json', import.meta.url))
  const vite = await import(pathToFileURL(mobileRequire.resolve('vite')).href)
  const frontend = await vite.createServer({
    root: mobileRoot, envDir: false, server: { middlewareMode: true, hmr: false, allowedHosts: ['127.0.0.1'] },
    define: {
      'import.meta.env.VITE_EXE_ONLINE': '"1"',
      // The test-only reverse proxy serves real local GoTrue. Runtime still requires HTTPS.
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(mobileOrigin.replace('http:', 'https:')),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': '"sb_publishable_local_test"',
    },
  })
  t.after(() => frontend.close())
  const gateway = createServer((incoming, outgoing) => {
    const path = incoming.url ?? '/'
    if (!path.startsWith('/auth/v1/') && !path.startsWith('/v1/')) {
      frontend.middlewares(incoming, outgoing)
      return
    }
    const destination = path.startsWith('/auth/v1/') ? new URL(path.slice('/auth/v1'.length), authOrigin) : new URL(path, api)
    const proxy = request(destination, { method: incoming.method, headers: { ...incoming.headers, host: destination.host } }, upstream => {
      outgoing.writeHead(upstream.statusCode ?? 502, upstream.headers)
      upstream.pipe(outgoing)
    })
    proxy.on('error', () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end() })
    incoming.pipe(proxy)
  })
  gateway.listen(58244, '127.0.0.1')
  await once(gateway, 'listening')
  t.after(() => new Promise<void>(resolve => gateway.close(() => resolve())))

  const browser = await chromium.launch({ headless: true, executablePath: process.env.EXE_CHROMIUM_PATH || undefined })
  t.after(() => browser.close())
  async function device() {
    const context = await browser.newContext({ viewport: { width: 390, height: 850 }, reducedMotion: 'reduce' })
    await context.route('https://127.0.0.1:58244/auth/v1/**', async (route: {
      request: () => { url: () => string }; fetch: (options: { url: string }) => Promise<unknown>;
      fulfill: (options: { response: unknown }) => Promise<void>;
    }) => {
      await route.fulfill({ response: await route.fetch({ url: route.request().url().replace('https:', 'http:') }) })
    })
    return { context, page: await context.newPage() }
  }
  type Page = Awaited<ReturnType<typeof device>>['page']
  const makeIdentity = () => ({
    email: 'player-' + randomUUID().slice(0, 10) + '@example.com',
    password: randomBytes(24).toString('base64url'),
  })
  type Identity = ReturnType<typeof makeIdentity>
  async function credentials(page: Page, identity: Identity) {
    await page.getByLabel('Email').fill(identity.email)
    await page.getByLabel('Mật khẩu').fill(identity.password)
  }
  async function signup(page: Page, identity: Identity) {
    await page.goto(mobileOrigin)
    await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click()
    await credentials(page, identity)
    const signupResponse = page.waitForResponse((response: { url: () => string }) => response.url().includes('/auth/v1/signup'))
    await page.getByRole('button', { name: 'Đăng ký', exact: true }).click()
    assert.equal((await signupResponse).status(), 200)
    await page.getByText('Hãy kiểm tra email', { exact: false }).waitFor()
    return confirmationLink(identity.email)
  }
  async function signin(page: Page, identity: Identity) {
    await page.goto(mobileOrigin)
    await credentials(page, identity)
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await page.getByRole('button', { name: 'Bắt đầu phiêu lưu' }).waitFor()
  }
  async function openList(page: Page) {
    await page.getByRole('button', { name: 'Bắt đầu phiêu lưu' }).click()
    await page.getByRole('heading', { name: 'Ván chơi của bạn' }).waitFor()
  }

  const a = makeIdentity()
  const b = makeIdentity()
  const first = await device()
  const second = await device()
  const outsider = await device()
  const exchange = first.page.waitForResponse((response: { url: () => string; status: () => number }) =>
    response.url().includes('grant_type=pkce') && response.status() === 200)
  await first.page.goto(await signup(first.page, a))
  await exchange
  await first.page.getByRole('button', { name: 'Bắt đầu phiêu lưu' }).waitFor()
  assert.equal(new URL(first.page.url()).searchParams.has('code'), false)
  await first.page.reload()
  await openList(first.page)
  await first.page.getByRole('button', { name: 'Tạo ván mới', exact: true }).click()
  const createdResponse = first.page.waitForResponse((response: { url: () => string; status: () => number }) =>
    response.url().endsWith('/v1/game-sessions') && response.status() === 201)
  await first.page.getByRole('button', { name: /Bắt đầu hành trình/ }).click()
  const createdGame = (await (await createdResponse).json()).session
  assert.equal(createdGame.stateVersion, 0)

  await signin(second.page, a)
  let rejected = false
  await second.page.route('**/v1/game-sessions?*', async (route: {
    fulfill: (response: { status: number; json: unknown }) => Promise<void>;
    continue: () => Promise<void>;
  }) => {
    if (rejected) return route.continue()
    rejected = true
    await route.fulfill({ status: 401, json: { error: { code: 'UNAUTHORIZED' } } })
  })
  const refresh = second.page.waitForResponse((response: { url: () => string; status: () => number }) =>
    response.url().includes('grant_type=refresh_token') && response.status() === 200)
  const list = second.page.waitForResponse((response: { url: () => string; status: () => number }) =>
    response.url().includes('/v1/game-sessions?') && response.status() === 200)
  await openList(second.page)
  await refresh
  assert.equal(rejected, true)
  const resumed = (await (await list).json()).sessions
  assert.equal(resumed[0].id, createdGame.id)
  assert.equal(resumed[0].stateVersion, 0)

  await outsider.page.goto(await signup(outsider.page, b))
  const otherList = outsider.page.waitForResponse((response: { url: () => string; status: () => number }) =>
    response.url().includes('/v1/game-sessions?') && response.status() === 200)
  await openList(outsider.page)
  assert.deepEqual((await (await otherList).json()).sessions, [])
  const bToken = (await otherList).request().headers().authorization
  assert.equal((await fetch(api + '/v1/game-sessions/' + createdGame.id, { headers: { authorization: bToken } })).status, 404)

  // A callback opened in a context without its verifier must fail safely and scrub the URL.
  const misplaced = await device()
  await misplaced.page.goto(mobileOrigin + '/?code=synthetic-missing-verifier&lang=vi')
  await misplaced.page.getByRole('alert').filter({ hasText: 'Không thể hoàn tất xác nhận' }).waitFor()
  assert.equal(new URL(misplaced.page.url()).search, '?lang=vi')

  await second.page.getByRole('button', { name: 'Đăng xuất' }).click()
  await second.page.getByRole('button', { name: 'Đăng nhập', exact: true }).waitFor()
  await first.page.reload()
  await first.page.getByRole('button', { name: 'Bắt đầu phiêu lưu' }).waitFor()
  await Promise.all([first.context.close(), second.context.close(), outsider.context.close(), misplaced.context.close()])
})
