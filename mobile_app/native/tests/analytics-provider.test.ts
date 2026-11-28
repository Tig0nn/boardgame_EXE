import assert from 'node:assert/strict'
import test from 'node:test'
import Module, { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { sanitizeEvent, type AnalyticsEvent } from '../src/analytics/schema.ts'
import type PostHog from 'posthog-react-native'

test('pinned PostHog SDK sends only consented whitelisted batches, acknowledges and retries stable UUIDs', async () => {
  const native = fileURLToPath(new URL('../', import.meta.url)), require = createRequire(import.meta.url)
  const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }
  const originalLoad = loader._load, originalFetch = globalThis.fetch
  const clients: PostHog[] = [], lifecycle: ((state: string) => void)[] = []
  let subscriptions = 0
  loader._load = function(id, ...args) {
    if (id === 'react-native') return { Platform: { OS: 'android', Version: 35 }, NativeModules: {},
      AppState: { currentState: 'active', addEventListener(_event: string, callback: (state: string) => void) { subscriptions++; lifecycle.push(callback); return { remove() {} } } },
      Dimensions: { get: () => ({ width: 384, height: 824 }) }, TurboModuleRegistry: { get: () => null } }
    if (id.startsWith('expo-') || id === '@react-native-async-storage/async-storage') return {}
    return originalLoad.call(this, id, ...args)
  }
  const bridge = globalThis as unknown as Record<string, unknown>
  try {
    const sdk = require(native + '/node_modules/posthog-react-native/dist/posthog-rn.js')
    bridge.__EXE_POSTHOG_PERSISTED = sdk.PostHogPersistedProperty
    const RealPostHog: typeof PostHog = sdk.PostHog
    bridge.__EXE_REAL_POSTHOG = class extends RealPostHog {
      constructor(...args: ConstructorParameters<typeof PostHog>) { super(...args); clients.push(this) }
    }
  }
  finally { loader._load = originalLoad }
  const calls: { url: string; body: string }[] = []
  let response = 200
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: String(options?.body) })
    return new Response('{}', { status: response })
  }
  const createSdkHost = () => createServer({ root: native, configFile: false, appType: 'custom',
    ssr: { noExternal: ['posthog-react-native'] },
    server: { middlewareMode: true, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{ name: 'real-sdk-native-host', enforce: 'pre',
      resolveId(id) { if (id === 'posthog-react-native') return '\0real-sdk' },
      load(id) { if (id === '\0real-sdk') return 'export default globalThis.__EXE_REAL_POSTHOG; export const PostHogPersistedProperty=globalThis.__EXE_POSTHOG_PERSISTED' } }] })
  const server = await createSdkHost()
  try {
    const provider = await server.ssrLoadModule('/src/analytics/posthog-provider.ts')
    assert.equal(provider.providerConfig('phx_personal_not_allowed', 'https://us.i.posthog.com'), null)
    assert.equal(provider.providerConfig('phc_synthetic_test_only', 'https://arbitrary.example'), null)
    const config = { projectKey: 'phc_synthetic_test_only', host: 'https://us.i.posthog.com' }
    const e: AnalyticsEvent = { id: '12345678-1234-5123-8123-123456789abc', anonymousId: '87654321-1234-4123-8123-123456789abc', name: 'app_open',
      properties: { schema_version: 1, platform: 'android', app_build: '9', test_mode: true,
        first_seen: '2026-11-27T00:00:00.000Z', occurred_at: '2026-11-27T00:00:00.000Z',
        visit_id: '12345678-1234-4123-8123-123456789abc', opening: 'cold_start',
        email: 'must-not-leak', cash: 50000000 } }
    await provider.sendPosthog(config, [e], new AbortController().signal)
    assert.equal(calls.length, 1)
    assert.equal(new URL(calls[0].url).pathname.replace(/\/$/, ''), '/batch')
    const batch = JSON.parse(calls[0].body).batch
    assert.equal(batch.length, 1); assert.equal(batch[0].uuid, e.id)
    assert.equal(batch[0].distinct_id, e.anonymousId)
    assert.equal(batch[0].properties.distinct_id, e.anonymousId)
    assert.equal(clients[0].getDistinctId(), e.anonymousId, 'batch cleanup never rotates SDK identity')
    assert.equal(clients[0].optedOut, true, 'SDK remains opted out between controlled sends')
    assert.deepEqual(Object.keys(batch[0].properties).sort(), [...Object.keys(sanitizeEvent(e)!.properties), 'distinct_id', 'token', '$geoip_disable', '$process_person_profile'].sort())
    assert.doesNotMatch(calls[0].body, /must-not-leak|50000000|\$device|\$os|\$session|\$identify/)
    response = 503
    await assert.rejects(provider.sendPosthog(config, [e], new AbortController().signal))
    assert.equal(JSON.parse(calls.at(-1)!.body).batch[0].distinct_id, e.anonymousId, 'failed second batch keeps the installation ID')
    response = 200
    await provider.sendPosthog(config, [e], new AbortController().signal)
    assert.equal(JSON.parse(calls.at(-1)!.body).batch[0].uuid, e.id)
    for (const call of calls) {
      const retry = JSON.parse(call.body).batch
      assert.equal(retry.length, 1, 'EXE outbox owns retries; SDK must not retain a second copy')
      assert.equal(retry[0].distinct_id, e.anonymousId, 'wire identity, not just properties.distinct_id')
    }
    for (const game of ['11111111-1111-5111-8111-111111111111', '22222222-2222-5222-8222-222222222222']) {
      await provider.sendPosthog(config, [{ ...e, id: game, name: 'game_started',
        properties: { ...e.properties, game_id: game, mode: 'local', start_reason: 'fresh' } }], new AbortController().signal)
      assert.equal(JSON.parse(calls.at(-1)!.body).batch[0].distinct_id, e.anonymousId, 'two games belong to the same anonymous installation')
    }
    const beforeLifecycle = calls.length
    for (const state of ['background', 'active']) for (const listener of lifecycle) listener(state)
    await clients[0].flush()
    assert.equal(clients[0].getDistinctId(), e.anonymousId)
    assert.equal(calls.length, beforeLifecycle, 'foreground/background cannot bypass the controlled transport')
    assert.equal(subscriptions, 1, 'one SDK AppState listener, not a leak per flush/retry')
    const previous = calls.length, revoked = new AbortController(); revoked.abort()
    await assert.rejects(provider.sendPosthog(config, [e], revoked.signal))
    assert.equal(calls.length, previous)
    let entered: () => void = () => {}
    const waiting = new Promise<void>(resolve => { entered = resolve })
    let aborted = false
    globalThis.fetch = async (_url, options) => {
      entered()
      return new Promise<Response>((_resolve, reject) => options?.signal?.addEventListener('abort', () => {
        aborted = true; reject(Error('consent aborted'))
      }, { once: true }))
    }
    const during = new AbortController(), pending = provider.sendPosthog(config, [e], during.signal)
    await waiting; during.abort(); await assert.rejects(pending)
    assert.equal(aborted, true, 'revocation aborts the real SDK HTTP request')
    assert.equal(clients[0].optedOut, true)
    const persisted = bridge.__EXE_POSTHOG_PERSISTED as { Queue: Parameters<PostHog['getPersistedProperty']>[0] }
    assert.deepEqual(clients[0].getPersistedProperty(persisted.Queue), [], 'revoked/failed SDK data cannot leak into a later batch')
    globalThis.fetch = async (url, options) => {
      calls.push({ url: String(url), body: String(options?.body) }); return new Response('{}', { status: 200 })
    }
    const afterWithdrawal = calls.length
    for (const state of ['background', 'active']) for (const listener of lifecycle) listener(state)
    await clients[0].flush()
    assert.equal(calls.length, afterWithdrawal, 'withdrawn SDK queue cannot retry on a lifecycle callback')
    const renewed = { ...e, id: '33333333-3333-5333-8333-333333333333', anonymousId: '44444444-4444-4444-8444-444444444444',
      properties: { ...e.properties, first_seen: '2026-11-28T00:00:00.000Z', occurred_at: '2026-11-28T00:00:00.000Z' } }
    await provider.sendPosthog(config, [renewed], new AbortController().signal)
    const fresh = JSON.parse(calls.at(-1)!.body).batch
    assert.equal(fresh.length, 1)
    assert.equal(fresh[0].uuid, renewed.id)
    assert.equal(fresh[0].distinct_id, renewed.anonymousId, 'explicit re-consent adopts the new durable identity without identify/reset')
    assert.doesNotMatch(calls.at(-1)!.body, new RegExp(e.anonymousId))
    assert.equal(subscriptions, 1, 're-consent reuses the SDK without leaking AppState listeners')
    // A new module/SDK instance models process restart, bootstrapped with the
    // identity restored from the existing durable consent/outbox record.
    const reboot = await createSdkHost()
    try {
      const restoredProvider = await reboot.ssrLoadModule('/src/analytics/posthog-provider.ts')
      const restoredEvent = { ...renewed, id: '55555555-5555-5555-8555-555555555555' }
      await restoredProvider.sendPosthog(config, [restoredEvent], new AbortController().signal)
      const afterRestart = JSON.parse(calls.at(-1)!.body).batch
      assert.equal(afterRestart.length, 1)
      assert.equal(afterRestart[0].distinct_id, renewed.anonymousId)
      assert.equal(afterRestart[0].properties.distinct_id, renewed.anonymousId)
      assert.equal(afterRestart[0].uuid, restoredEvent.id)
      assert.equal(clients[1].getDistinctId(), renewed.anonymousId)
      assert.equal(clients[1].optedOut, true)
    } finally { await reboot.close() }
  } finally { await server.close(); globalThis.fetch = originalFetch; delete bridge.__EXE_REAL_POSTHOG; delete bridge.__EXE_POSTHOG_PERSISTED }
})
