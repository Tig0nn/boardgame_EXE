# Android friend Beta v12 candidate

Source preparation only. No build, signing, installation or distribution is authorized by this document. Package remains `vn.exe.boardgame.nativeapp`, versionCode is 12, and the existing Beta signing identity is required. Gameplay, Auth, Cloud Save, Result, the shared engine and the PostHog adapter are unchanged from accepted v11. Only the analytics default preference and Settings copy change for the simplified Friend Beta policy.

## Build profiles

Keep the existing QA `.env.local` at `EXPO_PUBLIC_EXE_ANALYTICS_TEST_MODE=1`. Store the friend profile outside Git as a local JSON object containing only these public settings:

| Setting | Friend profile |
| --- | --- |
| `EXPO_PUBLIC_EXE_POSTHOG_KEY` | Owner's existing public capture key for project 771278; never a personal/admin token |
| `EXPO_PUBLIC_EXE_POSTHOG_HOST` | `https://us.i.posthog.com` |
| `EXPO_PUBLIC_EXE_ANALYTICS_TEST_MODE` | `0` |
| `EXPO_PUBLIC_EXE_API_ORIGIN` | `https://exe-staging-backend.onrender.com` |
| `EXPO_PUBLIC_SUPABASE_URL` | Existing exe-staging public URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Existing staging public client key |
| `EXPO_PUBLIC_EXE_WHATIF_GEMINI` | `0` |

`scripts/build-beta.ps1` uses `EXPO_NO_DOTENV=1`. A future authorized build must explicitly load these values into that build process; merely saving an env file is insufficient. Validate host, project-key match, staging configuration and test mode without printing their keys. Verify the actual embedded bundle after building. Reuse a short physical workspace and real lockfile dependencies, not links to a long worktree.

Configured Friend installations start with analytics ON when no choice is saved; there is no popup/onboarding. QA stays OFF without an explicit choice. Settings always allows turning analytics OFF/ON. An existing OFF choice is never overridden, including QA-to-friend upgrades. Malformed/unreadable preference storage stays closed. Turning OFF aborts sends and clears the pending analytics identity/outbox; explicitly enabling again creates a new anonymous identity and first_seen. There is no Auth identification or alias, and no app-data reset.

## Dashboard separation

The MVP dashboard must include an **event property** filter: `test_mode` **equals boolean false**. Require false explicitly; do not use “not true”, a missing property, or a person property. This excludes QA and events without a verified label. Preserve any existing date/property filters and AND this condition with them. Apply the condition consistently to every event series, including both retention cohort and return events. Count anonymous installations with analytics enabled as installations, not verified unique humans.

For a native PostHog property group, the intended additional condition is:

```json
{
  "type": "AND",
  "values": [
    {"key": "test_mode", "type": "event", "operator": "exact", "value": [false]}
  ]
}
```

QA review uses a separate view with `test_mode=true`; never add QA rows to friend KPIs. D1/D7 are actual return_visit events in elapsed buckets since first_seen, not multiple same-day opens. Do not change old stored event labels. Upgrading a QA installation to a friend build does not turn that installation into a real tester; use a QA profile for QA work.

Verified dashboards: [EXE MVP friends](https://us.posthog.com/project/771278/dashboard/2420566), filtered false, and [EXE QA](https://us.posthog.com/project/771278/dashboard/2420574), filtered true. Legacy v10 identity issues and deliberate QA identity rotations are documented separately; they do not establish real player counts.

## Runtime coverage and proposed approval

| Event/check | Existing evidence | Safe next acceptance |
| --- | --- | --- |
| app_open, stable identity, offline/retry, revoke | v11 S22 and actual PostHog records PASS | Preserve existing evidence; no repeat required for unchanged adapter |
| game_started | v11 S22/PostHog: fresh once, replay once | Preserve evidence; restore does not emit a start |
| lap_completed 1–4 | v11 S22/PostHog: every lap once, one game ID | Preserve evidence; no repeat needed for unchanged event mapping |
| game_completed | v11 S22/PostHog: one defeat, completed_laps=4, completed_four_laps=true | Early termination is not device-verified; do not call a four-lap defeat an early exit |
| replay_started | v11 S22/PostHog: once, new game ID and same distinct_id | Preserve evidence; UUIDs remain unique |
| return_visit | Clock-controlled D1/D7 tests PASS; real elapsed device coverage not verified | Keep one consenting QA identity and return in [24h,48h) and [168h,192h) after first_seen; do not change the device clock |

The Owner-approved v11 local gameplay acceptance on 27 November 2026 received 10 events with 10 unique UUIDs, one anonymous ID and two game IDs. Result cold restore did not duplicate start/lap/completion. No official Cloud Save or account was changed. Keep QA at test_mode=1 for future device work. Never manufacture retention by changing the clock, edit AsyncStorage, or uninstall/reset. The simplified friend default is source-tested, not yet accepted in a v12 APK.

## Gates before friend distribution

1. Preserve **Discard client IP data** in project 771278. It was verified enabled during v11 acceptance; new gameplay-event property audits contained no raw IP. Recheck before friend distribution; `$geoip_disable` alone is not a provider-side IP guarantee. Existing historical QA data was not changed.
2. Preserve the verified MVP false filter and separate QA true view; do not count QA as friends.
3. Record real-time retention and early-termination coverage limits above. Any additional device acceptance uses the QA profile, not friend traffic.
4. Approve source publication separately: push the analytics feature branch and open a PR to main; no push, PR or merge has been performed during preparation.
5. Separately approve building, existing-key signing and final artifact checks for v12. Do not replace the S22 QA APK with test_mode=0 for acceptance. Do not distribute an unverified artifact.

No APK, keystore, credentials, private profile, device capture, logs or QA evidence belongs in the PR. The local publication draft records the exact source diff and known runtime limits. No Web or backend deployment is part of this candidate.
