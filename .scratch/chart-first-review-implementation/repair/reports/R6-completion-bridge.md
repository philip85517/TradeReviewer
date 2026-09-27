# R6 completion bridge

2026-09-26. Scoped implementation report for E20 / US29–US30. The completion
bridge is frozen for coordinator integration; root still owns the final build,
browser journey, and acceptance record.

## Problem and contract

Recall formal completion is authoritative for whether an episode is reviewed.
The legacy `reviews.review_json` record remains the source for legacy plan,
psychology, tags, and other review fields. A pending working draft does not
count as completed, and a later draft after a formal completion cannot clear
that completion. A failed finalization must not create it.

The defect reported in `R6-astra-acceptance.md` was that `getReviews()` only
returned non-null legacy `review_json` values. Episode 999996 had a completed
formal Recall document but a cursor/drawings row with `review_json = NULL`, so
bootstrap, the library, queue, and dashboard all reported it as pending.

## Implementation

- `app/lib/storage/recall-completion-bridge.ts` projects only the effective
  `review.completed` bit and creates an empty legacy-shaped record only when a
  completed formal document has a resolvable episode instrument. Existing
  legacy fields and an existing legacy completed bit are preserved.
- `app/lib/storage/sqlite-store.ts` derives completed formal Recall documents
  in the read path used by `getReviews()`, `getReview()`, and `getBootstrap()`.
  Internal compare-and-write paths deliberately continue to read the raw
  legacy record, so the projection cannot overwrite or downgrade stored
  review data. The formal timestamp is taken from the finalized document.
- `app/components/recall/recall-workspace.tsx` exposes
  `onFormalCompletion` and calls it only after the server accepts the formal
  save. Failed saves never invoke it.
- `app/components/trade-review-workspace.tsx` consumes that callback through
  the same bridge, updating the in-memory episode review map immediately.
  Reload then obtains the same effective record through `getBootstrap()`.

## Evidence and coverage

The completion bridge test creates a fresh `mkdtemp` directory under the OS
temporary directory for every test. It sets `TRADEREVIEW_DB_PATH` only to that
owned file while setup runs, restores the caller's original environment in
teardown, and removes only its own temporary directory. An externally supplied
database path is never opened or deleted.

The first red run of
`app/lib/storage/recall-completion-bridge.test.ts` reproduced the Astra
failure: a finalized Recall returned no bootstrap review, an existing legacy
review stayed incomplete, and a formal completion followed by a draft returned
no effective review. After the bridge, the same test is green with 7/7 tests:

1. finalized Recall appears as reviewed in bootstrap, library counts, queue,
dashboard, and after closing/reopening SQLite;
2. legacy plan and psychology fields survive the formal projection;
3. a preexisting legacy completed review remains completed;
4. an unfinalized draft remains pending;
5. failed finalization leaves no completed projection;
6. a later autosaved draft preserves formal completion;
7. legacy compare-and-write remains independent from the formal projection.

The callback journey is covered by
`app/components/recall/recall-integration.recall-review.test.tsx`, which
confirms the parent callback fires once with a completed document only after
the repository save resolves, and is not called when formal save rejects.

Commands and results:

```text
PATH=/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH \
npm run test:unit -- app/lib/storage/recall-completion-bridge.test.ts
Test Files  1 passed (1)
Tests       7 passed (7)

PATH=/Users/zhoulin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH \
npm run test:unit -- app/components/recall/recall-integration.recall-review.test.tsx
Test Files  1 passed (1)
Tests       37 passed (37)
```

Coordinator browser evidence already available for the integrated reload is
`repair/reports/R6-library-reload-pass.png`: episode 999996 shows 1/1 reviewed
with zero pending after reload. The original failing screenshot remains
`repair/reports/R6-library-status-fail.png`; the formal reopen evidence is
`repair/reports/R6-reopened-final-1440.png`.

## Boundary

This worker report does not sign overall R6 acceptance. Root must run the
final type/build/runtime checks and independently verify the immediate
finalize-to-library journey against the integrated worktree before updating
`DESIGN-COVERAGE.md` and the final acceptance record. No full suite, browser
run, build, commit, or product database write was performed by this worker.
