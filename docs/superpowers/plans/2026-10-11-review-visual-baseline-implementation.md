# TradeReview Review Visual Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` for each bounded implementation task and obtain an independent review before accepting it.

**Goal:** Implement the approved compact Review workspace baseline in the real chart route, with a compact header/panel frame, TradingView-like drawing interaction feedback, anchored Text editing, and a default 1:1 risk/reward gesture. Prove the minimal real-chart replay journey before expanding visual changes.

**Architecture:** Keep `RecallWorkspace` as the state and persistence owner. Keep chart-coordinate, drawing creation, hit testing, selection, Text anchor, and preview behavior in `DrawingCanvas`. Keep the design route as a real `RecallWorkspace` fixture backed by the isolated acceptance repository. Scope visual calibration to the recommended review preview class so existing production surfaces are not silently restyled.

**Tech Stack:** Next/Vinext, React 19, TypeScript, CSS modules/global CSS, Canvas 2D, Vitest + Testing Library, Playwright/CUA browser evidence, SQLite acceptance fixture.

## Approved references and coverage

- `.scratch/review-visual-baseline-plan-20261011/DESIGN-COVERAGE.md` — V01–V15 requirement and evidence map.
- `.scratch/review-visual-baseline-plan-20261011/STATE-TRANSITIONS.md` — S0/S1/S2, market/execution cutoffs, replay and persistence contract.
- `.scratch/review-visual-baseline-plan-20261011/CONTROL-AUDIT-SCOPE.md` — post-development control registry and coverage rules.
- `docs/design-system/versions/2026-10-10/design-contract.md` — frozen compact frame, Text anchor, drawing preview, selection, and RR 1:1 rules.
- `docs/design-system/versions/2026-10-10/README.md` — current visual baseline and known historical limits.
- User references: `/var/folders/35/254l_pjd3176pndzmz5_2l4m0000gn/T/codex-clipboard-207f294a-f3c0-4ba9-be61-8d4d2bc1cd27.png` and `/var/folders/35/254l_pjd3176pndzmz5_2l4m0000gn/T/codex-clipboard-e4ae5aa9-000c-40e4-b6de-c47182c0e419.png`; comparison viewport is 1440×900 CSS px unless an acceptance record states otherwise.

## Global constraints

- Work only in the existing isolated `052d` worktree. Preserve unrelated `.scratch/*` work and the supplied trade fixture.
- Do not change the frontend framework, chart library, business database, or fixed Chinese copy to make the frame fit.
- Use the existing theme and teal/red P/L colors. Keep S0/S1/S2 as one workspace and keep market and execution cutoffs independent.
- New risk/reward drawings default to 1:1; existing stored custom ratios remain unchanged.
- Transient hover, selection pulse, drag preview, and editor focus are not persisted.
- Every implementation task must add a behavior-first failing test before the implementation, then run the scoped test and report the red→green transition.
- No remote push, merge, or publish is authorized by this turn.

## Review focus

- Whole-page visual owner: coordinator (`/root`) compares final screenshots at 1440×900, 1280×800, the narrow boundary around 1105 CSS px, and ~390px.
- Data/state owner: coordinator verifies replay cutoffs, Text/drawing state, isolated save/reopen/reload, and original trade data protection.
- Independent visual reviewer must not implement the reviewed UI and must directly inspect reference and rendered screenshots.
- Any visual deviation from the supplied TradingView reference must be documented with the affected element ID and rationale; no silent density or hierarchy changes.

## Task 1 — Minimal real-chart replay journey and acceptance harness

**Files allowed:** `app/components/review-design-preview/review-design-preview.test.tsx`, `app/components/recall/recall-workspace.test.tsx` or a new narrowly scoped test beside the real route, `.scratch/review-visual-baseline-plan-20261011/evidence/*` and task report only. Do not change production components unless the failing journey proves a defect.

**Behavior:** Start in S0 with future bars and executions hidden; advance one bar and one decision on the real fixture; create an anchored Text; return to the early cursor; save/reopen through the isolated repository; assert the same Text anchor, stage, and cutoff survive. Capture the exact initial and final state evidence needed by V02, V04, V07, V09, and V13.

