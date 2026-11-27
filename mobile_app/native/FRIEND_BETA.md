# Android friend Beta v12 candidate

Source preparation only. No build, signing, installation or distribution is authorized by this document. Package remains `vn.exe.boardgame.nativeapp`, versionCode is 12, and the existing Beta signing identity is required. Gameplay, Auth, Cloud Save, Result, the shared engine and the PostHog adapter are unchanged from accepted v11.

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

New installations start with consent OFF. Settings provides opt-in and withdrawal. Updating an existing installation preserves its consent choice rather than resetting app data. Withdrawing aborts sends and clears the pending analytics identity/outbox; explicit re-consent creates a new anonymous identity and first_seen. There is no Auth identification or alias.

## Dashboard separation

The MVP dashboard must include an **event property** filter: `test_mode` **equals boolean false**. Require false explicitly; do not use “not true”, a missing property, or a person property. This excludes QA and events without a verified label. Preserve any existing date/property filters and AND this condition with them. Apply the condition consistently to every event series, including both retention cohort and return events. Count consenting installations as installations, not verified unique humans.

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

At preparation, project 771278 contained only “Your starter dashboard” (2419839), with default pageview/screen charts. It was not an EXE gameplay MVP dashboard. Confirm the intended dashboard before applying the filter; this document does not create or repurpose one or claim it already measures gameplay.

## Runtime coverage and proposed approval

| Event/check | Existing evidence | Safe next acceptance |
| --- | --- | --- |
| app_open, stable identity, offline/retry, revoke | v11 S22 and actual PostHog records PASS | Preserve existing evidence; no repeat required for unchanged adapter |
| game_started | Focused tests PASS; v11 device delivery not verified | Owner-approved fresh **local QA** game with consent already ON; opening an existing save cannot test a start |
| lap_completed 2–4 | Canonical four-lap test PASS; device delivery not verified | Owner-approved progression of the current local QA game through the remaining laps |
| game_completed | Focused canonical transition test PASS; device delivery not verified | Finish that local game normally; verify actual outcome and one accepted UUID |
| replay_started | Focused dedupe tests PASS; device delivery not verified | Owner-approved new-game action from Result, then stop; this replaces the single local save |
| return_visit | Clock-controlled D1/D7 tests PASS; real elapsed device coverage not verified | Keep one consenting QA identity and return in [24h,48h) and [168h,192h) after first_seen; do not change the device clock |

Proposed sequence, **not executed**: use existing v11 with test_mode=1 and its accepted local save. Enable consent before testing (it is currently OFF). Continuing the game updates only the local save, RNG position and action history through normal UI. Finishing enables game_completed. Starting replay from Result overwrites the single local slot and emits replay_started plus game_started. A later explicitly approved fresh game can instead test start first, but also overwrites that slot. Do not use official Cloud Save, edit AsyncStorage, manufacture an outcome, or uninstall/reset. Preserve the same consent identity during D1/D7; revoking starts a new cohort on re-opt-in. No Gemini requests are needed.

This source preparation performs none of those device actions. The absence of remaining runtime coverage is a release limitation, not a failure of already accepted v11 identity behavior.

## Gates before friend distribution

1. Owner enables **Discard client IP data** in project 771278, then read-only verification confirms it is enabled. The last preparation check found `anonymize_ips=false`; `$geoip_disable` alone did not prevent provider-added `$ip`. Existing QA IP values were not read or changed.
2. Confirm the EXE MVP dashboard target and save/verify its explicit false filter. The generic starter dashboard is not proof that gameplay KPIs exist.
3. Approve the remaining local QA mutations above if device-level gameplay-event coverage is required; keep all of that traffic in test_mode=1.
4. Approve source publication separately: push the analytics feature branch and open a PR to main; no push, PR or merge has been performed during preparation.
5. Separately approve building, existing-key signing and final artifact checks for v12. Do not replace the S22 QA APK with test_mode=0 for acceptance. Do not distribute an unverified artifact.

No APK, keystore, credentials, private profile, device capture, logs or QA evidence belongs in the PR. The local publication draft records the exact source diff and known runtime limits. No Web or backend deployment is part of this candidate.
