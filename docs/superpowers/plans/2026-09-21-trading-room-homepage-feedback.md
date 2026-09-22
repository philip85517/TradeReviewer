# Trading Room Homepage Feedback Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the approved `trading-room-homepage-feedback-20260921` specification so the trading-room homepage has a clear top-right scope control, an actionable custom period editor, a compact unified performance block, readable trend/calendar details, and diagnosable holding states.

**Architecture:** Keep the existing unified `RoomScope`, trading-room calendar model, holdings model, and data-management callbacks as the authoritative seams. Adjust the dashboard composition and CSS, add only the small presentation fields needed for point/calendar/holding explanations, and verify the result through component tests plus real-browser geometry checks.

**Tech Stack:** React 19, TypeScript, CSS Modules, Vitest, Testing Library, local SQLite preview data, Codex in-app browser.

**Spec:** `docs/specs/2026-09-21-trading-room-homepage-feedback.md`

## Global Constraints

- Keep the page simple, focused, and clear; do not add a new route, chart library, provider, or financial algorithm.
- Preserve the existing unified range semantics, live/simulation isolation, trusted closed-episode rules, FX snapshot rules, and unknown-data diagnostics.
- Unknown values must not be converted to zero; negative positions must not be normalized away.
- Visible amounts, counts, and percentages use at most two decimal places without changing calculation precision.
- Use the existing isolated worktree and preserve all pre-existing uncommitted changes.
- Browser writes or retries use an isolated SQLite copy; do not modify the protected source database.
- Do not push, merge, or publish.

## Review Focus

- The `当前持仓` control must be a view/anchor action, not a third financial nature; its test lives in the dashboard integration task.
- `更多期间` must reveal an actionable date editor and preserve the last valid scope on cancel or invalid drafts; its test lives in the dashboard integration task.
- Visual merging must not duplicate or desynchronize summary and trend ranges; its test lives in the composition task.
- Missing, stale, future, currency-mismatched, and unsupported quotes must remain distinct from valid negative/short positions; its tests live in the holdings task.
- A chart point must remain readable at 1280px and 320px without stretched SVG labels or hidden-only details; its tests and browser checks live in the performance task.

---

### Task 1: Rebuild the homepage scope control row

**Files:**
- Modify: `app/components/dashboard/review-dashboard.tsx`
- Modify: `app/components/dashboard/review-dashboard.module.css`
- Test: `app/components/dashboard/review-dashboard.test.tsx`
- Modify: `.scratch/trading-room-homepage-feedback-20260921/issues/01-homepage-feedback-fixes.md`

**Interfaces:**
- Consumes: existing `RoomScope`, `updateRoomScope`, `updateRoomPeriod`, `roomPeriodError`, and the existing `RoomHoldingsPanel` section.
- Produces: top-right buttons `实盘`, `模拟盘`, `当前持仓`; a visible custom-period editor with apply/cancel behavior; a `市场分类` combobox with no `未知资产类型` option; a stable `id` for the current-holdings target.

- [ ] **Step 1: Write the failing tests.** Add dashboard behavior tests that assert:
  - the scope header exposes `实盘` and `模拟盘` as pressed-state controls and `当前持仓` as a separate action with `aria-controls` pointing to the holdings target;
  - the main combobox is labelled `交易室市场分类` and does not expose `未知资产类型` as an option while the room still reports unknown data in its diagnostic text;
  - clicking `更多期间` immediately exposes start/end date inputs, applying a valid range changes the scope summary, cancelling leaves the previous range unchanged, and an invalid draft leaves the previous range unchanged with an error.

- [ ] **Step 2: Run the focused tests and verify they fail for the intended missing behavior.**

  Run: `npx vitest run app/components/dashboard/review-dashboard.test.tsx --maxWorkers=1 --reporter=verbose`

  Expected: FAIL because the current controls still render `交易性质` in the filter grid, label the combobox `交易室分类`, and only expose custom date inputs through the collapsed advanced area.

- [ ] **Step 3: Implement the minimal control restructuring.** Move the live/simulation buttons into the scope heading, add a current-holdings focus action with a stable target id, rename the category label, filter the visible category options, and add local custom-period draft/apply/cancel state without changing `RoomScope` or its date-range model.

- [ ] **Step 4: Implement the layout contract.** Use one top-label/control structure for the remaining filter controls, keep the scope header controls aligned at the right on desktop, stack them without overflow on narrow screens, and make the custom date editor occupy the same scope control area.

