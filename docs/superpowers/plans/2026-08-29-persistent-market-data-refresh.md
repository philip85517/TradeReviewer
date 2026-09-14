# Persistent Market Data and One-Click Refresh Implementation Plan

## Goal

Keep imported trades and market-data cache in SQLite, make daily and supported
15-minute refreshes reliable under public-provider limits, and add one-click
refresh for every persisted instrument.

## Confirmed decisions

- SQLite remains the single source of truth. Imported execution facts are not
  rewritten by a market refresh.
- “Update all” means refresh instrument metadata and market candles for every
  imported instrument, using the existing trade-derived date ranges.
- Refreshes are queued with bounded concurrency and retry only for transient
  provider failures; existing candles remain available if a refresh fails.
- The UI reports per-instrument progress and keeps failed instruments
  retryable.

## Implementation order

1. Add failing tests for persistent round trips, provider request/error
   behavior, bounded batch execution, and the new UI action.
2. Fix provider parsing/request behavior and centralize retry/backoff policy.
3. Extract a reusable market-refresh queue and route all single/all refreshes
   through it so imports no longer fan out unbounded requests.
4. Add the sidebar “更新全部行情” action, progress summary, and retry-failed
   action without changing execution records.
5. Run unit tests, typecheck, lint, build, and local runtime/API smoke tests.

## Acceptance criteria

- A new SQLite connection reads the same executions, instruments, candles,
  coverage, and job status after writes.
- A provider response with an empty or history-limited intraday window is
  classified as partial/history-limited instead of a misleading format error.
- A batch of instruments never starts more than the configured number of
  provider jobs at once and transient failures are retried with backoff.
- One click updates every imported instrument, displays completed/failed
  counts, and permits retrying only failures.
- Existing cache is not deleted or overwritten by a failed provider request.
