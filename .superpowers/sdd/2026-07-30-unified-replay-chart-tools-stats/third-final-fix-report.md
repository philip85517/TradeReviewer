# Third final remediation report

Date: 2026-07-30

Base commit: `dcb8c78b1fa983a5b713ae72a7cd22ca4477946a`

## Scope

This follow-up fixes only the verified import-time episode-selection regression.
The prior seven remediation findings and unified review workspace behavior are
unchanged.

## Root-cause evidence

`confirmImport()` builds the correct merged summaries, calls
`selectImportedSummary(firstImported)`, and immediately starts automatic market
data synchronization. The selection helper queues `selectedEpisodeId` for the
newest merged episode, but React has not rerendered before
`startMarketDataUpdate()` runs. For the already selected instrument, that
function therefore reads the previous episode ID from its closure and chooses
the old episode's intraday window. No later automatic request corrects it.

Manual refresh does not have this problem because it runs after the selection
rerender. Non-selected instruments already defaulted to their newest episode.

## TDD red/green

### RED

Added a workspace integration test that:

1. loads a currently selected XPEV instrument with a closed Jan 2 episode;
2. uploads and confirms a real XLSX workbook containing a later closed Jan 6
   episode for the same instrument;
3. inspects the automatic intraday request produced by the import flow.

Command:

`npm run test:unit -- --run app/components/trade-review-workspace.test.tsx -t "automatically syncs a newly imported later episode"`

The probe failed on the intended boundary:

- expected start: `2024-12-30T14:30:00.000Z` (Jan 6 episode context)
- received start: `2024-12-26T14:30:00.000Z` (Jan 2 episode context)

### GREEN

`startMarketDataUpdate()` now accepts optional explicit episode IDs by
instrument. `confirmImport()` derives the newest episode from its already
computed merged summaries for every automatically synchronized instrument and
passes those IDs into the same-tick request. Manual callers omit the override
and retain selected-episode behavior.

Focused results:

- exact import regression: PASS, 1/1
- complete workspace integration file: PASS, 25/25

## Full verification

- `npm run test:unit` — PASS, 56 files / 323 tests
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npm run build` — PASS
- `npm test` — PASS, production build plus 2/2 rendered-HTML tests
- `git diff --check` — PASS
- built app smoke — PASS, `GET http://127.0.0.1:4318/` returned HTTP 200
  with a 92,327-byte response

The build retains the pre-existing informational client-chunk size warning.
Interactive browser QA is unavailable in this environment and is not claimed.

## Self-review

The complete diff from the base commit contains only:

- the real-workbook import integration regression and its test-only workbook
  fixture;
- an optional per-instrument episode override at the market-update boundary;
- import confirmation deriving those overrides from the merged summaries.

Manual refresh still uses the current selected episode, automatic sync for all
imported instruments uses their newest merged episode, open/closed window
calculation remains centralized in `episodeIntradaySyncRange()`, and typed
provider failure propagation is untouched. No existing assertion was weakened
or removed.
