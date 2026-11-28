import PostHog, { PostHogPersistedProperty, type PostHogOptions } from 'posthog-react-native'
import { sanitizeEvent, type AnalyticsEvent } from './schema.ts'

export type PosthogConfig = { projectKey: string; host: string }
export function providerConfig(projectKey: string | undefined, host: string | undefined): PosthogConfig | null {
  if (!projectKey || !/^phc_[A-Za-z\d_-]{10,}$/.test(projectKey)) return null
  if (!host || !['https://us.i.posthog.com', 'https://eu.i.posthog.com'].includes(host)) return null
  return { projectKey, host }
}

type FetchOptions = Parameters<PostHog['fetch']>[1]
/** Deny all SDK background endpoints, including config/flags, before any HTTP call. */
class CaptureOnlyPosthog extends PostHog {
  accepted = false
  allowed?: () => boolean
  endpoint?: string
  consentSignal?: AbortSignal
  override fetch(url: string, options: FetchOptions): ReturnType<PostHog['fetch']> {
    if (!this.allowed?.() || this.consentSignal?.aborted || !this.endpoint || new URL(url).origin !== this.endpoint
      || !/^\/batch\/?$/.test(new URL(url).pathname)) return Promise.reject(Error('Analytics request disabled'))
    const controller = new AbortController(), abort = () => controller.abort()
    const signals = [this.consentSignal, options.signal].filter((s): s is AbortSignal => !!s)
    for (const s of signals) { if (s.aborted) abort(); s.addEventListener('abort', abort, { once: true }) }
    return super.fetch(url, { ...options, signal: controller.signal }).then(response => {
      if (response.status >= 200 && response.status < 300) this.accepted = true
      return response
    }).finally(() => {
      for (const s of signals) s.removeEventListener('abort', abort)
    })
  }
}

type Context = { live: boolean; signal: AbortSignal; anonymousId: string }
// The SDK registers an AppState listener in its constructor. Keep exactly one
// memory-only client instead of leaking a listener/client on every retry.
let cached: { config: PosthogConfig; client: CaptureOnlyPosthog; context?: Context } | undefined

export async function sendPosthog(config: PosthogConfig, events: AnalyticsEvent[], signal: AbortSignal) {
  if (!events.length) return
  if (signal.aborted) throw Error('Consent withdrawn')
  const anonymousId = events[0].anonymousId
  const context: Context = { live: true, signal, anonymousId }
  if (cached && (cached.config.host !== config.host || cached.config.projectKey !== config.projectKey)) throw Error('Provider configuration changed')
  if (cached?.context) throw Error('Analytics batch already pending')
  if (!cached) {
    const options: PostHogOptions = {
      host: config.host, defaultOptIn: false, persistence: 'memory',
      // EXE owns the single durable outbox; SDK storage stays in memory.
      flushAt: 50, maxBatchSize: 50, maxQueueSize: 100, flushInterval: 0,
      fetchRetryCount: 0, requestTimeout: 3000, disableCompression: true,
      captureAppLifecycleEvents: false, enableSessionReplay: false,
      capturePushNotificationOpened: false, capturePushNotificationSubscriptions: false,
      errorTracking: { autocapture: false }, rageClickConfig: { enabled: false },
      preloadFeatureFlags: false, disableRemoteFeatureFlags: true, disableSurveys: true,
      sendFeatureFlagEvent: false, disableGeoip: true, personProfiles: 'never', customAppProperties: {},
      setDefaultPersonProperties: false,
      bootstrap: { distinctId: anonymousId, isIdentifiedId: false },
      before_send(event) {
        const current = cached?.context
        if (!current?.live || current.signal.aborted) return null
        const clean = sanitizeEvent({ id: event.uuid, anonymousId: current.anonymousId, name: event.event, properties: event.properties })
        if (!clean) return null
        return { event: clean.name, uuid: clean.id, timestamp: new Date(String(clean.properties.occurred_at)),
          properties: { ...clean.properties, distinct_id: current.anonymousId, token: config.projectKey,
            $geoip_disable: true, $process_person_profile: false } }
      },
    }
    const client = new CaptureOnlyPosthog(config.projectKey, options)
    cached = { config, client }
    client.allowed = () => !!cached?.context?.live && !cached.context.signal.aborted
    client.endpoint = config.host
  }
  const client = cached.client
  cached.context = context; client.consentSignal = signal; client.accepted = false
  try {
    await client.ready(); if (signal.aborted) throw Error('Consent withdrawn')
    // Rehydrate the single identity owned by the durable consent/outbox record.
    // This also replaces the old in-memory ID after revoke + explicit re-opt-in.
    // identify() is intentionally never used: this is an anonymous installation.
    client.setPersistedProperty(PostHogPersistedProperty.AnonymousId, anonymousId)
    client.setPersistedProperty(PostHogPersistedProperty.DistinctId, null)
    client.setPersistedProperty(PostHogPersistedProperty.PersonMode, 'anonymous')
    if (client.getDistinctId() !== anonymousId) throw Error('Analytics identity mismatch')
    await client.optIn()
    for (const input of events) {
      const e = sanitizeEvent(input)
      if (!e || e.anonymousId !== anonymousId || signal.aborted) throw Error('Invalid analytics batch')
      client.capture(e.name, e.properties, { uuid: e.id, timestamp: new Date(String(e.properties.occurred_at)), disableGeoip: true })
    }
    // In the pinned SDK this rejects on HTTP/network failure; the EXE outbox then retains the same UUIDs.
    await client.flush()
    if (!client.accepted || signal.aborted) throw Error('Analytics batch not acknowledged')
  } finally {
    context.live = false
    await client.optOut().catch(() => {})
    // Only EXE's bounded durable outbox owns retries. reset() rotates identity,
    // clears opt-out and *preserves* the SDK queue, so it is unsafe cleanup here.
    client.setPersistedProperty(PostHogPersistedProperty.Queue, [])
    cached.context = undefined; client.consentSignal = undefined
  }
}
