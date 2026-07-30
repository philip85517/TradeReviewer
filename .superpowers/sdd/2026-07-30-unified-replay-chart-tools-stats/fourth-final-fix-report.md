# Fourth final remediation report

Date: 2026-07-30

Base commit: `bddc3d84c760cfb257ce02a2a0de81d04a9a2844`

## Scope

This final follow-up fixes only the automatic import-sync admission gate for an
open-to-closed import that also creates a newer episode. The explicit
newest-episode override from `bddc3d8` is preserved unchanged.

## Root-cause evidence

`confirmImport()` previously admitted an imported instrument only when
`requiredRangeExpanded(previousRange, range)` returned true. That predicate is
appropriate for the instrument-wide daily range, but it is not sufficient for
the newly selected episode's intraday synchronization.

The real import counterexample is:

1. XPEV already contains a Jan 2 buy, so the episode and instrument position
   are open. Its required instrument range ends at the latest completed US
   session.
2. One workbook import supplies the Jan 2 closing sell and a separate closed
   Jan 6 buy/sell episode.
3. The merged instrument is closed, so its instrument-wide end is only 35
   calendar days after Jan 6. That end precedes the former open-position end,
   while the start is unchanged.
4. `requiredRangeExpanded()` therefore returns false, `automaticSyncIds`
   excludes XPEV, and `startMarketDataUpdate()` never runs. The correct Jan 6
   override from `bddc3d8` is never consumed.

The failure is at the admission gate, not in episode selection,
`episodeIntradaySyncRange()`, either synchronization service, or the explicit
per-instrument episode override.

## TDD red/green

### RED

Added a workspace integration regression that persists the real open Jan 2
execution, uploads and confirms a real XLSX workbook that closes Jan 2 and adds
the closed Jan 6 episode, and inspects the import flow's automatic intraday
request.

Command:

`npm run test:unit -- --run app/components/trade-review-workspace.test.tsx -t "automatically syncs a newer episode when the same import closes an open episode"`

Before the production change, the test failed at the intended boundary:

`AssertionError: expected "vi.fn()" to be called 2 times, but got 0 times`

That proves the merged import and confirmation completed, but the contracted
instrument range suppressed both immediate synchronization requests.

### GREEN

The admission predicate now retains the existing instrument-range expansion
rule and additionally admits an imported instrument when its newest merged
episode ID differs from its previous newest episode ID. Episode IDs are stable
from the opening execution, so an unchanged or duplicate import remains
excluded while a genuinely newer selected episode is synchronized.

No synchronization arguments or range builders changed. Once admitted, the
existing override still directs intraday synchronization to the exact newest
episode, while daily synchronization retains the complete instrument range.

Focused results:

- exact open-to-closed import regression: PASS, 1/1
- complete workspace integration file: PASS, 26/26
- existing closed-to-closed later-episode regression remains PASS

The exact request asserted by the new regression is:

- intraday start: `2024-12-30T14:30:00.000Z`
- intraday end: `2025-01-06T15:14:59.999Z`

## Full verification

- `npm run test:unit` — PASS, 56 files / 324 tests
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run build` — PASS
- `npm test` — PASS, production build plus 2/2 rendered-HTML tests
- `git diff --check` — PASS
- built app smoke — PASS, `GET http://127.0.0.1:4318/` returned HTTP 200
  with a 92,327-byte response

The build retains the pre-existing informational client-chunk size warning and
the test runtime retains its Node `module.register()` deprecation warning.

## Self-review

The scoped diff contains only:

- one real-workbook import-flow regression for the open-to-closed contraction;
- one additional clause in the existing automatic-sync admission predicate;
- this evidence report.

The gate is evaluated independently for every imported instrument, so
multi-instrument imports retain per-instrument admission and overrides. New
instruments and daily-range expansions retain their existing path. An unchanged
newest episode with no daily-range expansion remains excluded. The prior
closed-to-closed regression still exercises the explicit newest-episode
override. Daily synchronization still receives `marketRanges(summary).daily`;
intraday synchronization still receives `episodeIntradaySyncRange()` for the
explicit newest episode. Open/closed range calculation, manual refresh,
cache-first planning, typed provider failures, persistence, and abort behavior
are untouched. No existing assertion was weakened or removed.
