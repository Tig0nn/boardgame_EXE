# EXE Fastify on Render Free

Use a single Render **Web Service**, Singapore if available on Free, compute **Free**, health path `/health`, default HTTPS and one instance. Choose **Existing Image** and a private registry accessible to Render. Build only target `api` for `linux/amd64`. Render image-backed deploys are manual. Pin an image digest and retain the previous digest for rollback. Leave the pre-deploy command empty. [Render image deployment](https://render.com/docs/deploying-an-image) · [Render Free](https://render.com/docs/free)

```sh
docker build --platform linux/amd64 --target api \
  --label "org.opencontainers.image.revision=$(git rev-parse HEAD)" \
  -f deploy/staging/Dockerfile -t exe-render-backend:local .
```

Transfer the image only to the approved registry and confirm the digest in Render. Use a read-only registry credential for Render. A Git-backed service requires explicit Owner approval to push only `codex/exe-render-free-backend`. For that path choose native Node 22 at repository root, set build command `npm ci --prefix apps/api --include=dev && npm run --prefix apps/api build` and start command `node apps/api/dist/apps/api/src/server.js`, then turn auto-deploy off.

## Environment

Copy the names in [the environment template](.env.staging.example) into Render. Let Render supply `RENDER=true` and `PORT`. The API binds all interfaces using the platform port in this environment. Store the runtime DSN and CA as Render secret files named `exe_database_url` and `exe_database_ca`. The API reads them at startup. Only one of `DATABASE_URL` and `DATABASE_URL_FILE` may be set. Backend Auth verifies ES256/RS256 JWTs against the issuer's public JWKS, with audience `authenticated`. The APK uses the staging Auth publishable key and Render API origin. [Render environment and secret files](https://render.com/docs/configure-environment-variables)

Render has IPv4 outbound. Direct PostgreSQL for this project currently resolves to IPv6 only. In the Supabase Dashboard for `yqikecqeijeaygmmjdyg`, copy the **Session pooler** hostname from Connect and use port 5432, database `postgres`, and username `exe_runtime.yqikecqeijeaygmmjdyg`. Use the existing runtime password, percent-encoded in the DSN, and the CA chain appropriate to the pooler hostname. The client enforces CA and hostname verification and sets a 5-second statement timeout. Verify a real login from Render. Pool starts at two per instance. Keep Data API off and the existing journal and RLS in place. [Render and Supabase connectivity](https://render.com/articles/how-to-connect-a-render-service-to-supabase-postgres) · [Supabase connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres)

## Acceptance and cost

Verify the Dashboard shows **Free** and deployment status **Live** for the selected digest. Check workspace usage and avoid paid features or upgrades. Free instance idle spin-down can take about a minute to recover. Capture cold start separately from warm API action latency. [Render pricing](https://render.com/pricing) · [Render Free limits](https://render.com/docs/free)

From the repo root set `EXE_RENDER_ORIGIN` to the actual `https://…onrender.com` origin and run `node deploy/render/smoke.mjs`. For the read-only ownership probe provide `EXE_SMOKE_TOKEN_A_FILE`, `EXE_SMOKE_TOKEN_B_FILE` containing short-lived tokens from two distinct real staging accounts, and `EXE_SMOKE_SESSION_A` for an approved A-owned test session. Keep token files outside Git. Check `/health` 200, `/ready` 200, unauthenticated 401 and B-to-A 404. Correlate failures via request IDs and sanitized API events. No tokens or response payloads appear in the report.

For the bounded B18 follow-up, create one dedicated A-owned test ván through Fastify and play four rounds through the APK or authenticated API. Retry one committed command using the same idempotency key and check one action and snapshot for that version. Check one stale version returns 409. Have an authorized operator replay from persisted seed and action history, compare schema 7 SHA-256 at every version, and compare the official result. Review snapshot timing, SQLSTATE 57014 and resource usage. To test database rollback, use the local integration suite's controlled snapshot failure. Hosted verification checks for partial rows after any observed failure. The runtime role cannot delete. Agree on the test IDs and have an authorized operator clean up only those rows in a controlled transaction, then verify counts. Keep the previous deploy digest available for application rollback.
