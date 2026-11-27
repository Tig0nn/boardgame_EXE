# Android gameplay analytics

Optional PostHog React Native 4.87.3, Expo SDK 57. All collection is opt-in in Settings, available from both the chapter map and game. No provider configuration: the SDK is not initialized and no events/identity are collected. No consent: only the consent choice is stored. Gameplay, saves and account operations never await analytics.

## Public build configuration

Use the existing native `.env.example`. Owner supplies a PostHog **public capture project key** (`phc_…`) and its matching ingestion region (`https://us.i.posthog.com` or `https://eu.i.posthog.com`). Never supply a personal/admin token. These public settings are embedded by Metro at build time. Set `EXPO_PUBLIC_EXE_ANALYTICS_TEST_MODE=1` for QA; use `0` for a friends build so dashboards can filter QA out. Keep staging API/Auth and Gemini OFF unchanged.

Owner manages the provider account separately. Review retention/access controls and enable **Discard client IP data** in PostHog before gathering friends' data if IP storage is unwanted. The SDK disables geolocation enrichment, but the ingestion service still receives a network connection; the APK cannot guarantee provider-side IP handling. No advertising ID is requested. No screen capture, autocapture, crash/error capture, surveys, feature flags, push tracking, Auth identify or person profiles are used. SDK HTTP is restricted to the configured capture `/batch/` endpoint. No provider account/settings are created or changed by this code.

## Schema v1

Each event has a stable UUID, anonymous installation UUID (PostHog `distinct_id`), `schema_version=1`, `platform=android`, decimal-string `app_build`, boolean `test_mode`, ISO `first_seen`, ISO `occurred_at`, and UUID `visit_id`. All additional properties are reconstructed from a whitelist, including when reading the disk outbox. No email, name, account ID, original Cloud Save ID, seed, amounts, journal or save payload is sent.

| Event | Additional fields | Trigger / deduplication |
| --- | --- | --- |
| `app_open` | `opening`: cold_start / foreground / consent_enabled | Cold start or new foreground session after >=30 minutes background; one per visit ID. Enabling consent while active starts the first measurable visit. |
| `game_started` | `game_id`, `mode`: local/cloud, `start_reason`: fresh/replay | Committed fresh local game or new cloud creation followed by a successful read, once per game. Opening an existing cloud/local save is not a start. |
| `lap_completed` | `game_id`, `mode`, `lap`: 1–4 | A newly added canonical lap summary, once per game/lap. Not current position or React renders. |
| `game_completed` | `game_id`, `mode`, `outcome`: victory/defeat/insolvent, `completed_laps`: 0–4, `completed_four_laps` | Transition into canonical finished state, once per game. Insolvency before lap 4 is not a four-lap completion. |
| `replay_started` | `game_id`, `mode` | Explicit new-game action from Result, once per new game; also emits game_started with start_reason=replay. |
| `return_visit` | `days_since_first_seen` | Actual activation in elapsed 24-hour bucket since first consenting configured use; at most once per bucket. D1 = bucket 1 ([24h,48h)), D7 = bucket 7 ([168h,192h)). No event is invented for missing days. |

Unique players means **consenting installations**, not unique human beings or Supabase users. Reinstall, clearing storage or revoking/re-enabling consent creates a new identity. Games use a hash scoped to that anonymous installation and local/cloud mode; a restored local game keeps its seed, hence its game ID. Open count = app_open count; game count = distinct game_id on game_started; four-lap finishers = distinct anonymous IDs with game_completed.completed_four_laps=true. D1/D7 denominator is consenting first_seen cohort, numerator actual return_visit in that bucket, filtered by test_mode. Device clock changes can affect retention; no live D7 result is claimed by clock-controlled unit tests.

## Persistence / privacy / failure handling

One separate AsyncStorage key `exe:analytics:consent-and-outbox:v1` atomically stores consent, anonymous identity, first_seen, dedupe ledger and pending events. It never reads/writes the gameplay save or SecureStore. No historical backfill when mounting/restoring completed games. Outbox: max 200 events, 30-day TTL, max 256 KB; ledger: last 128 games. Oldest events are dropped under capacity pressure (best-effort analytics, not a financial audit log).

Batches contain <=20 events. HTTP/network failures keep UUIDs and timestamps; exponential retry backoff is bounded at 60 seconds, attempted by a 30-second active-app timer and later lifecycle/game events. Process restart retains the outbox. Server retry deduplication uses the same event UUID; dashboards should count distinct game_id/UUID rather than raw retried attempts. No claim of exactly-once delivery across all provider failures. SDK memory has one bounded client, no second durable queue. A batch is removed only after a successful capture HTTP acknowledgement and unchanged consent epoch. Storage failures disable analytics, never gameplay. Consent withdrawal immediately aborts in-flight transport, clears local pending identity/events and blocks new collection. Previously accepted provider data is not automatically deleted; a request already delivered cannot be recalled.

The consent/outbox record remains the **single durable anonymous identity**; adding SDK file persistence would introduce a second identity/store to reconcile with pending UUIDs and first_seen. Before an eligible batch, the adapter restores that same ID into the SDK's public persisted AnonymousId property, clears any identified DistinctId, and keeps PersonMode anonymous. Both the wire-level distinct_id and properties.distinct_id must match it. Ordinary batches, retry, foreground/background and process restart never rotate the identity. No Auth ID, email, identify or alias is used.

The adapter never calls reset(): the pinned SDK's reset rotates identity, clears opted-out state and preserves queued events. Instead, batch cleanup closes the transport gate, opts the SDK out and empties only its transient Queue. Failed/aborted events remain solely in EXE's durable outbox until retry or withdrawal. On withdrawal EXE aborts transport and removes its pending events/identity; SDK callbacks cannot send while idle or revoked. Explicit re-consent creates a fresh anonymous ID and first_seen, then hydrates the same SDK client with that identity before opt-in. This intentionally starts a new retention cohort without linking it to the withdrawn identity. Consent does not affect the separate local game save.

## Verification and next APK

Tests use deterministic clocks/storage plus the pinned SDK with a mocked HTTP boundary; no live PostHog, gameplay cloud writes or Gemini requests. Verify the actual batch-envelope distinct_id, not only the nested property, including after a failed batch and SDK process restart. Financial Health/Result v9, currency glyph fallback and wrapping fix are already present in main. Signing scripts/plugins stay unchanged.

Android v11 was accepted on S22 for anonymous app_open identity, restart, offline delivery and revoke/re-consent. Five real QA events had stable IDs within each consent epoch, distinct UUIDs and test_mode=true. That acceptance does not cover gameplay-event delivery or elapsed real-time D1/D7 retention. Earlier v10 split-identity QA data is not repaired or linked retroactively.

VersionCode 12 is a source-only friend candidate. Use an explicit private friend profile with EXPO_PUBLIC_EXE_ANALYTICS_TEST_MODE=0, while keeping QA configuration at 1. Missing test-mode configuration remains QA by default. Persisted QA events retain their original test_mode/app_build/UUID after an upgrade; they are never relabeled as friend traffic. Do not install the friend profile on a QA device to complete runtime coverage. See [FRIEND_BETA.md](./FRIEND_BETA.md) for release gates, filter and non-destructive test planning. No v12 APK has been built, signed, installed or distributed by this preparation.

SDK references: https://posthog.com/docs/libraries/react-native and https://posthog.com/docs/references/posthog-react-native ; IP handling: https://posthog.com/docs/privacy/data-storage .
