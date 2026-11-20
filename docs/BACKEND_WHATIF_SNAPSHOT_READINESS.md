# Backend What-if and snapshot reliability candidate

Local work only, 2026-11-20. No push, deploy, staging migration, secret change, or Gemini Live call is authorized by this document.

## Source and contract

The live Render revision is `2892fbafb9236332552dfb52ee0f9eb590eb1ea4`; it does not register What-if routes. The actual Android catalog request returned HTTP 404 / route `unmatched`. This is deployment drift, not evidence that the authenticated player lacks ownership.

The complete implementation exists in the local backend Git repository at `329a173e75e16182788e7a989b38a4ec381ba31f`, descended from the live revision. This branch starts at that checkpoint; it reuses the existing routes, canonical replay, deterministic coach, and separately disabled optional Gemini integrations. Availability of that commit on GitHub has not been assumed. See [the Android wire contract](WHATIF_ANDROID_BACKEND_CONTRACT.md).

The later local recovery checkpoint `e054cd5b77de270e4a307468444e1ce2ede53193` was also audited: its backend runtime is unchanged from `329a173`; its API-side change is a browser regression test for frontend recovery. No What-if runtime fix is omitted by using `329a173` as this backend-only base.

## Snapshot evidence

The synthetic Android journey generated 60 actions and 61 schema-7 snapshots. Its existing read-only catalog statistics are:

| Measurement | Bytes |
| --- | ---: |
| Sum of logical snapshot text | 469,417,963 |
| Stored payload values after TOAST compression | 78,793,206 |
| Snapshot table including TOAST and indexes | 81,895,424 |
| Failed version-36 payload | 9,161,902 |
| Final version-60 payload | 16,586,551 |

The reported approximately 78 MiB is primarily live TOAST storage, not duplicate committed actions. `pg_stat_*` dead-tuple values are estimates and do not establish a leak. No vacuum or cloud write was performed during this audit.

`serializeLog()` includes the journal both as `entries` and `state.log`. Journal entries contain before/after snapshots with repeated market and price histories. Retaining each historical save compounds this duplication. At version 36, each independently serialized journal array is 4,146,558 bytes. These copies belong to the existing canonical serialization contract; removing them in place would change saved bytes and replay hashes.

The existing dictionary transport reconstructs the original text inside PostgreSQL. It still uses only two parameters and reduces the version-36 template plus dictionary representation to approximately 0.61 MB. It does not compress the persisted format. Local comparisons of plain transport, `format(... VARIADIC text[])`, and ordered aggregation did not justify replacing the existing adapter. Dictionary reconstruction, Unicode/escaping, and exact stored bytes remain unchanged.

## SQLSTATE 57014: proven and unproven

The failed request `727acae4-67a6-4707-9ea4-f1e3850062e2` attempted snapshot version 36. Its insert lasted 5,343.1 ms and reported PostgreSQL 57014; Fastify returned HTTP 500 after 8,065.8 ms. The transaction rolled back. The same-key manual retry committed version 36 once; its insert took 775.9 ms. Staging runtime source explicitly sets a session statement timeout of 5 seconds, including through the session pooler. It does not configure a separate driver query timeout.

The original incident has no contemporaneous backend PID/wait sampling that can conclusively separate CPU scheduling, storage pressure, and a transient lock wait. An idle catalog sample taken afterward cannot disprove an earlier wait. The exact recorded payload did not spontaneously exceed 5 seconds on isolated local PostgreSQL 17.11. Do not claim that payload size alone proves the cause of the cloud latency spike.

The reproducible, avoidable cost is validation: the old CHECK converts the entire payload to JSONB twice. Isolated `EXPLAIN ANALYZE` comparisons separate reconstruction/TOAST from validation; one conversion materially reduces execution time. A local trigger-controlled cancellation additionally reproduces 57014 and verifies rollback/retry behavior without altering cloud settings.

## Implementation and compatibility

1. Versioned migration `0005_snapshot_single_parse` replaces only `game_snapshots_schema_version_check`. For non-null integer `schema_version` and non-null `payload`, positive version plus JSONB object containment preserves the old boundary: matching numeric versions pass; missing/wrong/string/array/object versions and top-level arrays do not. Malformed JSON still fails. New and legacy snapshots retain their exact TEXT representation and schema version.
2. Existing migrations `0000`–`0004` are unchanged. The journal gains one entry, with Drizzle-generated metadata. Upgrade tests start with the original five migrations and existing rows, then verify payload preservation, current journal integrity, migration idempotency, and restored session timeouts.
3. Unhandled wrapped PostgreSQL cancellation 57014 is reported as HTTP 503 `DATABASE_BUSY`, with a generic message and existing correlation/SQLSTATE logs. No SQL, parameters, payload, or credential is returned. Existing explicit API errors keep their specific codes.
4. The server does not automatically retry. Clients retain their original idempotency key and expected version; an identical request after rollback or a lost committed response can be safely replayed. Different keys with stale versions still return 409. No financial calculation, RNG, replay policy, result, RLS, or runtime privilege is changed.

The migration's `SET LOCAL statement_timeout='60s'` applies only to its maintenance transaction, permitting validation of existing rows. `SET LOCAL lock_timeout='2s'` bounds acquisition of the DDL lock. Both settings reset at transaction end; gameplay connections stay at 5 seconds. The migration holds ACCESS EXCLUSIVE during validation. It is **not** an online, nonblocking migration: new gameplay operations could queue behind it unless the API is quiesced.

