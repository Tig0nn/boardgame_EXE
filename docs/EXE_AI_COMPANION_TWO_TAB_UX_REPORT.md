# B18 AI Companion — two-tab UX refinement

Date: 2026-10-30 (Asia/Bangkok). Status: IMPLEMENTED / QA COMPLETE WITH KNOWN BASELINE FAILURE / OWNER REVIEW REQUIRED. No commit, push, deploy, endpoint mount or production flag change.

Workspace: E:/Fall25_Ki8/EXE-boardgame/_exe-workstreams/b18-ai-ui-integration
Branch: codex/b18-ai-ui-integration
Unchanged HEAD: eabb096c38a4dd9ed24e8a4f8f8fa89e85a4377e

## Files and scope

- [EventModal.tsx](../mobile_app/src/components/EventModal.tsx): extract the original narrative, cash and payment choices without changing choice filtering, affordability, labels or onChoose behavior. Only an enabled/eligible repair uses the tabbed presentation.
- [RepairAiPanel.tsx](../mobile_app/src/components/RepairAiPanel.tsx): accessible segmented Decision/AI tabs, persistent binding subscription, canonical answer cards, full limitations and fixed return action.
- [repair-ai.css](../mobile_app/src/components/repair-ai.css): scoped tab/card styles,44px controls,16px input and single-scroll modal layout. Obsolete inline-trigger styles removed.
- [GamifiedModal.tsx](../mobile_app/src/components/GamifiedModal.tsx): two optional ReactNode slots, fixedContent and footerContent. Required to keep tabs/cash/back outside the existing body scroll; callers without slots keep their original layout. No shared behavior/state transition changed.
- [repair-ai-browser.mjs](../scripts/diagnostics/repair-ai-browser.mjs):15 real-browser regressions for the new tab contract, lifecycle, canonical wording and screenshots.
- This report.

No changes to App.tsx, GamePhase.tsx, the session adapter/binding, feature-enable module, engine, financial rules, Question API, contracts, Coach, API1 or golden fixtures. The two pre-existing task files are untouched; short status may still show M while diffs are empty and normalized blob IDs match HEAD. No original Phat checkout operations.

## Player flow

Default is Quyết định. The event title, segmented tabs and cash stay fixed. This tab shows only the original narrative and both payment choices; AI content is hidden. Selecting ✨ Hỏi AI reveals three supported examples, the question input, send button and response area in the same event modal. No popup is added.

Only the existing modal body scrolls. The return button is in a fixed footer outside the scroll area; both it and the tabs remain reachable even at the360px reduced-height test viewport. Back returns focus to the Decision tab. Tabs use tablist/tab/tabpanel, aria-selected, aria-controls/labelledby and roving tabIndex; Arrow keys/Home/End select and focus without sending. Escape from the AI content also returns to Decision. No automatic input autofocus steals focus from the tab strip.

## Presentation and financial fidelity

The first result section shows the exact canonical explanation, without shortening or generating a new conclusion. Existing labeled statements become cards with unchanged labels and complete statement.text, grouped by optionId. Amount-bearing sentences use heavier type/tabular numerals; temporary-option cards use the existing gold palette. The UI does not parse amounts, extract numbers, calculate values or infer financial claims from text.

Reflection has its own section. All returned limitations are displayed, including conditional funding-cost exclusion. The full canonical statement and reflection strings remain intact; nothing is truncated or hidden behind a financial-summary toggle. Fallback explicitly says the question has not been answered and has no fact cards/reflection. Safe errors remain distinct.

## State and lifecycle

- Tab selection is local presentation state. It never dispatches or modifies a game snapshot and never automatically calls ask().
- The binding/controller remains mounted and subscribed while the Decision tab is visible. Back does not call binding.close(). Questions, valid results and pending work survive tab changes. A result can finish in the background and be viewed on return.
- Snapshot/revision changes, including same-phase notifications while Decision is selected, still invoke the existing binding observe/close path and clear the question/result. view.open becomes false and selection returns to Decision.
- A new session creates a fresh binding/controller epoch; unmount disposes pending work. Payment choice still closes synchronously before onChoose.
- Editing cancels superseded work. Final rendering checks delivery.isCurrent()/error.isCurrent() even for the hidden panel, so old content is not revived by switching tabs.
- OFF or ineligible context uses the original decision modal without AI tabs. The production gate remains the unchanged DEV-and-explicit-query opt-in. No remote/provider/API calls are introduced.

Independent read-only review found no Critical/Required findings. Remaining focus limitations are listed below rather than claimed as certified.

## Actual QA