- [ ] **Step 5: Run the focused tests and verify they pass.**

  Run: `npx vitest run app/components/dashboard/review-dashboard.test.tsx --maxWorkers=1 --reporter=verbose`

- [ ] **Step 6: Run typecheck for the changed dashboard seam.**

  Run: `npm run typecheck`

### Task 2: Merge the performance presentation and reduce card density

**Files:**
- Modify: `app/components/dashboard/review-dashboard.tsx`
- Modify: `app/components/dashboard/review-dashboard.module.css`
- Modify: `app/components/dashboard/room-performance.tsx`
- Modify: `app/components/dashboard/room-performance.module.css`
- Test: `app/components/dashboard/review-dashboard.test.tsx`
- Test: `app/components/dashboard/room-performance.test.tsx`

**Interfaces:**
- Consumes: the existing summary values, `RoomPerformance` props, and `RoomMoneyView` formatting helpers.
- Produces: one visually unified performance block; compact card detail with the full detail retained as an accessible title/description; no duplicate range/cumulative summary line when `RoomPerformance` is embedded.

- [ ] **Step 1: Write the failing tests.** Add assertions that the dashboard has one visible performance block containing the summary and trend regions, that the net-P&L card exposes a short readable detail while retaining the full detail for assistive/hover access, and that embedded performance does not render a second cumulative-summary line.

- [ ] **Step 2: Run the focused tests and verify they fail for the intended missing behavior.**

  Run: `npx vitest run app/components/dashboard/review-dashboard.test.tsx app/components/dashboard/room-performance.test.tsx --maxWorkers=1 --reporter=verbose`

- [ ] **Step 3: Add an `embedded`/summary-visibility presentation option to `RoomPerformance` and compose it inside the dashboard performance block.** Keep the model and callbacks unchanged; only remove duplicate visual chrome when embedded.

- [ ] **Step 4: Shorten the visible metric-card detail and preserve the full string through accessible metadata.** Apply a two-line clamp and consistent card heights, without removing the underlying currency/period information.

- [ ] **Step 5: Update the shared CSS so the summary cards, view tabs, trend, and calendar share one border/background and have a single left alignment.** Keep the current holdings outside this block.

- [ ] **Step 6: Run the focused tests and verify they pass.**

  Run: `npx vitest run app/components/dashboard/review-dashboard.test.tsx app/components/dashboard/room-performance.test.tsx --maxWorkers=1 --reporter=verbose`

### Task 3: Make trend points and calendar cells readable

**Files:**
- Modify: `app/components/dashboard/room-performance.tsx`
- Modify: `app/components/dashboard/room-performance.module.css`
- Modify: `app/lib/reviews/trading-room-calendar.ts`
- Test: `app/components/dashboard/room-performance.test.tsx`
- Test: `app/lib/reviews/trading-room-calendar.test.ts`

**Interfaces:**
- Consumes: existing `TradingRoomTrendPoint`, `TradingRoomCalendarCell`, and `RoomMoneyView` fields.
- Produces: selectable/focusable trend points with visible point details; calendar cells with reliable net P&L, trusted sample, and win/loss/胜率 presentation fields; no new odds or return algorithm.

- [ ] **Step 1: Write the failing tests.** Add tests that click or focus a trend point and find its period/cumulative values without opening a hidden details disclosure; add calendar model/component tests for win/loss counts and a percentage only when its denominator is valid, with an unavailable label otherwise.

- [ ] **Step 2: Run the focused tests and verify they fail for the intended missing behavior.**

  Run: `npx vitest run app/components/dashboard/room-performance.test.tsx app/lib/reviews/trading-room-calendar.test.ts --maxWorkers=1 --reporter=verbose`

- [ ] **Step 3: Extend only the calendar presentation model needed to expose reliable win/loss/denominator data.** Keep the existing trusted-row and FX rules; do not introduce odds or a new percentage denominator.

- [ ] **Step 4: Render each SVG point as an accessible focusable control or paired button overlay, with a selected-point detail region containing period money, cumulative money, sample, wins/losses, and coverage dates.** Preserve the existing details list as a fallback.

- [ ] **Step 5: Correct chart geometry.** Keep axis labels outside the SVG plot, preserve the plot aspect ratio, reserve space for labels, show a zero baseline, and prevent labels/details from being compressed at narrow widths.

