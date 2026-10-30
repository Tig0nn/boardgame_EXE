# B18 repair AI integration plan — 2026-10-30

Approved scope: isolated integration worktree, verified UI6294fbe + approved AI90c03ff history via --no-commit merge. No commits or existing-workstream edits.

1. Gate and session binding: default OFF; DEV + explicit repairAi=1; bind real immutable snapshots to the public controller. Verify production denial, cancellation, same-phase changes and session replacement with actual session adapter tests.
2. Inline UI: RepairAiPanel below cash and above both payment choices; accessible form/examples/status/return; preserve guide and choices. Verify shared gate, synchronous pre-choice cancellation, focus and small viewport scroll.
3. QA: real browser GameExperience/session scenarios, full product/AI/Coach regression and UI diagnostics, lint, root/mobile/strict typechecks, ESM and81 frozen replays. Preserve engine/API1/goldens and approved AI blobs.
4. Report exact staged imported61 AI files vs unstaged UI glue, evidence, remote pins and review requirements. Leave merge uncommitted for Owner.

Risks: old Git lacks merge-tree --write-tree (used disjoint-path precheck instead); client state remains unauthenticated; virtual keyboard needs device verification beyond viewport emulation. No endpoint mount/model calls.