| Check | Result |
| --- | --- |
| Initial new-tab browser expectation before implementation | Expected RED: Decision tab absent in old inline UI |
| Final new browser matrix |15/15 PASS;0uncaught page errors;0AI/API/provider network requests |
| Binding/controller/transport lifecycle tests |37/37 PASS,0fail/skip/cancel |
| Full available tests and every TS diagnostic |710 tests:708 PASS,2 failure records,0skip/cancel; same old onboarding child and parent only |
| Root/mobile/strict TypeScript |PASS |
| Full ESLint |PASS |
| Emitted ESM validation |PASS;46 browser files,0backend/external imports;50 server graph files;12 frozen wire examples |
| Frozen historical replay corpus |81/81 PASS,read-only; frozen Git-blob hashes and CRLF-only checkout equivalence verified |
| Mobile production build/shared React diagnostic |PASS as part of full QA; feature module unchanged |
| Scope/preservation |HEAD/index unchanged; only five planned tracked files plus this report; no engine/AI/golden/flag edits |

Browser assertions cover default Decision; no automatic request on tab changes; one request ID for one submit under StrictMode; exact saved-game equality before/after questions and tab switching; retained question and identical response on return; unsupported and false-premise questions; hidden-tab same-phase invalidation; pending hidden work cancellation on snapshot change/unmount; edit supersession; disable while loading; zero-cash funding conditions; original payment transition; new session reset; ARIA keyboard behavior and responsive scrolling.

Two unchanged baseline failure records in scripts/diagnostics/mobile-final-ui.test.ts:
1. Child: fresh player sees onboarding without creating a game; returning player sees setup. Failing assertion remains assert.match(first, /Hướng dẫn chơi/).
2. Parent: Mobile final UI contracts use the official engine, board and financial previews, failed because that child fails.

The reviewed UI baseline intentionally renders Entrance first. Prior exact baseline/integration comparison remains documented in [final integration review](EXE_AI_UI_INTEGRATION_FINAL_REVIEW.md). No onboarding source or assertion was changed to force PASS. Phat must reconcile that expectation separately.

## Screenshots

All screenshots are local QA evidence, excluded from staging. Animations are disabled during capture so screenshots show settled layout. Some images include explicit test-harness restart/import controls, which are not game UI.

| Width | Decision | AI input | Answered | Fallback | Reduced-height input |
| --- | --- | --- | --- | --- | --- |
|320|[image](../node_modules/.tmp/b18-ai-tabs-20261030/320-decision.png)|[image](../node_modules/.tmp/b18-ai-tabs-20261030/320-ai.png)|[image](../node_modules/.tmp/b18-ai-tabs-20261030/320-answered.png)|[image](../node_modules/.tmp/b18-ai-tabs-20261030/320-fallback.png)|[image](../node_modules/.tmp/b18-ai-tabs-20261030/320-keyboard-viewport.png)|
|375|[image](../node_modules/.tmp/b18-ai-tabs-20261030/375-decision.png)|[image](../node_modules/.tmp/b18-ai-tabs-20261030/375-ai.png)|[image](../node_modules/.tmp/b18-ai-tabs-20261030/375-answered.png)|[image](../node_modules/.tmp/b18-ai-tabs-20261030/375-fallback.png)|[image](../node_modules/.tmp/b18-ai-tabs-20261030/375-keyboard-viewport.png)|
|390|[image](../node_modules/.tmp/b18-ai-tabs-20261030/390-decision.png)|[image](../node_modules/.tmp/b18-ai-tabs-20261030/390-ai.png)|[image](../node_modules/.tmp/b18-ai-tabs-20261030/390-answered.png)|[image](../node_modules/.tmp/b18-ai-tabs-20261030/390-fallback.png)|[image](../node_modules/.tmp/b18-ai-tabs-20261030/390-keyboard-viewport.png)|

Evidence folder: node_modules/.tmp/b18-ai-tabs-20261030/. Includes browser-results.json, browser-final.txt, lifecycle-tests.txt, full-tests.txt, qa-exits.json, final-checks.json, historical-replays.json and final-verification.json. Source/fixture hashes are recorded separately from screenshots and logs; no generated evidence should be committed.

## Remaining review and responsive limits

- No horizontal overflow observed at320/375/390px. Tabs/cash and return remain fixed when the tab body scrolls; the browser test verifies cash Y position stays unchanged and the return button remains in the viewport.
-360px viewport-height emulation verifies a reduced-height layout only. Real mobile keyboard/IME composition, iOS Safari, safe areas/orientation, screen reader announcements, very short landscape viewports and hardware interaction remain NOT TESTED.
- Focus after automatic snapshot reset/disable is not a certified device behavior. Escape is supported from AI content; it is not a global close shortcut for the tab strip/footer or the event modal. Full modal focus trapping is inherited and not redesigned.
- Phat should review tab placement, fixed cash/back sizing on a real phone, gold/green card hierarchy, and the unchanged financial wording. Confirm the retained-result behavior while returning to Decision and the intentional continuation of pending work when only changing tabs.
- Owner reviews this uncommitted refinement before any commit or official integration. Production AI remainsOFF; no paid model, endpoint mount or backend expansion is part of this task.