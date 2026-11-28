import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'
import nativeConfig from '../../app.json'
import { createGameplayAnalytics } from './core.ts'
import type { AnalyticsEvent, GameSignal } from './schema.ts'

// Only the public capture project key belongs in an APK, never a personal/admin token.
const key = process.env.EXPO_PUBLIC_EXE_POSTHOG_KEY
const host = process.env.EXPO_PUBLIC_EXE_POSTHOG_HOST
const configured = !!key && /^phc_[A-Za-z\d_-]{10,}$/.test(key)
  && !!host && ['https://us.i.posthog.com', 'https://eu.i.posthog.com'].includes(host)
export const gameplayAnalytics = createGameplayAnalytics({
  configured, testMode: process.env.EXPO_PUBLIC_EXE_ANALYTICS_TEST_MODE !== '0',
  build: String(nativeConfig.expo.android.versionCode), now: Date.now, uuid: () => Crypto.randomUUID(),
  hash: text => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text), storage: AsyncStorage,
  send: async (events: AnalyticsEvent[], signal: AbortSignal) => {
    if (!configured || !key || !host || signal.aborted) throw Error('Analytics unconfigured')
    const { sendPosthog } = await import('./posthog-provider')
    if (signal.aborted) throw Error('Consent withdrawn')
    await sendPosthog({ projectKey: key, host }, events, signal)
  },
})

// No analytics promise or exception is part of the gameplay/mutation/save success path.
function safely(work: () => Promise<void>) {
  try { void work().then(() => gameplayAnalytics.flush()).catch(() => {}) } catch { /* fail-open */ }
}
function eligible() { const status = gameplayAnalytics.getSnapshot(); return status.configured && status.consent === 'enabled' && status.storageAvailable }
export function trackGameStarted(signal: () => GameSignal, replay: boolean) {
  if (eligible()) safely(() => gameplayAnalytics.gameStarted(signal(), replay))
}
export function trackGameTransition(signals: () => [GameSignal, GameSignal]) {
  if (eligible()) safely(() => { const [before, after] = signals(); return gameplayAnalytics.transition(before, after) })
}
export function analyticsForeground() { safely(() => gameplayAnalytics.activate()) }
