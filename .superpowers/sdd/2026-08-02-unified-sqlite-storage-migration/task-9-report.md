# Task 9 report — SQLite production storage boundary

Base commit: `5f0897a`

## Delivered

- Added a storage-boundary regression suite that renders an empty SQLite
  bootstrap without legacy reads, drives a real import and chart-settings save
  through a successful SQLite client while asserting no legacy browser writes,
  and prevents normal production imports of legacy browser persistence modules.
- The import-library boundary permits only the pure `mergeExecutions` value
  import (or type-only imports) outside migration/test modules; a forbidden
  `saveImportedExecutions` import is an explicit regression case.
- Marked the retired localStorage/IndexedDB modules and the browser exporter
  explicitly `MIGRATION-ONLY`. The exporter is the production migration
  boundary; the remaining browser write helpers are retained only for isolated
  legacy tests.
- Updated rendered production HTML coverage for the SQLite loading boundary and
  strengthened the assertion that XPEV/demo content is absent.
- Added the unified SQLite rollout runbook, including exact same-root deploy,
  status, backup, migration report, checksum, bind-mount, and restart checks.

## Verification

```text
npm run test:unit -- app/lib/storage/storage-boundary.test.tsx
npm run test:unit -- app/lib/storage
npm run test:unit -- app/lib/storage/storage-boundary.test.tsx app/components/trade-review-workspace.test.tsx app/components/trade-review-workspace.import-flow.test.tsx
npm test
npm run typecheck
npm run lint
```

All commands passed before commit.

Rendered HTML is a Node test and is therefore covered by `npm test`, not the
Vitest unit-test command.
