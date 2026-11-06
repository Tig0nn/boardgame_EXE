# Isolated AI Companion Beta — prepared, not deployed

Content: Owner accepted all 39 reviewed cases. Deployment is **not** authorized by content acceptance. Current package is **Patch 1**, superseding the older readiness proposal. Read the [Patch 1 report](../../docs/EXE_AI_COMPANION_RELEASE_READINESS_PATCH1_REPORT.md) and approve the [current manifest](../../docs/qa/release-readiness-patch1/release-manifest.json) before any GitHub push or Vercel action.

## Proposed NEW Vercel project

| Setting | Prepared value |
| --- | --- |
| Project label | `exe-companion-beta`, a human label only; not used as build identity |
| Actual project identity | `VERCEL_PROJECT_ID` supplied by Vercel |
| Expected project identity | `EXE_AI_BETA_EXPECTED_PROJECT_ID`, Owner-approved exact ID; **UNSET until project exists and Owner approves its ID** |
| Git source | Owner must approve independent Beta repo/branch; confirm existing deployment hooks first |
| Root Directory | `release/beta` |
| Include source outside Root Directory | Enabled, for shared engine/UI source and existing lockfiles |
| Framework | Other / null |
| Node | 22.x |
| Install | `npm ci --prefix ../.. && npm ci --prefix ../../mobile_app` |
| Build | `npm run build` |
| Output | `dist` relative to this directory |
| System environment variables | Enabled; do not manually spoof `VERCEL_ENV` or `VERCEL_PROJECT_ID` |
| Preview-only flag | `EXE_AI_BETA_PREVIEW=1`, only after Owner approves deployment |
| Protection | Enable Vercel Deployment Protection before inviting testers |

Do not copy this config to the repository root, link the existing Production project, add its domains, or promote the Beta artifact to Production. This project root has no `api/` directory; only static files are published. The existing root `api/ai-coach.ts` is outside this project's root and is not needed by deterministic Beta.

An initial Git import may attempt a Production build. Its refusal is intentional; do not bypass it by spoofing deployment environment variables. After separate Owner authorization, use the approved Preview branch/PR workflow on the new project. Project creation and hosted workflow have not been executed here.

When `VERCEL=1`, build refuses a missing actual ID, missing expected ID or any mismatch; project name cannot bypass that check. Production is always refused, even with matching IDs. Preview still requires explicit approval. The build uses Vite **production** optimization, disables dotenv and general `VITE_*` exposure, and embeds only two nonsecret gate values. Neither actual nor expected project ID is exposed in the client bundle/build-info JSON. The UI still requires `?aiBeta=1`; query opt-in cannot alter build policy or enable Production. Deployment Protection is a separate hosted access gate.

## Safe expected-ID provisioning (Owner action after this HOLD)

No project ID has been assigned, fabricated or configured by this preparation. After a separately approved Beta project is created, Owner verifies its exact ID independently in Vercel project settings and approves that value. Set `EXE_AI_BETA_EXPECTED_PROJECT_ID` as a **build-only, Preview-scoped** project environment variable on that Beta project. It is a nonsecret identifier but security-sensitive configuration: do not use a `VITE_` prefix, commit a concrete value, put it in query/client configuration, copy it automatically from `VERCEL_PROJECT_ID`, or apply it as a shared Production variable. Leave it unset until approval; hosted builds must fail closed in the meantime. Do not change the existing Production project.

## Local artifact review only

Use the existing Node 22/npm runtime. From repository root, set `VERCEL_ENV=preview` and `EXE_AI_BETA_PREVIEW=1` **in the local build process only**, then run `node scripts/build-companion-beta.mjs`. This simulates the allowed target for QA; it does not approve or perform a hosted deployment. Run `node scripts/preview-companion-beta.mjs` and open `http://127.0.0.1:5314/?aiBeta=1`.

No Gemini, provider credentials, API functions or server are required for answers. A static host serves the build assets; browser QA answered while offline after loading the game. External Google Fonts in the inherited UI may still be requested; the AI does not depend on them.

Do not reuse Production saves as test inputs. Origin storage is separate for Preview, but it is browser-local storage, not authentication. Import only intentionally exported test saves. Physical device QA, hosted build/install/actual Preview URL and complete main-app import navigation remain signoff work.

## Minimal review/reproduction set

Use only the current [commit list](../../docs/qa/release-readiness-patch1/commit-files.txt); all excluded files remain local. It retains runtime source, tests, five frozen synthetic canonical baselines required by regression, the replay inventory, current sanitized QA evidence and four compiled Preview images. Historical verdicts inside test baselines are comparison data, not the latest approval decision.

From the repo root after installing the root/Mobile lockfiles, run `node scripts/diagnostics/readiness-patch1-checks.mjs`. Use `node scripts/diagnostics/readiness-patch1-audit.mjs --verify-proposal` to check the published proposal's files/hashes. The full historical audit/manifest regeneration requires local-only archives and checkpoints; those are intentionally not prerequisites for building or running product tests. Browser QA can use `PLAYWRIGHT_MODULE` and `BROWSER_PATH` to select a locally installed Playwright/Chromium runtime. No provider credentials are required.

## Rollback

Before publishing, retain all checkpoint hashes and QA evidence. After a separately approved Beta deployment, restrict access with Deployment Protection or remove that Beta deployment. Unset the Preview flag to block future Beta builds; this build script deliberately refuses a missing flag. Unsetting it does **not** disable an already deployed immutable client bundle. Keep Production Mobile, domains, data and environment untouched.

## Official references

The separate Root Directory with parent-source inclusion follows [Vercel monorepo guidance](https://vercel.com/docs/monorepos/monorepo-faq). Commands and output are scoped through this [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json). Deployment environment uses [Vercel system variables](https://vercel.com/docs/environment-variables/system-environment-variables); Vite mode and optimization are [separate concepts](https://vite.dev/guide/env-and-mode).