## Reproducible local QA

Use only the separate PostgreSQL 17.11 container bound to `127.0.0.1:55439`, its separate volume, and disposable test databases. Credentials are supplied through the process environment, outside Git and logs. Do not substitute a cloud DSN.

From `apps/api`:

```text
node --experimental-strip-types --test --test-concurrency=1 tests/snapshot-validation.integration.ts tests/snapshot-retry.integration.ts
node --experimental-strip-types tests/snapshot-validation-performance.ts
```

The benchmark interleaves 24 old/new samples at both recorded payload sizes, keeps a 5-second statement timeout, and reports PostgreSQL execution p50/p95. There are too few samples for p99; it is explicitly null. This diagnoses constraint/reconstruction/TOAST cost, not hosted HTTP performance or universal Free-tier capacity.

Measured on the isolated PostgreSQL 17.11 container (2 CPU limit), milliseconds:

| Payload | Old p50 | Single-parse p50 | Old p95 | Single-parse p95 |
| --- | ---: | ---: | ---: | ---: |
| 9,161,902 bytes | 335.391 | 247.888 | 375.760 | 280.276 |
| 16,586,551 bytes | 728.833 | 465.566 | 809.332 | 496.034 |

Every measured insert completed below the unchanged 5-second deadline. This is not proof that cloud scheduling or lock contention cannot consume that budget.

A separate full-retention upgrade rehearsal rebuilt all 61 canonical snapshots and 60 actions in a disposable local database using migrations 0000–0004. Logical text totaled 469,417,963 bytes and stored payloads totaled 78,793,206 bytes, matching the synthetic staging dataset. Applying only pending 0005 took 6,567.6 ms. All 61 hashes, canonical state and the 84,000,000 VND result remained identical. Session settings reverted to `statement_timeout=5s`, `lock_timeout=0`. This scan exceeds a gameplay statement's 5-second budget and explains the bounded, transaction-local maintenance timeout; it does not raise the runtime timeout.

The reliability suite uses a real local timeout, delayed inserts, and an actual HTTP socket destroyed after a cash-changing action commits. It checks one debit, one action/snapshot per version, concurrent same-key requests, 409, owner isolation, exact canonical reload, and no idle transactions. The existing START suite exercises catalog, canonical full-endgame simulation, assistant interpret/propose/explain mocks, Gemini OFF fallback, ownership, grounding and official-state immutability.

## Future staging execution plan — separate Owner approval required

1. Pin the reviewed fix SHA and backend build dependency closure. Inspect Git/Render deployment triggers before any approved push. Keep Render Free and Auto-Deploy Off. Do not deploy frontend or any unrelated workstream.
2. Confirm the exact staging ref, TLS verification, runtime role, pool limit, Data API design, and current journal hashes. There must be exactly one pending migration, `0005`; the first five hashes/timestamps must match source. Do not rerun applied migrations.
3. Back up staging and verify restore into a separate PostgreSQL target. Capture snapshot counts/hashes, official results, constraint definitions, RLS/ACLs and connection timeouts. Stop on drift or a failed restore rehearsal.
4. Schedule a bounded staging maintenance window. Quiesce gameplay writes and drain in-flight transactions before DDL. Confirm the scan can complete within the maintenance-only 60-second budget; if not, stop and review measured sizing rather than changing runtime timeouts.
5. After approval, use the official staging migration CLI and exact project-ref confirmation. It uses transactional Drizzle execution. Lock or validation failure must roll back the constraint and journal together. Never delete/reseed existing data or edit journal hashes to force success.
6. Verify six exact journal entries, a validated single-conversion CHECK, unchanged old snapshot hashes/results, seven tables, B18 scenario, RLS and runtime privileges. Verify the runtime still has a 5-second timeout. Re-enable staging service only after checks pass.
7. Manually deploy the reviewed backend candidate after separate deployment approval. With no token, all three What-if routes must return 401, not 404/unmatched; `/health` and `/ready` must be 200. Inspect the actually deployed commit before Android acceptance.
8. Preserve the existing Android login and synthetic completed game. Load its catalog, confirm a valid alternative from its historical context, and submit `stateVersion`, `sequence`, `alternative`, `operation:'explain'`, `allowGemini:false`. Verify full four-lap comparison, deterministic explanation, and unchanged official history/snapshot/result hashes. Gemini Live calls remain zero.
9. Run one bounded write/retry smoke on a separate synthetic session, verify 409/ownership with two valid staging accounts, inspect latency/SQLSTATE/resource telemetry and release connections. No cloud stress test.

If migration fails before commit, keep the prior application and retry no DDL automatically. If application rollback is needed after migration, the prior runtime can read the unchanged TEXT/schema-7 rows; prefer retaining the equivalent constraint. An old migration CLI expecting only five entries must not be used against a six-entry journal. Database rollback or restore requires separate approval; never reset a live database. Rollback to the old deployed runtime also restores its known missing-What-if limitation.

## Deferred storage reduction

No on-disk compression wrapper, delta snapshot, retention deletion, or save format change is implemented. A future storage proposal would need a separate persistence version, dual readers for plain and compact rows, logical-versus-physical hash rules compatible with verified replay, full-history restore tests, a mixed-version/rollback strategy, and explicit approval before converting existing records. The current candidate reduces validation cost; it does not claim to remove the 78 MB storage footprint or prove that cloud contention can never cause another timeout.
