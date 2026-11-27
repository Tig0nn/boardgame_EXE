import assert from 'node:assert/strict'
import test from 'node:test'
import Module, { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { sanitizeEvent, type AnalyticsEvent } from '../src/analytics/schema.ts'

test('pinned PostHog SDK sends only consented whitelisted batches, acknowledges and retries stable UUIDs', async () => {
  const native = fileURLToPath(new URL('../', import.meta.url)), require = createRequire(import.meta.url)
  const loader = Module as unknown as { _load: (id: string, ...args: unknown[]) => unknown }
  const originalLoad = loader._load, originalFetch = globalThis.fetch
  let subscriptions = 0
  loader._load = function(id, ...args) {
    if (id === 'react-native') return { Platform: { OS: 'android', Version: 35 }, NativeModules: {},
      AppState: { currentState: 'active', addEventListener() { subscriptions++; return { remove() {} } } },
      Dimensions: { get: () => ({ width: 384, height: 824 }) }, TurboModuleRegistry: { get: () => null } }
    if (id.startsWith('expo-') || id === '@react-native-async-storage/async-storage') return {}
    return originalLoad.call(this, id, ...args)
  }
  const bridge = globalThis as unknown as Record<string, unknown>
  try { bridge.__EXE_REAL_POSTHOG = require(native + '/node_modules/posthog-react-native/dist/posthog-rn.js').PostHog }
  finally { loader._load = originalLoad }
  const calls: { url: string; body: string }[] = []
  let response = 200
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: String(options?.body) })
    return new Response('{}', { status: response })
  }
  const server = await createServer({ root: native, configFile: false, appType: 'custom',
    ssr: { noExternal: ['posthog-react-native'] },
    server: { middlewareMode: true, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{ name: 'real-sdk-native-host', enforce: 'pre',
      resolveId(id) { if (id === 'posthog-react-native') return '\0real-sdk' },
      load(id) { if (id === '\0real-sdk') return 'export default globalThis.__EXE_REAL_POSTHOG' } }] })
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
    assert.equal(batch[0].properties.distinct_id, e.anonymousId)
    assert.deepEqual(Object.keys(batch[0].properties).sort(), [...Object.keys(sanitizeEvent(e)!.properties), 'distinct_id', 'token', '$geoip_disable', '$process_person_profile'].sort())
    assert.doesNotMatch(calls[0].body, /must-not-leak|50000000|\$device|\$os|\$session|\$identify/)
    response = 503
    await assert.rejects(provider.sendPosthog(config, [e], new AbortController().signal))
    response = 200
    await provider.sendPosthog(config, [e], new AbortController().signal)
    assert.equal(JSON.parse(calls.at(-1)!.body).batch[0].uuid, e.id)
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
  } finally { await server.close(); globalThis.fetch = originalFetch; delete bridge.__EXE_REAL_POSTHOG }
})