**Acceptance:** Test uses the real `RecallWorkspace` fixture and explicit isolated database path. A mock-only state update is insufficient. Any product defect found here is fixed in the coordinator-owned integration step before visual expansion.

## Task 2 — Compact frame, side-local panel controls, and centered replay tools

**Files allowed:** `app/components/review-design-preview/review-design-preview.css`, a new focused CSS test or additions to `app/components/review-design-preview/review-design-preview.test.tsx`, and the task report. Do not edit `drawing-canvas.tsx` or `recall-workspace.tsx` in parallel.

**Behavior:** Calibrate the recommended sample to the approved frame budget: no mandatory 58px spacer, compact top row, left collapse affordance on the left edge, right plan affordance on the right edge, and bottom replay actions visually centered with icon-first compact controls while retaining accessible labels. Keep the actual chart as the dominant region and preserve long Chinese content.

**Acceptance:** Rendered measurements and screenshots show header, chart, side panel, and replay strip within the documented budget at wide and narrow boundaries. Controls remain keyboard reachable and keep 36px desktop / 44px coarse-pointer hit boxes. CSS tests assert the class hooks and state selectors used by the real JSX.

## Task 3 — Drawing interaction contract: staged preview, Text price anchor, selection pulse, and RR 1:1

**Files allowed:** `app/components/chart/drawing-canvas.tsx`, `app/components/chart/drawing-canvas.creation.test.tsx`, `app/components/chart/drawing-canvas.selection.test.tsx`, `app/components/chart/drawing-canvas.labels.test.tsx`, and focused chart geometry tests if needed. Do not edit review preview CSS.

**Behavior:** Ensure first-point drawing gestures remain in a live preview until the confirming release/click; selection is visible immediately with persistent outline/handles and a one-shot pulse; pointer cursors distinguish move, resize, and anchor gestures; Text selects a revealed bar/price first, then places a movable card with a visible connector; the card can be edited, expanded, collapsed, or cancelled without blocking chart movement; new RR objects create a valid 1:1 target while preserving existing custom anchors.

**Acceptance:** Add failing interaction tests for click/drag/cancel, pointer cursor state, Text anchor/card independence, and default RR ratio. Run the real canvas test suite and inspect the rendered overlay in a browser state with selected and focused controls.

## Task 4 — Integration, public-component decision, and acceptance evidence

**Files allowed:** coordinator-owned integration edits across the files above only when a task review identifies a real seam, plus `.scratch/review-visual-baseline-plan-20261011/DESIGN-COVERAGE.md`, `CONTROL-AUDIT-SCOPE.md`, new `FINAL-ACCEPTANCE.md`, `issues/*.md`, and screenshot/evidence files.

**Behavior:** Integrate accepted slices, resolve regressions, and document which existing primitives remain public (`RecallWorkspace`, `DrawingToolbar`, `DrawingCanvas`, `DrawingLayersPanel`) versus preview-only CSS. Run functional, state/persistence, and visual gates independently. Update coverage, control audit, and issue states with PASS/FAIL/NOT VERIFIED rather than inferred scores.

**Acceptance:** Fresh browser URL remains running; coordinator directly performs the core journey and control audit; an independent reviewer directly compares screenshots to the supplied references; all unresolved in-scope failures remain explicit and block a completion claim.

## Verification commands

Run in this order, saving output under the SDD ledger/evidence directory:

1. `npm ci` (only to provision the missing local dependencies).
2. Scoped Vitest tests for the task being changed.
3. `npm run typecheck` and `npm run lint`.
4. `npm run build`.
5. Browser service with the project’s documented start command and an explicit isolated `TRADEREVIEW_DB_PATH`; fresh browser checks at the required viewports and states.

Do not claim visual PASS from unit tests, HTTP success, or a worker report. The final report must include the preview URL, service command, screenshots, version-bound control coverage, and all NOT VERIFIED items.
