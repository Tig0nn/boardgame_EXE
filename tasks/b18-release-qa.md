# B18 Release Readiness QA

Base: 927e53e2189bd6d901ed494791d9dc7e912358a6. Branch: codex/mvp-b18-release-qa.

Preserve superseded tasks/plan.md and tasks/todo.md. This task-specific plan owns the active QA checklist. No Human Playtest, gameplay changes, golden updates, merge, manual deployment, alias or production promotion.

1. [x] Verify exact Preview URLs READY + SHA through Vercel metadata, then load actual sites. Chromium/Firefox/WebKit supported, no access blocker.
2. [x] Play reproducible natural games through real Preview UI: 13 complete games, 16 exported logs verified. Fixtures and bounded scenario planning labeled separately.
3. [x] Check save/reload/setup/resume/import/export, malformed data and storage faults. Desktop P0 RQA-01 confirmed; manual cross-origin import checked, no automatic transfer.
4. [x] Inspect 320/390/768/1440: 268 surface checks, 0 layout/language finding or page error in measured paths. Physical-device limits explicit.
5. [x] 349 product/46 SSR/81 historical replay/13 parity games+2306 snapshots, lint/builds and historical evidence integrity pass. No product changes.
6. [x] Report and evidence prepared for commit/push. Verdict NO-GO, one P0; no product fix, engine change or release action. Exact handoff SHA supplied after push; Owner approval pending.

Risks: Preview access may require existing Vercel credentials; Firefox/WebKit binaries may be unavailable. Do independent regression work while access is resolved. Safari/iOS, physical devices and real virtual keyboards remain unverified unless actually available. GO requires the stated core flows to work; missing critical evidence cannot count as PASS.