- [ ] **Step 6: Render calendar cell secondary information using a stable order and contrast.** Show amount first, sample/win-rate second, and explicit unavailable/future text where appropriate.

- [ ] **Step 7: Run the focused tests and verify they pass.**

  Run: `npx vitest run app/components/dashboard/room-performance.test.tsx app/lib/reviews/trading-room-calendar.test.ts --maxWorkers=1 --reporter=verbose`

### Task 4: Diagnose holdings and quote states in the existing data-management flow

**Files:**
- Modify: `app/lib/reviews/trading-room-holdings.ts`
- Modify: `app/components/dashboard/room-holdings.tsx`
- Modify: `app/components/dashboard/room-holdings.module.css`
- Test: `app/lib/reviews/trading-room-holdings.test.ts`
- Test: `app/components/dashboard/room-holdings.test.tsx`

**Interfaces:**
- Consumes: existing position ledger, quote normalization, `statusReason`, quality callbacks, and `onOpenInReview`.
- Produces: explicit holding direction/diagnostic labels and actions for missing, stale, future, invalid, currency-mismatched, and unsupported quotes, while preserving negative quantities and existing review navigation.

- [ ] **Step 1: Write the failing model tests.** Cover a known short/negative position, unknown direction or quantity evidence, stale quote, quote before latest execution, quote currency mismatch, and invalid/missing quote. Assert each status remains distinct and no unavailable state produces a P&L number.

- [ ] **Step 2: Run the model tests and verify they fail for the missing diagnostic/direction fields.**

  Run: `npx vitest run app/lib/reviews/trading-room-holdings.test.ts --maxWorkers=1 --reporter=verbose`

- [ ] **Step 3: Add minimal derived display fields to the holdings model.** Keep the numeric quantity untouched; derive a direction label only from known evidence, and normalize the reason/action category from the existing quote and position statuses.

- [ ] **Step 4: Update holding rows to show a short status badge/reason and a direct existing data-management action where one is available.** Keep provider/date details in an expandable or secondary area, preserve review navigation, and do not add a new repair API.

- [ ] **Step 5: Add component tests for visible short/needs-check labels, actionable quote reasons, and unchanged review callbacks.**

- [ ] **Step 6: Run model and component tests and verify they pass.**

  Run: `npx vitest run app/lib/reviews/trading-room-holdings.test.ts app/components/dashboard/room-holdings.test.tsx --maxWorkers=1 --reporter=verbose`

### Task 5: Integrate, review, and browser-verify the feature

**Files:**
- Modify: `.scratch/trading-room-homepage-feedback-20260921/issues/01-homepage-feedback-fixes.md`
- Modify: `.scratch/trading-room-homepage-feedback-20260921/README.md`
- Create: `.scratch/trading-room-homepage-feedback-20260921/verification.md`

- [ ] **Step 1: Run the related dashboard/model test set.**

  Run: `npx vitest run app/components/dashboard/review-dashboard.test.tsx app/components/dashboard/room-performance.test.tsx app/components/dashboard/room-holdings.test.tsx app/lib/reviews/trading-room-calendar.test.ts app/lib/reviews/trading-room-holdings.test.ts --maxWorkers=2 --reporter=verbose`

- [ ] **Step 2: Run repository verification.**

  Run: `npm run typecheck`, `npm run build`, and `git diff --check`.

- [ ] **Step 3: Start a preview from this worktree with an isolated SQLite database and verify ownership.** Use an available loopback port, wait for the page/data load, and keep the service running for review.

- [ ] **Step 4: In a real browser, verify 1280px and 1440px desktop states.** Check top-right control placement, filter label/control top alignment within 2px, visible custom-period expansion, one unified performance block, chart axis/point detail, calendar text, and holdings diagnostics.

- [ ] **Step 5: In a real browser, verify 390px and 320px narrow states.** Check no page horizontal overflow, no control overlap, readable point detail, usable date editor, and visible holding reason/action.

- [ ] **Step 6: Check browser console errors, compare source-data counts before/after, and record commands, port, isolated DB path, viewport results, warnings, and remaining limitations in `verification.md`.**

- [ ] **Step 7: Independently review the final diff against the spec.** Fix any Critical/Important issue with a new RED→GREEN test cycle before marking the task complete; leave unrelated existing modifications untouched.

