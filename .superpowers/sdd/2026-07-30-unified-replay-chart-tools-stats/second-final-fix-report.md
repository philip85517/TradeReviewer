# Second final remediation report

Date: 2026-07-30

Base commit: `cf46d695bb13a1ebdf6bc4b9206da53f60c38c65`

## Scope

This wave addressed only the seven residual findings in the second final
remediation brief. No new product capability was added, and the unified review
workspace was preserved.

## Systematic diagnosis and TDD evidence

### 1. Demo completed-bar knowledge

- Root cause: generated demo candles stored only their bar-start `time`, and
  the server provider used that value for cursor indexing, slicing, and
  navigation. This published the final OHLCV before the bar completed and
  snapped raw restore cursors to candle starts.
- RED:
  `npm run test:unit -- --run app/lib/demo/server-replay-provider.test.ts`
  failed because a restore at `2025-01-02T14:44:59.999Z` returned cursor
  `14:30` and exposed the 14:30 candle.
- Fix: demo candles now retain bar-start `time` and carry a separate
  15-minute `knowledgeAt`. Restore preserves valid raw cursors, while
  publication and candle navigation use completion knowledge.
- GREEN: the focused demo and imported replay run passed, 6/6 tests.

### 2. Raw imported cursor before the first completed candle

- Root cause: imported replay clamped every stored cursor to the latest
  completed candle. A raw cursor at 10:07 therefore became 10:15, causing
  `nextExecution()` to skip a 10:12 fill.
- RED:
  `npm run test:unit -- --run app/lib/replay/imported-replay.test.ts -t
  'preserves a raw cursor'` expected 10:07 and received 10:15.
- Fix: replay knowledge cursor is now independent of visible-candle
  selection. Navigation compares parsed timestamps against the raw cursor.
- GREEN: the focused demo and imported replay run passed, 6/6 tests.

### 3. Episode-bounded intraday synchronization and typed failures

- Root causes:
  - `marketRanges(summary)` derived both daily and intraday requests from the
    instrument-wide 400-day daily lookback.
  - the intraday service mapped every non-history HTTP failure to
    `source-unavailable` and threw malformed successful responses, after which
    the workspace also flattened rejection identity.
- RED:
  - the workspace probe requested intraday data from
    `2023-11-29T00:00:00.000Z` instead of the selected episode's
    `2024-12-30T14:30:00.000Z`;
  - three synchronization probes showed malformed 200 responses throwing and
    rate-limit/forbidden responses returning `source-unavailable`.
- Fix:
  - daily synchronization retains its summary range, while intraday requests
    use the selected episode's seven-day context and required final bar;
    switching episodes recomputes the request, and open episodes use the
    existing latest-completed-session calculation;
  - `invalid-response`, `source-rate-limited`, and `source-forbidden` now flow
    through coverage, sync result, persisted job validation, availability
    messaging, and UI status labels. Security-relevant echoed-request identity
    mismatches continue to reject before persistence.
- GREEN: all 13 intraday service tests passed; the selected/switching episode
  workspace probe passed with exact start/end assertions.

### 4. Newest-revision-wins autosave persistence

- Root cause: revision checks surrounded `await onSave`, but both revisions had
  already entered the persistence callback. IndexedDB `put` unconditionally
  replaced the record, so an older delayed write could land last.
- RED:
  `npm run test:unit -- --run
  app/components/review/use-episode-review-autosave.test.tsx -t
  'keeps the newest concurrent save'` forced N+1 to persist before N and found
  the repository contained `older draft`.
- Fix: saves receive a monotonic per-identity `updatedAt`; the repository
  compares the current record and candidate inside one read/write transaction
  and rejects stale writes. Workspace visible state changes only after an
  accepted write and also guards against an older visible timestamp.
- GREEN: autosave, review repository, and review metric focused suites passed,
  20/20 tests, including switch/unmount retention coverage.

### 5. Missing source bar inside one aggregation bucket

- Root cause: every source candle with the same session bucket key was sent to
  a single `aggregateGroup`, without checking 15-minute timestamp continuity.
- RED:
  `npm run test:unit -- --run app/lib/market/aggregate.test.ts -t
  'splits one US hourly bucket'` returned two candles and combined
  14:30/14:45/15:15; the exact probe expected three independently asserted
  OHLCV/knowledge segments.
- Fix: each native intraday bucket is split into contiguous 15-minute runs
  before aggregation. Existing session, timezone, lunch-break, DST, and
  completion-knowledge logic remains in place.
- GREEN: all 13 aggregation tests passed.

### 6. Historical planned-risk validation

- Root cause: autosave validated only `candidate.plan.plannedRiskAmount`; a
  rewind edit lived in `planRevisions` while the valid latest plan remained at
  the top level.
- RED: historical `-1` and `0` probes both called `onSave`.
- Fix: validation covers the top-level compatibility plan and every persisted
  plan revision.
- GREEN: both historical probes reject without persistence; the combined
  autosave/repository/metrics run passed 20/20 tests.

### 7. Contained compact risk/reward labels

- Root cause: the canvas emitted the full formatter output in one unmeasured,
  unclamped `fillText`, and did not render entry, stop, or target explicitly.
- RED:
  `npm run test:unit -- --run app/components/chart/drawing-canvas.test.tsx -t
  'renders complete risk/reward values'` observed one text call rather than a
  stacked presentation.
- Fix: the drawing now emits measured lines for entry, stop, target, risk and
  reward distances, R multiple, localized risk/reward amounts, and quantity.
  The shared X position and first Y position are clamped against canvas bounds.
- GREEN: all 23 drawing-canvas tests passed, including complete-value and
  coordinate containment assertions at 180×150.

## Focused integration verification

The combined affected-file run passed:

- 9 test files
- 99 tests
- 0 failures

## Full verification

- `npm run test:unit` — PASS, 56 files / 322 tests
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run build` — PASS
- `npm test` — PASS, production build plus 2/2 rendered-HTML tests
- `git diff --check` — PASS
- built app smoke — PASS, `GET http://127.0.0.1:4317/` returned HTTP 200
  with a 92,327-byte response

The build retains the pre-existing informational client-chunk size warning.
Interactive browser QA is unavailable in this environment and is not claimed.
